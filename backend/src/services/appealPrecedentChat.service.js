/**
 * Chat over a few ticked appeal decisions. Answers come only from the full text of those decisions; every claim
 * carries a citation, and each cited quote is verified against that decision's text (unverified quotes are dropped).
 *
 * Decision text comes from the in-memory text store (filled by the run) or is re-fetched from Appealbase on demand.
 * It is never saved. The decision block is marked for prompt caching so follow-up questions are cheap.
 */

import { createClient } from './appealbase.service.js';
import { ensureText } from './appealbaseTextStore.js';
import { makeFinder } from './appealbaseQuotes.js';
import { client as anthropic, parseJSON, MODEL_SONNET } from './llm.shared.js';

export const CHAT_LIMITS = { maxDecisions: 10, maxChars: 700000, maxMessages: 30 }; // ~175k tokens of decision text

const DEV_CACHE = process.env.APPEALBASE_DEV_CACHE === '1';

function instructions(context, issues) {
  const issueLine = issues?.length ? issues.map(i => `${i.label} (weight ${i.weight})`).join('; ') : 'not specified';
  return `You are a planning appeals analyst helping a planning consultant interrogate a small set of appeal decisions for a live project. Answer ONLY from the decisions provided below.

PROJECT: ${context?.project?.name ?? 'the project'}. Scheme: ${context?.project?.scheme || 'not stated'}. LPA: ${context?.project?.lpa || 'not stated'}. Setting: ${context?.project?.setting || 'not stated'}.
KEY ISSUES: ${issueLine}.

RULES
- Answer the question directly and concisely in plain prose, using short paragraphs or bullet points. Name decisions by LPA and reference. Distinguish clearly between decisions. Aim for under 500 words and no more than about 20 citations; cite the strongest support for each point rather than every detail.
- Every factual claim about a decision must be supported by a citation. Mark it in the answer with [n] and list it in "citations".
- Quotes: one short contiguous span, under 250 characters, copied exactly from the cited decision's text, no ellipsis joins and no paraphrase. If you cannot quote support for a claim, do not make the claim.
- If the decisions do not contain the answer, say so plainly. Never infer a conclusion the text does not state.
- Give the inspector's paragraph number in "para" where you can see it, otherwise an empty string.

Return ONLY a JSON object, no other text:
{"answer": "<your answer, with [1] [2] markers>", "citations": [{"n": 1, "ref": "<7-digit reference>", "para": "<paragraph number or empty>", "quote": "<exact span>"}]}`;
}

/** Pull the answer text and any fully-formed citation objects out of a reply that is not valid JSON. */
export function salvage(raw) {
  const start = raw.indexOf('"answer"');
  let answer = raw;
  if (start >= 0) {
    const open = raw.indexOf('"', raw.indexOf(':', start) + 1);
    let end = open + 1;
    while (end < raw.length && !(raw[end] === '"' && raw[end - 1] !== '\\')) end++;
    try {
      answer = JSON.parse(raw.slice(open, end) + '"');
    } catch {
      answer = raw.slice(open + 1, end).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  const citations = [];
  for (const m of raw.slice(start >= 0 ? start : 0).matchAll(/\{\s*"n"\s*:\s*\d+[^{}]*\}/g)) {
    try {
      citations.push(JSON.parse(m[0]));
    } catch {
      // incomplete citation: skip it
    }
  }
  return { answer, citations };
}

/**
 * @param {{ refs: string[], messages: {role: 'user'|'assistant', content: string}[], context?: object, issues?: object[] }} args
 */
export async function chatAboutPrecedents({ refs, messages, context, issues }) {
  const unique = [...new Set((refs ?? []).map(String))];
  const bad = (e, status = 400) => Object.assign(new Error(e), { status });
  if (!unique.length) throw bad('Tick at least one decision to ask about.');
  if (unique.length > CHAT_LIMITS.maxDecisions) throw bad(`Too many decisions ticked (${unique.length}). Choose ${CHAT_LIMITS.maxDecisions} or fewer.`);
  const convo = (messages ?? []).filter(m => (m.role === 'user' || m.role === 'assistant') && String(m.content ?? '').trim()).slice(-CHAT_LIMITS.maxMessages);
  if (!convo.length || convo[convo.length - 1].role !== 'user') throw bad('Send a question.');

  const appealbase = createClient({ budget: 12, cache: DEV_CACHE });
  const loaded = [];
  for (const ref of unique) {
    if (!/^\d{7}$/.test(ref)) throw bad(`Invalid decision reference ${ref}`);
    const { text, meta } = await ensureText(appealbase, ref);
    loaded.push({ ref, text, meta });
  }
  const totalChars = loaded.reduce((n, d) => n + d.text.length, 0);
  if (totalChars > CHAT_LIMITS.maxChars) throw bad(`These decisions are too long to read together (about ${Math.round(totalChars / 4000)}k tokens). Untick some and try again.`);

  const decisionsBlock = loaded
    .map(d => `<decision reference="${d.ref}" lpa="${d.meta.lpa ?? ''}" outcome="${d.meta.decision ?? ''}" date="${String(d.meta.date ?? '').slice(0, 10)}">\n${d.text}\n</decision>`)
    .join('\n\n');

  const resp = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system: [
      { type: 'text', text: instructions(context, issues) },
      { type: 'text', text: `DECISIONS\n\n${decisionsBlock}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: convo.map(m => ({ role: m.role, content: String(m.content) })),
  });

  const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  let answer = raw;
  let citations = [];
  try {
    const j = parseJSON(raw);
    answer = String(j.answer ?? '');
    citations = Array.isArray(j.citations) ? j.citations : [];
  } catch {
    // Not valid JSON, usually because the reply was cut off. Recover the answer text and any complete citations.
    ({ answer, citations } = salvage(raw));
    if (resp.stop_reason === 'max_tokens') answer += '\n\n(The reply was cut off because it was very long, so some citations may be missing. Ask a narrower question for a shorter answer.)';
  }

  const finders = Object.fromEntries(loaded.map(d => [d.ref, makeFinder(d.text)]));
  const checked = citations
    .filter(c => c && unique.includes(String(c.ref)))
    .map((c, i) => {
      const ref = String(c.ref);
      const verified = !!c.quote && finders[ref](c.quote);
      return { n: Number(c.n) || i + 1, ref, lpa: loaded.find(d => d.ref === ref)?.meta.lpa ?? '', para: c.para ? String(c.para) : '', quote: verified ? c.quote : '', verified, url: `https://www.appealbase.com/decision/${ref}` };
    });

  return {
    reply: answer,
    citations: checked,
    contextTokens: Math.round(totalChars / 4),
    usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens, cacheRead: resp.usage.cache_read_input_tokens ?? 0, cacheWrite: resp.usage.cache_creation_input_tokens ?? 0 },
  };
}
