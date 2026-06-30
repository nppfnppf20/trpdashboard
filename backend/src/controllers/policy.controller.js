import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processPolicyDocument } from '../services/policy.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Combined list — policy_documents + extracted_insights, newest first
// ─────────────────────────────────────────────────────────────────────────────

export async function listPolicyItems(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        'document'   AS source_type,
        id,
        title,
        source_name,
        NULL         AS meeting_type,
        NULL         AS meeting_date,
        NULL         AS raised_by,
        summary_html,
        key_points,
        implications,
        our_take,
        created_at
      FROM admin_console.policy_documents

      UNION ALL

      SELECT
        'insight'         AS source_type,
        i.id,
        i.topic           AS title,
        t.title           AS source_name,
        i.meeting_type,
        t.meeting_date,
        i.raised_by,
        i.detail          AS summary_html,
        NULL              AS key_points,
        NULL              AS implications,
        i.our_take,
        i.created_at
      FROM admin_console.extracted_insights i
      LEFT JOIN planning_applications.meeting_transcripts t ON t.id = i.transcript_id

      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('policy.listPolicyItems error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload + process a policy document
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadPolicyDocument(req, res) {
  try {
    const { user_notes, policy_date } = req.body;

    let rawText;
    let sourceName;

    if (req.file) {
      ({ text: rawText } = await parseFile(req.file.buffer, req.file.originalname));
      sourceName = req.file.originalname;
    } else if (req.body.text) {
      rawText = req.body.text;
      sourceName = req.body.source_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const { title, summary_html, key_points, implications } = await processPolicyDocument(
      rawText,
      user_notes || null
    );

    const { rows: [doc] } = await pool.query(
      `INSERT INTO admin_console.policy_documents
         (title, source_name, policy_date, summary_html, key_points, implications, user_notes, raw_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, sourceName, policy_date || null, summary_html, key_points, implications, user_notes?.trim() || null, rawText]
    );

    res.status(201).json(doc);
  } catch (err) {
    console.error('policy.uploadPolicyDocument error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update a policy document (our_take, title)
// ─────────────────────────────────────────────────────────────────────────────

export async function updatePolicyDocument(req, res) {
  const { id } = req.params;
  const { our_take, title } = req.body;
  try {
    const { rows: [doc] } = await pool.query(
      `UPDATE admin_console.policy_documents
         SET our_take   = COALESCE($2, our_take),
             title      = COALESCE($3, title),
             updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, our_take ?? null, title?.trim() || null]
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error('policy.updatePolicyDocument error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a policy document
// ─────────────────────────────────────────────────────────────────────────────

export async function deletePolicyDocument(req, res) {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM admin_console.policy_documents WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('policy.deletePolicyDocument error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update an extracted insight (our_take)
// ─────────────────────────────────────────────────────────────────────────────

export async function updatePolicyInsight(req, res) {
  const { id } = req.params;
  const { our_take } = req.body;
  try {
    const { rows: [insight] } = await pool.query(
      `UPDATE admin_console.extracted_insights SET our_take = $2 WHERE id = $1 RETURNING *`,
      [id, our_take ?? null]
    );
    if (!insight) return res.status(404).json({ error: 'Not found' });
    res.json(insight);
  } catch (err) {
    console.error('policy.updatePolicyInsight error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete an extracted insight from the policy page
// ─────────────────────────────────────────────────────────────────────────────

export async function deletePolicyInsight(req, res) {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM admin_console.extracted_insights WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('policy.deletePolicyInsight error:', err);
    res.status(500).json({ error: err.message });
  }
}
