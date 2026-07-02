import { pool } from '../db.js';
import { processTrackerIntake } from '../services/trackerActions.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Get all confirmed tracker actions + their updates for the grid
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrackerActions(req, res) {
  const { projectId } = req.params;
  try {
    const { rows: actions } = await pool.query(
      `SELECT id, title, owner, status, source_transcript_id, order_index, created_at
       FROM planning_applications.tracker_actions
       WHERE project_id = $1 AND confirmed = true
       ORDER BY order_index ASC, created_at ASC`,
      [projectId]
    );

    if (actions.length === 0) return res.json([]);

    const { rows: updates } = await pool.query(
      `SELECT u.id, u.action_id, u.update_date, u.summary, u.full_text, u.source_type, u.source_meeting_id, u.created_at,
              t.title AS source_meeting_title
       FROM planning_applications.action_updates u
       LEFT JOIN planning_applications.meeting_transcripts t ON t.id = u.source_meeting_id
       WHERE u.action_id = ANY($1::int[])
       ORDER BY u.update_date ASC, u.created_at ASC`,
      [actions.map(a => a.id)]
    );

    const byAction = {};
    for (const u of updates) {
      if (!byAction[u.action_id]) byAction[u.action_id] = [];
      byAction[u.action_id].push(u);
    }

    res.json(actions.map(a => ({ ...a, updates: byAction[a.id] || [] })));
  } catch (err) {
    console.error('trackerActions.getTrackerActions error:', err);
    res.status(500).json({ error: 'Failed to fetch tracker actions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get staged (unconfirmed) tracker actions for a project
// ─────────────────────────────────────────────────────────────────────────────

export async function getStagedActions(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ta.id, ta.title, ta.owner, ta.source_transcript_id,
              t.title AS meeting_title, t.meeting_date
       FROM planning_applications.tracker_actions ta
       LEFT JOIN planning_applications.meeting_transcripts t ON t.id = ta.source_transcript_id
       WHERE ta.project_id = $1 AND ta.confirmed = false
       ORDER BY ta.order_index ASC, ta.created_at ASC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('trackerActions.getStagedActions error:', err);
    res.status(500).json({ error: 'Failed to fetch staged actions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm staged actions — body: { actions: [{ id, title, owner }] }
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmStagedActions(req, res) {
  const { projectId } = req.params;
  const { actions } = req.body;
  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'actions array is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const confirmed = [];
    for (const a of actions) {
      const { rows } = await client.query(
        `UPDATE planning_applications.tracker_actions
         SET title = $2, owner = $3, confirmed = true, updated_at = NOW()
         WHERE id = $1 AND project_id = $4
         RETURNING *`,
        [a.id, a.title?.trim() || 'Untitled action', a.owner?.trim() || null, projectId]
      );
      if (rows[0]) confirmed.push(rows[0]);
    }
    await client.query('COMMIT');
    res.json(confirmed);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('trackerActions.confirmStagedActions error:', err);
    res.status(500).json({ error: 'Failed to confirm staged actions' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dismiss (delete) staged actions — body: { action_ids: [1,2,3] }
// ─────────────────────────────────────────────────────────────────────────────

export async function dismissStagedActions(req, res) {
  const { projectId } = req.params;
  const { action_ids } = req.body;
  if (!Array.isArray(action_ids)) return res.status(400).json({ error: 'action_ids is required' });
  try {
    await pool.query(
      `DELETE FROM planning_applications.tracker_actions
       WHERE id = ANY($1::int[]) AND project_id = $2 AND confirmed = false`,
      [action_ids, projectId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('trackerActions.dismissStagedActions error:', err);
    res.status(500).json({ error: 'Failed to dismiss staged actions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a tracker action manually (confirmed immediately)
// ─────────────────────────────────────────────────────────────────────────────

export async function createTrackerAction(req, res) {
  const { projectId } = req.params;
  const { title, owner } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.tracker_actions (project_id, title, owner, confirmed)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [projectId, title.trim(), owner?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('trackerActions.createTrackerAction error:', err);
    res.status(500).json({ error: 'Failed to create action' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update a tracker action (title, owner, status)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTrackerAction(req, res) {
  const { actionId } = req.params;
  const { title, owner, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.tracker_actions SET
         title      = COALESCE($2, title),
         owner      = $3,
         status     = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [actionId, title?.trim() || null, owner !== undefined ? (owner?.trim() || null) : undefined, status || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('trackerActions.updateTrackerAction error:', err);
    res.status(500).json({ error: 'Failed to update action' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a tracker action
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteTrackerAction(req, res) {
  const { actionId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.tracker_actions WHERE id = $1`, [actionId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('trackerActions.deleteTrackerAction error:', err);
    res.status(500).json({ error: 'Failed to delete action' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI intake — analyse pasted text, return suggestions (nothing saved yet)
// ─────────────────────────────────────────────────────────────────────────────

export async function intakeText(req, res) {
  const { projectId } = req.params;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  try {
    const { rows: existing } = await pool.query(
      `SELECT id, title, owner FROM planning_applications.tracker_actions
       WHERE project_id = $1 AND confirmed = true
       ORDER BY order_index ASC, created_at ASC`,
      [projectId]
    );
    const suggestions = await processTrackerIntake(text.trim(), existing);
    res.json(suggestions);
  } catch (err) {
    console.error('trackerActions.intakeText error:', err);
    res.status(500).json({ error: 'Failed to process intake' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save confirmed intake — inserts action_updates + any new tracker_actions
// Body: { update_date, full_text, source_type, source_meeting_id,
//         updates: [{ action_id, summary }],
//         new_actions: [{ title, owner, summary }] }
// ─────────────────────────────────────────────────────────────────────────────

export async function saveIntakeUpdates(req, res) {
  const { projectId } = req.params;
  const { update_date, full_text, source_type = 'manual', source_meeting_id, updates = [], new_actions = [] } = req.body;
  if (!update_date) return res.status(400).json({ error: 'update_date is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const savedUpdates = [];
    for (const u of updates) {
      const { rows } = await client.query(
        `INSERT INTO planning_applications.action_updates
           (action_id, update_date, summary, full_text, source_type, source_meeting_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [u.action_id, update_date, u.summary.trim(), full_text || null, source_type, source_meeting_id || null]
      );
      savedUpdates.push(rows[0]);
    }

    const savedNewActions = [];
    for (const na of new_actions) {
      const { rows: [action] } = await client.query(
        `INSERT INTO planning_applications.tracker_actions (project_id, title, owner, confirmed)
         VALUES ($1, $2, $3, true) RETURNING *`,
        [projectId, na.title.trim(), na.owner?.trim() || null]
      );
      savedNewActions.push(action);
      if (na.summary?.trim()) {
        await client.query(
          `INSERT INTO planning_applications.action_updates
             (action_id, update_date, summary, full_text, source_type, source_meeting_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [action.id, update_date, na.summary.trim(), full_text || null, source_type, source_meeting_id || null]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ updates: savedUpdates, new_actions: savedNewActions });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('trackerActions.saveIntakeUpdates error:', err);
    res.status(500).json({ error: 'Failed to save updates' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add a single manual update to one action
// ─────────────────────────────────────────────────────────────────────────────

export async function addActionUpdate(req, res) {
  const { actionId } = req.params;
  const { update_date, summary, full_text, source_type = 'manual' } = req.body;
  if (!summary?.trim()) return res.status(400).json({ error: 'summary is required' });
  if (!update_date) return res.status(400).json({ error: 'update_date is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.action_updates (action_id, update_date, summary, full_text, source_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [actionId, update_date, summary.trim(), full_text || null, source_type]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('trackerActions.addActionUpdate error:', err);
    res.status(500).json({ error: 'Failed to add update' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete an update
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteActionUpdate(req, res) {
  const { updateId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.action_updates WHERE id = $1`, [updateId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('trackerActions.deleteActionUpdate error:', err);
    res.status(500).json({ error: 'Failed to delete update' });
  }
}
