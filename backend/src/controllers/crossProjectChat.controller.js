import { pool } from '../db.js';
import { client, MODEL_SONNET, ANTI_AI_SLOP_BLOCK } from '../services/llm.shared.js';
import { getMultiProjectCatalogue, assembleMultiProjectContext, CONTEXT_BUDGET } from '../services/crossProjectChat.service.js';
import { getTone } from '../services/emailTones.service.js';

function emailToneInstructions(tone) {
  if (!tone) return '';
  const guidance = tone.guidance_notes?.trim()
    ? `\n\nInstructions for this tone — follow these precisely, they override any stylistic default or habit:\n${tone.guidance_notes.trim()}`
    : '';
  return `\n\nIf — and only if — the user asks you to compose, draft, or write an email, write its prose in the following tone/style, modelled on these real examples the user has sent before. This does not apply to normal Q&A answers, and does not relax the citation/grounding rules above for any factual claims the email contains.\n\nTone: ${tone.label}\nExample emails:\n${tone.sample_text}${guidance}`;
}

function parseCitationsArray(text) {
  const t = text.trim();
  try { const v = JSON.parse(t); return Array.isArray(v) ? v : []; } catch {}
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try { const v = JSON.parse(t.slice(start, end + 1)); return Array.isArray(v) ? v : []; } catch {}
  }
  return [];
}

export async function getSources(req, res) {
  const { project_ids } = req.body;
  if (!Array.isArray(project_ids) || !project_ids.length) {
    return res.status(400).json({ error: 'project_ids required' });
  }
  try {
    const projects = await getMultiProjectCatalogue(project_ids);
    res.json({ projects });
  } catch (err) {
    console.error('crossProjectChat.getSources error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function chat(req, res) {
  const { project_ids, messages, sources, emailToneId } = req.body;

  if (!Array.isArray(project_ids) || !project_ids.length) {
    return res.status(400).json({ error: 'project_ids required' });
  }
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  try {
    const emailTone = emailToneId ? await getTone(req.user.id, emailToneId) : null;

    const { rows: projectRows } = await pool.query(
      `SELECT id, project_name, client FROM public.projects WHERE id = ANY($1::int[])`,
      [project_ids]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'No matching projects found' });

    const projectNames = Object.fromEntries(projectRows.map(p => [p.id, p.project_name]));
    const { blocks, totalChars } = await assembleMultiProjectContext(projectNames, sources ?? {});

    if (!blocks.length) {
      return res.status(400).json({ error: 'No sources selected. Tick at least one source across your projects to chat.' });
    }
    if (totalChars > CONTEXT_BUDGET) {
      const pct = Math.round(totalChars / CONTEXT_BUDGET * 100);
      return res.status(400).json({
        error: `Selected sources exceed the context budget (~${pct}%). Untick some sources and try again.`,
      });
    }

    const sourceBlocks = blocks
      .map(b => `<source id="${b.sourceId}" name="${b.label}">\n${b.text}\n</source>`)
      .join('\n\n');

    const selectedIds = new Set(blocks.map(b => b.sourceId));
    const projectList = projectRows.map(p => `"${p.project_name}"${p.client ? ` (client: ${p.client})` : ''}`).join(', ');

    const systemPrompt = `You are a planning consultant's assistant answering questions across MULTIPLE projects: ${projectList}.

Grounding rules — these are absolute:
- Answer ONLY from the source blocks below. Never use outside knowledge for any project-specific claim. You may use general planning knowledge to explain terminology, but never to assert project facts.
- Every factual claim must carry an inline citation of its source ID in square brackets, e.g. [57:COND] or [114:D12]. Where the source shows a section, paragraph, date, or named entry, include it: [57:COND §4.2]. Source IDs are prefixed with the project's numeric ID so you can tell which project each fact belongs to — always keep that prefix in citations.
- When comparing or summarizing across projects, be explicit about which project each fact came from (by name, not just the ID prefix).
- If the answer is not in the sources, say so plainly ("The selected sources don't cover this.").
- Never invent, infer beyond, or embellish what the sources state. If sources conflict (including between projects), say so and cite both.
- Keep answers concise and direct. Write in plain text: no markdown headings (#), no tables, no code blocks, no italics. The ONLY formatting allowed is **double asterisks** around a short heading or label where bold genuinely helps, and simple dash lists. Prefer prose.

After your answer, output a citations block in exactly this format (valid JSON, empty array if the answer contained no factual claims):
<citations>
[{ "source_id": "57:COND", "ref": "Section 4.2", "quote": "verbatim excerpt from the source, max 150 chars", "claim": "short restatement of the claim this supports" }]
</citations>

citation rules:
- source_id must be one of: ${[...selectedIds].join(', ')}
- ref: the most specific location available in the source (section heading, paragraph, date, consultee name, condition number) — null if none
- quote: exact text from the source, max 150 characters

Source blocks:

${sourceBlocks}`
      + emailToneInstructions(emailTone)
      + ANTI_AI_SLOP_BLOCK;

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const raw = (textBlock?.text || '').trim();
    const citationsMatch = raw.match(/<citations>([\s\S]*?)<\/citations>/);
    const citations = citationsMatch ? parseCitationsArray(citationsMatch[1]) : [];
    const reply = raw.replace(/<citations>[\s\S]*?<\/citations>/, '').trim();

    res.json({
      reply,
      citations,
      sources_used: [...new Set(citations.map(c => c.source_id))],
      context_chars: totalChars,
      suggestions: [],
    });
  } catch (err) {
    console.error('crossProjectChat.chat error:', err);
    res.status(500).json({ error: err.message });
  }
}
