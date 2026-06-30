/**
 * Marketing Controller
 * Card-based content generation: LinkedIn posts, newsletters.
 * Not project-specific — one draft per type globally.
 */

import { pool } from '../db.js';
import { callClaude, MODEL_SONNET } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';

const DEFAULT_PROMPTS = {
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

function stripHtml(html) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function buildTopicContext(selectedTopicKeys = []) {
  if (!selectedTopicKeys.length) return null;

  const docIds    = selectedTopicKeys.filter(k => k.startsWith('document:')).map(k => parseInt(k.split(':')[1]));
  const insightIds = selectedTopicKeys.filter(k => k.startsWith('insight:')).map(k => parseInt(k.split(':')[1]));

  const topicRows = [];

  if (docIds.length) {
    const { rows } = await pool.query(
      `SELECT title, summary_html, key_points, implications, 'document' AS source_type
       FROM admin_console.policy_documents WHERE id = ANY($1)`,
      [docIds]
    );
    topicRows.push(...rows);
  }

  if (insightIds.length) {
    const { rows } = await pool.query(
      `SELECT topic AS title, detail, raised_by, meeting_type, 'insight' AS source_type
       FROM admin_console.extracted_insights WHERE id = ANY($1)`,
      [insightIds]
    );
    topicRows.push(...rows);
  }

  if (!topicRows.length) return null;

  return topicRows.map(t => {
    const lines = [`### ${t.title}`];
    if (t.source_type === 'document') {
      if (t.summary_html) lines.push(`Summary: ${stripHtml(t.summary_html)}`);
      if (t.key_points)   lines.push(`Key points: ${t.key_points}`);
      if (t.implications) lines.push(`Implications: ${stripHtml(t.implications)}`);
    } else {
      const src = t.meeting_type === 'cpd' ? 'CPD' : 'Internal Meeting';
      lines.push(`Source: ${src}`);
      if (t.detail)    lines.push(`Detail: ${t.detail}`);
      if (t.raised_by) lines.push(`Raised by: ${t.raised_by}`);
    }
    return lines.join('\n');
  }).join('\n\n');
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
    const { selected_topic_keys: selectedTopicKeys = [], user_angle: userAngle } = req.body ?? {};

    const guidingBrief = await getGuidingBrief(type.slug, null).catch(() => null);

    let systemPrompt = DEFAULT_PROMPTS[type.slug] ?? DEFAULT_PROMPTS.short_linkedin;
    if (guidingBrief?.guidance_content) {
      systemPrompt += `\n\n## Guiding Brief\n${guidingBrief.guidance_content}`;
    }
    if (guidingBrief?.style_example) {
      systemPrompt += `\n\n## Style / Tone Reference\nMatch the style and tone of the following example. Use it for register and structure only — do not copy its content, facts, or details:\n<style_example>\n${guidingBrief.style_example}\n</style_example>`;
    }

    const topicContext = await buildTopicContext(selectedTopicKeys);

    let userMessage = `Write a ${type.name}.`;
    if (topicContext) {
      userMessage += `\n\n## Relevant Policy Context\nThe following policy updates and topics are relevant — use them as factual context and substance for the content:\n\n${topicContext}`;
    }
    if (userAngle?.trim()) {
      userMessage += `\n\n## My Angle\nThe specific angle, message, or focus for this piece:\n${userAngle.trim()}`;
    }

    systemPrompt += '\n\n## Formatting rules\n- Never use em dashes (—) under any circumstances. Use a comma, colon, or restructure the sentence instead.';

    const raw = await callClaude(systemPrompt, userMessage, MODEL_SONNET, 2048);
    const firstTag = raw.indexOf('<');
    const contentHtml = firstTag > 0 ? raw.slice(firstTag) : raw;

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
