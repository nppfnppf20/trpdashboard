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

export async function createNote(req, res) {
  const projectId = pid(req, res); if (projectId == null) return;
  try {
    let body = str(req.body?.text);
    let fileName = null;
    if (req.file) {
      ({ text: body } = await parseFile(req.file.buffer, req.file.originalname));
      fileName = req.file.originalname;
    }
    body = body.trim();
    if (!body) return res.status(400).json({ error: 'Paste some text or choose a file' });
    const title = str(req.body?.title).trim() || (fileName ? fileName.replace(/\.[^.]+$/, '') : 'Meeting notes');
    const { rows: [row] } = await pool.query(
      `INSERT INTO public.workbook_notes (project_id, title, note_date, source, body, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6) RETURNING ${NOTE_SELECT}, body`,
      [projectId, title, isoDate(req.body?.date), str(req.body?.source).trim() || 'Meeting notes', body, req.user?.id ?? null]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('workbook.createNote error:', err);
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
    const okDate = d => isoDate(d) || undefined;

    const updates = [];
    for (const u of raw.updates) {
      if (u.kind === 'gate') {
        const g = gateByRef.get(String(u.gate_ref));
        if (!g) continue;
        const score = Number.isInteger(u.score) && u.score >= 0 && u.score <= 5 && u.score !== g.score ? u.score : undefined;
        if (!u.note && score === undefined) continue;
        updates.push({ kind: 'gate', gate_id: g.id, note: str(u.note), score, reason: str(u.reason), quote: str(u.quote) });
      } else {
        const it = itemById.get(Number(u.id));
        if (!it) continue;
        const status = STATUSES.includes(u.status) && u.status !== it.status ? u.status : undefined;
        const target = okDate(u.target) && u.target !== it.target ? u.target : undefined;
        const owner = u.owner && u.owner !== it.owner ? str(u.owner) : undefined;
        if (!u.note && !status && !target && !owner) continue;
        updates.push({ kind: 'item', item_id: it.id, note: str(u.note), status, target, owner, reason: str(u.reason), quote: str(u.quote) });
      }
    }

    const newRows = [];
    for (const n of raw.new) {
      if (!ITEM_TYPES.includes(n.type) || !str(n.subject).trim()) continue;
      const parent = items.find(x => x.id === Number(n.parent_id));
      const parentOk = parent && ((n.type === 'action' && parent.type === 'risk') || (n.type === 'issue' && (parent.type === 'action' || parent.type === 'risk')));
      newRows.push({
        type: n.type, subject: str(n.subject).trim(), text: str(n.text || n.subject).trim(), owner: str(n.owner).trim(),
        priority: [1, 2, 3].includes(n.priority) ? n.priority : 2, target: okDate(n.target) || '',
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
  const { ops, date, source, summary, note_id } = req.body || {};
  if (!Array.isArray(ops) || !ops.length) return res.status(400).json({ error: 'Nothing to apply' });
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
    const noteRef = intOrNull(note_id);
    await client.query(
      `INSERT INTO public.workbook_advancements (project_id, note_id, advancement_date, source, summary, applied_count, created_by)
       VALUES ($1, (SELECT id FROM public.workbook_notes WHERE id = $2 AND project_id = $1), $3::date, $4, $5, $6, $7)`,
      [projectId, noteRef, when, src, str(summary).slice(0, 2000), applied, userId]
    );
    await client.query('COMMIT');
    res.json({ applied, ...(await loadWorkbook(pool, projectId)) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('workbook.applyAdvancement error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
