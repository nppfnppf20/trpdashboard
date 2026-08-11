import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processMeetingTranscript, extractInsights } from '../services/meeting.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Process + save a meeting transcript (upload → LLM → store all 3 tables)
// ─────────────────────────────────────────────────────────────────────────────

export async function processMeetingNote(req, res) {
  try {
    const { projectId } = req.params;
    const { user_notes, agenda, summary_type, custom_prompt, provider } = req.body;

    let text;
    let fileName;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    } else if (req.body.text) {
      text = req.body.text;
      fileName = req.body.file_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const { meeting_title, meeting_date, attendees, summary_html, actions } = await processMeetingTranscript(
      text, fileName, user_notes || null, agenda || null, summary_type || 'brief', custom_prompt || null, 'project', provider || null
    );

    const title = meeting_title
      || (fileName ? fileName.replace(/\.[^.]+$/, '') : null)
      || 'Meeting Notes';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [transcript] } = await client.query(
        `INSERT INTO planning_applications.meeting_transcripts
           (project_id, title, meeting_date, attendees_text, file_name, transcript_text, user_notes, agenda)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [projectId, title, meeting_date || null, attendees || null, fileName, text, user_notes?.trim() || null, agenda?.trim() || null]
      );

      const { rows: [summary] } = await client.query(
        `INSERT INTO planning_applications.meeting_summaries
           (transcript_id, project_id, summary_html)
         VALUES ($1, $2, $3) RETURNING *`,
        [transcript.id, projectId, summary_html]
      );

      // Stage tracker actions for user review (confirmed = false)
      const stagedTrackerActions = [];
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a.action_text?.trim()) continue;
        const { rows: [ta] } = await client.query(
          `INSERT INTO planning_applications.tracker_actions
             (project_id, title, owner, confirmed, source_transcript_id, order_index)
           VALUES ($1, $2, $3, false, $4, $5) RETURNING id, title, owner`,
          [projectId, a.action_text.trim(), a.owner?.trim() || null, transcript.id, i]
        );
        stagedTrackerActions.push(ta);
      }

      await client.query('COMMIT');
      res.status(201).json({ transcript, summary, suggestedActions: actions, stagedTrackerActions });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('meetingNotes.processMeetingNote error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all meeting notes for a project (transcript + summary + action counts)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeetingNotes(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id, t.title, t.meeting_date, t.attendees_text, t.file_name, t.created_at,
         s.id AS summary_id, s.summary_html,
         COUNT(a.id) FILTER (WHERE a.status = 'pending')  AS pending_count,
         COUNT(a.id) FILTER (WHERE a.status = 'complete') AS complete_count
       FROM planning_applications.meeting_transcripts t
       LEFT JOIN planning_applications.meeting_summaries s ON s.transcript_id = t.id
       LEFT JOIN planning_applications.meeting_actions   a ON a.transcript_id = t.id
       WHERE t.project_id = $1
       GROUP BY t.id, t.title, t.meeting_date, t.attendees_text, t.file_name, t.created_at,
                s.id, s.summary_html
       ORDER BY t.meeting_date DESC NULLS LAST, t.created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('meetingNotes.getMeetingNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get transcript text for a single meeting
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeetingTranscript(req, res) {
  const { meetingId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, meeting_date, attendees_text, file_name, transcript_text, created_at
       FROM planning_applications.meeting_transcripts WHERE id = $1`,
      [meetingId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.getMeetingTranscript error:', err);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update meeting note summary HTML
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMeetingSummary(req, res) {
  const { meetingId } = req.params;
  const { summary_html } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.meeting_summaries
         SET summary_html = $2
       WHERE transcript_id = $1 RETURNING *`,
      [meetingId, summary_html]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.updateMeetingSummary error:', err);
    res.status(500).json({ error: 'Failed to update summary' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update meeting note metadata (title, date, attendees)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMeetingNote(req, res) {
  const { meetingId } = req.params;
  const { title, meeting_date, attendees_text } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.meeting_transcripts SET
         title          = COALESCE($2, title),
         meeting_date   = $3,
         attendees_text = $4
       WHERE id = $1 RETURNING *`,
      [meetingId, title?.trim() || null, meeting_date || null, attendees_text?.trim() || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.updateMeetingNote error:', err);
    res.status(500).json({ error: 'Failed to update meeting note' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a meeting note (cascades to summary + its actions)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteMeetingNote(req, res) {
  const { meetingId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.meeting_transcripts WHERE id = $1`,
      [meetingId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('meetingNotes.deleteMeetingNote error:', err);
    res.status(500).json({ error: 'Failed to delete meeting note' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeetingActions(req, res) {
  const { projectId } = req.params;
  const { status } = req.query; // optional filter
  try {
    const params = [projectId];
    const where = status ? ' AND a.status = $2' : '';
    if (status) params.push(status);

    const { rows } = await pool.query(
      `SELECT a.*, t.title AS meeting_title, t.meeting_date
       FROM planning_applications.meeting_actions a
       LEFT JOIN planning_applications.meeting_transcripts t ON t.id = a.transcript_id
       WHERE a.project_id = $1${where}
       ORDER BY
         CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
         a.due_date ASC,
         a.created_at ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('meetingNotes.getMeetingActions error:', err);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
}

export async function createMeetingAction(req, res) {
  const { projectId } = req.params;
  const { action_text, owner, due_date, notes, transcript_id } = req.body;
  if (!action_text?.trim()) return res.status(400).json({ error: 'action_text is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.meeting_actions
         (project_id, transcript_id, action_text, owner, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [projectId, transcript_id || null, action_text.trim(), owner?.trim() || null, due_date || null, notes?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.createMeetingAction error:', err);
    res.status(500).json({ error: 'Failed to create action' });
  }
}

export async function updateMeetingAction(req, res) {
  const { actionId } = req.params;
  const { action_text, owner, due_date, notes, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE planning_applications.meeting_actions SET
         action_text  = COALESCE($2, action_text),
         owner        = $3,
         due_date     = $4,
         notes        = $5,
         status       = COALESCE($6, status),
         completed_at = CASE
           WHEN $6 = 'complete' AND completed_at IS NULL THEN NOW()
           WHEN $6 = 'pending'                           THEN NULL
           ELSE completed_at
         END,
         updated_at   = NOW()
       WHERE id = $1 RETURNING *`,
      [actionId, action_text?.trim() || null, owner?.trim() || null, due_date || null, notes?.trim() || null, status || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.updateMeetingAction error:', err);
    res.status(500).json({ error: 'Failed to update action' });
  }
}

export async function deleteMeetingAction(req, res) {
  const { actionId } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.meeting_actions WHERE id = $1`,
      [actionId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('meetingNotes.deleteMeetingAction error:', err);
    res.status(500).json({ error: 'Failed to delete action' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Process internal / CPD meeting note (no project)
// ─────────────────────────────────────────────────────────────────────────────

export async function processInternalMeetingNote(req, res) {
  try {
    const { meeting_type = 'internal', user_notes, agenda, summary_type, custom_prompt } = req.body;

    if (!['internal', 'cpd'].includes(meeting_type)) {
      return res.status(400).json({ error: 'meeting_type must be internal or cpd' });
    }

    let text;
    let fileName;
    if (req.file) {
      ({ text } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    } else if (req.body.text) {
      text = req.body.text;
      fileName = req.body.file_name || null;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    // Run summary + insights extraction in parallel
    const [summaryResult, extractedInsights] = await Promise.all([
      processMeetingTranscript(
        text, fileName, user_notes || null, agenda || null, summary_type || 'brief', custom_prompt || null, meeting_type, null
      ),
      extractInsights(text, meeting_type),
    ]);

    const { meeting_title, meeting_date, attendees, summary_html, actions } = summaryResult;

    const title = meeting_title
      || (fileName ? fileName.replace(/\.[^.]+$/, '') : null)
      || (meeting_type === 'cpd' ? 'CPD Record' : 'Meeting Notes');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [transcript] } = await client.query(
        `INSERT INTO planning_applications.meeting_transcripts
           (meeting_type, title, meeting_date, attendees_text, file_name, transcript_text, user_notes, agenda)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [meeting_type, title, meeting_date || null, attendees || null, fileName, text, user_notes?.trim() || null, agenda?.trim() || null]
      );

      const { rows: [summary] } = await client.query(
        `INSERT INTO planning_applications.meeting_summaries
           (transcript_id, summary_html)
         VALUES ($1, $2) RETURNING *`,
        [transcript.id, summary_html]
      );

      await client.query('COMMIT');
      res.status(201).json({
        transcript,
        summary,
        suggestedActions: actions,
        extractedInsights,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('meetingNotes.processInternalMeetingNote error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all meeting notes across all types (with optional ?type= filter)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllMeetingNotes(req, res) {
  const { type } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id, t.title, t.meeting_date, t.attendees_text, t.file_name, t.created_at, t.meeting_type,
         t.project_id, p.project_name,
         s.id AS summary_id, s.summary_html,
         COUNT(a.id) FILTER (WHERE a.status = 'pending')  AS pending_count,
         COUNT(a.id) FILTER (WHERE a.status = 'complete') AS complete_count
       FROM planning_applications.meeting_transcripts t
       LEFT JOIN planning_applications.meeting_summaries s ON s.transcript_id = t.id
       LEFT JOIN planning_applications.meeting_actions   a ON a.transcript_id = t.id
       LEFT JOIN public.projects p ON p.id = t.project_id
       ${type ? 'WHERE t.meeting_type = $1' : ''}
       GROUP BY t.id, t.title, t.meeting_date, t.attendees_text, t.file_name, t.created_at,
                t.meeting_type, t.project_id, p.project_name, s.id, s.summary_html
       ORDER BY t.meeting_date DESC NULLS LAST, t.created_at DESC`,
      type ? [type] : []
    );
    res.json(rows);
  } catch (err) {
    console.error('meetingNotes.getAllMeetingNotes error:', err);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get actions for a specific transcript (any type)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeetingNoteActions(req, res) {
  const { meetingId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, t.title AS meeting_title, t.meeting_date
       FROM planning_applications.meeting_actions a
       LEFT JOIN planning_applications.meeting_transcripts t ON t.id = a.transcript_id
       WHERE a.transcript_id = $1
       ORDER BY
         CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
         a.due_date ASC, a.created_at ASC`,
      [meetingId]
    );
    res.json(rows);
  } catch (err) {
    console.error('meetingNotes.getMeetingNoteActions error:', err);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create action for a non-project transcript (internal / CPD)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Save confirmed extracted insights (policy updates / CPD topics)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveExtractedInsights(req, res) {
  const { transcriptId } = req.params;
  const { insights } = req.body; // array of { topic, detail, raised_by }

  if (!Array.isArray(insights) || insights.length === 0) {
    return res.status(400).json({ error: 'insights must be a non-empty array' });
  }

  try {
    const { rows: [transcript] } = await pool.query(
      `SELECT meeting_type, meeting_date FROM planning_applications.meeting_transcripts WHERE id = $1`,
      [transcriptId]
    );
    if (!transcript) return res.status(404).json({ error: 'Transcript not found' });

    const insightType = transcript.meeting_type === 'cpd' ? 'cpd_topic' : 'policy_update';
    const meetingDate = transcript.meeting_date ?? null;

    const saved = await Promise.all(
      insights.map(item =>
        pool.query(
          `INSERT INTO admin_console.extracted_insights
             (transcript_id, meeting_type, insight_type, topic, detail, raised_by, meeting_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [transcriptId, transcript.meeting_type, insightType, item.topic, item.detail ?? null, item.raised_by ?? null, meetingDate]
        ).then(r => r.rows[0])
      )
    );

    res.status(201).json(saved);
  } catch (err) {
    console.error('meetingNotes.saveExtractedInsights error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function createStandaloneAction(req, res) {
  const { transcript_id, action_text, owner, due_date, notes } = req.body;
  if (!action_text?.trim()) return res.status(400).json({ error: 'action_text is required' });
  if (!transcript_id) return res.status(400).json({ error: 'transcript_id is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.meeting_actions
         (transcript_id, action_text, owner, due_date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [transcript_id, action_text.trim(), owner?.trim() || null, due_date || null, notes?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('meetingNotes.createStandaloneAction error:', err);
    res.status(500).json({ error: 'Failed to create action' });
  }
}
