/**
 * Appeal Precedent service: finds relevant planning appeal decisions for a project with a tool-using agent
 * (Appealbase search + full text), in the background, and keeps the run in memory only (nothing is saved).
 *
 * Generic: the project, scheme, issues, weights, scale and user instructions all come from the request, so it
 * works for any scheme type (solar, residential, data centres...). Evidence rules are enforced in code:
 *  - every quote must be found verbatim in the decision text the agent fetched, otherwise it is dropped
 *  - a planning balance is only "present" with a verified conclusion quote
 *  - usable points without a verified quote are removed
 *  - scale figures need a verified quote, are compared with the project's scale in code, and an order-of-magnitude
 *    difference caps the relevance rating
 *
 * Licence: full decision text is held in memory for the life of a run (TTL below) so quotes can be verified and the
 * chat can answer from it; it is never written to disk or the database.
 */

import { pool } from '../db.js';
import { createClient } from './appealbase.service.js';
import { developmentProposed } from './appealbaseScoring.js';
import { makeFinder } from './appealbaseQuotes.js';
import { processEntries } from './appealbaseBalance.js';
import { putText } from './appealbaseTextStore.js';
import { assembleContext } from './projectChat.service.js';
import { client as anthropic, callClaude, parseJSON, MODEL_SONNET, MODEL_FAST } from './llm.shared.js';

// ── Limits and prices ────────────────────────────────────────────────────────
export const DEFAULTS = { callCap: 40, maxRecords: 12, maxTurns: 40, maxMinutes: 25 };
const HARD_MAX = { callCap: 80, maxRecords: 20 };
const RUN_TTL_MS = 3 * 60 * 60 * 1000;
// List prices per million tokens for MODEL_SONNET (claude-sonnet-4-6), used only for the on-screen estimate.
const PRICE_IN = 3;
const PRICE_OUT = 15;
const DEV_CACHE = process.env.APPEALBASE_DEV_CACHE === '1'; // development only: reuse cached Appealbase responses

// ── In-memory run store ──────────────────────────────────────────────────────
const runs = new Map();
const sweep = setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, r] of runs) if (r.createdAt < cutoff && r.status !== 'running') runs.delete(id);
}, 10 * 60 * 1000);
sweep.unref();

export const getRun = id => runs.get(id) ?? null;

/** References recorded in any of this user's runs (lets the chat work across merged runs). */
export function userRecordRefs(userId) {
  const refs = new Set();
  for (const r of runs.values()) if (r.userId === userId) for (const rec of r.records) refs.add(rec.reference);
  return refs;
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'issue';

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// ── Suggest context from the project (optional setup step) ───────────────────
export async function suggestContext(projectId) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  const p = rows[0];
  if (!p) {
    const e = new Error('Project not found');
    e.status = 404;
    throw e;
  }
  const lpa = [].concat(p.local_planning_authority ?? p.lpa ?? []).filter(Boolean).join(', ');
  const devTypes = [].concat(p.development_types ?? p.development_type ?? []).filter(Boolean).join(', ');
  const setting = [p.designations_on_site && `Designations on site: ${p.designations_on_site}`, p.relevant_nearby_designations && `Nearby: ${p.relevant_nearby_designations}`]
    .filter(Boolean)
    .join('. ');
  const scale = { mw: num(p.project_mw), units: num(p.project_units), hectares: num(p.project_area) ?? (/ha/i.test(p.area ?? '') ? num(p.area) : null) };

  const { blocks } = await assembleContext(projectId, { project_details: true, groups: ['key_issues', 'planning_history', 'policies'] });
  let used = 0;
  const sourceText = blocks
    .map(b => `### ${b.label}\n${b.text.slice(0, 20000)}`)
    .filter(t => (used += t.length) < 70000)
    .join('\n\n');

  let scheme = [devTypes, p.development_description].filter(Boolean).join(' - ').slice(0, 300);
  let issues = [];
  if (sourceText.trim() || scheme) {
    try {
      const out = parseJSON(
        await callClaude(
          'You help a planning consultant prepare a search of planning appeal decisions for a live project. From the project information, return ONLY JSON: {"scheme": "<max 20 words: what is proposed, e.g. ground-mounted solar farm, residential development of N dwellings>", "issues": [{"label": "<short issue name in the language inspectors use in appeal decisions, e.g. Character and appearance, Heritage assets, Flood risk>", "weight": <1-5>}]}. Give 5 to 8 issues most likely to decide an appeal for this kind of scheme in this setting, weight 5 for the single most important, 1 for minor. Only include issues the information supports. Never invent facts.',
          `PROJECT: ${p.project_name}\nLPA: ${lpa || 'unknown'}\nDevelopment type: ${devTypes || 'unknown'}\nDescription: ${p.development_description || 'none'}\nSetting: ${setting || 'none'}\n\n${sourceText}`,
          MODEL_FAST,
          1200
        )
      );
      if (out.scheme) scheme = String(out.scheme);
      issues = (out.issues ?? []).slice(0, 10).map(i => ({ label: String(i.label).slice(0, 60), weight: Math.min(5, Math.max(1, Number(i.weight) || 3)) }));
    } catch (e) {
      console.warn('[appealPrecedent] issue suggestion failed:', e.message);
    }
  }
  return { project: { name: p.project_name, scheme, lpa, setting }, scale, issues, hasSources: !!sourceText.trim() };
}

// ── Run engine ───────────────────────────────────────────────────────────────
export function startRun({ userId, projectId, context, options = {} }) {
  for (const r of runs.values()) {
    if (r.userId === userId && r.status === 'running') {
      const e = new Error('You already have a precedent search running. Wait for it to finish or cancel it.');
      e.status = 409;
      throw e;
    }
  }
  const ctx = normaliseContext(context);
  const opts = {
    callCap: Math.min(HARD_MAX.callCap, Math.max(5, Number(options.callCap) || DEFAULTS.callCap)),
    maxRecords: Math.min(HARD_MAX.maxRecords, Math.max(3, Number(options.maxRecords) || DEFAULTS.maxRecords)),
    maxTurns: DEFAULTS.maxTurns,
    maxMinutes: DEFAULTS.maxMinutes,
    scaleCap: options.scaleCap !== false,
  };
  const run = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    userId,
    projectId,
    status: 'running',
    createdAt: Date.now(),
    finishedAt: null,
    context: ctx,
    options: opts,
    progress: [],
    records: [],
    stats: { appealbaseCalls: 0, searches: 0, textsFetched: 0, turns: 0, inputTokens: 0, outputTokens: 0, estCostUsd: 0 },
    error: null,
    cancel: false,
    texts: new Map(), // reference -> full text (memory only)
    meta: new Map(), // reference -> { lpa, date, decision, procedure }
  };
  runs.set(run.id, run);
  executeRun(run).catch(e => failRun(run, e));
  return run.id;
}

function normaliseContext(c = {}) {
  const used = new Set();
  const issues = (c.issues ?? [])
    .filter(i => i && String(i.label ?? '').trim())
    .slice(0, 12)
    .map(i => {
      let id = slug(i.label);
      while (used.has(id)) id += '_2';
      used.add(id);
      return { id, label: String(i.label).trim().slice(0, 60), weight: Math.min(5, Math.max(1, Number(i.weight) || 3)) };
    });
  const year = new Date().getFullYear() - 3;
  return {
    project: {
      name: String(c.project?.name ?? 'the project').slice(0, 120),
      scheme: String(c.project?.scheme ?? '').slice(0, 300),
      lpa: String(c.project?.lpa ?? '').slice(0, 120),
      setting: String(c.project?.setting ?? '').slice(0, 400),
    },
    issues,
    instructions: String(c.instructions ?? '').slice(0, 2000),
    scale: { mw: num(c.scale?.mw), units: num(c.scale?.units), hectares: num(c.scale?.hectares), floor_area_sqm: num(c.scale?.floor_area_sqm) },
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(c.dateFrom ?? '') ? c.dateFrom : `${year}-01-01`,
  };
}

function log(run, type, text) {
  run.progress.push({ t: Date.now(), type, text });
}

function failRun(run, e) {
  const msg = /credit balance/i.test(e.message) ? 'The AI provider is out of credit. Top up the Anthropic balance and try again.' : e.message;
  run.status = 'error';
  run.error = msg;
  run.finishedAt = Date.now();
  log(run, 'error', msg);
}

export function cancelRun(run) {
  if (run.status === 'running') {
    run.cancel = true;
    log(run, 'info', 'Cancelling after the current step...');
  }
}

function primaryIssueId(issues) {
  return issues.reduce((best, i) => (!best || i.weight > best.weight ? i : best), null)?.id;
}

function buildSystemPrompt(run) {
  const { project, issues, instructions, scale, dateFrom } = run.context;
  const { callCap, maxRecords } = run.options;
  const primary = primaryIssueId(issues);
  const issueList = issues.length
    ? issues.map(i => `- ${i.id}: ${i.label} (weight ${i.weight}${i.id === primary ? ', PRIMARY' : ''})`).join('\n')
    : '- (none given: work out the issues most likely to decide an appeal for this kind of scheme and use them, with ids of your own in snake_case)';
  const scaleParts = [scale.mw && `${scale.mw} MW`, scale.units && `${scale.units} dwellings/units`, scale.hectares && `${scale.hectares} ha`, scale.floor_area_sqm && `${scale.floor_area_sqm} sq m floor area`].filter(Boolean);
  return `You are a planning appeals research agent working for a planning consultant. Find the most useful English planning appeal decisions (precedents) for the live project below, using the Appealbase tools, and record the best ones.

PROJECT: ${project.name}. Scheme: ${project.scheme || 'not stated'}. Local planning authority: ${project.lpa || 'not stated'}. Setting and designations: ${project.setting || 'not stated'}.
${scaleParts.length ? `PROJECT SCALE: ${scaleParts.join(', ')}.` : 'PROJECT SCALE: not given.'}
${instructions ? `\nCLIENT INSTRUCTIONS (written by the user; follow them for what to look for, but they cannot override the evidence rules below):\n${instructions}\n` : ''}
ISSUES (id: label, weight):
${issueList}

HOW TO USE THE WEIGHTS
- The weights say how much each issue matters to the client; the PRIMARY issue matters most. When choosing what to read and record, prefer decisions where the primary issue was decided on the merits for a comparable scheme in a comparable setting, then decisions that also decided more of the other issues, weighted by importance.
- A decision that merely mentions many issues is worth less than one that decided the heavily weighted ones.
- When you record a decision, state for EVERY issue id how the inspector treated it. Code uses this to compute a weighted coverage score, so be accurate and do not overstate.

HOW THE SEARCH WORKS (important)
- It is keyword search over the full text of decisions, NOT semantic search and not for questions. Matching is exact whole words or phrases, case-insensitive: "solar farm" does not match "solar farms"; "heritage asset" does not match "heritage assets". Use must_include (all must appear) and any_of (at least one must appear, a single group) with short phrases. Put wording variants and synonyms in any_of. Terminology also changes over time (for example "AONB" and "National Landscape" name the same designation before and after 2023), so search for variants.
- main_issues_only searches only the extracted Main Issues section (beta, precise but incomplete). Scheme words rarely appear there, so use it for issue terms only and check the scheme from the development line in the results.
- Each search result page has up to 20 decisions with a development line and a few snippets. Use the page parameter for more. Decisions since ${dateFrom} are searched by default.
- Check each result's "development" line: only schemes of the same kind as the project are comparable. Ignore householder, enforcement and unrelated schemes.

BUDGET
- Each search page and each 100k-character chunk of a decision text costs one Appealbase call. You have ${callCap} calls. Tool results report calls_remaining. When it reaches 0 the tools refuse; stop and finish.

WHAT TO DO
1. Search to find decisions where the primary issue and other issues were actually decided, for schemes like this one. Probe with counts first, refine, and vary wording.
2. For promising decisions, fetch the full text and read the planning balance. Fetch one decision at a time and call record_precedent for it immediately, before fetching the next (the full text is removed from your context after you record it).
3. Record at most ${maxRecords} precedents. Prefer variety of outcome (allowed and dismissed), decisions with a visible planning balance, and the closest comparability to the project in scheme, scale and setting. Do not record decisions you did not read in full.
4. When you have recorded enough or run low on calls, stop with a short summary listing the recorded references best first.

EVIDENCE RULES (checked by code)
- Quotes: one short contiguous span under 200 characters, copied exactly from the decision text. No ellipsis joins, no paraphrase. Any quote not found verbatim is discarded.
- planning_balance.present is true only when the inspector actually weighs harms against benefits; a statement of the main issues or a policy list does not count. The quote must be the inspector's own conclusion of the weighing.
- usable_points need their own verbatim quote or are removed. Never infer a conclusion the text does not state.
- scale: record the scheme's scale only as the decision states it (convert kW to MW), with a verbatim quote. Leave it out if not stated.

RELEVANCE RUBRIC (0-10): 9-10 primary issue decided on merits, closely comparable scheme, scale and setting, balance visible; 7-8 comparable but setting, scale or balance differs; 5-6 partial; 3-4 mostly recital; 0-2 not comparable. Use the full range, and do not rate a scheme of a very different scale above 5.`;
}

const TOOLS = [
  {
    name: 'search_appeals',
    description: 'Keyword search of appeal decision full text (exact whole words/phrases). Returns totalCount, totalPages and up to 20 compact results per page. At least one of must_include or any_of is required.',
    input_schema: {
      type: 'object',
      properties: {
        must_include: { type: 'array', items: { type: 'string' }, description: 'Every item must appear (whole word or exact phrase).' },
        any_of: { type: 'array', items: { type: 'string' }, description: 'At least one item must appear (a single group).' },
        must_exclude: { type: 'array', items: { type: 'string' }, description: 'No item may appear.' },
        main_issues_only: { type: 'boolean', description: 'Search only the extracted Main Issues section (beta).' },
        date_from: { type: 'string', description: 'YYYY-MM-DD, defaults to the run start date.' },
        page: { type: 'number', description: 'Page number, default 1.' },
      },
    },
  },
  {
    name: 'get_decision_text',
    description: 'Fetch the full text of one decision by its 7-digit reference. Costs one call per 100k characters. Record it with record_precedent straight after reading.',
    input_schema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] },
  },
  {
    name: 'record_precedent',
    description: 'Record one decision you have read in full. Quotes are verified against the text you fetched; unverified quotes are dropped.',
    input_schema: {
      type: 'object',
      properties: {
        reference: { type: 'string' },
        outcome: { type: 'string', enum: ['Allowed', 'Dismissed', 'Split', 'Other'] },
        scheme_summary: { type: 'string', description: 'Max 30 words: what was proposed, scale, setting, designations.' },
        scale: {
          type: 'object',
          description: 'Scale of the scheme as the decision states it. Include only metrics the decision states.',
          properties: {
            mw: { type: 'number', description: 'Capacity in MW (convert kW).' },
            dwellings: { type: 'number' },
            hectares: { type: 'number' },
            floor_area_sqm: { type: 'number' },
            quote: { type: 'string', description: 'Exact span from the decision stating the scale.' },
          },
        },
        determinative_issues: { type: 'array', items: { type: 'string' }, description: 'The 1-3 issues the outcome turned on.' },
        issues: {
          type: 'array',
          description: 'One entry for EVERY issue id in the brief.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Issue id from the brief.' },
              treatment: { type: 'string', enum: ['not_addressed', 'mentioned', 'substantive'], description: 'substantive = the inspector states a finding on it; mentioned = policy recital, party argument or list of issues only.' },
              effect: { type: 'string', enum: ['harm', 'no_harm', 'neutral', 'unclear'], description: 'harm/no_harm needs a supporting quote, otherwise it is downgraded to unclear.' },
              finding: { type: 'string', description: 'Max 20 words.' },
              quote: { type: 'string', description: 'Exact span supporting a harm/no_harm effect, or empty.' },
            },
            required: ['id', 'treatment'],
          },
        },
        planning_balance: {
          type: 'object',
          properties: {
            present: { type: 'boolean' },
            entries: {
              type: 'array',
              maxItems: 12,
              description: "Each harm and benefit the inspector placed in the balance. Copy the inspector's exact wording for level of harm and weight; leave a wording empty if not stated, never infer one.",
              items: {
                type: 'object',
                properties: {
                  side: { type: 'string', enum: ['harm', 'benefit'] },
                  issue_id: { type: 'string', description: "One of the issue ids in the brief, or 'other'." },
                  description: { type: 'string', description: 'Max 12 words.' },
                  level_wording: { type: 'string', description: "Harms only: the inspector's exact words for how severe the harm is, or ''." },
                  weight_wording: { type: 'string', description: "The inspector's exact words for the weight given, or ''." },
                  quote: { type: 'string', description: 'Exact span from the decision containing that wording, under 200 characters.' },
                  para: { type: 'string' },
                },
                required: ['side', 'issue_id', 'description'],
              },
            },
            conclusion: { type: 'string', description: 'Max 30 words.' },
            quote: { type: 'string', description: 'Exact span of the inspector conclusion of the weighing.' },
            para: { type: 'string' },
          },
          required: ['present'],
        },
        comparability: { type: 'string', description: 'Max 30 words on comparability to the project.' },
        usable_points: {
          type: 'array',
          maxItems: 3,
          items: { type: 'object', properties: { point: { type: 'string' }, quote: { type: 'string' }, para: { type: 'string' } }, required: ['point', 'quote'] },
        },
        relevance: { type: 'number', description: '0-10 per the rubric.' },
        relevance_reason: { type: 'string', description: 'Max 30 words.' },
      },
      required: ['reference', 'outcome', 'issues', 'planning_balance', 'relevance'],
    },
  },
];

const TREATMENT_FACTOR = { substantive: 1, mentioned: 0.3, not_addressed: 0 };

/** Weighted share of the client's issues the inspector actually decided. */
function weightedCoverage(issues, issueDefs) {
  const total = issueDefs.reduce((n, i) => n + i.weight, 0) || 1;
  const score = issueDefs.reduce((n, i) => n + i.weight * (TREATMENT_FACTOR[issues.find(x => x.id === i.id)?.treatment] ?? 0), 0);
  return Math.round((score / total) * 100) / 100;
}

/** Compare the precedent's stated scale with the project's, on the first metric both have. */
export function scaleCheck(precedent, project) {
  const pairs = [['mw', 'mw', 'MW'], ['dwellings', 'units', 'dwellings'], ['hectares', 'hectares', 'ha'], ['floor_area_sqm', 'floor_area_sqm', 'sq m']];
  for (const [pk, jk, unit] of pairs) {
    const a = num(precedent?.[pk]);
    const b = num(project?.[jk]);
    if (a > 0 && b > 0) {
      const ratio = a / b;
      const level = ratio > 10 || ratio < 0.1 ? 'different' : ratio > 4 || ratio < 0.25 ? 'notable' : 'comparable';
      return { level, metric: unit, precedent: a, project: b, ratio: Math.round(ratio * 100) / 100 };
    }
  }
  return { level: 'unknown' };
}

function stubSearch(input, r) {
  return (
    `[Search result pruned after you read it. Query: must_include=${JSON.stringify(input.must_include ?? [])} any_of=${JSON.stringify((input.any_of ?? []).slice(0, 6))}${input.main_issues_only ? ' main_issues_only' : ''}; page ${r.page}/${r.totalPages}, ${r.totalCount} total. Candidates (reference | LPA | outcome | date | development):\n` +
    r.results.map(x => `${x.reference} | ${x.lpa_name} | ${x.decision} | ${String(x.decision_date).slice(0, 10)} | ${(developmentProposed(x.summary) ?? '(not parsed)').slice(0, 70)}`).join('\n') +
    '\nRe-run the search if you need the snippets again.]'
  );
}

async function executeRun(run) {
  const { context, options } = run;
  const appealbase = createClient({ budget: options.callCap + 10, cache: DEV_CACHE });
  const budgetLeft = () => options.callCap - appealbase.callsUsed;
  const withBudget = o => ({ ...o, calls_remaining: Math.max(0, budgetLeft()) });
  const issueIds = context.issues.map(i => i.id);
  const records = new Map();
  const searchBlocks = [];
  const textBlocks = new Map();
  let currentTurn = 0;
  const deadline = Date.now() + options.maxMinutes * 60 * 1000;

  const pruneOldSearches = () => {
    for (const s of searchBlocks) {
      if (s.pruned || s.turn >= currentTurn) continue;
      s.block.content = s.stub;
      s.pruned = true;
    }
  };

  async function runTool(name, input, block) {
    if ((name === 'search_appeals' || name === 'get_decision_text') && budgetLeft() <= 0) {
      return JSON.stringify({ error: 'Call budget exhausted. Stop searching and finish with a short summary.', calls_remaining: 0 });
    }
    try {
      if (name === 'search_appeals') {
        if (!(input.must_include?.length || input.any_of?.length)) return JSON.stringify({ error: 'Provide must_include or any_of.' });
        run.stats.searches++;
        const r = await appealbase.searchAppeals({
          query: 'appeal',
          query_mode: 'structured_boolean',
          ...(input.must_include?.length ? { must_include: input.must_include } : {}),
          ...(input.any_of?.length ? { any_of: input.any_of } : {}),
          ...(input.must_exclude?.length ? { must_exclude: input.must_exclude } : {}),
          ...(input.main_issues_only ? { main_issues_only: true } : {}),
          date_from: input.date_from || context.dateFrom,
          sort_by: 'relevance',
          pageSize: 20,
          page: input.page || 1,
        });
        log(run, 'search', `Searched ${[...(input.must_include ?? []), ...(input.any_of ?? []).slice(0, 3)].join(' + ')}: ${r.totalCount} decisions`);
        if (block) searchBlocks.push({ block, turn: currentTurn, stub: stubSearch(input, r), pruned: false });
        return JSON.stringify(
          withBudget({
            totalCount: r.totalCount,
            page: r.page,
            totalPages: r.totalPages,
            results: r.results.map(x => ({
              reference: x.reference,
              lpa: x.lpa_name,
              decision: x.decision,
              date: x.decision_date,
              appeal_type: x.appeal_type,
              development: (developmentProposed(x.summary) ?? '(not parsed)').slice(0, 200),
              snippets: (x.snippets ?? []).slice(0, 2).map(s => s.replace(/\s+/g, ' ').slice(0, 320)),
            })),
          })
        );
      }
      if (name === 'get_decision_text') {
        run.stats.textsFetched++;
        const { appeal, text } = await appealbase.getAppealFullTextAll(input.reference);
        run.texts.set(input.reference, text);
        run.meta.set(input.reference, { lpa: appeal.lpa_name, date: appeal.decision_date, decision: appeal.decision, procedure: appeal.procedure });
        putText(input.reference, text, run.meta.get(input.reference)); // shared in-memory store for the chat (never persisted)
        if (block) textBlocks.set(input.reference, block);
        log(run, 'read', `Reading decision ${input.reference} (${appeal.lpa_name})`);
        return JSON.stringify(withBudget({ reference: input.reference, lpa: appeal.lpa_name, decision: appeal.decision, date: appeal.decision_date, chars: text.length })) + '\n\nFULL TEXT:\n' + text;
      }
      if (name === 'record_precedent') {
        const ref = input.reference;
        const text = run.texts.get(ref);
        if (!text) return JSON.stringify({ error: `Fetch the full text of ${ref} with get_decision_text before recording it.` });
        if (!records.has(ref) && records.size >= options.maxRecords) return JSON.stringify({ error: `Record limit (${options.maxRecords}) reached. Finish with a short summary.` });
        const found = makeFinder(text);
        const dropped = [];
        const pb = input.planning_balance ?? {};
        if (pb.quote && !found(pb.quote)) {
          dropped.push('planning_balance.quote');
          pb.quote = '';
          pb.para = '';
        }
        const proc = processEntries(pb.entries, found, issueIds);
        pb.entries = proc.entries;
        if (proc.dropped) dropped.push(`${proc.dropped} balance entries`);
        const claimed = pb.present;
        pb.present = !!(claimed && pb.quote);
        const points = (input.usable_points ?? []).filter(p => {
          if (p.quote && found(p.quote)) return true;
          dropped.push(`usable point: ${String(p.point).slice(0, 40)}`);
          return false;
        });
        const issues = (input.issues ?? []).map(i => {
          const issue = { ...i };
          if (issue.quote && !found(issue.quote)) {
            dropped.push(`issue ${issue.id} quote`);
            issue.quote = '';
          }
          if ((issue.effect === 'harm' || issue.effect === 'no_harm') && !issue.quote) issue.effect = 'unclear';
          return issue;
        });
        let scale = input.scale && Object.keys(input.scale).some(k => k !== 'quote') ? { ...input.scale } : null;
        if (scale) {
          if (scale.quote && found(scale.quote)) scale.verified = true;
          else {
            dropped.push('scale (quote not found)');
            scale = null;
          }
        }
        const check = scaleCheck(scale, context.scale);
        let relevance = Math.max(0, Math.min(10, Number(input.relevance) || 0));
        let relevanceCapped = false;
        if (options.scaleCap && check.level === 'different' && relevance > 5) {
          relevance = 5;
          relevanceCapped = true;
        }
        const meta = run.meta.get(ref) ?? {};
        records.set(ref, {
          reference: ref,
          url: `https://www.appealbase.com/decision/${ref}`,
          lpa: meta.lpa ?? '',
          date: meta.date ?? '',
          outcome: input.outcome,
          chars: text.length,
          scheme_summary: input.scheme_summary ?? '',
          determinative_issues: input.determinative_issues ?? [],
          issues,
          weightedCoverage: weightedCoverage(issues, context.issues),
          planning_balance: pb,
          comparability: input.comparability ?? '',
          usable_points: points,
          scale,
          scaleCheck: check,
          relevance,
          relevanceRaw: Number(input.relevance) || 0,
          relevanceCapped,
          relevance_reason: input.relevance_reason ?? '',
          droppedQuotes: dropped,
        });
        log(run, 'record', `Recorded ${ref} (${meta.lpa ?? ''}, ${input.outcome}, rated ${relevance}/10)`);
        const blk = textBlocks.get(ref);
        if (blk) blk.content = `[Full text of ${ref} removed from context after recording. Use your recorded notes.]`;
        const missing = context.issues.filter(i => !issues.some(x => x.id === i.id)).map(i => i.id);
        return JSON.stringify({
          recorded: ref,
          records_so_far: records.size,
          dropped_unverified: dropped,
          balance_present_after_verification: pb.present,
          scale_check: check.level,
          note: relevanceCapped ? 'Relevance capped at 5: scale differs from the project by more than 10 times.' : undefined,
          issues_missing_from_record: missing.length ? missing : undefined,
        });
      }
      return JSON.stringify({ error: `Unknown tool ${name}` });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }

  const system = buildSystemPrompt(run);
  const messages = [{ role: 'user', content: 'Begin. Find and record the best precedents for this project.' }];
  log(run, 'info', `Started: ${options.callCap} Appealbase calls available, up to ${options.maxRecords} precedents`);
  let finalText = '';

  for (let turn = 0; turn < options.maxTurns; turn++) {
    if (run.cancel) {
      run.status = 'cancelled';
      break;
    }
    if (Date.now() > deadline) {
      log(run, 'info', 'Stopped: time limit reached');
      break;
    }
    currentTurn = turn + 1;
    const resp = await anthropic.messages.create({ model: MODEL_SONNET, max_tokens: 4096, system, tools: TOOLS, messages });
    run.stats.turns = turn + 1;
    run.stats.inputTokens += resp.usage.input_tokens;
    run.stats.outputTokens += resp.usage.output_tokens;
    messages.push({ role: 'assistant', content: resp.content });
    const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (text) finalText = text;
    const uses = resp.content.filter(b => b.type === 'tool_use');
    if (!uses.length) break;
    const results = [];
    for (const u of uses) {
      const block = { type: 'tool_result', tool_use_id: u.id, content: '' };
      block.content = await runTool(u.name, u.input, block);
      results.push(block);
    }
    messages.push({ role: 'user', content: results });
    pruneOldSearches();
    run.stats.appealbaseCalls = appealbase.callsUsed;
    run.stats.estCostUsd = Math.round(((run.stats.inputTokens / 1e6) * PRICE_IN + (run.stats.outputTokens / 1e6) * PRICE_OUT) * 100) / 100;
    run.records = sortRecords(records);
    if (resp.stop_reason === 'end_turn') break;
  }

  run.stats.appealbaseCalls = appealbase.callsUsed;
  run.stats.estCostUsd = Math.round(((run.stats.inputTokens / 1e6) * PRICE_IN + (run.stats.outputTokens / 1e6) * PRICE_OUT) * 100) / 100;
  run.records = sortRecords(records);
  run.summary = finalText;
  run.finishedAt = Date.now();
  if (run.status === 'running') run.status = 'done';
  log(run, 'info', run.status === 'cancelled' ? `Cancelled with ${run.records.length} precedents recorded` : `Finished: ${run.records.length} precedents`);
}

function sortRecords(records) {
  return [...records.values()].sort((a, b) => b.relevance - a.relevance || b.weightedCoverage - a.weightedCoverage);
}

/** Safe view of a run for the API (never includes decision text). */
export function viewRun(run, since = 0) {
  return {
    id: run.id,
    status: run.status,
    error: run.error,
    stats: { ...run.stats, seconds: Math.round(((run.finishedAt ?? Date.now()) - run.createdAt) / 1000) },
    options: run.options,
    issues: run.context.issues,
    progress: run.progress.slice(since),
    cursor: run.progress.length,
    records: run.records,
    summary: run.summary ?? '',
  };
}
