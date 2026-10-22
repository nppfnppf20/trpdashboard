/**
 * One-off: tidy the whitespace of already-saved meeting text (transcripts, uploaded
 * documents, agendas and consultant notes), using the same formatter that now runs
 * when text is pasted (frontend/src/lib/utils/policyFormat.js). Whitespace only:
 * no words are added, removed or reordered.
 *
 *   node scripts/tidy-meeting-text.js                     preview only, writes nothing
 *   node scripts/tidy-meeting-text.js --project=68        limit to one project (database id)
 *   node scripts/tidy-meeting-text.js --show=meeting_transcripts:123:transcript_text
 *                                                          full before/after for one field
 *   node scripts/tidy-meeting-text.js --apply             saves a backup file, then updates
 *
 * Covers: planning_applications.meeting_transcripts (transcript_text, agenda,
 * user_notes) and planning_applications.document_summaries (transcript_text).
 * Any saved formatting layer (transcript_text_annotated) is left alone: it holds
 * layout and marks for the same words, so it stays valid when only whitespace in
 * the plain text changes.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const formatterPath = path.resolve(here, '../../frontend/src/lib/utils/policyFormat.js');
const { formatPastedPolicyText, normaliseBullets, LIST_MARKER } = await import(pathToFileURL(formatterPath).href);

const apply = process.argv.includes('--apply');
const projectArg = process.argv.find(a => a.startsWith('--project='));
const projectId = projectArg ? Number(projectArg.slice(10)) : null;
if (projectArg && !Number.isInteger(projectId)) {
  console.error('--project must be a number');
  process.exit(1);
}
const showArg = process.argv.find(a => a.startsWith('--show='));
const show = showArg ? showArg.slice(7).split(':') : null; // [table, id, column]

const TARGETS = [
  { table: 'planning_applications.meeting_transcripts', short: 'meeting_transcripts', cols: ['transcript_text', 'agenda', 'user_notes'] },
  { table: 'planning_applications.document_summaries', short: 'document_summaries', cols: ['transcript_text'] },
];

// Compares letters and punctuation only: ALL whitespace is ignored, so a word
// wrapped at a hyphen ("semi-" / "natural") may legitimately become "semi-natural".
const strip = s => (s ?? '').replace(/[­​-‍﻿]/g, '');
const squash = s => strip(s).replace(/\s+/g, '');
const markerLines = s => (s ?? '').split('\n').filter(l => LIST_MARKER.test(l.trim())).length;
const lineCount = s => (s ?? '').split('\n').filter(l => l.trim()).length;

console.log(projectId ? `Project ${projectId} only` : 'All projects');

const changes = []; // { target, id, col, before, after }
const summary = {};

for (const target of TARGETS) {
  const res = { rows: 0, fields: 0, changed: 0, unchanged: 0, skippedWords: 0, skippedMarkers: 0 };
  summary[target.short] = res;

  const { rows } = await pool.query(
    `SELECT id, project_id, ${target.cols.join(', ')} FROM ${target.table}
     WHERE ($1::int IS NULL OR project_id = $1) ORDER BY id`,
    [projectId]
  );
  res.rows = rows.length;

  for (const r of rows) {
    for (const col of target.cols) {
      const before = r[col];
      if (!before || !before.trim()) continue;
      res.fields++;
      const after = formatPastedPolicyText(before);

      // Symbol-font bullets (private-use characters that show as boxes) become a normal
      // bullet, which is the one intended non-whitespace change, so compare against that.
      const expected = normaliseBullets(before);
      if (squash(expected) !== squash(after)) { res.skippedWords++; console.log(`!! words would differ in ${target.short}#${r.id}.${col}, skipping`); continue; }
      if (markerLines(expected) !== markerLines(after)) { res.skippedMarkers++; console.log(`!! list items would merge in ${target.short}#${r.id}.${col}, skipping`); continue; }
      if (after === before) { res.unchanged++; continue; }

      res.changed++;
      changes.push({ target, id: r.id, project_id: r.project_id, col, before, after });
    }
  }
}

console.log('');
for (const [name, r] of Object.entries(summary)) {
  console.log(`${name}: ${r.rows} rows, ${r.fields} text fields | would change ${r.changed} | already tidy ${r.unchanged} | skipped (words) ${r.skippedWords} | skipped (list items) ${r.skippedMarkers}`);
}
console.log(`\nTotal fields that would change: ${changes.length}`);
if (changes.length) {
  const before = changes.reduce((n, c) => n + lineCount(c.before), 0);
  const after = changes.reduce((n, c) => n + lineCount(c.after), 0);
  console.log(`Lines across those fields: ${before} -> ${after}`);
}

const clip = (s, n = 230) => JSON.stringify((s ?? '').slice(0, n)) + ((s ?? '').length > n ? '…' : '');
for (const c of changes.slice(0, 4)) {
  console.log(`\n${c.target.short}#${c.id} (project ${c.project_id ?? '-'}) ${c.col}: ${lineCount(c.before)} -> ${lineCount(c.after)} lines`);
  console.log('   before: ' + clip(c.before));
  console.log('   after : ' + clip(c.after));
}

if (show) {
  const [short, id, col] = show;
  const c = changes.find(x => x.target.short === short && String(x.id) === id && x.col === col);
  console.log('\n===== ' + show.join(':') + ' =====');
  console.log(c ? `--- BEFORE ---\n${c.before}\n--- AFTER ---\n${c.after}` : '(no change for that field, or not found)');
}

if (!apply) {
  console.log('\nPreview only. Nothing was written. Re-run with --apply to save.');
  await pool.end();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(here, `meeting-text-backup-${stamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(changes.map(c => ({ table: c.target.table, id: c.id, column: c.col, original: c.before })), null, 2));
console.log(`\nBackup of originals written to ${backupFile}`);

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const c of changes) {
    await client.query(`UPDATE ${c.target.table} SET ${c.col} = $1 WHERE id = $2`, [c.after, c.id]);
  }
  await client.query('COMMIT');
  console.log(`Updated ${changes.length} fields.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
