import { pool } from '../db.js';

const strip = (html) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Resolves a 'briefing_notes' starting-docs slot selection into joined text
// for {{BRIEFING_NOTES}} substitution. The slot stores a JSON array — either
// the legacy format (bare document_summaries ids, e.g. [12, 15], from before
// meeting notes were selectable here) or the current format
// ([{type: 'doc'|'meeting', id}]) — so old selections keep resolving
// correctly after this change.
export async function resolveBriefingNotesSelection(projectId, selectionJson) {
  if (!selectionJson) return '';
  let raw;
  try {
    raw = JSON.parse(selectionJson);
  } catch {
    return '';
  }
  if (!Array.isArray(raw) || !raw.length) return '';

  const docIds = [];
  const meetingIds = [];
  for (const entry of raw) {
    if (typeof entry === 'number') { docIds.push(entry); continue; } // legacy format
    if (entry?.type === 'meeting' && entry.id != null) meetingIds.push(entry.id);
    else if (entry?.type === 'doc' && entry.id != null) docIds.push(entry.id);
  }
  if (!docIds.length && !meetingIds.length) return '';

  const [{ rows: docRows }, { rows: meetingRows }] = await Promise.all([
    docIds.length
      ? pool.query(
          `SELECT title, summary_html, created_at FROM planning_applications.document_summaries
           WHERE id = ANY($1) AND project_id = $2 AND doc_type IN ('briefing_transcript', 'briefing_note')
           ORDER BY created_at DESC`,
          [docIds, projectId]
        )
      : { rows: [] },
    meetingIds.length
      ? pool.query(
          `SELECT mt.title, ms.summary_html, mt.meeting_date, mt.created_at
           FROM planning_applications.meeting_transcripts mt
           JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
           WHERE mt.id = ANY($1) AND mt.project_id = $2 AND mt.meeting_type = 'project'
           ORDER BY mt.meeting_date DESC NULLS LAST, mt.created_at DESC`,
          [meetingIds, projectId]
        )
      : { rows: [] },
  ]);

  return [...docRows, ...meetingRows]
    .map(r => `${r.title ? `[${r.title}]\n` : ''}${strip(r.summary_html)}`)
    .join('\n\n---\n\n');
}

// Same 'briefing_notes' slot, resolved to full transcript text instead of
// the summary — used by "transcript"/"both" source modes. Falls back to the
// summary per-item where no transcript was stored (e.g. older uploads).
export async function resolveBriefingTranscriptsSelection(projectId, selectionJson) {
  if (!selectionJson) return '';
  let raw;
  try {
    raw = JSON.parse(selectionJson);
  } catch {
    return '';
  }
  if (!Array.isArray(raw) || !raw.length) return '';

  const docIds = [];
  const meetingIds = [];
  for (const entry of raw) {
    if (typeof entry === 'number') { docIds.push(entry); continue; } // legacy format
    if (entry?.type === 'meeting' && entry.id != null) meetingIds.push(entry.id);
    else if (entry?.type === 'doc' && entry.id != null) docIds.push(entry.id);
  }
  if (!docIds.length && !meetingIds.length) return '';

  const [{ rows: docRows }, { rows: meetingRows }] = await Promise.all([
    docIds.length
      ? pool.query(
          `SELECT title, transcript_text, summary_html, created_at FROM planning_applications.document_summaries
           WHERE id = ANY($1) AND project_id = $2 AND doc_type IN ('briefing_transcript', 'briefing_note')
           ORDER BY created_at DESC`,
          [docIds, projectId]
        )
      : { rows: [] },
    meetingIds.length
      ? pool.query(
          `SELECT mt.title, mt.transcript_text, ms.summary_html, mt.meeting_date, mt.created_at
           FROM planning_applications.meeting_transcripts mt
           JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
           WHERE mt.id = ANY($1) AND mt.project_id = $2 AND mt.meeting_type = 'project'
           ORDER BY mt.meeting_date DESC NULLS LAST, mt.created_at DESC`,
          [meetingIds, projectId]
        )
      : { rows: [] },
  ]);

  return [...docRows, ...meetingRows]
    .map(r => `${r.title ? `[${r.title}]\n` : ''}${r.transcript_text?.trim() || strip(r.summary_html)}`)
    .join('\n\n---\n\n');
}

// A single briefing note or meeting note's plain-text summary, for pulling
// its content into a starting-doc slot's textarea (the "import from an
// existing note" picker on each slot card). Returns null if not found.
export async function getBriefingSourceContent(projectId, type, id) {
  if (type === 'meeting') {
    const { rows } = await pool.query(
      `SELECT mt.title, ms.summary_html
       FROM planning_applications.meeting_transcripts mt
       JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
       WHERE mt.id = $1 AND mt.project_id = $2 AND mt.meeting_type = 'project'`,
      [id, projectId]
    );
    if (!rows.length) return null;
    return { title: rows[0].title, text: strip(rows[0].summary_html) };
  }
  if (type === 'doc') {
    const { rows } = await pool.query(
      `SELECT title, summary_html FROM planning_applications.document_summaries
       WHERE id = $1 AND project_id = $2 AND doc_type IN ('briefing_transcript', 'briefing_note')`,
      [id, projectId]
    );
    if (!rows.length) return null;
    return { title: rows[0].title, text: strip(rows[0].summary_html) };
  }
  return null;
}
