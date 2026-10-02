/**
 * Snippet-level LLM judging of cached Appealbase candidates (Landulph, solar). Spends Anthropic tokens
 * only: the Appealbase client is cacheOnly, so a cache miss throws and no quota is used.
 *
 * Usage: node scripts/appealbase-judge.js [--model haiku|sonnet] [--top 30] [--sample 10]
 *   --top N      consider the top N solar-verified candidates by coverage score (default 30)
 *   --sample K   judge K of them, evenly spread across the ranking (default: all N)
 * Output: logs/appealbase-judgements-<model>.json (gitignored)
 */

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '../src/services/appealbase.service.js';
import { gatherCandidates, scoreCandidates } from '../src/services/appealbaseScoring.js';
import { judgeCandidates } from '../src/services/appealbaseJudge.service.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const MODEL_KEY = arg('model', 'haiku');
const TOP_N = Number(arg('top', 30));
const SAMPLE = arg('sample') ? Number(arg('sample')) : null;
const OUT = new URL(`../logs/appealbase-judgements-${MODEL_KEY}.json`, import.meta.url);

const client = createClient({ cacheOnly: true });
const scored = scoreCandidates(await gatherCandidates(client, { log: () => {} }));
let pool = scored
  .filter(s => s.schemeOk === true)
  .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
  .slice(0, TOP_N);
if (SAMPLE && SAMPLE < pool.length) pool = Array.from({ length: SAMPLE }, (_, k) => pool[Math.floor((k * pool.length) / SAMPLE)]);
console.log(`Judging ${pool.length} candidates (top ${TOP_N} by coverage) with ${MODEL_KEY} (Appealbase calls: ${client.callsUsed})\n`);

const results = await judgeCandidates(pool, { modelKey: MODEL_KEY, onProgress: r => process.stdout.write(r.error ? 'x' : '.') });
console.log('\n');
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

const ok = results.filter(r => !r.error).sort((a, b) => b.judgement.relevance - a.judgement.relevance);
console.log('rel | cov | balance | ref LPA outcome');
for (const r of ok) {
  const j = r.judgement;
  console.log(
    `${String(j.relevance).padStart(3)} | ${String(r.coverage).padStart(3)} | ${j.planning_balance_visible ? ' yes   ' : ' no    '} | ${r.reference} ${r.lpa} ${r.decision}`
  );
}
const sum = f => ok.reduce((n, r) => n + f(r), 0);
console.log(
  `\nErrors: ${results.length - ok.length} | relevance values: ${[...new Set(ok.map(r => r.judgement.relevance))].sort((a, b) => a - b).join(',')}` +
    `\nBalance visible in excerpts: ${ok.filter(r => r.judgement.planning_balance_visible).length}/${ok.length} (model claimed but code overruled: ${ok.filter(r => r.balanceOverruled).length})` +
    `\nQuotes returned: ${sum(r => r.quotesReturned)}, dropped as not verbatim: ${sum(r => r.dropped)} | effect downgraded to unclear: ${sum(r => r.downgraded)}` +
    `\nSaved to logs/appealbase-judgements-${MODEL_KEY}.json | Appealbase calls this run: ${client.callsUsed}`
);
