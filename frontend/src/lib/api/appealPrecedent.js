import { authFetch } from './client.js';

async function json(res, fallback) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || e.message || fallback);
  }
  return res.json();
}

const post = (url, body) =>
  authFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

/** The latest saved results for the project, or null. */
export async function getSavedPrecedents(projectId) {
  return (await json(await authFetch(`/api/appeal-precedent/projects/${projectId}/saved`), 'Could not load the saved results')).saved;
}

/** Save the current results (records, setup, ticks, chat). An empty record list clears the save. */
export async function savePrecedents(projectId, state) {
  return json(await authFetch(`/api/appeal-precedent/projects/${projectId}/saved`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }), 'Could not save the results');
}

/** Meeting notes and project documents that can be picked to draft the setup from. */
export async function getPrecedentSources(projectId) {
  return json(await authFetch(`/api/appeal-precedent/projects/${projectId}/sources`), 'Could not load the notes and documents');
}

/**
 * Read the project and suggest the scheme, scale, key issues and instructions (optional setup step).
 * `sources` ({ document_ids, meeting_ids, mode }) drafts from chosen notes and documents as well.
 */
export async function suggestPrecedentContext(projectId, sources = null) {
  return json(await post(`/api/appeal-precedent/projects/${projectId}/suggest`, sources ? { sources } : {}), 'Could not read the project');
}

/** Start a background search. Returns { runId }. */
export async function startPrecedentRun({ projectId, context, options }) {
  return json(await post('/api/appeal-precedent/runs', { projectId, context, options }), 'Could not start the search');
}

/** Poll a run. `since` is the progress cursor from the previous poll. */
export async function getPrecedentRun(runId, since = 0) {
  return json(await authFetch(`/api/appeal-precedent/runs/${runId}?since=${since}`), 'Could not read the search');
}

export async function cancelPrecedentRun(runId, since = 0) {
  return json(await post(`/api/appeal-precedent/runs/${runId}/cancel?since=${since}`), 'Could not cancel the search');
}

/** Ask a question about the ticked decisions. Returns { reply, citations, contextTokens, usage }. */
export async function askAboutPrecedents(runId, { refs, messages, projectId, projectName }) {
  if (runId) {
    const res = await post(`/api/appeal-precedent/runs/${runId}/chat`, { refs, messages });
    if (res.status !== 404) return json(res, 'Chat request failed');
  }
  // No live run (results were restored from the save, or the server restarted): answer from the saved results.
  return json(await post(`/api/appeal-precedent/projects/${projectId}/saved/chat`, { refs, messages, projectName }), 'Chat request failed');
}
