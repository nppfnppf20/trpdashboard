/**
 * Full-text deep read of a few Appealbase decisions (Landulph, solar). Spends Appealbase calls
 * (1 per 100k-char chunk) plus Sonnet tokens. Responses are cached (dev only) so reruns are free.
 *
 * Usage: node scripts/appealbase-deepread.js 6002358 3370586 3374756 ...
 * Output: logs/appealbase-deepread.json (gitignored)
 */

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '../src/services/appealbase.service.js';
import { deepRead } from '../src/services/appealbaseDeepRead.service.js';

const REFS = process.argv.slice(2);
if (!REFS.length) throw new Error('Pass one or more 7-digit appeal references');
const OUT = new URL('../logs/appealbase-deepread.json', import.meta.url);

const client = createClient({ budget: 12, cache: true });
const results = [];
for (const ref of REFS) {
  try {
    const r = await deepRead(client, ref);
    const j = r.judgement;
    results.push(r);
    console.log(`${ref} ${r.lpa} (${r.decision}): ${r.chars} chars, relevance ${j.relevance}, balance ${j.planning_balance.present}, quotes ${r.returned - r.dropped}/${r.returned} verified, usable points kept ${j.usable_points.length} (removed ${r.pointsRemoved})`);
  } catch (e) {
    results.push({ reference: ref, error: e.message });
    console.log(`${ref}: ERR ${e.message}`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nSaved to logs/appealbase-deepread.json | Appealbase calls this run: ${client.callsUsed}`);
