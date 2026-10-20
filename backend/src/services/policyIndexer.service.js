/**
 * Policy Indexer Service
 * Background indexing for the company policy library: download the stored original,
 * extract + chunk it, embed the chunks, and replace the document's rows in
 * company_documents.chunks. Jobs run one at a time through an in-process queue so a
 * batch of uploads doesn't hit the embeddings API all at once.
 * See docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md (Phase 2).
 */

import { pool } from '../db.js';
import { supabaseAdmin } from '../supabase.js';
import { openaiClient } from './llm.shared.js';
import { log } from '../utils/logger.js';
import { extractBlocks, chunkBlocks, embeddingText } from './policyChunker.service.js';

const BUCKET = 'company-policies';
export const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims — must match company_documents.chunks.embedding
const EMBED_BATCH = 100;

const active = new Set(); // document ids queued or running
let queue = Promise.resolve();

export const isIndexing = (id) => active.has(id);

/** Queue a document for (re)indexing. Returns false if it is already queued or running. */
export function queueIndexing(id) {
  if (active.has(id)) return false;
  active.add(id);
  queue = queue.then(async () => {
    try {
      await indexDocument(id);
    } finally {
      active.delete(id);
    }
  });
  return true;
}

/** Anything left "processing" at startup was interrupted by a restart — flag it so it can be re-indexed. */
export async function recoverInterruptedIndexing() {
  const { rowCount } = await pool.query(
    `UPDATE company_documents.documents
        SET status = 'failed', status_detail = 'Indexing was interrupted by a server restart. Use Re-index.', updated_at = NOW()
      WHERE status = 'processing'`
  );
  if (rowCount) log('warn', 'company policy indexing interrupted by restart', { documents: rowCount });
}

async function embedAll(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const res = await openaiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.slice(i, i + EMBED_BATCH),
    });
    vectors.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return vectors;
}

function friendlyError(err) {
  const status = err?.status;
  if (status === 401) return 'The OpenAI API key was rejected. Check OPENAI_API_KEY.';
  if (status === 429) return 'OpenAI rate limit or quota reached. Try Re-index again shortly.';
  return (err?.message || 'Indexing failed').slice(0, 300);
}

async function setFailed(id, detail) {
  await pool.query(
    `UPDATE company_documents.documents SET status = 'failed', status_detail = $2, updated_at = NOW() WHERE id = $1`,
    [id, detail]
  );
}

async function indexDocument(id) {
  const started = Date.now();
  try {
    const { rows } = await pool.query(
      `UPDATE company_documents.documents
          SET status = 'processing', status_detail = NULL, updated_at = NOW()
        WHERE id = $1 AND NOT display_only
      RETURNING title, version, storage_path`,
      [id]
    );
    if (!rows.length) return; // deleted while queued, or switched to display-only (never indexed)
    const { title, version, storage_path: storagePath } = rows[0];

    const { data: file, error: downloadError } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
    if (downloadError) throw new Error(`Could not read the stored file: ${downloadError.message}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    const ext = storagePath.split('.').pop().toLowerCase();
    const { blocks, warning } = await extractBlocks(buffer, ext);
    if (!blocks.length) return await setFailed(id, warning || 'No text could be extracted from this file.');

    const chunks = chunkBlocks(blocks);
    if (!chunks.length) return await setFailed(id, 'No indexable content was found in this file.');

    const vectors = await embedAll(chunks.map((chunk) => embeddingText({ docTitle: title, version, chunk })));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // If it was switched to display-only while this job ran, write nothing
      const flag = await client.query('SELECT display_only FROM company_documents.documents WHERE id = $1 FOR UPDATE', [id]);
      if (!flag.rows.length || flag.rows[0].display_only) {
        await client.query('ROLLBACK');
        return;
      }
      await client.query('DELETE FROM company_documents.chunks WHERE document_id = $1', [id]);
      for (const [i, c] of chunks.entries()) {
        await client.query(
          `INSERT INTO company_documents.chunks
             (document_id, chunk_index, section_path, section_ref, page_start, page_end,
              content, token_count, embedding, embedding_model)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10)`,
          [id, c.chunk_index, c.section_path, c.section_ref, c.page_start, c.page_end,
           c.content, c.token_count, JSON.stringify(vectors[i]), EMBEDDING_MODEL]
        );
      }
      const done = await client.query(
        `UPDATE company_documents.documents
            SET status = 'ready', status_detail = $2, chunk_count = $3, updated_at = NOW()
          WHERE id = $1`,
        [id, warning, chunks.length]
      );
      if (!done.rowCount) throw new Error('Document was deleted during indexing');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    log('info', 'company policy indexed', { id, chunks: chunks.length, ms: Date.now() - started });
  } catch (err) {
    log('error', 'company policy indexing failed', { id, message: err?.message });
    await setFailed(id, friendlyError(err)).catch(() => {});
  }
}
