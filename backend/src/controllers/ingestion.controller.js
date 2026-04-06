/**
 * Ingestion Controller
 * Handles document upload, topic management, review/confirm flow, and the timeline.
 */

import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { runIngestion, runSingleTopicIngestion } from '../services/llm.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Topics
// ─────────────────────────────────────────────────────────────────────────────

export async function getTopics(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, code, title, description, keywords, sort_order, created_at
       FROM issue_tracker.topics
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getTopics error:', err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
}

export async function createTopic(req, res) {
  const { projectId } = req.params;
  const { title, description, keywords } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const client = await pool.connect();
  try {
    // Auto-generate code: count existing topics to derive ISS-XX
    const { rows: existing } = await client.query(
      'SELECT COUNT(*) AS cnt FROM issue_tracker.topics WHERE project_id = $1',
      [projectId]
    );
    const nextNum = parseInt(existing[0].cnt, 10) + 1;
    const code = `ISS-${String(nextNum).padStart(2, '0')}`;

    const { rows } = await client.query(
      `INSERT INTO issue_tracker.topics (project_id, code, title, description, keywords, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [projectId, code, title.trim(), description ?? null, keywords ?? [], nextNum]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createTopic error:', err);
    res.status(500).json({ error: 'Failed to create topic' });
  } finally {
    client.release();
  }
}

export async function updateTopic(req, res) {
  const { topicId } = req.params;
  const { title, description, keywords } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE issue_tracker.topics
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           keywords = COALESCE($3, keywords),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title ?? null, description ?? null, keywords ?? null, topicId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topic not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateTopic error:', err);
    res.status(500).json({ error: 'Failed to update topic' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocuments(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         d.id, d.project_id, d.stage_instance_id, d.stage_label, d.filename,
         d.status, d.parse_warning, d.uploaded_at,
         psd.name AS stage_name,
         psd.user_guidance AS stage_user_guidance,
         ds.summary, ds.unmatched_content, ds.suggested_topics
       FROM issue_tracker.documents d
       LEFT JOIN admin_console.project_stage_instances psi ON psi.id = d.stage_instance_id
       LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       LEFT JOIN issue_tracker.document_summaries ds ON ds.document_id = d.id
       WHERE d.project_id = $1
       ORDER BY d.uploaded_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

export async function uploadDocument(req, res) {
  const { projectId } = req.params;
  const { stage_label, stage_instance_id } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Must have at least one topic defined before allowing upload
  const { rows: topicRows } = await pool.query(
    'SELECT id FROM issue_tracker.topics WHERE project_id = $1 LIMIT 1',
    [projectId]
  );
  if (!topicRows.length) {
    return res.status(400).json({ error: 'Define at least one topic before uploading documents' });
  }

  const client = await pool.connect();
  try {
    // Parse file
    const { text: rawText, warning: parseWarning } = await parseFile(req.file.buffer, req.file.originalname);

    // Create document record in processing state
    const { rows: docRows } = await client.query(
      `INSERT INTO issue_tracker.documents
         (project_id, stage_instance_id, stage_label, filename, raw_text, status, parse_warning)
       VALUES ($1, $2, $3, $4, $5, 'processing', $6)
       RETURNING id`,
      [
        projectId,
        stage_instance_id || null,
        stage_label || null,
        req.file.originalname,
        rawText,
        parseWarning || null
      ]
    );
    const documentId = docRows[0].id;

    // Fetch topics
    const { rows: topics } = await client.query(
      'SELECT id, code, title, description, keywords FROM issue_tracker.topics WHERE project_id = $1',
      [projectId]
    );

    // Fetch stage config (custom prompts) if a stage instance was specified
    let stageConfig = null;
    if (stage_instance_id) {
      const { rows: stageRows } = await client.query(
        `SELECT psd.llm_system_prompt, psd.llm_user_prompt_template, psd.user_guidance
         FROM admin_console.project_stage_instances psi
         JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
         WHERE psi.id = $1`,
        [stage_instance_id]
      );
      stageConfig = stageRows[0] ?? null;
    }

    // Determine if this is a preset-stage (has a stage with user_guidance = review required)
    // We treat any upload against a named stage as requiring review if user_guidance is set
    const isPresetStage = !!(stageConfig?.user_guidance);

    // Run LLM ingestion
    const { topicResults, documentSummary, unmatchedContent, suggestedTopics } =
      await runIngestion(rawText, topics, stageConfig);

    if (isPresetStage) {
      // Write to draft tables — user must confirm before data becomes permanent
      await client.query(
        `INSERT INTO issue_tracker.draft_document_summaries
           (document_id, summary, unmatched_content, suggested_topics)
         VALUES ($1, $2, $3, $4)`,
        [documentId, documentSummary, unmatchedContent, JSON.stringify(suggestedTopics)]
      );

      for (const r of topicResults) {
        await client.query(
          `INSERT INTO issue_tracker.draft_topic_summaries
             (document_id, topic_id, summary, sentiment, source_quote, confidence, mentioned)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [documentId, r.topic_id, r.summary, r.sentiment, r.source_quote, r.confidence, r.mentioned]
        );
      }

      await client.query(
        `UPDATE issue_tracker.documents SET status = 'awaiting_review', updated_at = NOW() WHERE id = $1`,
        [documentId]
      );

      const draft = await getDraftData(client, documentId);
      return res.status(201).json({ documentId, status: 'awaiting_review', draft, parseWarning });
    }

    // Standard ingestion — write directly to permanent tables
    await client.query(
      `INSERT INTO issue_tracker.document_summaries
         (document_id, summary, unmatched_content, suggested_topics)
       VALUES ($1, $2, $3, $4)`,
      [documentId, documentSummary, unmatchedContent, JSON.stringify(suggestedTopics)]
    );

    for (const r of topicResults) {
      await client.query(
        `INSERT INTO issue_tracker.topic_summaries
           (document_id, topic_id, summary, sentiment, source_quote, confidence, mentioned)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [documentId, r.topic_id, r.summary, r.sentiment, r.source_quote, r.confidence, r.mentioned]
      );
    }

    await client.query(
      `UPDATE issue_tracker.documents SET status = 'complete', updated_at = NOW() WHERE id = $1`,
      [documentId]
    );

    res.status(201).json({ documentId, status: 'complete', parseWarning });
  } catch (err) {
    console.error('uploadDocument error:', err);
    // Mark document as errored if it was created
    // (best-effort — ignore secondary failure)
    await pool.query(
      `UPDATE issue_tracker.documents SET status = 'error', updated_at = NOW() WHERE id = $1 AND status = 'processing'`,
      [err._documentId]
    ).catch(() => {});
    res.status(500).json({ error: 'Ingestion failed', detail: err.message });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Review / Confirm
// ─────────────────────────────────────────────────────────────────────────────

async function getDraftData(client, documentId) {
  const [docSummary, topicSummaries] = await Promise.all([
    client.query(
      'SELECT * FROM issue_tracker.draft_document_summaries WHERE document_id = $1',
      [documentId]
    ),
    client.query(
      `SELECT dts.*, t.code, t.title
       FROM issue_tracker.draft_topic_summaries dts
       JOIN issue_tracker.topics t ON t.id = dts.topic_id
       WHERE dts.document_id = $1
       ORDER BY t.sort_order, t.id`,
      [documentId]
    )
  ]);
  return {
    document_summary: docSummary.rows[0] ?? null,
    topic_summaries: topicSummaries.rows
  };
}

export async function getDraft(req, res) {
  const { documentId } = req.params;
  const client = await pool.connect();
  try {
    const { rows: doc } = await client.query(
      `SELECT d.*, psd.user_guidance AS stage_user_guidance, psd.name AS stage_name
       FROM issue_tracker.documents d
       LEFT JOIN admin_console.project_stage_instances psi ON psi.id = d.stage_instance_id
       LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       WHERE d.id = $1`,
      [documentId]
    );
    if (!doc.length) return res.status(404).json({ error: 'Document not found' });
    if (doc[0].status !== 'awaiting_review') {
      return res.status(400).json({ error: 'Document is not awaiting review' });
    }

    const draft = await getDraftData(client, parseInt(documentId, 10));
    res.json({ document: doc[0], ...draft });
  } catch (err) {
    console.error('getDraft error:', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  } finally {
    client.release();
  }
}

export async function confirmDocument(req, res) {
  const { documentId } = req.params;
  const { topic_summaries, document_summary } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document is in the right state
    const { rows: doc } = await client.query(
      `SELECT status FROM issue_tracker.documents WHERE id = $1 FOR UPDATE`,
      [documentId]
    );
    if (!doc.length) throw Object.assign(new Error('Document not found'), { status: 404 });
    if (doc[0].status !== 'awaiting_review') {
      throw Object.assign(new Error('Document is not awaiting review'), { status: 400 });
    }

    // Write confirmed topic summaries
    for (const ts of topic_summaries) {
      await client.query(
        `INSERT INTO issue_tracker.topic_summaries
           (document_id, topic_id, summary, sentiment, source_quote, confidence, mentioned)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (document_id, topic_id) DO UPDATE SET
           summary = EXCLUDED.summary,
           sentiment = EXCLUDED.sentiment,
           source_quote = EXCLUDED.source_quote,
           confidence = EXCLUDED.confidence,
           mentioned = EXCLUDED.mentioned,
           updated_at = NOW()`,
        [documentId, ts.topic_id, ts.summary, ts.sentiment, ts.source_quote, ts.confidence, ts.mentioned]
      );
    }

    // Write confirmed document summary
    await client.query(
      `INSERT INTO issue_tracker.document_summaries
         (document_id, summary, unmatched_content, suggested_topics)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (document_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         unmatched_content = EXCLUDED.unmatched_content,
         suggested_topics = EXCLUDED.suggested_topics,
         updated_at = NOW()`,
      [documentId, document_summary.summary, document_summary.unmatched_content,
       JSON.stringify(document_summary.suggested_topics ?? [])]
    );

    // Delete draft rows
    await client.query('DELETE FROM issue_tracker.draft_topic_summaries WHERE document_id = $1', [documentId]);
    await client.query('DELETE FROM issue_tracker.draft_document_summaries WHERE document_id = $1', [documentId]);

    await client.query(
      `UPDATE issue_tracker.documents SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [documentId]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmDocument error:', err);
    res.status(err.status ?? 500).json({ error: err.message || 'Failed to confirm document' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept suggested topic + backfill
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a count of confirmed/complete documents in the project so the
 * frontend can show "this will scan X documents" before the user commits.
 */
export async function getBackfillPreview(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM issue_tracker.documents
       WHERE project_id = $1 AND status IN ('complete', 'confirmed')`,
      [projectId]
    );
    res.json({ document_count: parseInt(rows[0].cnt, 10) });
  } catch (err) {
    console.error('getBackfillPreview error:', err);
    res.status(500).json({ error: 'Failed to fetch backfill preview' });
  }
}

export async function acceptSuggestedTopic(req, res) {
  const { projectId } = req.params;
  const { document_id, suggested_topic_index, run_backfill } = req.body;

  if (suggested_topic_index === undefined) {
    return res.status(400).json({ error: 'suggested_topic_index is required' });
  }

  const client = await pool.connect();
  try {
    // Pull suggested topic from whichever summary table has it
    // (could be from a confirmed doc's document_summaries or a draft)
    let suggested = null;
    for (const table of ['issue_tracker.document_summaries', 'issue_tracker.draft_document_summaries']) {
      const { rows } = await client.query(
        `SELECT suggested_topics FROM ${table} WHERE document_id = $1`,
        [document_id]
      );
      if (rows.length && rows[0].suggested_topics?.[suggested_topic_index]) {
        suggested = rows[0].suggested_topics[suggested_topic_index];
        break;
      }
    }

    if (!suggested) return res.status(404).json({ error: 'Suggested topic not found' });

    // Create the new topic
    const { rows: existing } = await client.query(
      'SELECT COUNT(*) AS cnt FROM issue_tracker.topics WHERE project_id = $1',
      [projectId]
    );
    const nextNum = parseInt(existing[0].cnt, 10) + 1;
    const code = `ISS-${String(nextNum).padStart(2, '0')}`;

    const { rows: newTopic } = await client.query(
      `INSERT INTO issue_tracker.topics (project_id, code, title, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, code, suggested.title, suggested.description ?? null, nextNum]
    );
    const topic = newTopic[0];

    // If user declined backfill, return immediately
    if (!run_backfill) {
      return res.status(201).json({ topic, backfilled: false });
    }

    // Backfill — re-run ingestion for this topic against all confirmed/complete docs
    const { rows: docs } = await client.query(
      `SELECT id, raw_text FROM issue_tracker.documents
       WHERE project_id = $1 AND status IN ('complete', 'confirmed')`,
      [projectId]
    );

    for (const doc of docs) {
      try {
        const result = await runSingleTopicIngestion(doc.raw_text, topic);
        await client.query(
          `INSERT INTO issue_tracker.topic_summaries
             (document_id, topic_id, summary, sentiment, source_quote, confidence, mentioned)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (document_id, topic_id) DO UPDATE SET
             summary = EXCLUDED.summary, sentiment = EXCLUDED.sentiment,
             source_quote = EXCLUDED.source_quote, confidence = EXCLUDED.confidence,
             mentioned = EXCLUDED.mentioned, updated_at = NOW()`,
          [doc.id, topic.id, result.summary, result.sentiment, result.source_quote, result.confidence, result.mentioned]
        );
      } catch (backfillErr) {
        // Log and continue — a single doc failure shouldn't abort the whole backfill
        console.error(`Backfill failed for document ${doc.id}:`, backfillErr.message);
      }
    }

    res.status(201).json({ topic, backfilled: true, documents_processed: docs.length });
  } catch (err) {
    console.error('acceptSuggestedTopic error:', err);
    res.status(500).json({ error: 'Failed to accept suggested topic' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

export async function getTimeline(req, res) {
  const { projectId } = req.params;
  try {
    // All confirmed/complete documents with summaries
    const { rows: docs } = await pool.query(
      `SELECT
         d.id, d.filename, d.stage_label, d.stage_instance_id, d.uploaded_at, d.status,
         psd.name AS stage_name,
         ds.summary, ds.unmatched_content, ds.suggested_topics
       FROM issue_tracker.documents d
       LEFT JOIN admin_console.project_stage_instances psi ON psi.id = d.stage_instance_id
       LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
       LEFT JOIN issue_tracker.document_summaries ds ON ds.document_id = d.id
       WHERE d.project_id = $1 AND d.status IN ('complete', 'confirmed')
       ORDER BY d.uploaded_at ASC`,
      [projectId]
    );

    // All topics
    const { rows: topics } = await pool.query(
      `SELECT id, code, title, description
       FROM issue_tracker.topics
       WHERE project_id = $1
       ORDER BY sort_order, id`,
      [projectId]
    );

    // All topic summaries for those documents
    const docIds = docs.map(d => d.id);
    let topicSummaries = [];
    if (docIds.length) {
      const { rows } = await pool.query(
        `SELECT ts.document_id, ts.topic_id, ts.summary, ts.sentiment,
                ts.mentioned, ts.confidence, ts.source_quote
         FROM issue_tracker.topic_summaries ts
         WHERE ts.document_id = ANY($1)`,
        [docIds]
      );
      topicSummaries = rows;
    }

    // Build a lookup: topicSummaries[documentId][topicId]
    const summaryMap = {};
    for (const ts of topicSummaries) {
      if (!summaryMap[ts.document_id]) summaryMap[ts.document_id] = {};
      summaryMap[ts.document_id][ts.topic_id] = ts;
    }

    // Shape the timeline response
    const issues = topics.map(topic => ({
      ...topic,
      entries: docs.map(doc => {
        const ts = summaryMap[doc.id]?.[topic.id] ?? null;
        return {
          document_id: doc.id,
          filename: doc.filename,
          stage_label: doc.stage_label || doc.stage_name || null,
          is_preset_stage: !!doc.stage_instance_id,
          uploaded_at: doc.uploaded_at,
          summary: ts?.summary ?? null,
          sentiment: ts?.sentiment ?? 'not_mentioned',
          mentioned: ts?.mentioned ?? false,
          confidence: ts?.confidence ?? null,
          source_quote: ts?.source_quote ?? null
        };
      })
    }));

    res.json({ issues, documents: docs });
  } catch (err) {
    console.error('getTimeline error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
}
