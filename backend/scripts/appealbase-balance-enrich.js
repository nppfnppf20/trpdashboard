/**
 * Enrich existing Appealbase results with structured planning-balance entries (level of harm and weight given).
 * Reads cached decision text only (cacheOnly, so no Appealbase calls) and spends Sonnet tokens.
 *
 * Usage: node scripts/appealbase-balance-enrich.js 6002358 3374756 ...
 * Output: logs/appealbase-balance-entries.json (gitignored), merged with any earlier output
 */

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '../src/services/appealbase.service.js';
import { extractBalanceEntries } from '../src/services/appealbaseDeepRead.service.js';

const REFS = process.argv.slice(2);
if (!REFS.length) throw new Error('Pass one or more 7-digit appeal references');
const OUT = new URL('../logs/appealbase-balance-entries.json', import.meta.url);
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const client = createClient({ cacheOnly: true });
let next = 0;
let promptChars = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < REFS.length) {
      const ref = REFS[next++];
      try {
        const r = await extractBalanceEntries(client, ref);
        existing[ref] = r.entries;
        promptChars += r.promptChars;
        const harms = r.entries.filter(e => e.side === 'harm');
        console.log(`${ref}: ${r.entries.length} entries kept (${r.dropped} dropped of ${r.returned}); harms with level stated ${harms.filter(h => h.level !== 'not_stated').length}/${harms.length}, weights stated ${r.entries.filter(e => e.weight !== 'not_stated').length}/${r.entries.length}`);
      } catch (e) {
        console.log(`${ref}: ERR ${e.message}`);
      }
    }
  })
);
fs.writeFileSync(OUT, JSON.stringify(existing, null, 2));
console.log(`\nSaved logs/appealbase-balance-entries.json (${Object.keys(existing).length} decisions) | ~${Math.round(promptChars / 4)} input tokens | Appealbase calls: ${client.callsUsed}`);
