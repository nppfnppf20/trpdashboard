import { pool } from '../db.js';

export async function listPlanningHistory(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, section, planning_ref, description, decision, decision_date, created_at
       FROM project_planning_history
       WHERE project_id = $1
       ORDER BY section, id`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listPlanningHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch planning history' });
  }
}

export async function createPlanningHistory(req, res) {
  const { projectId } = req.params;
  const { section, planning_ref, description, decision, decision_date } = req.body;

  if (!section || !['on_site', 'nearby'].includes(section)) {
    return res.status(400).json({ error: 'section must be on_site or nearby' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO project_planning_history
         (project_id, section, planning_ref, description, decision, decision_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, section, planning_ref, description, decision, decision_date, created_at`,
      [projectId, section, planning_ref || null, description || null,
       decision || null, decision_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createPlanningHistory error:', err);
    res.status(500).json({ error: 'Failed to create planning history entry' });
  }
}

export async function updatePlanningHistory(req, res) {
  const { id } = req.params;
  const { planning_ref, description, decision, decision_date } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE project_planning_history
       SET planning_ref = $1, description = $2, decision = $3, decision_date = $4
       WHERE id = $5
       RETURNING id, section, planning_ref, description, decision, decision_date, created_at`,
      [planning_ref || null, description || null,
       decision || null, decision_date || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePlanningHistory error:', err);
    res.status(500).json({ error: 'Failed to update planning history entry' });
  }
}

export async function deletePlanningHistory(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM project_planning_history WHERE id = $1',
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).end();
  } catch (err) {
    console.error('deletePlanningHistory error:', err);
    res.status(500).json({ error: 'Failed to delete planning history entry' });
  }
}
