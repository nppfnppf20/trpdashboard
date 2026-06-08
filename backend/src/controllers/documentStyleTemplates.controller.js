import { pool } from '../db.js';

export async function listDocumentStyleTemplates(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT dst.id, dst.name, dst.guiding_brief_id, dst.style_text, dst.notes, dst.sort_order,
              gb.document_type, gb.development_type, gb.name AS guiding_brief_name
       FROM admin_console.document_style_templates dst
       LEFT JOIN admin_console.guiding_briefs gb ON gb.id = dst.guiding_brief_id
       ORDER BY gb.document_type NULLS LAST, dst.sort_order, dst.name`
    );
    res.json(rows);
  } catch (err) {
    console.error('documentStyleTemplates.list error:', err);
    res.status(500).json({ error: 'Failed to fetch style templates' });
  }
}

export async function getDocumentStyleTemplateByBriefId(guiding_brief_id) {
  const { rows } = await pool.query(
    `SELECT id, name, guiding_brief_id, style_text, notes, sort_order
     FROM admin_console.document_style_templates
     WHERE guiding_brief_id = $1
     ORDER BY sort_order, name
     LIMIT 1`,
    [guiding_brief_id]
  );
  return rows[0] || null;
}

export async function getDocumentStyleTemplateByDocType(document_type, development_type) {
  const { rows } = await pool.query(
    `SELECT dst.id, dst.name, dst.guiding_brief_id, dst.style_text, dst.notes
     FROM admin_console.document_style_templates dst
     JOIN admin_console.guiding_briefs gb ON gb.id = dst.guiding_brief_id
     WHERE gb.document_type = $1
       AND (gb.development_type = $2 OR gb.development_type IS NULL)
     ORDER BY (gb.development_type = $2) DESC NULLS LAST, dst.sort_order
     LIMIT 1`,
    [document_type, development_type || null]
  );
  return rows[0] || null;
}

export async function createDocumentStyleTemplate(req, res) {
  const { name, guiding_brief_id, style_text, notes, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.document_style_templates
         (name, guiding_brief_id, style_text, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, guiding_brief_id, style_text, notes, sort_order`,
      [
        name.trim(),
        guiding_brief_id || null,
        style_text?.trim() || null,
        notes?.trim() || null,
        sort_order ?? 0,
      ]
    );
    const row = rows[0];
    if (row.guiding_brief_id) {
      const { rows: gb } = await pool.query(
        `SELECT document_type, development_type, name AS guiding_brief_name FROM admin_console.guiding_briefs WHERE id = $1`,
        [row.guiding_brief_id]
      );
      Object.assign(row, gb[0] || {});
    }
    res.status(201).json(row);
  } catch (err) {
    console.error('documentStyleTemplates.create error:', err);
    res.status(500).json({ error: 'Failed to create style template' });
  }
}

export async function updateDocumentStyleTemplate(req, res) {
  const { id } = req.params;
  const { name, guiding_brief_id, style_text, notes, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.document_style_templates
       SET name             = COALESCE($1, name),
           guiding_brief_id = $2,
           style_text       = $3,
           notes            = $4,
           sort_order       = COALESCE($5, sort_order),
           updated_at       = NOW()
       WHERE id = $6
       RETURNING id, name, guiding_brief_id, style_text, notes, sort_order`,
      [
        name?.trim() || null,
        guiding_brief_id || null,
        style_text?.trim() || null,
        notes?.trim() || null,
        sort_order ?? null,
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Style template not found' });
    const row = rows[0];
    if (row.guiding_brief_id) {
      const { rows: gb } = await pool.query(
        `SELECT document_type, development_type, name AS guiding_brief_name FROM admin_console.guiding_briefs WHERE id = $1`,
        [row.guiding_brief_id]
      );
      Object.assign(row, gb[0] || {});
    }
    res.json(row);
  } catch (err) {
    console.error('documentStyleTemplates.update error:', err);
    res.status(500).json({ error: 'Failed to update style template' });
  }
}

export async function deleteDocumentStyleTemplate(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM admin_console.document_style_templates WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Style template not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('documentStyleTemplates.delete error:', err);
    res.status(500).json({ error: 'Failed to delete style template' });
  }
}
