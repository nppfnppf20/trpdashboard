import { pool } from '../db.js';

export async function listIssueTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, label, development_type, nppf_text, nppg_text,
              other_national_text, other_guidance_text, sort_order
       FROM admin_console.issue_types
       ORDER BY sort_order, label`
    );
    res.json(rows);
  } catch (err) {
    console.error('issueTypes.list error:', err);
    res.status(500).json({ error: 'Failed to fetch issue types' });
  }
}

export async function createIssueType(req, res) {
  const { label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'label is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.issue_types
         (label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, label, development_type, nppf_text, nppg_text,
                 other_national_text, other_guidance_text, sort_order`,
      [
        label.trim(),
        development_type?.trim() || null,
        nppf_text?.trim() || null,
        nppg_text?.trim() || null,
        other_national_text?.trim() || null,
        other_guidance_text?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An issue type with this label and development type already exists' });
    }
    console.error('issueTypes.create error:', err);
    res.status(500).json({ error: 'Failed to create issue type' });
  }
}

export async function updateIssueType(req, res) {
  const { id } = req.params;
  const { label, development_type, nppf_text, nppg_text, other_national_text, other_guidance_text, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.issue_types
       SET label               = COALESCE($1, label),
           development_type    = $2,
           nppf_text           = $3,
           nppg_text           = $4,
           other_national_text = $5,
           other_guidance_text = $6,
           sort_order          = COALESCE($7, sort_order),
           updated_at          = NOW()
       WHERE id = $8
       RETURNING id, label, development_type, nppf_text, nppg_text,
                 other_national_text, other_guidance_text, sort_order`,
      [
        label?.trim() || null,
        development_type?.trim() || null,
        nppf_text?.trim() || null,
        nppg_text?.trim() || null,
        other_national_text?.trim() || null,
        other_guidance_text?.trim() || null,
        sort_order ?? null,
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Issue type not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An issue type with this label and development type already exists' });
    }
    console.error('issueTypes.update error:', err);
    res.status(500).json({ error: 'Failed to update issue type' });
  }
}

export async function deleteIssueType(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM admin_console.issue_types WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Issue type not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('issueTypes.delete error:', err);
    res.status(500).json({ error: 'Failed to delete issue type' });
  }
}
