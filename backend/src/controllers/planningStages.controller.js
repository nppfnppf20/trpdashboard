import { pool } from '../db.js';
import { STAGE_KEYS, STAGE_STATUSES as STATUSES } from '../services/planningStages.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Planning stages: the strip of seven stage pills in the project workspace header.
// Table shape is documented in migration 190_project_planning_stages.sql.
// A stage with no row is "not started", so a project always comes back with all seven.
// ─────────────────────────────────────────────────────────────────────────────


function projectIdOf(req, res) {
  const id = parseInt(req.params.projectId, 10);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid project id' }); return null; }
  return id;
}

// { applicable, stages: [{ key, status, changed_at }] } for all seven stages, in order. null if no such project.
async function loadState(db, projectId) {
  const { rows: proj } = await db.query('SELECT planning_stages_applicable AS applicable FROM public.projects WHERE id = $1', [projectId]);
  if (!proj.length) return null;
  const { rows } = await db.query(
    'SELECT stage_key, status, status_changed_at FROM public.project_planning_stages WHERE project_id = $1',
    [projectId]
  );
  const byKey = new Map(rows.map(r => [r.stage_key, r]));
  return {
    applicable: proj[0].applicable,
    stages: STAGE_KEYS.map(key => ({
      key,
      status: byKey.get(key)?.status || 'not_started',
      changed_at: byKey.get(key)?.status_changed_at || null,
    })),
  };
}

function setStage(db, projectId, key, status, userId) {
  return db.query(
    `INSERT INTO public.project_planning_stages (project_id, stage_key, status, status_changed_at, status_changed_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (project_id, stage_key)
     DO UPDATE SET status = EXCLUDED.status, status_changed_at = now(), status_changed_by = EXCLUDED.status_changed_by, updated_at = now()`,
    [projectId, key, status, userId]
  );
}

// One entry per project for the global projects table: { project_id, applicable, stages: { <key>: status } }.
// Only stages that have a row are listed; the client treats a missing key as not started.
export async function getPlanningStagesOverview(req, res) {
  try {
    const [{ rows: projects }, { rows: stages }] = await Promise.all([
      pool.query('SELECT id, planning_stages_applicable AS applicable FROM public.projects'),
      pool.query('SELECT project_id, stage_key, status FROM public.project_planning_stages'),
    ]);
    const byProject = new Map(projects.map(p => [p.id, { project_id: p.id, applicable: p.applicable, stages: {} }]));
    for (const s of stages) {
      const entry = byProject.get(s.project_id);
      if (entry) entry.stages[s.stage_key] = s.status;
    }
    res.json([...byProject.values()]);
  } catch (err) {
    console.error('getPlanningStagesOverview failed:', err);
    res.status(500).json({ error: 'Failed to load the planning stages' });
  }
}

export async function getPlanningStages(req, res) {
  const projectId = projectIdOf(req, res);
  if (projectId === null) return;
  try {
    const state = await loadState(pool, projectId);
    if (!state) return res.status(404).json({ error: 'Project not found' });
    res.json(state);
  } catch (err) {
    console.error('getPlanningStages failed:', err);
    res.status(500).json({ error: 'Failed to load the planning stages' });
  }
}

export async function updatePlanningStage(req, res) {
  const projectId = projectIdOf(req, res);
  if (projectId === null) return;
  const { key } = req.params;
  const { status } = req.body || {};
  if (!STAGE_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown stage' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    if (!(await loadState(pool, projectId))) return res.status(404).json({ error: 'Project not found' });
    await setStage(pool, projectId, key, status, req.user?.id ?? null);
    res.json(await loadState(pool, projectId));
  } catch (err) {
    console.error('updatePlanningStage failed:', err);
    res.status(500).json({ error: 'Failed to save the stage' });
  }
}

// Completes one stage and starts the next stage that is still not started (stages marked N/A are skipped).
// Both changes happen together or not at all.
export async function completeAndStartNext(req, res) {
  const projectId = projectIdOf(req, res);
  if (projectId === null) return;
  const { key } = req.params;
  if (!STAGE_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown stage' });
  const userId = req.user?.id ?? null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await loadState(client, projectId);
    if (!before) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Project not found' }); }
    await setStage(client, projectId, key, 'complete', userId);
    const after = before.stages.slice(STAGE_KEYS.indexOf(key) + 1).find(s => s.status === 'not_started');
    if (after) await setStage(client, projectId, after.key, 'in_progress', userId);
    await client.query('COMMIT');
    res.json(await loadState(pool, projectId));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('completeAndStartNext failed:', err);
    res.status(500).json({ error: 'Failed to move to the next stage' });
  } finally {
    client.release();
  }
}

// Shows or hides the whole strip for a project. Stage statuses are left as they are.
export async function setPlanningStagesApplicable(req, res) {
  const projectId = projectIdOf(req, res);
  if (projectId === null) return;
  const { applicable } = req.body || {};
  if (typeof applicable !== 'boolean') return res.status(400).json({ error: 'applicable must be true or false' });
  try {
    const { rowCount } = await pool.query('UPDATE public.projects SET planning_stages_applicable = $2 WHERE id = $1', [projectId, applicable]);
    if (!rowCount) return res.status(404).json({ error: 'Project not found' });
    res.json(await loadState(pool, projectId));
  } catch (err) {
    console.error('setPlanningStagesApplicable failed:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
}
