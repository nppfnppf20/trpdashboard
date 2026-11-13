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

export async function getDraftingIssuePlanRelevance(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/plan-relevance`);
  if (!res.ok) throw new Error('Failed to fetch plan relevance');
  return res.json();
}

export async function toggleDraftingIssuePlan(draftingIssueId, planId) {
  const res = await authFetch(`${BASE}/${draftingIssueId}/plans/${planId}/toggle`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to toggle plan relevance');
  return res.json();
}

export async function draftIssuesFromBriefing(projectId, sources, { allowNewIssues = true, issueScope = {}, pastedText = '' } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/draft-from-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, allowNewIssues, issueScope, pastedText })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to draft issues from briefing');
  }
  return res.json();
}

export async function draftIssuesFromTracker(projectId, { allowNewIssues = true, issueScope = {} } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/draft-from-tracker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowNewIssues, issueScope })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to draft issues from tracker');
  }
  return res.json();
}

export async function summarizeSpecialistReport(draftingIssueId, { file, text, fileName } = {}) {
  let res;
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    res = await authFetch(`${BASE}/${draftingIssueId}/specialist-report/summarize`, {
      method: 'POST',
      body: formData
    });
  } else {
    res = await authFetch(`${BASE}/${draftingIssueId}/specialist-report/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, file_name: fileName || null })
    });
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to summarise specialist report');
  }
  return res.json();
}

// ── Notes log (history of drafted notes per issue; see migration 202) ─────────

// { [issueId]: { total, pending } } — pending = entries not yet consolidated
export async function getNotesLogSummary(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/notes-log-summary`);
  if (!res.ok) throw new Error('Failed to fetch notes log summary');
  return res.json();
}

export async function getNotesLog(issueId) {
  const res = await authFetch(`${BASE}/${issueId}/notes-log`);
  if (!res.ok) throw new Error('Failed to fetch notes log');
  return res.json();
}

// Returns { notes, changes } — a proposal only, nothing is saved
export async function consolidateNotesLog(issueId) {
  const res = await authFetch(`${BASE}/${issueId}/notes-log/consolidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to consolidate notes');
  }
  return res.json();
}

// Saves the reviewed notes as the issue's current notes; returns the updated issue
export async function applyConsolidatedNotes(issueId, notes) {
  const res = await authFetch(`${BASE}/${issueId}/notes-log/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save consolidated notes');
  }
  return res.json();
}

// Writes the rows ticked in the review modal after "Draft from document".
// payload: { title, date ('YYYY-MM-DD'), items: [{ kind: 'new' | 'update' | 'rename' | 'merge' | 'drop', ... }] }
export async function applyDraftReview(projectId, payload) {
  const res = await authFetch(`${BASE}/projects/${projectId}/draft-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to apply the reviewed changes');
  }
  return res.json();
}

// "Possibly missed" check, requested after the review window has opened (it is a
// slow second AI call). drafted: [{ label, notes }] for the notes being reviewed.
export async function getMissedForDraft(projectId, { sources = [], pastedText = '', drafted = [] } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/draft-missed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, pastedText, drafted })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to check for missed points');
  }
  return res.json();
}
