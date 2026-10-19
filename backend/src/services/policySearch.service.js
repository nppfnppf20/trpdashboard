/**
 * Policy Search Service
 * Hybrid retrieval over the company policy library: pgvector similarity plus Postgres
 * full-text, merged with reciprocal rank fusion. The keyword half matters for policies,
 * which are full of exact terms ("TOIL", "fit note", clause numbers) that embeddings
 * can blur. Only chunks of current, fully indexed documents are searched.
 * See docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md (Phase 3).
 */

import { pool } from '../db.js';
import { openaiClient } from './llm.shared.js';
import { EMBEDDING_MODEL } from './policyIndexer.service.js';

const CANDIDATES = 20; // taken from each of the two searches before merging
const RRF_K = 60;      // standard reciprocal-rank-fusion constant

const CHUNK_COLUMNS = `c.id AS chunk_id, c.document_id, d.title, d.version, d.category, d.effective_date,
  c.chunk_index, c.section_path, c.section_ref, c.page_start, c.page_end, c.content`;

const FROM_CURRENT_READY = `FROM company_documents.chunks c
  JOIN company_documents.documents d ON d.id = c.document_id
  WHERE d.is_current AND d.status = 'ready' AND (d.visibility = 'all' OR $2::boolean)
    AND ($3::int[] IS NULL OR d.folder_id = ANY($3::int[]))`;

// Free text -> an OR query of its words, so "how many days can I carry over" still matches a chunk
// containing "carried" or "days" without needing every word. Stop words are dropped by Postgres.
function toOrTsQuery(text) {
  const words = [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2))];
  return words.slice(0, 15).join(' | ');
}

/**
 * @param {string} query
 * @param {{ limit?: number, isAdmin?: boolean, folderIds?: number[] | null }} [opts] folderIds limits the search to those folders
 * @returns {Promise<object[]>} chunks, best first, each with vector_sim (0-1, or null) and score
 */
export async function searchPolicies(query, { limit = 8, isAdmin = false, folderIds = null } = {}) {
  const text = (query || '').trim();
  if (!text) return [];

  const embedding = (await openaiClient.embeddings.create({ model: EMBEDDING_MODEL, input: text })).data[0].embedding;
  const tsQuery = toOrTsQuery(text);

  const [vector, keyword] = await Promise.all([
    pool.query(
      `SELECT ${CHUNK_COLUMNS}, 1 - (c.embedding <=> $1::vector) AS vector_sim
       ${FROM_CURRENT_READY}
       ORDER BY c.embedding <=> $1::vector
       LIMIT ${CANDIDATES}`,
      [JSON.stringify(embedding), isAdmin, folderIds]
    ),
    tsQuery
      ? pool.query(
          `SELECT ${CHUNK_COLUMNS}
           ${FROM_CURRENT_READY} AND c.tsv @@ to_tsquery('english', $1)
           ORDER BY ts_rank_cd(c.tsv, to_tsquery('english', $1)) DESC
           LIMIT ${CANDIDATES}`,
          [tsQuery, isAdmin, folderIds]
        )
      : { rows: [] },
  ]);

  const merged = new Map();
  const add = (rows, withSim) =>
    rows.forEach((row, rank) => {
      const entry = merged.get(row.chunk_id) || { ...row, vector_sim: null, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      if (withSim) entry.vector_sim = Number(row.vector_sim);
      merged.set(row.chunk_id, entry);
    });
  add(vector.rows, true);
  add(keyword.rows, false);

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
