import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FAST } from '../services/llm.shared.js';

const client = new Anthropic();

export async function listGuidingBriefs(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, document_type, development_type,
              guidance_content, review_checklist, sort_order
       FROM admin_console.guiding_briefs
       ORDER BY document_type, sort_order, name`
    );
    res.json(rows);
  } catch (err) {
    console.error('guidingBriefs.list error:', err);
    res.status(500).json({ error: 'Failed to fetch guiding briefs' });
  }
}

export async function getGuidingBrief(document_type, development_type) {
  const { rows } = await pool.query(
    `SELECT id, name, document_type, development_type,
            guidance_content, review_checklist
     FROM admin_console.guiding_briefs
     WHERE document_type = $1
       AND (development_type = $2 OR development_type IS NULL)
     ORDER BY (development_type = $2) DESC NULLS LAST
     LIMIT 1`,
    [document_type, development_type || null]
  );
  return rows[0] || null;
}

export async function createGuidingBrief(req, res) {
  const { name, document_type, development_type, guidance_content, review_checklist } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!document_type?.trim()) return res.status(400).json({ error: 'document_type is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.guiding_briefs
         (name, document_type, development_type, guidance_content, review_checklist)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, document_type, development_type,
                 guidance_content, review_checklist, sort_order`,
      [
        name.trim(),
        document_type.trim(),
        development_type?.trim() || null,
        guidance_content?.trim() || null,
        review_checklist?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A guiding brief for this document type and development type already exists' });
    }
    console.error('guidingBriefs.create error:', err);
    res.status(500).json({ error: 'Failed to create guiding brief' });
  }
}

export async function updateGuidingBrief(req, res) {
  const { id } = req.params;
  const { name, document_type, development_type, guidance_content, review_checklist, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.guiding_briefs
       SET name             = COALESCE($1, name),
           document_type    = COALESCE($2, document_type),
           development_type = $3,
           guidance_content = $4,
           review_checklist = $5,
           sort_order       = COALESCE($6, sort_order),
           updated_at       = NOW()
       WHERE id = $7
       RETURNING id, name, document_type, development_type,
                 guidance_content, review_checklist, sort_order`,
      [
        name?.trim() || null,
        document_type?.trim() || null,
        development_type?.trim() || null,
        guidance_content?.trim() || null,
        review_checklist?.trim() || null,
        sort_order ?? null,
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Guiding brief not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A guiding brief for this document type and development type already exists' });
    }
    console.error('guidingBriefs.update error:', err);
    res.status(500).json({ error: 'Failed to update guiding brief' });
  }
}

export async function deleteGuidingBrief(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM admin_console.guiding_briefs WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Guiding brief not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('guidingBriefs.delete error:', err);
    res.status(500).json({ error: 'Failed to delete guiding brief' });
  }
}

export async function reviewDraft(req, res) {
  const { draft_html, document_type, development_type } = req.body;
  if (!draft_html?.trim()) return res.status(400).json({ error: 'draft_html is required' });
  if (!document_type?.trim()) return res.status(400).json({ error: 'document_type is required' });

  try {
    const brief = await getGuidingBrief(document_type, development_type || null);

    if (!brief?.review_checklist?.trim()) {
      return res.json({ items: [], no_brief: !brief, no_checklist: !!brief });
    }

    const draftText = draft_html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20000);

    const prompt = `You are reviewing a draft planning document against a practice checklist.

Review Checklist:
${brief.review_checklist.trim()}

Draft Document (plain text):
${draftText}

For each distinct topic or item in the checklist, assess whether the draft covers it adequately. Return a JSON array — one object per checklist item — with this shape:
[{
  "topic": "short label for the checklist item",
  "status": "present" | "partial" | "missing",
  "suggestion": "one concise sentence explaining what is missing or could be strengthened, or null if status is present"
}]

Rules:
- "present" = clearly and adequately addressed
- "partial" = mentioned but thin, vague, or incomplete
- "missing" = not addressed at all
- Keep suggestions short and actionable — one sentence maximum
- Return ONLY valid JSON — no explanation, no markdown fences`;

    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 1500,
      system: 'You are a planning consultant reviewing a draft document. Return only valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    });

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let items;
    try {
      items = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse review response' });
    }

    res.json({ items });
  } catch (err) {
    console.error('guidingBriefs.reviewDraft error:', err);
    res.status(500).json({ error: 'Failed to review draft' });
  }
}
