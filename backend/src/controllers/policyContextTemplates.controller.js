import { pool } from '../db.js';

export async function listPolicyContextTemplates(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT development_type, nppf_text, nppg_text, other_national_text, other_guidance_text, updated_at
       FROM planning_applications.policy_context_templates
       ORDER BY development_type`
    );
    res.json(rows);
  } catch (err) {
    console.error('listPolicyContextTemplates error:', err);
    res.status(500).json({ error: 'Failed to fetch policy context templates' });
  }
}

export async function updatePolicyContextTemplate(req, res) {
  const { devType } = req.params;
  const { nppf_text, nppg_text, other_national_text, other_guidance_text } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.policy_context_templates
       SET nppf_text = $1, nppg_text = $2, other_national_text = $3, other_guidance_text = $4, updated_at = NOW()
       WHERE development_type = $5
       RETURNING *`,
      [nppf_text ?? null, nppg_text ?? null, other_national_text ?? null, other_guidance_text ?? null, devType]
    );
    if (!rows.length) return res.status(404).json({ error: 'Development type not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePolicyContextTemplate error:', err);
    res.status(500).json({ error: 'Failed to update policy context template' });
  }
}
