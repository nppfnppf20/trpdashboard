import { readFileSync, writeFileSync } from 'fs';

const parts = ['nppf_part1.json', 'nppf_part2.json', 'nppf_part3.json'];
const all = parts.flatMap(f => JSON.parse(readFileSync(new URL(f, import.meta.url))));

console.log(`Loaded ${all.length} policies`);

// Sanity checks: no duplicate references, all three fields present and non-empty
const seen = new Set();
for (const p of all) {
  if (!p.policy_reference || !p.policy_name || !p.policy_text) {
    throw new Error(`Missing field on ${JSON.stringify(p).slice(0, 80)}`);
  }
  if (seen.has(p.policy_reference)) throw new Error(`Duplicate reference: ${p.policy_reference}`);
  seen.add(p.policy_reference);
}
console.log('No duplicates, all fields present.');

const esc = s => s.replace(/'/g, "''");

const values = all.map((p, i) => {
  const sortOrder = i + 1;
  return `  ('${esc(p.policy_reference)}', '${esc(p.policy_name)}', '${esc(p.policy_text)}', ${sortOrder})`;
}).join(',\n');

const sql = `-- One-off bulk import of the NPPF's national decision-making policies (August 2026 edition)
-- into the canonical library — see [[project_nppf_policy_bank]]. Extracted and reviewed
-- directly against the source document (bypassing the admin-console AI extraction flow,
-- which hit output-token truncation on a document this size — see nppfPolicies.service.js).
-- Plan-making policies (PM1-17, and the "Plan-making policies" subsection of every
-- thematic chapter) are deliberately excluded, per the library's decision-making-only scope.

INSERT INTO admin_console.nppf_policies (policy_reference, policy_name, policy_text, sort_order)
VALUES
${values};
`;

writeFileSync(new URL('../migrations/175_seed_nppf_policies.sql', import.meta.url), sql);
console.log(`Wrote migration with ${all.length} rows.`);
