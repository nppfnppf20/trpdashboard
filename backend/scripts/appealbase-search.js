/**
 * Appealbase precedent search experiment (Landulph, solar).
 *
 * Per issue: one full-text search = scheme variants (any_of) AND issue phrase (must_include).
 * Scheme type is then verified locally against the "development proposed" line of the free
 * `summary` field, and decisions are ranked by weighted issue coverage.
 *
 * Usage: node scripts/appealbase-search.js [pages-per-issue=1]
 */

import 'dotenv/config';
import { createClient } from '../src/services/appealbase.service.js';
import { ISSUES, gatherCandidates, scoreCandidates } from '../src/services/appealbaseScoring.js';

const PAGES = Number(process.argv[2] || 1);

const client = createClient({ budget: 20, cache: true });
const candidates = await gatherCandidates(client, { pages: PAGES });
const scored = scoreCandidates(candidates);

const verified = scored.filter(s => s.schemeOk === true);
const unknown = scored.filter(s => s.schemeOk === null);
console.log(
  `\nCandidates: ${scored.length} | solar-verified: ${verified.length} | rejected (not solar): ${scored.filter(s => s.schemeOk === false).length} | no dev line found: ${unknown.length}`
);

verified.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
console.log('\nTop 25 (score | issues hit):');
for (const s of verified.slice(0, 25)) {
  console.log(
    `${String(s.score).padStart(2)} | ${s.hits.length}/${ISSUES.length} | ${s.reference} ${s.lpa} ${s.decision} ${s.date}\n     ${(s.dev || '').slice(0, 110)}\n     ${s.hits.join(', ')}`
  );
}
console.log(`\nCalls used this run: ${client.callsUsed}`);
