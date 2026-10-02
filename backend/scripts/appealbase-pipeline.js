/**
 * Staged Appealbase precedent pipeline for Landulph (solar), end to end:
 *   search (all pages per issue) -> scheme check -> coverage score (top 30)
 *   -> snippet judging (Sonnet) -> full-text deep read (top 15, Sonnet) -> ranked list.
 *
 * Usage: node scripts/appealbase-pipeline.js [--budget 60] [--pages 5] [--judge 30] [--read 15]
 * Output: logs/compare-pipeline.json (gitignored)
 * Responses are cached (dev only), so repeated calls cost no Appealbase quota.
 */

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '../src/services/appealbase.service.js';
import { gatherCandidates, scoreCandidates } from '../src/services/appealbaseScoring.js';
import { judgeCandidates } from '../src/services/appealbaseJudge.service.js';
import { deepRead } from '../src/services/appealbaseDeepRead.service.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const BUDGET = arg('budget', 60);
const PAGES = arg('pages', 5);
const JUDGE_N = arg('judge', 30);
const READ_N = arg('read', 15);
const OUT = new URL('../logs/compare-pipeline.json', import.meta.url);

const started = Date.now();
const log = m => console.log(`[pipeline ${Math.round((Date.now() - started) / 1000)}s] ${m}`);
const client = createClient({ budget: BUDGET, cache: true });
const stats = { stages: {}, promptChars: 0 };

// 1. Search
const candidates = await gatherCandidates(client, { pages: PAGES, log: () => {} });
const scored = scoreCandidates(candidates);
const verified = scored.filter(s => s.schemeOk === true);
stats.stages.candidates = scored.length;
stats.stages.solarVerified = verified.length;
stats.stages.rejectedNotSolar = scored.filter(s => s.schemeOk === false).length;
stats.stages.unclassified = scored.filter(s => s.schemeOk === null).length;
log(`search done: ${scored.length} candidates, ${verified.length} solar-verified (Appealbase calls so far: ${client.callsUsed})`);

// 2. Coverage score -> top N
const top = verified.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)).slice(0, JUDGE_N);

// 3. Snippet judging
const judged = (await judgeCandidates(top, { modelKey: 'sonnet' })).filter(r => !r.error);
stats.stages.judged = judged.length;
stats.promptChars += judged.reduce((n, r) => n + r.promptChars, 0);
log(`snippet judging done: ${judged.length} judged`);

// 4. Choose the deep-read shortlist: best snippet relevance, balance visible as a tie-break, then coverage
const shortlist = judged
  .sort((a, b) => b.judgement.relevance - a.judgement.relevance || Number(b.judgement.planning_balance_visible) - Number(a.judgement.planning_balance_visible) || b.coverage - a.coverage)
  .slice(0, READ_N);
stats.stages.shortlisted = shortlist.length;

// 5. Deep read
const reads = [];
for (const s of shortlist) {
  try {
    const r = await deepRead(client, s.reference);
    reads.push({ ...r, snippetRelevance: s.judgement.relevance, coverage: s.coverage });
    stats.promptChars += r.promptChars;
    log(`deep read ${s.reference} ${r.lpa} (${r.decision}): relevance ${r.judgement.relevance}, balance ${r.judgement.planning_balance.present}`);
  } catch (e) {
    reads.push({ reference: s.reference, error: e.message });
    log(`deep read ${s.reference}: ERR ${e.message}`);
  }
}
const ok = reads.filter(r => !r.error).sort((a, b) => b.judgement.relevance - a.judgement.relevance);
stats.stages.deepRead = ok.length;

stats.appealbaseCalls = client.callsUsed;
stats.seconds = Math.round((Date.now() - started) / 1000);
stats.approxInputTokens = Math.round(stats.promptChars / 4);
fs.writeFileSync(OUT, JSON.stringify({ stats, ranked: ok, errors: reads.filter(r => r.error), judged: judged.map(j => ({ reference: j.reference, relevance: j.judgement.relevance, coverage: j.coverage })) }, null, 2));
log(`done. ${ok.length} precedents, ${stats.appealbaseCalls} Appealbase calls, ~${stats.approxInputTokens} input tokens. Saved logs/compare-pipeline.json`);
