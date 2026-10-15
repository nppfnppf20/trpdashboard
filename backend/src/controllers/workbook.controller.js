import { pool } from '../db.js';
import { parseFile } from '../services/parser.service.js';
import { suggestWorkbookUpdates } from '../services/workbook.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Project Workbook: gate questions, risks / actions / issues / decisions,
// progress entries, notes and Add advancement. Table shapes are documented in
// migration 188_project_workbook.sql.
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_TYPES = ['risk', 'action', 'issue', 'decision'];
const STATUSES = ['not started', 'in progress', 'completed'];

const GATE_SELECT = `id, project_id, gate, ref, section, section_title, sort_order, question, owner, score, comment`;
const ITEM_SELECT = `id, project_id, item_type AS type, seq, subject, body AS text,
  to_char(raised_on, 'YYYY-MM-DD') AS raised, to_char(target_on, 'YYYY-MM-DD') AS target,
  owner, priority, status, update_text AS "update", gate_refs, parent_id`;
const PROGRESS_SELECT = `id, item_id, to_char(entry_date, 'YYYY-MM-DD') AS date, source, body AS text`;

const isoDate = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const str = v => (typeof v === 'string' ? v : '');
const intOrNull = v => { const n = parseInt(v, 10); return Number.isInteger(n) ? n : null; };
const refList = v => (Array.isArray(v) ? [...new Set(v.map(x => String(x).replace(/^G\d\s*/i, '').trim()).filter(Boolean))] : []);

const normText = v => String(v || '').toLowerCase().replace(/[\s ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

// Words that make a quoted phrase a date or a time reference. "ASAP" and "soon" deliberately do not count.
const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_WORDS = new RegExp(
  `\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}|${MONTHS}\\s+\\d{1,2}|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?` +
  `|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next (?:week|month|fortnight)|this (?:week|month)` +
  `|end of (?:the )?(?:week|month|year|october|november|december)|by the end|within \\d+|in \\d+ (?:days?|weeks?)|\\d+ (?:days?|weeks?)|a fortnight|a week|eod|cob)\\b`,
  'i'
);
// The model's quoted basis must really be in the notes and must read as a date or time.
function basisMentionsDate(basis, noteNorm) {
  const b = normText(basis);
  return b.length >= 3 && noteNorm.includes(b) && DATE_WORDS.test(b);
}

function stamp(date) {
  const d = new Date((isoDate(date) || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
  return `[${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}] `;
}

function pid(req, res) {
  const id = parseInt(req.params.projectId, 10);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid project id' }); return null; }
  return id;
}

function withLogs(items, progress) {
  const byItem = new Map();
  for (const p of progress) {
    if (!byItem.has(p.item_id)) byItem.set(p.item_id, []);
    byItem.get(p.item_id).push({ id: p.id, date: p.date, source: p.source, text: p.text });
  }
  return items.map(i => ({ ...i, log: byItem.get(i.id) || [] }));
}

async function loadWorkbook(db, projectId) {
  const [{ rows: gate }, { rows: items }, { rows: progress }] = await Promise.all([
    db.query(`SELECT ${GATE_SELECT} FROM public.workbook_gate_questions WHERE project_id = $1 ORDER BY gate, sort_order, id`, [projectId]),
    db.query(`SELECT ${ITEM_SELECT} FROM public.workbook_items WHERE project_id = $1 ORDER BY item_type, seq`, [projectId]),
    db.query(`SELECT ${PROGRESS_SELECT} FROM public.workbook_progress WHERE item_id IN (SELECT id FROM public.workbook_items WHERE project_id = $1) ORDER BY entry_date, id`, [projectId]),
  ]);
  return { gate, items: withLogs(items, progress) };
}

async function loadItem(db, id) {
  const { rows: [item] } = await db.query(`SELECT ${ITEM_SELECT} FROM public.workbook_items WHERE id = $1`, [id]);
  if (!item) return null;
  const { rows: progress } = await db.query(`SELECT ${PROGRESS_SELECT} FROM public.workbook_progress WHERE item_id = $1 ORDER BY entry_date, id`, [id]);
  return withLogs([item], progress)[0];
}

// A parent must be a risk (for an action) or an action / risk (for an issue) in the same project, and not the item itself.
async function validParent(db, projectId, itemType, parentId, selfId = null) {
  if (parentId == null) return null;
  if (itemType !== 'action' && itemType !== 'issue') return null;
  if (selfId != null && parentId === selfId) return null;
  const { rows: [p] } = await db.query(`SELECT id, item_type FROM public.workbook_items WHERE id = $1 AND project_id = $2`, [parentId, projectId]);
  if (!p) return null;
  const allowed = itemType === 'action' ? ['risk'] : ['action', 'risk'];
  return allowed.includes(p.item_type) ? p.id : null;
}

// seq is the number shown in refs (A7, R3). Concurrent inserts can pick the same number, so retry on the unique clash.
async function insertItem(db, projectId, data, userId) {
  const type = data.type;
  const parent = await validParent(db, projectId, type, intOrNull(data.parent_id));
  const priority = [1, 2, 3].includes(Number(data.priority)) ? Number(data.priority) : 2;
  const status = STATUSES.includes(data.status) ? data.status : (type === 'decision' ? 'completed' : 'not started');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { rows: [row] } = await db.query(
        `INSERT INTO public.workbook_items
           (project_id, item_type, seq, subject, body, raised_on, target_on, owner, priority, status, update_text, gate_refs, parent_id, created_by)
         VALUES ($1, $2, (SELECT COALESCE(MAX(seq), 0) + 1 FROM public.workbook_items WHERE project_id = $1 AND item_type = $2),
                 $3, $4, COALESCE($5::date, CURRENT_DATE), $6::date, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [projectId, type, str(data.subject).trim(), str(data.text).trim(), isoDate(data.raised), isoDate(data.target), str(data.owner).trim(),
         priority, status, str(data.update), refList(data.gate_refs), parent, userId]
      );
      return row.id;
    } catch (err) {
      if (err.code !== '23505' || attempt === 3) throw err;
    }
  }
  return null;
}

// ── Whole workbook ───────────────────────────────────────────────────────────

export async function getWorkbook(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  try {
    res.json(await loadWorkbook(pool, projectId));
  } catch (err) {
    console.error('workbook.getWorkbook error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── Gate questions ───────────────────────────────────────────────────────────

export async function updateGateQuestion(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  const sets = [], vals = [];
  const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if ('owner' in req.body) add('owner', str(req.body.owner).trim());
  if ('comment' in req.body) add('comment', str(req.body.comment));
  if ('score' in req.body) {
    const s = Number(req.body.score);
    if (!Number.isInteger(s) || s < 0 || s > 5) return res.status(400).json({ error: 'Score must be a whole number from 0 to 5' });
    add('score', s);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  try {
    vals.push(id);
    const { rows: [row] } = await pool.query(
      `UPDATE public.workbook_gate_questions SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING ${GATE_SELECT}`, vals);
    if (!row) return res.status(404).json({ error: 'Gate question not found' });
    res.json(row);
  } catch (err) {
    console.error('workbook.updateGateQuestion error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Add a gate question under a section. It slots in after the last question of that section (or at the end for a
// new section), shifting later questions down so the order stays as the team sees it.
export async function createGateQuestion(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  const b = req.body || {};
  const gateNo = intOrNull(b.gate) ?? 2;
  const ref = str(b.ref).trim();
  const question = str(b.question).trim();
  const section = intOrNull(b.section);
  const score = b.score === undefined || b.score === '' ? 0 : Number(b.score);
  if (!question) return res.status(400).json({ error: 'Add the question' });
  if (!/^[A-Za-z0-9.\-]+$/.test(ref)) return res.status(400).json({ error: 'The reference can only use letters, numbers, dots and dashes, for example 3.14' });
  if (section == null || section < 1) return res.status(400).json({ error: 'Choose a section' });
  if (!Number.isInteger(score) || score < 0 || score > 5) return res.status(400).json({ error: 'Score must be a whole number from 0 to 5' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(
      `SELECT section_title, MAX(sort_order) AS last FROM public.workbook_gate_questions
       WHERE project_id = $1 AND gate = $2 AND section = $3 GROUP BY section_title`, [projectId, gateNo, section]);
    let title, after;
    if (existing) {
      title = existing.section_title;
      after = existing.last;
    } else {
      title = str(b.section_title).trim();
      if (!title) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Give the new section a title' }); }
      const { rows: [m] } = await client.query(`SELECT COALESCE(MAX(sort_order), 0) AS last FROM public.workbook_gate_questions WHERE project_id = $1 AND gate = $2`, [projectId, gateNo]);
      after = m.last;
    }
    await client.query(`UPDATE public.workbook_gate_questions SET sort_order = sort_order + 1 WHERE project_id = $1 AND gate = $2 AND sort_order > $3`, [projectId, gateNo, after]);
    await client.query(
      `INSERT INTO public.workbook_gate_questions (project_id, gate, ref, section, section_title, sort_order, question, owner, score, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [projectId, gateNo, ref, section, title, after + 1, question, str(b.owner).trim(), score, str(b.comment)]);
    await client.query('COMMIT');
    const { rows: gate } = await pool.query(`SELECT ${GATE_SELECT} FROM public.workbook_gate_questions WHERE project_id = $1 ORDER BY gate, sort_order, id`, [projectId]);
    res.status(201).json({ gate });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: `A gate question with the reference ${ref} already exists` });
    console.error('workbook.createGateQuestion error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

// Remove a gate question. Rows that pointed at its reference lose that gate ref, so nothing is left linked to a question that no longer exists.
export async function deleteGateQuestion(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [q] } = await client.query(`SELECT project_id, ref FROM public.workbook_gate_questions WHERE id = $1`, [id]);
    if (!q) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Gate question not found' }); }
    await client.query(
      `UPDATE public.workbook_items SET gate_refs = array_remove(gate_refs, $2), updated_at = now()
       WHERE project_id = $1 AND $2 = ANY(gate_refs)`, [q.project_id, q.ref]);
    await client.query(`DELETE FROM public.workbook_gate_questions WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json(await loadWorkbook(pool, q.project_id));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('workbook.deleteGateQuestion error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

// ── Items (risks, actions, issues, decisions) ────────────────────────────────

export async function createItem(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  if (!ITEM_TYPES.includes(req.body?.type)) return res.status(400).json({ error: 'type must be risk, action, issue or decision' });
  try {
    const id = await insertItem(pool, projectId, req.body, req.user?.id ?? null);
    res.status(201).json(await loadItem(pool, id));
  } catch (err) {
    console.error('workbook.createItem error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateItem(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows: [current] } = await pool.query(`SELECT id, project_id, item_type FROM public.workbook_items WHERE id = $1`, [id]);
    if (!current) return res.status(404).json({ error: 'Item not found' });

    const b = req.body || {};
    const sets = [], vals = [];
    const add = (col, val, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`); };
    if ('subject' in b) add('subject', str(b.subject).trim());
    if ('text' in b) add('body', str(b.text));
    if ('raised' in b) add('raised_on', isoDate(b.raised), '::date');
    if ('target' in b) add('target_on', isoDate(b.target), '::date');
    if ('owner' in b) add('owner', str(b.owner).trim());
    if ('update' in b) add('update_text', str(b.update));
    if ('gate_refs' in b) add('gate_refs', refList(b.gate_refs));
    if ('priority' in b) {
      const p = Number(b.priority);
      if (![1, 2, 3].includes(p)) return res.status(400).json({ error: 'Priority must be 1, 2 or 3' });
      add('priority', p);
    }
    if ('status' in b) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
      add('status', b.status);
    }
    if ('parent_id' in b) add('parent_id', await validParent(pool, current.project_id, current.item_type, intOrNull(b.parent_id), id));
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    await pool.query(`UPDATE public.workbook_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
    res.json(await loadItem(pool, id));
  } catch (err) {
    console.error('workbook.updateItem error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteItem(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query(`DELETE FROM public.workbook_items WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('workbook.deleteItem error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── Progress entries ─────────────────────────────────────────────────────────

export async function addProgress(req, res) {
  const itemId = intOrNull(req.params.id);
  const text = str(req.body?.text).trim();
  if (itemId == null) return res.status(400).json({ error: 'Invalid id' });
  if (!text) return res.status(400).json({ error: 'Progress text is required' });
  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO public.workbook_progress (item_id, entry_date, source, body, created_by)
       SELECT id, COALESCE($2::date, CURRENT_DATE), $3, $4, $5 FROM public.workbook_items WHERE id = $1
       RETURNING ${PROGRESS_SELECT}`,
      [itemId, isoDate(req.body.date), str(req.body.source).trim() || 'Note', text, req.user?.id ?? null]
    );
    if (!row) return res.status(404).json({ error: 'Item not found' });
    await pool.query(`UPDATE public.workbook_items SET updated_at = now() WHERE id = $1`, [itemId]);
    res.status(201).json({ id: row.id, date: row.date, source: row.source, text: row.text });
  } catch (err) {
    console.error('workbook.addProgress error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateProgress(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  const sets = [], vals = [];
  const add = (col, val, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`); };
  if ('text' in req.body) {
    const t = str(req.body.text).trim();
    if (!t) return res.status(400).json({ error: 'Progress text is required' });
    add('body', t);
  }
  if ('source' in req.body) add('source', str(req.body.source).trim() || 'Note');
  if ('date' in req.body && isoDate(req.body.date)) add('entry_date', req.body.date, '::date');
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  try {
    vals.push(id);
    const { rows: [row] } = await pool.query(`UPDATE public.workbook_progress SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING ${PROGRESS_SELECT}`, vals);
    if (!row) return res.status(404).json({ error: 'Entry not found' });
    res.json({ id: row.id, date: row.date, source: row.source, text: row.text });
  } catch (err) {
    console.error('workbook.updateProgress error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteProgress(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query(`DELETE FROM public.workbook_progress WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('workbook.deleteProgress error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── Notes (this page's own meeting notes, separate from the main Meeting Notes feature) ──

const NOTE_SELECT = `id, project_id, title, to_char(note_date, 'YYYY-MM-DD') AS note_date, source, created_at`;

export async function listNotes(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  try {
    const { rows } = await pool.query(
      `SELECT ${NOTE_SELECT}, length(body) AS length, left(body, 240) AS preview
       FROM public.workbook_notes WHERE project_id = $1 ORDER BY note_date DESC, id DESC`, [projectId]);
    res.json({ notes: rows });
  } catch (err) {
    console.error('workbook.listNotes error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getNote(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows: [row] } = await pool.query(`SELECT ${NOTE_SELECT}, body FROM public.workbook_notes WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: 'Note not found' });
    res.json(row);
  } catch (err) {
    console.error('workbook.getNote error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Read an uploaded file into plain text and hand it back, without saving anything. The text goes into the Add
// advancement box so it can be checked and edited before it is used.
export async function parseNoteFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file' });
    const { text } = await parseFile(req.file.buffer, req.file.originalname);
    if (!String(text || '').trim()) return res.status(422).json({ error: 'No text could be read from that file' });
    res.json({ text: String(text), file_name: req.file.originalname });
  } catch (err) {
    console.error('workbook.parseNoteFile error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteNote(req, res) {
  const id = intOrNull(req.params.id);
  if (id == null) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query(`DELETE FROM public.workbook_notes WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('workbook.deleteNote error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── Add advancement ──────────────────────────────────────────────────────────

// Draft proposals from a note. Nothing is written. Anything the model returns that points at a row outside this
// project (or at nothing) is dropped, so the client only ever sees proposals it can show and apply.
export async function suggestAdvancement(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  try {
    let noteText = str(req.body?.text);
    const noteId = intOrNull(req.body?.note_id);
    if (noteId != null) {
      const { rows: [n] } = await pool.query(`SELECT body FROM public.workbook_notes WHERE id = $1 AND project_id = $2`, [noteId, projectId]);
      if (!n) return res.status(404).json({ error: 'Note not found' });
      noteText = n.body;
    }
    if (noteText.trim().length < 20) return res.status(400).json({ error: 'Add some notes first' });

    const { gate, items } = await loadWorkbook(pool, projectId);
    const owners = [...new Set([...items, ...gate].flatMap(r => String(r.owner || '').split('/').map(s => s.trim())).filter(Boolean))];
    const date = isoDate(req.body?.date) || new Date().toISOString().slice(0, 10);
    const raw = await suggestWorkbookUpdates({ noteText, noteDate: date, source: str(req.body?.source) || 'Meeting notes', gate, items, owners });

    const itemById = new Map(items.map(i => [i.id, i]));
    const gateByRef = new Map(gate.map(g => [g.ref, g]));

    // A target date is only accepted when the notes actually mention a date for the item. The model must quote the
    // words that gave it (target_basis); we check those words really appear in the notes and read as a date or a
    // time ("22 October", "next Friday", "by the end of the month"), and that the date is not in the past.
    const noteNorm = normText(noteText);
    const dateOk = (target, basis) => !!isoDate(target) && target >= date && basisMentionsDate(basis, noteNorm);

    const updates = [];
    for (const u of raw.updates) {
      if (u.kind === 'gate') {
        const g = gateByRef.get(String(u.gate_ref));
        if (!g) continue;
        if (!str(u.note).trim()) continue;
        updates.push({ kind: 'gate', gate_id: g.id, note: str(u.note), reason: str(u.reason), quote: str(u.quote) });
      } else {
        const it = itemById.get(Number(u.id));
        if (!it) continue;
        const status = STATUSES.includes(u.status) && u.status !== it.status ? u.status : undefined;
        const target = dateOk(u.target, u.target_basis) && u.target !== it.target ? u.target : undefined;
        const owner = u.owner && u.owner !== it.owner ? str(u.owner) : undefined;
        if (!u.note && !status && !target && !owner) continue;
        updates.push({ kind: 'item', item_id: it.id, note: str(u.note), status, target, target_basis: target ? str(u.target_basis).trim() : undefined, owner, reason: str(u.reason), quote: str(u.quote) });
      }
    }

    const newRows = [];
    for (const n of raw.new) {
      if (!ITEM_TYPES.includes(n.type) || !str(n.subject).trim()) continue;
      const parent = items.find(x => x.id === Number(n.parent_id));
      const parentOk = parent && ((n.type === 'action' && parent.type === 'risk') || (n.type === 'issue' && (parent.type === 'action' || parent.type === 'risk')));
      newRows.push({
        type: n.type, subject: str(n.subject).trim(), text: str(n.text || n.subject).trim(), owner: str(n.owner).trim(),
        priority: null,   // never taken from the model: the reviewer chooses it
        target: dateOk(n.target, n.target_basis) ? n.target : '', target_basis: dateOk(n.target, n.target_basis) ? str(n.target_basis).trim() : '',
        gate_refs: refList(n.gate_refs).filter(r => gateByRef.has(r)), parent_id: parentOk ? parent.id : null,
        reason: str(n.reason), quote: str(n.quote),
      });
    }

    const links = [];
    for (const l of raw.links) {
      const it = itemById.get(Number(l.item_id));
      if (!it) continue;
      const patch = {};
      const parent = items.find(x => x.id === Number(l.parent_id));
      if (parent && parent.id !== it.id && parent.id !== it.parent_id && ((it.type === 'action' && parent.type === 'risk') || (it.type === 'issue' && (parent.type === 'action' || parent.type === 'risk')))) patch.parent_id = parent.id;
      const add = refList(l.add_gate_refs).filter(r => gateByRef.has(r) && !(it.gate_refs || []).includes(r));
      if (add.length) patch.gate_refs = [...(it.gate_refs || []), ...add];
      if (!Object.keys(patch).length) continue;
      links.push({ item_id: it.id, patch, reason: str(l.reason), quote: str(l.quote) });
    }

    res.json({ summary: raw.summary, updates, new: newRows, links });
  } catch (err) {
    console.error('workbook.suggestAdvancement error:', err);
    res.status(500).json({ error: err.message || 'Failed to draft suggestions' });
  }
}

// Apply the ticked proposals in one transaction. Ops come from the client but every id is re-checked against the project.
export async function applyAdvancement(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  const { ops, date, source, summary, note_id, save_note, note_text, note_title } = req.body || {};
  if (!Array.isArray(ops) || !ops.length) return res.status(400).json({ error: 'Nothing to apply' });
  // Every new risk, action or issue needs a priority chosen by the person applying. Decisions have none.
  const noPriority = ops.filter(op => op.op === 'new_item' && op.data && op.data.type !== 'decision' && ![1, 2, 3].includes(Number(op.data.priority)));
  if (noPriority.length) return res.status(400).json({ error: `Choose a priority for ${noPriority.length === 1 ? 'the new row' : 'each new row'}, or remove it.` });
  const when = isoDate(date) || new Date().toISOString().slice(0, 10);
  const src = str(source).trim() || 'Meeting notes';
  const mark = stamp(when);
  const userId = req.user?.id ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let applied = 0;
    for (const op of ops) {
      if (op.op === 'item_update') {
        const { rows: [it] } = await client.query(`SELECT id, item_type, update_text FROM public.workbook_items WHERE id = $1 AND project_id = $2`, [intOrNull(op.item_id), projectId]);
        if (!it) continue;
        const sets = [], vals = [];
        const add = (col, val, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`); };
        if (STATUSES.includes(op.status)) add('status', op.status);
        if (isoDate(op.target)) add('target_on', op.target, '::date');
        if (str(op.owner).trim()) add('owner', str(op.owner).trim());
        const note = str(op.note).trim();
        if (note) {
          if (it.item_type === 'action') {
            await client.query(`INSERT INTO public.workbook_progress (item_id, entry_date, source, body, created_by) VALUES ($1, $2::date, $3, $4, $5)`, [it.id, when, src, note, userId]);
          } else {
            add('update_text', mark + note + (it.update_text ? '\n' + it.update_text : ''));
          }
        }
        if (sets.length) { vals.push(it.id); await client.query(`UPDATE public.workbook_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals); }
        else if (note) await client.query(`UPDATE public.workbook_items SET updated_at = now() WHERE id = $1`, [it.id]);
        applied++;
      } else if (op.op === 'gate_update') {
        const { rows: [g] } = await client.query(`SELECT id, comment FROM public.workbook_gate_questions WHERE id = $1 AND project_id = $2`, [intOrNull(op.gate_id), projectId]);
        if (!g) continue;
        // The AI never proposes a score (the suggest step drops them). A score can only arrive here because the person
        // reviewing the suggestions set one by hand, so it is accepted as long as it is a whole number from 0 to 5.
        const sets = [], vals = [];
        const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
        const score = Number(op.score);
        if (op.score !== undefined && op.score !== null && Number.isInteger(score) && score >= 0 && score <= 5) add('score', score);
        const note = str(op.note).trim();
        if (note) add('comment', mark + note + (g.comment ? '\n' + g.comment : ''));
        if (!sets.length) continue;
        vals.push(g.id);
        await client.query(`UPDATE public.workbook_gate_questions SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
        applied++;
      } else if (op.op === 'new_item') {
        const d = op.data || {};
        if (!ITEM_TYPES.includes(d.type) || !str(d.subject).trim()) continue;
        const id = await insertItem(client, projectId, { ...d, raised: when, update: d.type === 'action' || d.type === 'decision' ? '' : `${mark}Raised from ${src.toLowerCase()}.` }, userId);
        if (d.type === 'action') {
          await client.query(`INSERT INTO public.workbook_progress (item_id, entry_date, source, body, created_by) VALUES ($1, $2::date, $3, $4, $5)`, [id, when, src, `Raised from ${src.toLowerCase()}.`, userId]);
        }
        applied++;
      } else if (op.op === 'link') {
        const { rows: [it] } = await client.query(`SELECT id, item_type FROM public.workbook_items WHERE id = $1 AND project_id = $2`, [intOrNull(op.item_id), projectId]);
        if (!it) continue;
        const sets = [], vals = [];
        const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
        const patch = op.patch || {};
        if ('parent_id' in patch) add('parent_id', await validParent(client, projectId, it.item_type, intOrNull(patch.parent_id), it.id));
        if ('gate_refs' in patch) add('gate_refs', refList(patch.gate_refs));
        if (!sets.length) continue;
        vals.push(it.id);
        await client.query(`UPDATE public.workbook_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
        applied++;
      }
    }
    let noteRef = intOrNull(note_id);
    // "Keep a copy of these notes": the note is only stored now, once the changes are applied, so a note you paste
    // just to try the suggestions is never saved.
    if (!noteRef && save_note && str(note_text).trim()) {
      const { rows: [n] } = await client.query(
        `INSERT INTO public.workbook_notes (project_id, title, note_date, source, body, created_by)
         VALUES ($1, $2, $3::date, $4, $5, $6) RETURNING id`,
        [projectId, str(note_title).trim().slice(0, 200) || `${src} ${when}`, when, src, str(note_text).slice(0, 200000), userId]
      );
      noteRef = n.id;
    }
    await client.query(
      `INSERT INTO public.workbook_advancements (project_id, note_id, advancement_date, source, summary, applied_count, created_by)
       VALUES ($1, (SELECT id FROM public.workbook_notes WHERE id = $2 AND project_id = $1), $3::date, $4, $5, $6, $7)`,
      [projectId, noteRef, when, src, str(summary).slice(0, 2000), applied, userId]
    );
    await client.query('COMMIT');
    res.json({ applied, note_id: noteRef, ...(await loadWorkbook(pool, projectId)) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('workbook.applyAdvancement error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
