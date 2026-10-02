/**
 * Appealbase probe: count-only searches to learn the vocabulary and pool size for a scheme type.
 * Uses pageSize 1 so each probe is one call and returns just totalCount plus one sample row.
 *
 * Usage: node scripts/appealbase-probe.js
 */

import 'dotenv/config';
import { createClient } from '../src/services/appealbase.service.js';

const SOLAR = ['solar farm', 'solar farms', 'solar park', 'solar array', 'solar arrays', 'photovoltaic'];
const SINCE = '2023-01-01';

const boolean = extra => ({
  query: 'appeal',
  query_mode: 'structured_boolean',
  date_from: SINCE,
  pageSize: 1,
  ...extra,
});

const probes = [
  ['solar (full text)', boolean({ any_of: SOLAR })],
  ['solar (main issues only)', boolean({ any_of: SOLAR, main_issues_only: true })],
  ['solar + "National Landscape" (full text)', boolean({ any_of: SOLAR, must_include: ['National Landscape'] })],
  ['solar + landscape (main issues only)', boolean({ any_of: SOLAR, must_include: ['landscape'], main_issues_only: true })],
  ['solar + heritage (main issues only)', boolean({ any_of: SOLAR, must_include: ['heritage'], main_issues_only: true })],
  ['solar + "best and most versatile" (full text)', boolean({ any_of: SOLAR, must_include: ['best and most versatile'] })],
  ['solar + flood (main issues only)', boolean({ any_of: SOLAR, must_include: ['flood'], main_issues_only: true })],
];

const client = createClient({ budget: 12 });

for (const [label, args] of probes) {
  try {
    const r = await client.searchAppeals(args);
    const s = r.results?.[0];
    console.log(`${String(r.totalCount).padStart(5)}  ${label}${s ? `   e.g. ${s.reference} ${s.lpa_name} (${s.decision})` : ''}`);
  } catch (e) {
    console.log(`  ERR  ${label}: ${e.message}`);
  }
}
console.log(`\nCalls used this run: ${client.callsUsed}`);
