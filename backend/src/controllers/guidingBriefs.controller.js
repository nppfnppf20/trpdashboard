import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FAST } from '../services/llm.shared.js';

const client = new Anthropic();

export async function listDocumentTypes(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT value, label FROM (
        SELECT slug AS value, name AS label FROM appeals.appeal_draft_types
        UNION
        SELECT slug AS value, name AS label FROM planning_applications.draft_types
        UNION
        SELECT slug AS value, name AS label FROM marketing.draft_types
        UNION
        -- Legacy values that exist in guiding briefs but have no draft type entry (e.g. 'hlpv' alias)
        SELECT document_type AS value, document_type AS label
        FROM admin_console.guiding_briefs
        WHERE document_type NOT IN (
          SELECT slug FROM appeals.appeal_draft_types
          UNION ALL
          SELECT slug FROM planning_applications.draft_types
          UNION ALL
          SELECT slug FROM marketing.draft_types
        )
      ) t
      ORDER BY label
    `);
    res.json(rows);
  } catch (err) {
    console.error('listDocumentTypes error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function listGuidingBriefs(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, document_type, development_type,
              guidance_content, review_checklist, meeting_prompt, style_example, sort_order
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
            guidance_content, review_checklist, style_example
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
  const { name, document_type, development_type, guidance_content, review_checklist, meeting_prompt, style_example } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!document_type?.trim()) return res.status(400).json({ error: 'document_type is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.guiding_briefs
         (name, document_type, development_type, guidance_content, review_checklist, meeting_prompt, style_example)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, document_type, development_type,
                 guidance_content, review_checklist, meeting_prompt, style_example, sort_order`,
      [
        name.trim(),
        document_type.trim(),
        development_type?.trim() || null,
        guidance_content?.trim() || null,
        review_checklist?.trim() || null,
        meeting_prompt?.trim() || null,
        style_example?.trim() || null,
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
  const { name, document_type, development_type, guidance_content, review_checklist, meeting_prompt, style_example, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE admin_console.guiding_briefs
       SET name             = COALESCE($1, name),
           document_type    = COALESCE($2, document_type),
           development_type = $3,
           guidance_content = $4,
           review_checklist = $5,
           meeting_prompt   = $6,
           style_example    = $7,
           sort_order       = COALESCE($8, sort_order),
           updated_at       = NOW()
       WHERE id = $9
       RETURNING id, name, document_type, development_type,
                 guidance_content, review_checklist, meeting_prompt, style_example, sort_order`,
      [
        name?.trim() || null,
        document_type?.trim() || null,
        development_type?.trim() || null,
        guidance_content?.trim() || null,
        review_checklist?.trim() || null,
        meeting_prompt?.trim() ?? null,
        style_example?.trim() ?? null,
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
      max_tokens: 2500,
      system: 'You are a planning consultant reviewing a draft document. Return only valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    });

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let items;
    try {
      items = JSON.parse(raw);
    } catch {
      // Fallback: extract the first [...] array block from the response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try { items = JSON.parse(match[0]); }
        catch {
          console.error('[guidingBriefs.reviewDraft] parse fallback failed. raw:', raw.slice(0, 400));
          return res.status(500).json({ error: 'Failed to parse review response' });
        }
      } else {
        console.error('[guidingBriefs.reviewDraft] no JSON array found. raw:', raw.slice(0, 400));
        return res.status(500).json({ error: 'Failed to parse review response' });
      }
    }

    res.json({ items });
  } catch (err) {
    console.error('guidingBriefs.reviewDraft error:', err);
    res.status(500).json({ error: 'Failed to review draft' });
  }
}
