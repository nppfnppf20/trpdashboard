/**
 * Test of the action "find context" cascade (Sonnet, prompt caching on), bypassing HTTP/auth.
 *
 * For a project's pending meeting actions it:
 *   1. lists what each action needs, tagging each need as contact / fact / document,
 *   2. searches the source pool in order, sending only still-open needs on to the next source,
 *   3. accepts a need only when the model says the quote fully answers it AND the quote passes
 *      checkVerbatim AND, for contact needs, the quote contains an email address or phone number.
 *      Anything else is reported as "partial" (with what is still missing) or "not found".
 *   4. prints per-need results and the cost of each run, and saves detail to backend/logs/.
 *
 * Usage:
 *   node scripts/action-triage-search.js <projectId> [--model <id>] [--price in,out] [--limit 20]
 *        [--max-sources 20] [--repeat 2] [--no-cache] [--run]
 * Without --run it only builds the source pool and prints sizes and a cost estimate (no API calls).
 * `--run` spends Anthropic tokens. `--repeat 2` runs the cascade twice back to back so the second
 * run shows the prompt-cache saving (the cache lasts ~5 minutes).
 *
 * Sources: for each meeting newest first, its notes (summary, actions, notes) then its full transcript;
 * then project details; then project documents newest first. A meeting's notes include that meeting's
 * own action list, so an action can trivially "find" its own wording there.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';
import { client, MODEL_SONNET, parseJSON } from '../src/services/llm.shared.js';
import { assembleContext, assembleSourceTexts, listPickerSources } from '../src/services/projectChat.service.js';
import { checkVerbatim } from '../src/services/verbatimCheck.service.js';

const projectId = Number(process.argv[2]);
if (!projectId) throw new Error('Usage: node scripts/action-triage-search.js <projectId> [--model id] [--limit 20] [--max-sources 20] [--repeat 2] [--no-cache] [--run]');
const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const has = n => process.argv.includes(`--${n}`);

const MODEL = flag('model', MODEL_SONNET);
const LIMIT = Number(flag('limit', 20));
const MAX_SOURCES = Number(flag('max-sources', 20));
const REPEAT = Number(flag('repeat', 1));
const USE_CACHE = !has('no-cache');
const RUN = has('run');

// $ per million tokens [input, output]. Override with --price "in,out" for any other model.
const PRICES = {
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-4-5-20251001': [1, 5],
  'claude-haiku-5-5': [0.1, 0.5],
};
const PRICE = flag('price') ? flag('price').split(',').map(Number) : PRICES[MODEL];
if (!PRICE) console.warn(`No price known for ${MODEL}; pass --price "in,out". Cost shown as 0.`);
const [PIN, POUT] = PRICE || [0, 0];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s()-]{8,}\d)/;

const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'undated');
const estTokens = chars => Math.round(chars / 4);

// ── Source pool ─────────────────────────────────────────────────────────────

async function buildPool() {
  const picker = await listPickerSources(projectId);
  const out = [];
  for (const m of picker.meetings) {
    const notes = await assembleSourceTexts(projectId, { meetingIds: [m.id], mode: 'notes' });
    if (notes.blocks[0]) out.push({ name: `${m.title} (${fmtDate(m.date)}): notes`, text: notes.blocks[0].text });
    if (m.has_transcript) {
      const t = await assembleSourceTexts(projectId, { meetingIds: [m.id], mode: 'transcript' });
      if (t.blocks[0]) out.push({ name: `${m.title} (${fmtDate(m.date)}): full transcript`, text: t.blocks[0].text });
    }
  }
  const details = await assembleContext(projectId, { project_details: true });
  details.blocks.forEach(b => out.push({ name: b.label, text: b.text }));
  for (const d of picker.documents) {
    const t = await assembleSourceTexts(projectId, { documentIds: [d.id], mode: 'both' });
    if (t.blocks[0]) out.push({ name: `${d.title} (${d.doc_type_label})`, text: t.blocks[0].text });
  }
  return out.slice(0, MAX_SOURCES);
}

// ── LLM call with usage accounting ──────────────────────────────────────────

const newUsage = () => ({ in: 0, out: 0, cacheWrite: 0, cacheRead: 0, calls: 0 });
const costOf = u => (u.in * PIN + u.cacheWrite * PIN * 1.25 + u.cacheRead * PIN * 0.1 + u.out * POUT) / 1e6;

async function call(content, usage) {
  let delay = 15000;
  for (let attempt = 0; ; attempt++) {
    try {
      const msg = await client.messages.create({ model: MODEL, max_tokens: 4096, messages: [{ role: 'user', content }] });
      usage.calls++;
      usage.in += msg.usage.input_tokens || 0;
      usage.out += msg.usage.output_tokens || 0;
      usage.cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      usage.cacheRead += msg.usage.cache_read_input_tokens || 0;
      return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    } catch (err) {
      if ((err?.status === 429 || err?.status >= 500) && attempt < 3) {
        console.warn(`  retrying in ${delay / 1000}s (${err.status})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else throw err;
    }
  }
}

// ── Step 1: what does each action need? ─────────────────────────────────────

async function listNeeds(actions, usage) {
  const prompt = `For each task below from a UK planning consultancy meeting, list the specific pieces of information that the person would need in order to produce the task's output (an email, a document or an answer) which are NOT already stated in the action text or notes. Maximum 4 per task, each a short noun phrase. Use an empty array when everything needed is already in the action text and notes. Do not list background that would merely be nice to have. Set needs_judgement to true when the task is mainly a decision or strategic thinking rather than assembling information.

Tag each need with a type:
- "contact": an email address or phone number for a person or organisation the task involves contacting
- "document": a specific file, report, template or notice that must be located
- "fact": any other piece of information

Respond with ONLY a JSON object: {"tasks": [{"id": number, "needs_judgement": boolean, "needs": [{"need": string, "type": "contact"|"document"|"fact"}]}]}.

Tasks:
${JSON.stringify(actions.map(a => ({ id: a.id, action: a.action_text, owner: a.owner, notes: a.notes })))}`;
  const res = parseJSON(await call(prompt, usage));
  const needs = [];
  for (const t of res.tasks || []) {
    if (t.needs_judgement) continue;
    (t.needs || []).forEach((n, i) => needs.push({ key: `${t.id}:${i}`, actionId: t.id, need: n.need, type: n.type || 'fact' }));
  }
  return needs;
}

// ── Step 2: cascade over the source pool ────────────────────────────────────

async function runCascade(needs, sources, actionsById) {
  const usage = newUsage();
  const state = new Map(needs.map(n => [n.key, { ...n, status: 'not found', partial: null }]));
  let sourcesRead = 0;
  for (let i = 0; i < sources.length; i++) {
    const open = [...state.values()].filter(n => n.status !== 'found');
    if (!open.length) break;
    const s = sources[i];
    sourcesRead++;
    console.log(`  source ${i + 1}/${sources.length}: ${s.name} (${open.length} open)`);
    const head = `Below is one source document, then a list of needs. For each need, decide whether THIS document contains the answer. Be strict: found is true only if the document actually states it. If a need is not stated here, found is false; do not infer or guess.

fully_answers depends on the need's type:
- contact: true only if the quote contains the email address or phone number. A name is NOT enough.
- document: true only if the document itself (or its full contents) is in this source. A mention that it exists is NOT enough.
- fact: true if what is stated here is enough for someone to write the task's output, even when the information is spread across several passages of the document and not set out as a tidy list. Do not require it to be complete or consolidated. Put anything still absent in "missing".
If the document only partly helps, set found true, fully_answers false, and say in "missing" what is still absent.

For each found need give "answer" (a short plain statement) and "quote": text copied EXACTLY, character for character, from the document that supports it (max 300 characters, no ellipsis, no paraphrase). Choose the single most informative passage as the quote.

SOURCE: ${s.name}
-----
${s.text}
-----

`;
    const tail = `Respond with ONLY a JSON object: {"results": [{"key": string, "found": boolean, "fully_answers": boolean, "answer": string|null, "quote": string|null, "missing": string|null}]}.

Needs (the task each belongs to is given for context):
${JSON.stringify(open.map(n => ({ key: n.key, need: n.need, type: n.type, task: actionsById.get(n.actionId).action_text })))}`;
    const content = [
      { type: 'text', text: head, ...(USE_CACHE ? { cache_control: { type: 'ephemeral' } } : {}) },
      { type: 'text', text: tail },
    ];
    let res;
    try {
      res = parseJSON(await call(content, usage));
    } catch (err) {
      console.warn(`  skipped "${s.name}": ${err.message}`);
      continue;
    }
    for (const r of res.results || []) {
      const n = state.get(r.key);
      if (!n || n.status === 'found' || !r.found || !r.quote) continue;
      const check = checkVerbatim(r.quote, s.text);
      if (!check.verified) { n.partial = n.partial || { source: s.name, answer: r.answer, quote: r.quote, why: 'quote did not check out against the source' }; continue; }
      const contactOk = n.type !== 'contact' || EMAIL_RE.test(r.quote) || PHONE_RE.test(r.quote);
      if (r.fully_answers && contactOk) {
        Object.assign(n, { status: 'found', source: s.name, quote: r.quote, answer: r.answer, partial: null });
      } else if (!n.partial) {
        n.partial = {
          source: s.name,
          answer: r.answer,
          quote: r.quote,
          why: !contactOk ? 'contact need but the quote has no email or phone' : r.missing || 'model said it only partly answers',
        };
      }
    }
  }
  return { usage, sourcesRead, results: [...state.values()] };
}

// ── Main ────────────────────────────────────────────────────────────────────

const sources = await buildPool();
console.log(`Project ${projectId}: ${sources.length} sources in the pool (model ${MODEL}, caching ${USE_CACHE ? 'on' : 'off'})`);
sources.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} — ${s.text.length.toLocaleString()} chars (~${estTokens(s.text.length).toLocaleString()} tokens)`));
const poolTokens = sources.reduce((acc, s) => acc + estTokens(s.text.length), 0);

const { rows: actions } = await pool.query(
  `SELECT id, action_text, owner, notes FROM planning_applications.meeting_actions
    WHERE project_id = $1 AND status = 'pending' ORDER BY id LIMIT $2`,
  [projectId, LIMIT]
);
console.log(`\n${actions.length} pending actions. Pool ~${poolTokens.toLocaleString()} tokens.`);

if (!RUN) {
  const worst = costOf({ in: poolTokens + sources.length * 3000, out: sources.length * 1500, cacheWrite: 0, cacheRead: 0 });
  console.log(`\nDry run (no API calls). Worst case if every source is read once: ~$${worst.toFixed(2)} on ${MODEL} (cascade only, uncached).`);
  console.log('Add --run to spend tokens. Add --repeat 2 to see the cache saving on a second run.');
  await pool.end();
  process.exit(0);
}

const actionsById = new Map(actions.map(a => [a.id, a]));
const needsUsage = newUsage();
console.log(`\nListing needs…`);
const needs = await listNeeds(actions, needsUsage);
console.log(`${needs.length} needs across ${new Set(needs.map(n => n.actionId)).size} actions (judgement-flagged actions skipped). Needs listing: $${costOf(needsUsage).toFixed(3)}`);

const runs = [];
for (let r = 1; r <= REPEAT; r++) {
  console.log(`\n══ Cascade run ${r} of ${REPEAT} ══`);
  runs.push(await runCascade(needs, sources, actionsById));
}

const last = runs[runs.length - 1];
console.log('\n══ RESULTS (last run) ══');
for (const n of last.results) {
  console.log(`\n#${n.actionId} [${n.type}] ${n.need} — ${n.status.toUpperCase()}${n.status !== 'found' && n.partial ? ' (partial)' : ''}`);
  if (n.status === 'found') console.log(`   ${n.answer}  [${n.source}]\n   "${n.quote.slice(0, 160)}${n.quote.length > 160 ? '…' : ''}"`);
  else if (n.partial) console.log(`   partial: ${n.partial.answer}  [${n.partial.source}]\n   still missing/why: ${n.partial.why}`);
}

const count = s => last.results.filter(n => n.status === s).length;
const partials = last.results.filter(n => n.status !== 'found' && n.partial).length;
console.log('\n══ SUMMARY ══');
console.log(`Needs: ${last.results.length} | found ${count('found')} | partial only ${partials} | nothing ${last.results.length - count('found') - partials}`);
runs.forEach((R, i) => {
  console.log(`Run ${i + 1}: ${R.sourcesRead} sources read, ${R.usage.calls} calls, in ${R.usage.in.toLocaleString()} (+${R.usage.cacheWrite.toLocaleString()} cache write, ${R.usage.cacheRead.toLocaleString()} cache read), out ${R.usage.out.toLocaleString()} → $${costOf(R.usage).toFixed(3)}`);
});
console.log(`Total including needs listing: $${(runs.reduce((a, R) => a + costOf(R.usage), 0) + costOf(needsUsage)).toFixed(3)}`);

const logDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const file = path.join(logDir, `action-triage-search-${projectId}-${Date.now()}.json`);
fs.writeFileSync(file, JSON.stringify({ projectId, model: MODEL, cache: USE_CACHE, sources: sources.map(s => ({ name: s.name, chars: s.text.length })), runs: runs.map(R => ({ usage: R.usage, sourcesRead: R.sourcesRead, results: R.results })), usageNeeds: needsUsage }, null, 2));
console.log(`\nFull detail saved to ${file}`);
await pool.end();
