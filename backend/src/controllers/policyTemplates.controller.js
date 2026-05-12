import { pool } from '../db.js';

export async function listTemplates(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM planning_applications.assessment_policy_templates
       ORDER BY development_type, discipline`
    );
    res.json(rows);
  } catch (err) {
    console.error('listTemplates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

export async function getTemplate(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM planning_applications.assessment_policy_templates WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getTemplate error:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

export async function upsertTemplate(req, res) {
  const { discipline, development_type, policy_national_text } = req.body;
  if (!discipline || !development_type) {
    return res.status(400).json({ error: 'discipline and development_type are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.assessment_policy_templates
         (discipline, development_type, policy_national_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (discipline, development_type) DO UPDATE
         SET policy_national_text = $3, updated_at = NOW()
       RETURNING *`,
      [discipline, development_type, policy_national_text ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertTemplate error:', err);
    res.status(500).json({ error: 'Failed to save template' });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const { rows } = await pool.query(
      `DELETE FROM planning_applications.assessment_policy_templates WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('deleteTemplate error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}
