/**
 * One-off: tidy the whitespace of already-saved policy wording, using the same
 * formatter that now runs when wording is pasted (frontend/src/lib/utils/policyFormat.js).
 * Whitespace only: no words are added, removed or reordered.
 *
 *   node scripts/tidy-policy-text.js            preview only, writes nothing
 *   node scripts/tidy-policy-text.js --apply    saves a backup file, then updates
 *
 * Policies that already have saved bold / highlight (policy_text_annotated) are
 * skipped so that markup is never lost. Only policy_text and
 * relevant_supporting_text are touched.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const formatterPath = path.resolve(here, '../../frontend/src/lib/utils/policyFormat.js');
const { formatPastedPolicyText, LIST_MARKER } = await import(pathToFileURL(formatterPath).href);

const apply = process.argv.includes('--apply');

// --project=68  limits the run to one project (database id); omit for all projects
const projectArg = process.argv.find(a => a.startsWith('--project='));
const projectId = projectArg ? Number(projectArg.slice(10)) : null;
if (projectArg && !Number.isInteger(projectId)) {
  console.error('--project must be a number');
  process.exit(1);
}

const { rows } = await pool.query(
  `SELECT id, project_id, policy_reference, policy_name, policy_text, relevant_supporting_text, policy_text_annotated
   FROM project_policies
   WHERE ($1::int IS NULL OR project_id = $1)
   ORDER BY project_id, id`,
  [projectId]
);
console.log(projectId ? `Project ${projectId} only` : 'All projects');

// Compares letters and punctuation only: ALL whitespace is ignored, so a word
// wrapped at a hyphen ("semi-" / "natural") may legitimately become "semi-natural".
const norm = s => (s ?? '').replace(/\s+/g, '');

const changes = [];
let skippedAnnotated = 0;
let notIdempotent = 0;

for (const r of rows) {
  const newText = r.policy_text ? formatPastedPolicyText(r.policy_text) : r.policy_text;
  const newSupport = r.relevant_supporting_text ? formatPastedPolicyText(r.relevant_supporting_text) : r.relevant_supporting_text;

  // Safety net: the words themselves must be identical once whitespace is ignored
  // (the formatter only removes soft hyphens / zero-width characters beyond that).
  const strip = s => (s ?? '').replace(/[­​-‍﻿]/g, '');
  if (norm(strip(r.policy_text)) !== norm(newText) || norm(strip(r.relevant_supporting_text)) !== norm(newSupport)) {
    const a = norm(strip(r.policy_text));
    const b = norm(newText);
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    console.log(`!! words would differ for policy ${r.id}, skipping. At char ${i}: ${JSON.stringify(a.slice(Math.max(0, i - 15), i + 25))} vs ${JSON.stringify(b.slice(Math.max(0, i - 15), i + 25))}`);
    continue;
  }
  if (r.policy_text && formatPastedPolicyText(newText) !== newText) {
    notIdempotent++;
    const twice = formatPastedPolicyText(newText);
    let k = 0;
    while (k < newText.length && newText[k] === twice[k]) k++;
    console.log(`~~ policy ${r.id} not stable on a second pass. At char ${k}: ${JSON.stringify(newText.slice(Math.max(0, k - 30), k + 40))} -> ${JSON.stringify(twice.slice(Math.max(0, k - 30), k + 40))}`);
  }

  // Safety net: every list item ("a.", "(b)", "1.3" ...) that began a line must still begin one.
  const markerLines = s => (s ?? '').split('\n').filter(l => LIST_MARKER.test(l.trim())).length;
  if (markerLines(r.policy_text) !== markerLines(newText) || markerLines(r.relevant_supporting_text) !== markerLines(newSupport)) {
    console.log(`!! list items would merge in policy ${r.id}, skipping`);
    continue;
  }

  const textChanged = (newText ?? null) !== (r.policy_text ?? null);
  const supportChanged = (newSupport ?? null) !== (r.relevant_supporting_text ?? null);
  if (!textChanged && !supportChanged) continue;

  // Formatting made only of plain paragraphs (what the preview modal generates on
  // its own) holds nothing of the user's, so it is simply reset along with the
  // wording. Anything else (bold, italic, underline, highlight...) is theirs: skip.
  const hasRealMarkup = !!r.policy_text_annotated && /<(?!\/?p[\s>/])[a-z]/i.test(r.policy_text_annotated);
  if (hasRealMarkup && textChanged) {
    skippedAnnotated++;
    continue;
  }
  changes.push({ r, newText, newSupport, textChanged, supportChanged });
}

console.log(`\nPolicies scanned:            ${rows.length}`);
console.log(`Would change:                ${changes.length}`);
console.log(`  wording changes:           ${changes.filter(c => c.textChanged).length}`);
console.log(`  supporting-text changes:   ${changes.filter(c => c.supportChanged).length}`);
console.log(`Skipped (have bold/highlight): ${skippedAnnotated}`);
console.log(`Formatter not stable on rerun: ${notIdempotent}`);

const show = (label, s) => console.log(`   ${label}: ${JSON.stringify((s ?? '').slice(0, 260))}${(s ?? '').length > 260 ? '…' : ''}`);
const samples = changes.filter(c => c.textChanged).slice(0, 4);
for (const c of samples) {
  console.log(`\n#${c.r.id} ${c.r.policy_reference ?? ''} ${c.r.policy_name}`);
  show('before', c.r.policy_text);
  show('after ', c.newText);
}

// --show=17,120  prints the full before/after for those policy ids
const showArg = process.argv.find(a => a.startsWith('--show='));
if (showArg) {
  const ids = showArg.slice(7).split(',').map(Number);
  for (const c of changes.filter(c => ids.includes(c.r.id))) {
    console.log(`\n===== #${c.r.id} ${c.r.policy_reference ?? ''} ${c.r.policy_name} =====`);
    console.log('--- BEFORE ---\n' + c.r.policy_text);
    console.log('--- AFTER ---\n' + c.newText);
  }
}

if (!apply) {
  console.log('\nPreview only. Nothing was written. Re-run with --apply to save.');
  await pool.end();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(here, `policy-text-backup-${stamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(changes.map(c => ({
  id: c.r.id,
  policy_text: c.r.policy_text,
  relevant_supporting_text: c.r.relevant_supporting_text,
  policy_text_annotated: c.r.policy_text_annotated
})), null, 2));
console.log(`\nBackup of originals written to ${backupFile}`);

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const c of changes) {
    await client.query(
      `UPDATE project_policies
       SET policy_text = $1,
           relevant_supporting_text = $2,
           policy_text_annotated = CASE WHEN $4::boolean THEN NULL ELSE policy_text_annotated END
       WHERE id = $3`,
      [c.newText, c.newSupport, c.r.id, c.textChanged]
    );
  }
  await client.query('COMMIT');
  console.log(`Updated ${changes.length} policies.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
