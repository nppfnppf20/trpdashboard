import { authFetch } from '$lib/api/client.js';

async function runCheck(endpoint, projectId, payload) {
  const res = await authFetch(`/api/draft-check/projects/${projectId}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to run ${endpoint} check`);
  }
  return res.json();
}

export function checkBriefCoverage(projectId, { draft_html, document_type, development_type }) {
  return runCheck('brief', projectId, { draft_html, document_type, development_type });
}

export function checkConsistency(projectId, { draft_html, document_type, development_type }) {
  return runCheck('consistency', projectId, { draft_html, document_type, development_type });
}

export function checkGrammar(projectId, { draft_html, document_type, development_type }) {
  return runCheck('grammar', projectId, { draft_html, document_type, development_type });
}
