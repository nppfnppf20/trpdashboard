import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { processMeetingTranscript } from '../services/meeting.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Process + save a meeting transcript (upload → LLM → store all 3 tables)
// ─────────────────────────────────────────────────────────────────────────────

export async function processMeetingNote(req, res) {
  try {
    const { projectId } = req.params;
    const { title, meeting_date, attendees_text, user_notes, agenda, summary_type } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

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

    const { summary_html, actions } = await processMeetingTranscript(
      text, fileName, user_notes || null, agenda || null, summary_type || 'brief'
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [transcript] } = await client.query(
        `INSERT INTO planning_applications.meeting_transcripts
           (project_id, title, meeting_date, attendees_text, file_name, transcript_text, user_notes, agenda)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [projectId, title.trim(), meeting_date || null, attendees_text?.trim() || null, fileName, text, user_notes?.trim() || null, agenda?.trim() || null]
      );

      const { rows: [summary] } = await client.query(
        `INSERT INTO planning_applications.meeting_summaries
           (transcript_id, project_id, summary_html)
         VALUES ($1, $2, $3) RETURNING *`,
        [transcript.id, projectId, summary_html]
      );

      let savedActions = [];
      if (actions.length > 0) {
        const values = actions.map((a, i) =>
          `($1, $2, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, $${i * 4 + 6})`
        ).join(', ');
        const params = [transcript.id, projectId];
        for (const a of actions) {
          params.push(a.action_text, a.owner, a.due_date, a.notes);
        }
        const { rows } = await client.query(
          `INSERT INTO planning_applications.meeting_actions
             (transcript_id, project_id, action_text, owner, due_date, notes)
           VALUES ${values} RETURNING *`,
          params
        );
        savedActions = rows;
      }

      await client.query('COMMIT');
      res.status(201).json({ transcript, summary, actions: savedActions });
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
  const { action_text, owner, due_date, notes } = req.body;
  if (!action_text?.trim()) return res.status(400).json({ error: 'action_text is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO planning_applications.meeting_actions
         (project_id, action_text, owner, due_date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, action_text.trim(), owner?.trim() || null, due_date || null, notes?.trim() || null]
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
