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

// ─────────────────────────────────────────────────────────────────────────────
// "Primary note" helpers — a note is just a note, whether it started life as a
// Briefing Note (document_summaries) or a project Meeting Note
// (meeting_transcripts). Tools that need ONE note as their principal source
// (e.g. {{PROJECT_BRIEF}}, HLPV, Stage 1) resolve it through these.
// ─────────────────────────────────────────────────────────────────────────────

// Normalises an explicit note reference: {type, id}, a bare doc id, or
// a "doc:12" / "meeting:7" key. Returns {type, id} or null.
export function normaliseNoteRef(ref) {
  if (ref == null || ref === '') return null;
  if (typeof ref === 'number') return { type: 'doc', id: ref };
  if (typeof ref === 'string') {
    const [t, i] = ref.includes(':') ? ref.split(':') : ['doc', ref];
    const id = Number(i);
    return (t === 'doc' || t === 'meeting') && Number.isFinite(id) ? { type: t, id } : null;
  }
  if ((ref.type === 'doc' || ref.type === 'meeting') && ref.id != null) {
    return { type: ref.type, id: Number(ref.id) };
  }
  return null;
}

// The entry flagged `primary: true` in a 'briefing_notes' slot selection, if any.
export function parsePrimaryRef(selectionJson) {
  if (!selectionJson) return null;
  try {
    const raw = JSON.parse(selectionJson);
    if (!Array.isArray(raw)) return null;
    const entry = raw.find(e => e && typeof e === 'object' && e.primary);
    return entry ? normaliseNoteRef(entry) : null;
  } catch {
    return null;
  }
}

// Most recent note of either kind for a project (by date), as a {type, id} ref.
export async function getLatestNoteRef(projectId) {
  const { rows } = await pool.query(
    `SELECT type, id FROM (
       SELECT 'doc' AS type, id, created_at AS sort_at
         FROM planning_applications.document_summaries
        WHERE project_id = $1 AND doc_type IN ('briefing_transcript', 'briefing_note')
       UNION ALL
       SELECT 'meeting' AS type, mt.id, COALESCE(mt.meeting_date::timestamptz, mt.created_at) AS sort_at
         FROM planning_applications.meeting_transcripts mt
         JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
        WHERE mt.project_id = $1 AND mt.meeting_type = 'project'
     ) n ORDER BY sort_at DESC LIMIT 1`,
    [projectId]
  );
  return rows[0] ? { type: rows[0].type, id: rows[0].id } : null;
}

// Summary HTML of one note ({type, id}) — null if it isn't found for the project.
export async function getNoteHtml(projectId, ref) {
  const r = normaliseNoteRef(ref);
  if (!r) return null;
  if (r.type === 'meeting') {
    const { rows } = await pool.query(
      `SELECT ms.summary_html
         FROM planning_applications.meeting_transcripts mt
         JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
        WHERE mt.id = $1 AND mt.project_id = $2 AND mt.meeting_type = 'project'`,
      [r.id, projectId]
    );
    return rows[0]?.summary_html ?? null;
  }
  const { rows } = await pool.query(
    `SELECT summary_html FROM planning_applications.document_summaries
      WHERE id = $1 AND project_id = $2 AND doc_type IN ('briefing_transcript', 'briefing_note')`,
    [r.id, projectId]
  );
  return rows[0]?.summary_html ?? null;
}

// Resolve the one note a tool should treat as its principal source.
// Order: explicit ref → primary flag in the slot selection → latest note of
// either kind (only when latestFallback is true).
export async function resolvePrimaryNoteHtml(projectId, { noteRef = null, selectionJson = null, latestFallback = true } = {}) {
  let ref = normaliseNoteRef(noteRef) ?? parsePrimaryRef(selectionJson);
  if (!ref && latestFallback) ref = await getLatestNoteRef(projectId);
  return ref ? getNoteHtml(projectId, ref) : null;
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
