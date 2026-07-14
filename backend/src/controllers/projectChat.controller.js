import { pool } from '../db.js';
import { client, MODEL_SONNET } from '../services/llm.shared.js';

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
import { getSourceCatalogue, assembleContext, CONTEXT_BUDGET } from '../services/projectChat.service.js';

export async function getSources(req, res) {
  const { projectId } = req.params;
  try {
    const catalogue = await getSourceCatalogue(projectId);
    res.json(catalogue);
  } catch (err) {
    console.error('projectChat.getSources error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function chat(req, res) {
  const { projectId } = req.params;
  const { messages, sources } = req.body;

  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, client FROM public.projects WHERE id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const { project_name, client: clientName } = projectRows[0];

    const { blocks, totalChars, availableGroups } = await assembleContext(projectId, sources ?? {});

    if (!blocks.length) {
      return res.status(400).json({ error: 'No sources selected. Tick at least one source to chat.' });
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
    const selectedKeys = new Set([
      ...(sources?.project_details ? ['project_details'] : []),
      ...((sources?.document_ids?.length) ? ['documents'] : []),
      ...((sources?.meeting_ids?.length) ? ['meetings'] : []),
      ...(sources?.groups ?? []),
    ]);
    const unselected = availableGroups.filter(g => !selectedKeys.has(g.key)).map(g => g.label);

    const systemPrompt = `You are a planning consultant's assistant answering questions about the project "${project_name}"${clientName ? ` (client: ${clientName})` : ''}.

Grounding rules — these are absolute:
- Answer ONLY from the source blocks below. Never use outside knowledge for any project-specific claim (facts about this site, this application, these consultees, these dates, etc.). You may use general planning knowledge to explain terminology, but never to assert project facts.
- Every factual claim must carry an inline citation of its source ID in square brackets, e.g. [D12] or [C]. Where the source shows a section, paragraph, date, or named entry, include it: [D12 §4.2].
- If the answer is not in the sources, say so plainly ("The selected sources don't cover this."). ${unselected.length ? `These source groups exist for this project but are NOT currently selected: ${unselected.join(', ')}. If one of them plausibly holds the answer, suggest the user ticks it.` : ''}
- Never invent, infer beyond, or embellish what the sources state. If sources conflict, say so and cite both.
- Keep answers concise and direct. Write in plain text: no markdown headings (#), no tables, no code blocks, no italics. The ONLY formatting allowed is **double asterisks** around a short heading or label where bold genuinely helps, and simple dash lists. Prefer prose.

After your answer, output a citations block in exactly this format (valid JSON, empty array if the answer contained no factual claims):
<citations>
[{ "source_id": "D12", "ref": "Section 4.2", "quote": "verbatim excerpt from the source, max 150 chars", "claim": "short restatement of the claim this supports" }]
</citations>

citation rules:
- source_id must be one of: ${[...selectedIds].join(', ')}
- ref: the most specific location available in the source (section heading, paragraph, date, consultee name, condition number) — null if none
- quote: exact text from the source, max 150 characters

Source blocks:

${sourceBlocks}`;

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const raw = response.content[0].text.trim();
    const citationsMatch = raw.match(/<citations>([\s\S]*?)<\/citations>/);
    const citations = citationsMatch ? parseCitationsArray(citationsMatch[1]) : [];
    const reply = raw.replace(/<citations>[\s\S]*?<\/citations>/, '').trim();

    res.json({
      reply,
      citations,
      sources_used: [...new Set(citations.map(c => c.source_id))],
      context_chars: totalChars,
    });
  } catch (err) {
    console.error('projectChat.chat error:', err);
    res.status(500).json({ error: err.message });
  }
}
