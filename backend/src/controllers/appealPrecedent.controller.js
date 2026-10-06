/**
 * Appeal Precedent controller: project-aware precedent search (background agent run, polled by the page),
 * plus chat over the ticked decisions. Runs live in memory only; nothing is saved.
 */

import { suggestContext, listSources, startRun, getRun, cancelRun, viewRun, userRecordRefs } from '../services/appealPrecedent.service.js';
import { chatAboutPrecedents } from '../services/appealPrecedentChat.service.js';

function fail(res, err, fallback) {
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(`[appeal-precedent] ${fallback}:`, err);
  const credit = /credit balance/i.test(err.message);
  res.status(credit ? 503 : status).json({ error: credit ? 'The AI provider is out of credit. Top up the Anthropic balance and try again.' : status >= 500 ? fallback : err.message });
}

export async function sources(req, res) {
  try {
    res.json(await listSources(Number(req.params.projectId)));
  } catch (err) {
    fail(res, err, 'Failed to list the project notes and documents');
  }
}

export async function suggest(req, res) {
  try {
    const picked = req.body?.sources;
    const clean = ids => (Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite).slice(0, 25) : []);
    const mode = ['notes', 'transcript', 'both'].includes(picked?.mode) ? picked.mode : 'notes';
    res.json(await suggestContext(Number(req.params.projectId), picked ? { document_ids: clean(picked.document_ids), meeting_ids: clean(picked.meeting_ids), mode } : null));
  } catch (err) {
    fail(res, err, 'Failed to read the project');
  }
}

export function create(req, res) {
  try {
    const { projectId, context, options } = req.body ?? {};
    const runId = startRun({ userId: req.user.id, projectId: Number(projectId) || null, context, options });
    res.status(202).json({ runId });
  } catch (err) {
    fail(res, err, 'Failed to start the search');
  }
}

function ownRun(req, res) {
  const run = getRun(req.params.runId);
  if (!run || run.userId !== req.user.id) {
    res.status(404).json({ error: 'Search not found. It may have expired.' });
    return null;
  }
  return run;
}

export function status(req, res) {
  const run = ownRun(req, res);
  if (run) res.json(viewRun(run, Math.max(0, Number(req.query.since) || 0)));
}

export function cancel(req, res) {
  const run = ownRun(req, res);
  if (!run) return;
  cancelRun(run);
  res.json(viewRun(run, Math.max(0, Number(req.query.since) || 0)));
}

export async function chat(req, res) {
  try {
    const run = ownRun(req, res);
    if (!run) return;
    const { refs, messages } = req.body ?? {};
    const known = userRecordRefs(req.user.id);
    const allowed = (refs ?? []).filter(r => known.has(String(r)));
    res.json(await chatAboutPrecedents({ refs: allowed, messages, context: run.context, issues: run.context.issues }));
  } catch (err) {
    fail(res, err, 'Chat request failed');
  }
}
