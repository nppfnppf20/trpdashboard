/**
 * Create Doc Types controller
 * CRUD for admin_console.create_doc_types: the document types offered on the
 * Create card (which Word template each exports with, plus an optional
 * example document and structure notes the AI is given as a style guide).
 */

import { pool } from '../db.js';

const COLUMNS = 'id, name, slug, word_template, example_text, structure_notes, sort_order, is_active';

// Template paths are the static .docx URLs the Word export already uses, e.g.
// '/letter.docx' or '/planning%20statement%20template%20c%20and%20s.docx'.
const TEMPLATE_PATH = /^\/[A-Za-z0-9%._\-]+\.docx$/;

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'doc_type';
}

function cleanTemplate(value) {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) return { value: null };
  if (!TEMPLATE_PATH.test(t)) return { error: 'word_template must be a .docx path such as /letter.docx' };
  return { value: t };
}

const textOrNull = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function listCreateDocTypes(req, res) {
  try {
    const onlyActive = req.query.active === '1' || req.query.active === 'true';
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM admin_console.create_doc_types
       ${onlyActive ? 'WHERE is_active = true' : ''}
       ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (err) {
    console.error('createDocTypes.list error:', err);
    res.status(500).json({ error: 'Failed to fetch document types' });
  }
}

export async function createCreateDocType(req, res) {
  const { name, word_template, example_text, structure_notes, sort_order, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const template = cleanTemplate(word_template);
  if (template.error) return res.status(400).json({ error: template.error });

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.create_doc_types
         (name, slug, word_template, example_text, structure_notes, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [name.trim(), slugify(name), template.value, textOrNull(example_text), textOrNull(structure_notes), sort_order ?? 0, is_active ?? true]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A document type with that name already exists' });
    console.error('createDocTypes.create error:', err);
    res.status(500).json({ error: 'Failed to create document type' });
  }
}

export async function updateCreateDocType(req, res) {
  const { id } = req.params;
  const { name, word_template, example_text, structure_notes, sort_order, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const template = cleanTemplate(word_template);
  if (template.error) return res.status(400).json({ error: template.error });

  try {
    // The slug is deliberately left alone on rename: it is a stable key.
    const { rows } = await pool.query(
      `UPDATE admin_console.create_doc_types
         SET name = $1, word_template = $2, example_text = $3, structure_notes = $4,
             sort_order = $5, is_active = $6, updated_at = now()
       WHERE id = $7
       RETURNING ${COLUMNS}`,
      [name.trim(), template.value, textOrNull(example_text), textOrNull(structure_notes), sort_order ?? 0, is_active ?? true, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document type not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('createDocTypes.update error:', err);
    res.status(500).json({ error: 'Failed to update document type' });
  }
}

export async function deleteCreateDocType(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM admin_console.create_doc_types WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Document type not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('createDocTypes.delete error:', err);
    res.status(500).json({ error: 'Failed to delete document type' });
  }
}
