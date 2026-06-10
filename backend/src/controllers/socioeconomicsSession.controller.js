import { pool } from '../db.js';

export async function saveSession(req, res) {
  const { project_id, csv_data, session_name } = req.body ?? {};
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!csv_data?.trim()) return res.status(400).json({ error: 'csv_data is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.socioeconomics_sessions (project_id, csv_data, session_name)
       VALUES ($1, $2, $3)
       RETURNING id, project_id, session_name, created_at`,
      [project_id, csv_data.trim(), session_name?.trim() || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('socioeconomicsSession.save error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function listProjectSessions(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, session_name, created_at
       FROM public.socioeconomics_sessions
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('socioeconomicsSession.list error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getSession(req, res) {
  const { sessionId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, project_id, session_name, csv_data, created_at
       FROM public.socioeconomics_sessions
       WHERE id = $1`,
      [sessionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('socioeconomicsSession.get error:', err);
    res.status(500).json({ error: err.message });
  }
}
