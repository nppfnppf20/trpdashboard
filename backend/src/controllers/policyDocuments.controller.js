import { pool } from '../db.js';

export async function listPolicyDocuments(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, section, plan_name, year_adopted, summary, relevance, created_at
       FROM policy_documents
       WHERE project_id = $1
       ORDER BY section, id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listPolicyDocuments error:', err);
    res.status(500).json({ error: 'Failed to fetch policy documents' });
  }
}

export async function createPolicyDocument(req, res) {
  const { projectId } = req.params;
  const { section, plan_name, year_adopted, summary, relevance } = req.body;

  if (!section || !['adopted', 'emerging', 'other', 'supplementary'].includes(section)) {
    return res.status(400).json({ error: 'section must be adopted, emerging, other or supplementary' });
  }
  if (!plan_name?.trim()) {
    return res.status(400).json({ error: 'plan_name is required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO policy_documents (project_id, section, plan_name, year_adopted, summary, relevance)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, section, plan_name, year_adopted, summary, relevance, created_at`,
      [projectId, section, plan_name.trim(), year_adopted || null, summary?.trim() || null, relevance?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createPolicyDocument error:', err);
    res.status(500).json({ error: 'Failed to create policy document' });
  }
}

export async function updatePolicyDocument(req, res) {
  const { id } = req.params;
  const { plan_name, year_adopted, summary, relevance } = req.body;

  if (!plan_name?.trim()) {
    return res.status(400).json({ error: 'plan_name is required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE policy_documents
       SET plan_name = $1, year_adopted = $2, summary = $3, relevance = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, section, plan_name, year_adopted, summary, relevance, created_at`,
      [plan_name.trim(), year_adopted || null, summary?.trim() || null, relevance?.trim() || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePolicyDocument error:', err);
    res.status(500).json({ error: 'Failed to update policy document' });
  }
}

export async function deletePolicyDocument(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM policy_documents WHERE id = $1',
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).end();
  } catch (err) {
    console.error('deletePolicyDocument error:', err);
    res.status(500).json({ error: 'Failed to delete policy document' });
  }
}
