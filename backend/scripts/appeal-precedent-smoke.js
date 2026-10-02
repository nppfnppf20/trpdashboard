/**
 * Smoke test for the Appeal Precedent service, bypassing HTTP/auth.
 *
 * Usage:
 *   node scripts/appeal-precedent-smoke.js suggest <projectId>
 *   node scripts/appeal-precedent-smoke.js run <projectId> [--cap 25] [--records 6] [--scheme "..."] [--setting "..."] [--instructions "..."] [--chat "question"]
 * Set APPEALBASE_DEV_CACHE=1 to reuse cached Appealbase responses (development only).
 * `run` spends Appealbase calls and Anthropic tokens (about $2-4 at default limits).
 */

import 'dotenv/config';
import { suggestContext, startRun, getRun, viewRun } from '../src/services/appealPrecedent.service.js';
import { chatAboutPrecedents } from '../src/services/appealPrecedentChat.service.js';

const [mode, projectIdArg] = process.argv.slice(2);
const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const projectId = Number(projectIdArg);
if (!mode || !projectId) throw new Error('Usage: suggest|run <projectId>');

const ctx = await suggestContext(projectId);
console.log('SUGGESTED CONTEXT');
console.log(JSON.stringify(ctx, null, 2));
if (mode === 'suggest') process.exit(0);

const runId = startRun({
  userId: 'smoke-test',
  projectId,
  context: { project: { ...ctx.project, scheme: flag('scheme', ctx.project.scheme), setting: flag('setting', ctx.project.setting) }, issues: ctx.issues, scale: ctx.scale, instructions: flag('instructions', '') },
  options: { callCap: Number(flag('cap', 25)), maxRecords: Number(flag('records', 6)) },
});
console.log(`\nRUN ${runId} started`);
let cursor = 0;
for (;;) {
  await new Promise(r => setTimeout(r, 4000));
  const v = viewRun(getRun(runId), cursor);
  cursor = v.cursor;
  v.progress.forEach(p => console.log(`  [${p.type}] ${p.text}`));
  if (v.status !== 'running') {
    console.log(`\nSTATUS ${v.status}${v.error ? ': ' + v.error : ''}`);
    console.log('STATS', JSON.stringify(v.stats));
    console.log('\nRECORDS');
    v.records.forEach(r =>
      console.log(`  ${r.relevance}/10${r.relevanceCapped ? ' (capped, raw ' + r.relevanceRaw + ')' : ''} cov ${r.weightedCoverage} | ${r.reference} ${r.lpa} ${r.outcome} | scale:${r.scaleCheck.level}${r.scaleCheck.ratio ? ' x' + r.scaleCheck.ratio + ' ' + r.scaleCheck.metric : ''} | balance:${r.planning_balance.present} | entries:${r.planning_balance.entries.length} | dropped:${r.droppedQuotes.length}`)
    );
    if (v.records.length && flag('chat')) {
      const refs = v.records.slice(0, 2).map(r => r.reference);
      console.log(`\nCHAT over ${refs.join(', ')}: ${flag('chat')}`);
      const out = await chatAboutPrecedents({ refs, messages: [{ role: 'user', content: flag('chat') }], context: getRun(runId).context, issues: getRun(runId).context.issues });
      console.log(out.reply);
      console.log('CITATIONS', JSON.stringify(out.citations.map(c => ({ n: c.n, ref: c.ref, para: c.para, verified: c.verified, quote: c.quote.slice(0, 80) })), null, 1));
      console.log('USAGE', JSON.stringify(out.usage), 'contextTokens', out.contextTokens);
    }
    process.exit(0);
  }
}
