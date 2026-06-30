/**
 * Marketing Controller
 * Card-based content generation: LinkedIn posts, newsletters.
 * Not project-specific — one draft per type globally.
 */

import { pool } from '../db.js';
import { callClaude, MODEL_SONNET } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';

const DEFAULT_PROMPTS = {
  now_linkedin: `You are a marketing copywriter for a planning and development consultancy.
Write a short "what's happening right now" LinkedIn post.

Rules:
- 50–100 words maximum
- Lead with the most newsworthy fact — what is happening now
- Professional but energetic tone
- No hashtags unless genuinely informative
- Never open with "Excited to announce", "Thrilled to share", "Delighted to" or similar hollow phrases
- Output clean HTML using <p> tags only — no headings`,

  short_linkedin: `You are a marketing copywriter for a planning and development consultancy.
Write a professional LinkedIn post.

Rules:
- 150–300 words
- Lead with a hook — a striking fact, question, or insight
- Middle: context, challenge, or significance
- End: clear takeaway or invitation to engage
- Professional tone, accessible to a non-specialist audience
- Never open with "Excited to", "Thrilled to", "Delighted to" or similar hollow phrases
- Output clean HTML using <p> tags, <ul>/<li> for lists if helpful`,

  long_newsletter: `You are a marketing copywriter for a planning and development consultancy.
Write a long-form newsletter article.

Rules:
- 600–900 words
- Structure: introduction, background, key challenge or context, our approach, outcomes or significance, conclusion
- Written for an informed professional audience — planners, developers, local stakeholders
- Authoritative and clear — no marketing fluff or hollow openers
- Output clean HTML using <h2> for section headings, <p> for body text, <ul>/<li> for lists`,
};

export async function getDraftTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, description, sort_order FROM marketing.draft_types ORDER BY sort_order, id`
    );
    res.json(rows);
  } catch (err) {
    console.error('marketing.getDraftTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch draft types' });
  }
}

export async function getDraft(req, res) {
  const { typeId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT content_html, generated_at, updated_at FROM marketing.drafts WHERE draft_type_id = $1`,
      [typeId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error('marketing.getDraft error:', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
}

export async function saveDraft(req, res) {
  const { typeId } = req.params;
  const { content_html } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO marketing.drafts (draft_type_id, content_html, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (draft_type_id)
       DO UPDATE SET content_html = EXCLUDED.content_html, updated_at = now()
       RETURNING content_html, generated_at, updated_at`,
      [typeId, content_html]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('marketing.saveDraft error:', err);
    res.status(500).json({ error: 'Failed to save draft' });
  }
}

export async function generateDraft(req, res) {
  const { typeId } = req.params;
  try {
    const { rows: typeRows } = await pool.query(
      `SELECT slug, name FROM marketing.draft_types WHERE id = $1`,
      [typeId]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Draft type not found' });

    const type = typeRows[0];
    const guidingBrief = await getGuidingBrief(type.slug, null).catch(() => null);

    let systemPrompt = DEFAULT_PROMPTS[type.slug] ?? DEFAULT_PROMPTS.short_linkedin;
    if (guidingBrief?.guidance_content) {
      systemPrompt += `\n\n## Guiding Brief\n${guidingBrief.guidance_content}`;
    }
    if (guidingBrief?.style_example) {
      systemPrompt += `\n\n## Style / Tone Reference\nMatch the style and tone of the following example. Use it for register and structure only — do not copy its content, facts, or details:\n<style_example>\n${guidingBrief.style_example}\n</style_example>`;
    }

    const userMessage = req.body?.user_notes
      ? `Write a ${type.name}.\n\nContext / notes:\n${req.body.user_notes}`
      : `Write a ${type.name}.`;

    const contentHtml = await callClaude(systemPrompt, userMessage, MODEL_SONNET, 2048);

    const { rows } = await pool.query(
      `INSERT INTO marketing.drafts (draft_type_id, content_html, generated_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (draft_type_id)
       DO UPDATE SET content_html = EXCLUDED.content_html, generated_at = now(), updated_at = now()
       RETURNING content_html, generated_at, updated_at`,
      [typeId, contentHtml]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('marketing.generateDraft error:', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate draft' });
  }
}
