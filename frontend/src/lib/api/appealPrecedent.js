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

/** Read the project and suggest the scheme, scale and key issues (optional setup step). */
export async function suggestPrecedentContext(projectId) {
  return json(await post(`/api/appeal-precedent/projects/${projectId}/suggest`), 'Could not read the project');
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
export async function askAboutPrecedents(runId, { refs, messages }) {
  return json(await post(`/api/appeal-precedent/runs/${runId}/chat`, { refs, messages }), 'Chat request failed');
}
