import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_SONNET } from '../services/llm.shared.js';
import { parseFile } from '../services/parser.service.js';

const client = new Anthropic();

export async function sectionChat(req, res) {
  const { projectId } = req.params;
  const { messages, paragraphs, doc_text, doc_title } = req.body;

  if (!messages?.length) return res.status(400).json({ error: 'messages required' });
  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name FROM public.projects WHERE id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    const stripHtml = html => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const selectedBlock = paragraphs.map(p => stripHtml(p.html)).filter(Boolean).join('\n\n');

    const docBlock = doc_text?.trim()
      ? `\n\n## Source Document${doc_title ? ` — "${doc_title}"` : ''}\nThis is the primary source material. Extract and use the relevant facts and descriptions from it when drafting.\n\n${doc_text.trim().slice(0, 15000)}`
      : '';

    const systemPrompt = `You are a senior planning consultant helping to update specific paragraphs of a planning document for project "${projectRows[0].project_name}".

The user has selected the following paragraphs to work on:
<selected-content>
${selectedBlock}
</selected-content>

You are in a back-and-forth conversation. On every turn:
1. Give a brief conversational reply (plain text, 1-3 sentences)
2. Provide updated HTML for the selected content

Always end your response with the updated content inside exactly these tags — even on the first turn:
<section-draft>
[updated HTML here]
</section-draft>

HTML rules: <h2> for section headings, <h3> for subsections, <p> for paragraphs, <ul><li> for lists, <strong> for bold. No markdown. No em dashes (—). If a specific fact is not in the source material or the existing content, write [SOURCE REQUIRED] in its place. Never invent project-specific information.${docBlock}`;

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const raw = response.content[0].text.trim();
    const draftMatch = raw.match(/<section-draft>([\s\S]*?)<\/section-draft>/);
    const sectionHtml = draftMatch
      ? draftMatch[1].trim().replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim()
      : null;
    const reply = raw.replace(/<section-draft>[\s\S]*?<\/section-draft>/, '').trim();

    return res.json({ reply, section_html: sectionHtml });
  } catch (err) {
    console.error('sectionChat error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function parseSectionDoc(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await parseFile(req.file.buffer, req.file.originalname);
    const text = typeof result === 'string' ? result : result.text;
    res.json({ text: (text || '').slice(0, 20000), warning: result.warning ?? null });
  } catch (err) {
    console.error('sectionChat.parseDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}
