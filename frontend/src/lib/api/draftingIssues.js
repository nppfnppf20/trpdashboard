import { authFetch } from './client.js';

const BASE = '/api/drafting-issues';

export async function getDraftingIssues(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch drafting issues');
  return res.json();
}

export async function createDraftingIssue(projectId, { label, discipline, issue_type_id }) {
  const res = await authFetch(`${BASE}/projects/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, discipline, issue_type_id })
  });
  if (!res.ok) throw new Error('Failed to create drafting issue');
  return res.json();
}

export async function updateDraftingIssue(id, updates) {
  const res = await authFetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update drafting issue');
  return res.json();
}

export async function setDraftingIssueType(id, issueTypeId) {
  const res = await authFetch(`${BASE}/${id}/issue-type`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_type_id: issueTypeId })
  });
  if (!res.ok) throw new Error('Failed to set issue type');
  return res.json();
}

export async function deleteDraftingIssue(id) {
  const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete drafting issue');
  return res.json();
}

export async function reorderDraftingIssues(projectId, orderedIds) {
  const res = await authFetch(`${BASE}/projects/${projectId}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds })
  });
  if (!res.ok) throw new Error('Failed to reorder drafting issues');
  return res.json();
}

export async function importFromKeyIssues(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/import-from-key-issues`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to import from key issues');
  return res.json();
}

export async function getDraftingIssuePolicyRelevance(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policy-relevance`);
  if (!res.ok) throw new Error('Failed to fetch policy relevance');
  return res.json();
}

export async function toggleDraftingIssuePolicy(draftingIssueId, policyId) {
  const res = await authFetch(`${BASE}/${draftingIssueId}/policies/${policyId}/toggle`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to toggle policy relevance');
  return res.json();
}

export async function getDraftingIssueSnippetRelevance(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/snippet-relevance`);
  if (!res.ok) throw new Error('Failed to fetch snippet relevance');
  return res.json();
}

export async function toggleDraftingIssueSnippet(draftingIssueId, issueTypeId, field) {
  const res = await authFetch(`${BASE}/${draftingIssueId}/snippets/${issueTypeId}/${field}/toggle`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to toggle snippet relevance');
  return res.json();
}

export async function draftIssuesFromBriefing(projectId, sources) {
  const res = await authFetch(`${BASE}/projects/${projectId}/draft-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to draft issues from briefing');
  }
  return res.json();
}
