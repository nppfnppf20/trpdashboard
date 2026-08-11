import { pool } from '../db.js';
import { suggestActionSummaries, draftActionsFromMeetingNotes } from '../services/progressTracker.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Get all issues (with sub-issues + actions) + tracker meta for a project
// ─────────────────────────────────────────────────────────────────────────────

export async function getProgressData(req, res) {
  const { projectId } = req.params;
  try {
    const [{ rows: issues }, { rows: subIssues }, { rows: actions }, { rows: actionSubLinks }, { rows: meta }] = await Promise.all([
      pool.query(
        `SELECT id, discipline, title, status, sort_order, created_at, updated_at
         FROM planning_applications.progress_issues
         WHERE project_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT si.id, si.issue_id, si.sub_issue_text, si.status, si.sort_order, si.created_at, si.updated_at
         FROM planning_applications.progress_sub_issues si
         JOIN planning_applications.progress_issues i ON i.id = si.issue_id
         WHERE i.project_id = $1
         ORDER BY si.sort_order ASC, si.id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT a.id, a.issue_id, a.action_date, a.summary, a.full_text, a.source_type,
                a.stage_instance_id, a.meeting_transcript_id, a.created_at, a.updated_at,
                COALESCE(psd.name, psi.custom_name) AS stage_name,
                mt.title AS meeting_note_title
         FROM planning_applications.progress_actions a
         JOIN planning_applications.progress_issues i ON i.id = a.issue_id
         LEFT JOIN admin_console.project_stage_instances psi ON psi.id = a.stage_instance_id
         LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
         LEFT JOIN planning_applications.meeting_transcripts mt ON mt.id = a.meeting_transcript_id
         WHERE i.project_id = $1
         ORDER BY a.action_date DESC, a.id DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT asi.action_id, asi.sub_issue_id
         FROM planning_applications.progress_action_sub_issues asi
         JOIN planning_applications.progress_actions a ON a.id = asi.action_id
         JOIN planning_applications.progress_issues i ON i.id = a.issue_id
         WHERE i.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT last_exported_at, last_issued_to_client_at
         FROM planning_applications.progress_tracker_meta
         WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    const subByIssue = {};
    for (const s of subIssues) {
      (subByIssue[s.issue_id] ||= []).push(s);
    }
    const subIdsByAction = {};
    for (const link of actionSubLinks) {
      (subIdsByAction[link.action_id] ||= []).push(link.sub_issue_id);
    }
    const actionsByIssue = {};
    for (const a of actions) {
      (actionsByIssue[a.issue_id] ||= []).push({ ...a, sub_issue_ids: subIdsByAction[a.id] || [] });
    }
    const withDetail = issues.map(i => ({
      ...i,
      sub_issues: subByIssue[i.id] || [],
      actions: actionsByIssue[i.id] || [],
    }));

    res.json({
      issues: withDetail,
      meta: meta[0] || { last_exported_at: null, last_issued_to_client_at: null },
    });
  } catch (err) {
    console.error('progressTracker.getProgressData error:', err);
    res.status(500).json({ error: 'Failed to fetch progress tracker data' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Issues: create (optionally with sub-issues) / update / delete
// ─────────────────────────────────────────────────────────────────────────────

export async function createIssue(req, res) {
  const { projectId } = req.params;
  const { discipline, title, status, sub_issues } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [issue] } = await client.query(
      `INSERT INTO planning_applications.progress_issues (project_id, discipline, title, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectId, discipline?.trim() || null, title.trim(), status?.trim() || 'In Progress']
    );

    const createdSubIssues = [];
    const items = (Array.isArray(sub_issues) ? sub_issues : [])
      .map(s => typeof s === 'string' ? s.trim() : (s?.sub_issue_text ?? '').trim())
      .filter(Boolean);
    for (let i = 0; i < items.length; i++) {
      const { rows: [subRow] } = await client.query(
        `INSERT INTO planning_applications.progress_sub_issues (issue_id, sub_issue_text, sort_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [issue.id, items[i], i]
      );
      createdSubIssues.push(subRow);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...issue, sub_issues: createdSubIssues, actions: [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('progressTracker.createIssue error:', err);
    res.status(500).json({ error: 'Failed to create issue' });
  } finally {
    client.release();
  }
}

export async function updateIssue(req, res) {
  const { issueId } = req.params;
  const { discipline, title, status, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.progress_issues SET
         discipline = CASE WHEN $2 THEN $3 ELSE discipline END,
         title      = COALESCE($4, title),
         status     = COALESCE($5, status),
         sort_order = COALESCE($6, sort_order),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        issueId,
        'discipline' in req.body, discipline?.trim() || null,
        title != null ? title.trim() || null : null,
        status?.trim() || null,
        sort_order ?? null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('progressTracker.updateIssue error:', err);
    res.status(500).json({ error: 'Failed to update issue' });
  }
}

export async function deleteIssue(req, res) {
  const { issueId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.progress_issues WHERE id = $1`, [issueId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('progressTracker.deleteIssue error:', err);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-issues: create / update / delete
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubIssue(req, res) {
  const { issueId } = req.params;
  const { sub_issue_text, status } = req.body;
  if (!sub_issue_text?.trim()) return res.status(400).json({ error: 'sub_issue_text is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.progress_sub_issues (issue_id, sub_issue_text, status, sort_order)
       VALUES (
         $1, $2, $3,
         COALESCE((SELECT MAX(sort_order) + 1 FROM planning_applications.progress_sub_issues WHERE issue_id = $1), 0)
       )
       RETURNING *`,
      [issueId, sub_issue_text.trim(), status?.trim() || 'In Progress']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('progressTracker.createSubIssue error:', err);
    res.status(500).json({ error: 'Failed to create sub-issue' });
  }
}

export async function updateSubIssue(req, res) {
  const { subIssueId } = req.params;
  const { sub_issue_text, status, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.progress_sub_issues SET
         sub_issue_text = COALESCE($2, sub_issue_text),
         status         = COALESCE($3, status),
         sort_order     = COALESCE($4, sort_order),
         updated_at     = NOW()
       WHERE id = $1 RETURNING *`,
      [
        subIssueId,
        sub_issue_text != null ? sub_issue_text.trim() || null : null,
        status?.trim() || null,
        sort_order ?? null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('progressTracker.updateSubIssue error:', err);
    res.status(500).json({ error: 'Failed to update sub-issue' });
  }
}

export async function deleteSubIssue(req, res) {
  const { subIssueId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.progress_sub_issues WHERE id = $1`, [subIssueId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('progressTracker.deleteSubIssue error:', err);
    res.status(500).json({ error: 'Failed to delete sub-issue' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions: dated progress entries against one or more issues
// ─────────────────────────────────────────────────────────────────────────────

// Batch create: one action (date + source text) applied to several issues,
// each with its own summary. Transactional.
export async function createActions(req, res) {
  const { projectId } = req.params;
  const { action_date, full_text, source_type, stage_instance_id, items } = req.body;
  if (!action_date) return res.status(400).json({ error: 'action_date is required' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one issue is required' });
  if (items.some(i => !i.summary?.trim())) return res.status(400).json({ error: 'Each selected issue needs a summary' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const item of items) {
      const { rows } = await client.query(
        `INSERT INTO planning_applications.progress_actions
           (issue_id, action_date, summary, full_text, source_type, stage_instance_id)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE EXISTS (
           SELECT 1 FROM planning_applications.progress_issues i
           WHERE i.id = $1 AND i.project_id = $7
         )
         RETURNING *`,
        [
          item.issue_id,
          action_date,
          item.summary.trim(),
          full_text?.trim() || null,
          source_type?.trim() || 'note',
          stage_instance_id || null,
          projectId,
        ]
      );
      if (!rows[0]) throw new Error(`Issue ${item.issue_id} does not belong to this project`);

      const linkedIds = [];
      for (const subId of item.sub_issue_ids || []) {
        const { rows: [link] } = await client.query(
          `INSERT INTO planning_applications.progress_action_sub_issues (action_id, sub_issue_id)
           SELECT $1, $2
           WHERE EXISTS (
             SELECT 1 FROM planning_applications.progress_sub_issues si
             WHERE si.id = $2 AND si.issue_id = $3
           )
           RETURNING sub_issue_id`,
          [rows[0].id, subId, item.issue_id]
        );
        if (link) linkedIds.push(link.sub_issue_id);
      }
      created.push({ ...rows[0], sub_issue_ids: linkedIds });
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('progressTracker.createActions error:', err);
    res.status(500).json({ error: 'Failed to save action' });
  } finally {
    client.release();
  }
}

// Suggest per-issue summaries from source text — mirrors Conditions Tracker's
// suggestAdvancements.
export async function suggestActions(req, res) {
  const { projectId } = req.params;
  const { full_text, items } = req.body;
  if (!full_text?.trim()) return res.status(400).json({ error: 'Paste the email trail or note text to summarise from' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one issue is required' });

  try {
    const ids = items.map(i => i.issue_id);
    const [{ rows: issues }, { rows: actions }] = await Promise.all([
      pool.query(
        `SELECT id, title, discipline
         FROM planning_applications.progress_issues
         WHERE project_id = $1 AND id = ANY($2::int[])`,
        [projectId, ids]
      ),
      pool.query(
        `SELECT issue_id, action_date::text, summary
         FROM planning_applications.progress_actions
         WHERE issue_id = ANY($1::int[])
         ORDER BY action_date DESC, id DESC`,
        [ids]
      ),
    ]);
    if (!issues.length) return res.status(404).json({ error: 'No matching issues found' });

    const actionsByIssue = {};
    for (const a of actions) {
      (actionsByIssue[a.issue_id] ||= []).push(a);
    }
    const userSummaries = Object.fromEntries(items.map(i => [i.issue_id, i.user_summary?.trim() || null]));

    const enriched = issues.map(iss => ({
      ...iss,
      actions: actionsByIssue[iss.id] || [],
      user_summary: userSummaries[iss.id] || null,
    }));

    const suggestions = await suggestActionSummaries(full_text, enriched);
    res.json({ suggestions });
  } catch (err) {
    console.error('progressTracker.suggestActions error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate summaries' });
  }
}

export async function updateAction(req, res) {
  const { actionId } = req.params;
  const { action_date, summary, full_text, source_type, stage_instance_id, sub_issue_ids } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE planning_applications.progress_actions SET
         action_date       = COALESCE($2, action_date),
         summary           = COALESCE($3, summary),
         full_text         = CASE WHEN $4 THEN $5 ELSE full_text END,
         source_type       = COALESCE($6, source_type),
         stage_instance_id = CASE WHEN $7 THEN $8 ELSE stage_instance_id END,
         updated_at        = NOW()
       WHERE id = $1 RETURNING *`,
      [
        actionId,
        action_date || null,
        summary != null ? summary.trim() || null : null,
        'full_text' in req.body, full_text?.trim() || null,
        source_type?.trim() || null,
        'stage_instance_id' in req.body, stage_instance_id || null,
      ]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    let linkedIds = null;
    if ('sub_issue_ids' in req.body) {
      await client.query(
        `DELETE FROM planning_applications.progress_action_sub_issues WHERE action_id = $1`,
        [actionId]
      );
      linkedIds = [];
      for (const subId of sub_issue_ids || []) {
        const { rows: [link] } = await client.query(
          `INSERT INTO planning_applications.progress_action_sub_issues (action_id, sub_issue_id)
           SELECT $1, $2
           WHERE EXISTS (
             SELECT 1 FROM planning_applications.progress_sub_issues si
             WHERE si.id = $2 AND si.issue_id = $3
           )
           RETURNING sub_issue_id`,
          [actionId, subId, rows[0].issue_id]
        );
        if (link) linkedIds.push(link.sub_issue_id);
      }
    } else {
      const { rows: links } = await client.query(
        `SELECT sub_issue_id FROM planning_applications.progress_action_sub_issues WHERE action_id = $1`,
        [actionId]
      );
      linkedIds = links.map(l => l.sub_issue_id);
    }

    await client.query('COMMIT');
    res.json({ ...rows[0], sub_issue_ids: linkedIds });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('progressTracker.updateAction error:', err);
    res.status(500).json({ error: 'Failed to update action' });
  } finally {
    client.release();
  }
}

export async function deleteAction(req, res) {
  const { actionId } = req.params;
  try {
    await pool.query(`DELETE FROM planning_applications.progress_actions WHERE id = $1`, [actionId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('progressTracker.deleteAction error:', err);
    res.status(500).json({ error: 'Failed to delete action' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Meeting Notes: propose actions/new issues, then commit the
// accepted subset. Nothing is written by the draft step.
// ─────────────────────────────────────────────────────────────────────────────

export async function listMeetingNotesForPicker(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, meeting_date
       FROM planning_applications.meeting_transcripts
       WHERE project_id = $1
       ORDER BY meeting_date DESC NULLS LAST, id DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('progressTracker.listMeetingNotesForPicker error:', err);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
}

export async function draftFromMeetingNotes(req, res) {
  const { projectId } = req.params;
  const { transcript_ids } = req.body;
  if (!Array.isArray(transcript_ids) || !transcript_ids.length) {
    return res.status(400).json({ error: 'At least one meeting note is required' });
  }
  try {
    const [{ rows: transcripts }, { rows: issues }, { rows: actions }] = await Promise.all([
      pool.query(
        `SELECT id, title, meeting_date::text, transcript_text, user_notes
         FROM planning_applications.meeting_transcripts
         WHERE project_id = $1 AND id = ANY($2::int[])`,
        [projectId, transcript_ids]
      ),
      pool.query(
        `SELECT id, title, discipline
         FROM planning_applications.progress_issues
         WHERE project_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT a.issue_id, a.action_date::text, a.summary
         FROM planning_applications.progress_actions a
         JOIN planning_applications.progress_issues i ON i.id = a.issue_id
         WHERE i.project_id = $1
         ORDER BY a.action_date DESC, a.id DESC`,
        [projectId]
      ),
    ]);
    if (!transcripts.length) return res.status(404).json({ error: 'No matching meeting notes found' });

    const actionsByIssue = {};
    for (const a of actions) {
      (actionsByIssue[a.issue_id] ||= []).push(a);
    }
    const enrichedIssues = issues.map(iss => ({ ...iss, actions: actionsByIssue[iss.id] || [] }));

    const proposals = await draftActionsFromMeetingNotes(transcripts, enrichedIssues);
    res.json({ proposals });
  } catch (err) {
    console.error('progressTracker.draftFromMeetingNotes error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft from meeting notes' });
  }
}

// Commits the user-reviewed/accepted subset of proposals from the draft step
// above. Creates any accepted new issues first, then inserts the actions,
// tagging provenance (source_type='meeting', meeting_transcript_id).
export async function commitDraftedActions(req, res) {
  const { projectId } = req.params;
  const { accepted, stage_instance_id } = req.body;
  if (!Array.isArray(accepted) || !accepted.length) {
    return res.status(400).json({ error: 'At least one accepted proposal is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const createdIssues = [];
    const createdActions = [];

    for (const p of accepted) {
      let issueId = p.issue_id;

      if (p.kind === 'new_issue') {
        if (!p.title?.trim()) throw new Error('A new issue proposal is missing a title');
        const { rows: [issue] } = await client.query(
          `INSERT INTO planning_applications.progress_issues (project_id, discipline, title)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [projectId, p.discipline?.trim() || null, p.title.trim()]
        );
        createdIssues.push(issue);
        issueId = issue.id;
      }

      if (!issueId || !p.summary?.trim() || !p.action_date) continue;

      const { rows } = await client.query(
        `INSERT INTO planning_applications.progress_actions
           (issue_id, action_date, summary, source_type, stage_instance_id, meeting_transcript_id)
         SELECT $1, $2, $3, 'meeting', $4, $5
         WHERE EXISTS (
           SELECT 1 FROM planning_applications.progress_issues i
           WHERE i.id = $1 AND i.project_id = $6
         )
         RETURNING *`,
        [issueId, p.action_date, p.summary.trim(), stage_instance_id || null, p.source_note_id || null, projectId]
      );
      if (rows[0]) createdActions.push({ ...rows[0], sub_issue_ids: [] });
    }

    await client.query('COMMIT');
    res.status(201).json({ issues: createdIssues, actions: createdActions });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('progressTracker.commitDraftedActions error:', err);
    res.status(500).json({ error: err.message || 'Failed to save the accepted proposals' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp last_exported_at / last_issued_to_client_at
// ─────────────────────────────────────────────────────────────────────────────

export async function markExported(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.progress_tracker_meta (project_id, last_exported_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_exported_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('progressTracker.markExported error:', err);
    res.status(500).json({ error: 'Failed to update export timestamp' });
  }
}

export async function markIssuedToClient(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.progress_tracker_meta (project_id, last_issued_to_client_at)
       VALUES ($1, NOW())
       ON CONFLICT (project_id) DO UPDATE SET last_issued_to_client_at = NOW(), updated_at = NOW()
       RETURNING last_exported_at, last_issued_to_client_at`,
      [projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('progressTracker.markIssuedToClient error:', err);
    res.status(500).json({ error: 'Failed to update issue timestamp' });
  }
}
