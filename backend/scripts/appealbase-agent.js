/**
 * Agentic Appealbase precedent search for Landulph (solar): Claude (Sonnet) is given the Appealbase
 * search and full-text tools plus a record_precedent tool, and decides for itself what to search and read.
 * Comparison baseline for scripts/appealbase-pipeline.js.
 *
 * Usage: node scripts/appealbase-agent.js [--cap 60] [--max-records 15] [--max-turns 45] [--tag name]
 * Output: logs/compare-agent[-tag].json (gitignored)
 *
 * Same evidence rules as the pipeline, enforced in the record_precedent tool: quotes must be found
 * verbatim in the full text the agent fetched, otherwise they are dropped; a balance is only "present"
 * with a verified conclusion quote; usable points without a verified quote are removed.
 * The tool executor enforces the call cap, so the agent cannot overspend Appealbase quota.
 */

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '../src/services/appealbase.service.js';
import { ISSUES, PROJECT, SINCE, developmentProposed, issueListText } from '../src/services/appealbaseScoring.js';
import { makeFinder } from '../src/services/appealbaseQuotes.js';
import { processEntries } from '../src/services/appealbaseBalance.js';
import { client as anthropic, MODEL_SONNET } from '../src/services/llm.shared.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const CALL_CAP = arg('cap', 60);
const MAX_RECORDS = arg('max-records', 15);
const MAX_TURNS = arg('max-turns', 45);
const TAG = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : '';
const OUT = new URL(`../logs/compare-agent${TAG ? '-' + TAG : ''}.json`, import.meta.url);

const started = Date.now();
const log = m => console.log(`[agent ${Math.round((Date.now() - started) / 1000)}s] ${m}`);
const appealbase = createClient({ budget: CALL_CAP + 10, cache: true });

const SYSTEM = `You are a planning appeals research agent working for a planning consultant. Find the most useful English planning appeal decisions (precedents) for the live project below, using the Appealbase tools, and record the best ones.

PROJECT: ${PROJECT.name}, a ${PROJECT.scheme} in ${PROJECT.lpa}, ${PROJECT.setting}.
WHAT THE CLIENT CARES ABOUT: ${PROJECT.concerns}

ISSUES (id: label, weight):
${issueListText()}

HOW TO USE THE WEIGHTS
- The weights say how much each issue matters to the client; the PRIMARY issue matters most. When choosing what to read and record, prefer decisions where the primary issue was decided on the merits in a comparable designation context and scheme type, then decisions that also decided more of the other issues, weighted by importance.
- A decision that merely mentions many issues is worth less than one that decided the heavily weighted ones.
- When you record a decision, state for EVERY issue id how the inspector treated it (see the record_precedent schema). Code uses this to compute a weighted coverage score, so be accurate and do not overstate.
- Wording changes over time: older decisions say "AONB" or "Area of Outstanding Natural Beauty", newer ones say "National Landscape". Search for the variants so you do not miss decisions.

HOW THE SEARCH WORKS (important)
- It is keyword search over the full text of decisions, NOT semantic search and not for questions. Matching is exact whole words or phrases, case-insensitive: "solar farm" does not match "solar farms"; "heritage asset" does not match "heritage assets". Use must_include (all must appear) and any_of (at least one must appear, a single group) with short phrases. Include wording variants in any_of.
- main_issues_only searches only the extracted Main Issues section (beta, precise but incomplete). Scheme words like "solar" rarely appear there, so use it for issue terms only and check the scheme from the development line in the results.
- Each search result page has up to 20 decisions with a development line and a few snippets. Use the page parameter for more. Decisions since ${SINCE} are searched by default.
- Check each result's "development" line: only solar farm schemes are comparable. Ignore householder, enforcement and unrelated schemes.

BUDGET
- Each search page and each 100k-character chunk of a decision text costs one Appealbase call. You have ${CALL_CAP} calls. Tool results report calls_remaining. When it reaches 0 the tools refuse; stop and finish.

WHAT TO DO
1. Search to find decisions where the primary issue (National Landscape) and other issues were actually decided, for ground-mounted solar. Probe with counts first, refine, and vary wording.
2. For promising decisions, fetch the full text and read the planning balance. Fetch one decision at a time and call record_precedent for it immediately, before fetching the next (the full text is removed from your context after you record it).
3. Record at most ${MAX_RECORDS} precedents. Prefer variety of outcome (allowed and dismissed), decisions with a visible planning balance, and the closest comparability to the project. Do not record decisions you did not read in full.
4. When you have recorded enough or run low on calls, stop with a short summary listing the recorded references best first.

EVIDENCE RULES (checked by code)
- Quotes: one short contiguous span under 200 characters, copied exactly from the decision text. No ellipsis joins, no paraphrase. Any quote not found verbatim is discarded.
- planning_balance.present is true only when the inspector actually weighs harms against benefits; a statement of the main issues or a policy list does not count. The quote must be the inspector's own conclusion of the weighing.
- usable_points need their own verbatim quote or are removed. Never infer a conclusion the text does not state.

RELEVANCE RUBRIC (0-10): 9-10 primary issue decided on merits, closely comparable scheme and setting, balance visible; 7-8 comparable but setting or balance differs; 5-6 partial; 3-4 mostly recital; 0-2 not comparable. Use the full range.`;

const TOOLS = [
  {
    name: 'search_appeals',
    description:
      'Keyword search of appeal decision full text (exact whole words/phrases). Returns totalCount, totalPages and up to 20 compact results per page. At least one of must_include or any_of is required.',
    input_schema: {
      type: 'object',
      properties: {
        must_include: { type: 'array', items: { type: 'string' }, description: 'Every item must appear (whole word or exact phrase).' },
        any_of: { type: 'array', items: { type: 'string' }, description: 'At least one item must appear (a single group).' },
        must_exclude: { type: 'array', items: { type: 'string' }, description: 'No item may appear.' },
        main_issues_only: { type: 'boolean', description: 'Search only the extracted Main Issues section (beta).' },
        date_from: { type: 'string', description: `YYYY-MM-DD, default ${SINCE}.` },
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
              description: 'Each harm and benefit the inspector placed in the balance. Copy the inspector\'s exact wording for level of harm and weight; leave a wording empty if not stated, never infer one.',
              items: {
                type: 'object',
                properties: {
                  side: { type: 'string', enum: ['harm', 'benefit'] },
                  issue_id: { type: 'string', description: "One of the issue ids in the brief, or 'other'." },
                  description: { type: 'string', description: 'Max 12 words.' },
                  level_wording: { type: 'string', description: "Harms only: the inspector's exact words for how severe the harm is (e.g. 'less than substantial harm', 'moderate adverse'), or ''." },
                  weight_wording: { type: 'string', description: "The inspector's exact words for the weight given (e.g. 'great weight', 'limited weight'), or ''." },
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
          items: {
            type: 'object',
            properties: { point: { type: 'string' }, quote: { type: 'string' }, para: { type: 'string' } },
            required: ['point', 'quote'],
          },
        },
        relevance: { type: 'number', description: '0-10 per the rubric.' },
        relevance_reason: { type: 'string', description: 'Max 30 words.' },
      },
      required: ['reference', 'outcome', 'issues', 'planning_balance', 'relevance'],
    },
  },
];

// Weighted share of the client's issues the inspector actually decided: substantive = full weight, mentioned = 0.3.
const TREATMENT_FACTOR = { substantive: 1, mentioned: 0.3, not_addressed: 0 };
const TOTAL_WEIGHT = ISSUES.reduce((n, i) => n + i.weight, 0);
function weightedCoverage(issues) {
  const score = ISSUES.reduce((n, i) => n + i.weight * (TREATMENT_FACTOR[issues.find(x => x.id === i.id)?.treatment] ?? 0), 0);
  return Math.round((score / TOTAL_WEIGHT) * 100) / 100;
}

const texts = new Map(); // reference -> full text (in memory only, for quote verification)
const textBlocks = new Map(); // reference -> tool_result block, so the bulky text can be swapped for a stub
// Search results stay in full for one turn only: every API call resends the whole conversation, so once the
// agent has seen a result page we shrink it to one line per candidate (no snippets) to stop paying for it again.
const searchBlocks = []; // { block, turn, compact, pruned }
let currentTurn = 0;
let prunedChars = 0;
const compactSearch = (input, r) =>
  `[Search result pruned after you read it. Query: must_include=${JSON.stringify(input.must_include ?? [])} any_of=${JSON.stringify((input.any_of ?? []).slice(0, 6))}${input.main_issues_only ? ' main_issues_only' : ''}; page ${r.page}/${r.totalPages}, ${r.totalCount} total. Candidates (reference | LPA | outcome | date | development):\n` +
  r.results.map(x => `${x.reference} | ${x.lpa_name} | ${x.decision} | ${String(x.decision_date).slice(0, 10)} | ${(developmentProposed(x.summary) ?? '(not parsed)').slice(0, 70)}`).join('\n') +
  '\nRe-run the search (results are cached, no extra call) if you need the snippets again.]';
function pruneOldSearches() {
  for (const s of searchBlocks) {
    if (s.pruned || s.turn >= currentTurn) continue;
    prunedChars += s.block.content.length - s.compact.length;
    s.block.content = s.compact;
    s.pruned = true;
  }
}
const records = new Map();
const toolLog = [];
let searches = 0;
let fetched = 0;

const budgetLeft = () => CALL_CAP - appealbase.callsUsed;
const withBudget = obj => ({ ...obj, calls_remaining: Math.max(0, budgetLeft()) });

async function runTool(name, input, block) {
  if ((name === 'search_appeals' || name === 'get_decision_text') && budgetLeft() <= 0) {
    return JSON.stringify({ error: 'Call budget exhausted. Stop searching and finish with a short summary.', calls_remaining: 0 });
  }
  try {
    if (name === 'search_appeals') {
      if (!(input.must_include?.length || input.any_of?.length)) return JSON.stringify({ error: 'Provide must_include or any_of.' });
      searches++;
      const r = await appealbase.searchAppeals({
        query: 'appeal',
        query_mode: 'structured_boolean',
        ...(input.must_include?.length ? { must_include: input.must_include } : {}),
        ...(input.any_of?.length ? { any_of: input.any_of } : {}),
        ...(input.must_exclude?.length ? { must_exclude: input.must_exclude } : {}),
        ...(input.main_issues_only ? { main_issues_only: true } : {}),
        date_from: input.date_from || SINCE,
        sort_by: 'relevance',
        pageSize: 20,
        page: input.page || 1,
      });
      if (block) searchBlocks.push({ block, turn: currentTurn, compact: compactSearch(input, r), pruned: false });
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
      fetched++;
      const { appeal, text } = await appealbase.getAppealFullTextAll(input.reference);
      texts.set(input.reference, text);
      if (block) textBlocks.set(input.reference, block);
      return JSON.stringify(withBudget({ reference: input.reference, lpa: appeal.lpa_name, decision: appeal.decision, date: appeal.decision_date, chars: text.length })) + '\n\nFULL TEXT:\n' + text;
    }
    if (name === 'record_precedent') {
      const ref = input.reference;
      const text = texts.get(ref);
      if (!text) return JSON.stringify({ error: `Fetch the full text of ${ref} with get_decision_text before recording it.` });
      if (!records.has(ref) && records.size >= MAX_RECORDS) return JSON.stringify({ error: `Record limit (${MAX_RECORDS}) reached. Finish with a short summary.` });
      const found = makeFinder(text);
      const dropped = [];
      const pb = input.planning_balance ?? {};
      if (pb.quote && !found(pb.quote)) {
        dropped.push('planning_balance.quote');
        pb.quote = '';
        pb.para = '';
      }
      // Structured entries: wording verified against the text, mapped onto fixed scales in code.
      const proc = processEntries(pb.entries, found);
      pb.entries = proc.entries;
      if (proc.dropped) dropped.push(`${proc.dropped} balance entries`);
      const claimed = pb.present;
      pb.present = !!(claimed && pb.quote);
      const points = (input.usable_points ?? []).filter(p => {
        if (p.quote && found(p.quote)) return true;
        dropped.push(`usable_point: ${String(p.point).slice(0, 50)}`);
        return false;
      });
      // Per-issue treatment: unverified quotes are dropped and harm/no_harm without a verified quote becomes "unclear".
      const issues = (input.issues ?? []).map(i => {
        const issue = { ...i };
        if (issue.quote && !found(issue.quote)) {
          dropped.push(`issue ${issue.id} quote`);
          issue.quote = '';
        }
        if ((issue.effect === 'harm' || issue.effect === 'no_harm') && !issue.quote) issue.effect = 'unclear';
        return issue;
      });
      const missing = ISSUES.filter(i => !issues.some(x => x.id === i.id)).map(i => i.id);
      records.set(ref, {
        ...input,
        issues,
        weightedCoverage: weightedCoverage(issues),
        planning_balance: pb,
        usable_points: points,
        url: `https://www.appealbase.com/decision/${ref}`,
        droppedQuotes: dropped,
      });
      // Free the context: replace the bulky full text with a stub.
      const blk = textBlocks.get(ref);
      if (blk) blk.content = `[Full text of ${ref} removed from context after recording. Use your recorded notes.]`;
      texts.set(ref, text); // keep in memory for verification of any re-record
      return JSON.stringify({
        recorded: ref,
        records_so_far: records.size,
        dropped_unverified: dropped,
        balance_present_after_verification: pb.present,
        weighted_coverage: records.get(ref).weightedCoverage,
        issues_missing_from_record: missing.length ? missing : undefined,
        note: claimed && !pb.present ? 'Balance claim overruled: its conclusion quote was not found verbatim.' : undefined,
      });
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

const messages = [{ role: 'user', content: 'Begin. Find and record the best precedents for this project.' }];
let inputTokens = 0;
let outputTokens = 0;
let turns = 0;
let finalText = '';
const inputByTurn = [];

for (; turns < MAX_TURNS; turns++) {
  const resp = await anthropic.messages.create({ model: MODEL_SONNET, max_tokens: 4096, system: SYSTEM, tools: TOOLS, messages });
  inputTokens += resp.usage.input_tokens;
  outputTokens += resp.usage.output_tokens;
  inputByTurn.push(resp.usage.input_tokens);
  currentTurn = turns + 1;
  messages.push({ role: 'assistant', content: resp.content });
  const uses = resp.content.filter(b => b.type === 'tool_use');
  const textOut = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  if (textOut) finalText = textOut;
  if (!uses.length) break;

  const results = [];
  for (const u of uses) {
    const block = { type: 'tool_result', tool_use_id: u.id, content: '' };
    block.content = await runTool(u.name, u.input, block);
    results.push(block);
    toolLog.push({ turn: turns + 1, tool: u.name, input: u.name === 'record_precedent' ? { reference: u.input.reference, relevance: u.input.relevance } : u.input });
    log(`${u.name} ${JSON.stringify(u.name === 'record_precedent' ? { reference: u.input.reference } : u.input).slice(0, 110)} | calls ${appealbase.callsUsed}/${CALL_CAP} | records ${records.size}`);
  }
  messages.push({ role: 'user', content: results });
  pruneOldSearches(); // results from earlier turns shrink now; this turn's stay in full for the next call
  if (resp.stop_reason === 'end_turn') break;
}

const stats = {
  appealbaseCalls: appealbase.callsUsed,
  searches,
  textsFetched: fetched,
  turns: turns + 1,
  seconds: Math.round((Date.now() - started) / 1000),
  inputTokens,
  outputTokens,
  records: records.size,
  hitTurnLimit: turns >= MAX_TURNS,
  searchesPruned: searchBlocks.filter(s => s.pruned).length,
  prunedApproxTokensPerResend: Math.round(prunedChars / 4),
  inputByTurn,
};
fs.writeFileSync(OUT, JSON.stringify({ stats, ranked: [...records.values()].sort((a, b) => b.relevance - a.relevance || b.weightedCoverage - a.weightedCoverage), finalText, toolLog }, null, 2));
log(`done. ${records.size} precedents, ${stats.appealbaseCalls} Appealbase calls, ${inputTokens} input / ${outputTokens} output tokens, ${stats.turns} turns. Saved logs/compare-agent${TAG ? '-' + TAG : ''}.json`);
