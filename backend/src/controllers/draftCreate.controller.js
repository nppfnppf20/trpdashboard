/**
 * Draft Create Controller
 * Powers the "Create" panel — turns a free-form custom prompt into a
 * complete HTML document, optionally wrapped in the practice's house style
 * (capitalisation, formatting, and anti-AI-slop rules shared with every
 * other generation prompt in the app).
 */

import { callLLM, resolveProvider, noEmDash, HOUSE_STYLE_BLOCK, ANTI_AI_SLOP_BLOCK } from '../services/llm.shared.js';

const BASE_SYSTEM_PROMPT = `You are a specialist UK planning consultant producing a professional document exactly as instructed by the brief below.

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- No markdown characters (**, *, #, ---) and no em dashes (—)
- Do not include a document title unless the brief below asks for one`;

export async function generateCustomDraft(req, res) {
  const { prompt, provider, use_house_style } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const resolvedProvider = await resolveProvider('draft_create', provider);
    const styleBlock = use_house_style === false ? '' : `${HOUSE_STYLE_BLOCK}${ANTI_AI_SLOP_BLOCK}`;

    const raw = await callLLM({
      provider: resolvedProvider,
      maxTokens: 8000,
      system: `${BASE_SYSTEM_PROMPT}${styleBlock}`,
      prompt: prompt.trim(),
    });

    const html = noEmDash(raw.trim().replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
    res.json({ html });
  } catch (err) {
    console.error('draftCreate.generate error:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}
