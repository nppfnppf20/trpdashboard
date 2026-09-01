import { authFetch } from './client.js';

const BASE = '/api/progress-tracker';

export async function getProgressData(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch progress tracker data');
  return res.json();
}

export async function createIssue(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create issue');
  return res.json();
}

export async function updateIssue(issueId, updates) {
  const res = await authFetch(`${BASE}/issues/${issueId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update issue');
  return res.json();
}

export async function deleteIssue(issueId) {
  const res = await authFetch(`${BASE}/issues/${issueId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete issue');
  return res.json();
}

export async function createSubIssue(issueId, data) {
  const res = await authFetch(`${BASE}/issues/${issueId}/sub-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create sub-issue');
  return res.json();
}

export async function updateSubIssue(subIssueId, updates) {
  const res = await authFetch(`${BASE}/sub-issues/${subIssueId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update sub-issue');
  return res.json();
}

export async function deleteSubIssue(subIssueId) {
  const res = await authFetch(`${BASE}/sub-issues/${subIssueId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete sub-issue');
  return res.json();
}

export async function createActions(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save action');
  return res.json();
}

export async function suggestActionSummaries(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/actions/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate summaries');
  }
  return res.json();
}

export async function updateAction(actionId, updates) {
  const res = await authFetch(`${BASE}/actions/${actionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update action');
  return res.json();
}

export async function deleteAction(actionId) {
  const res = await authFetch(`${BASE}/actions/${actionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete action');
  return res.json();
}

export async function listMeetingNotesForPicker(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/meeting-notes`);
  if (!res.ok) throw new Error('Failed to fetch meeting notes');
  return res.json();
}

export async function draftFromMeetingNotes(projectId, transcriptIds) {
  const res = await authFetch(`${BASE}/projects/${projectId}/actions/draft-from-meeting-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript_ids: transcriptIds }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to draft from meeting notes');
  }
  return res.json();
}

export async function commitDraftedActions(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/actions/commit-drafted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save the accepted proposals');
  }
  return res.json();
}

export async function markProgressExported(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to update export timestamp');
  return res.json();
}

export async function markProgressIssuedToClient(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issue-to-client`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to update issue timestamp');
  return res.json();
}

// ── Quote links (Surveyor Management) ──────────────────────────────────────

export async function getProjectQuotesForIssues(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/quotes`);
  if (!res.ok) throw new Error('Failed to fetch project quotes');
  return res.json();
}

export async function linkIssueQuote(issueId, quoteId) {
  const res = await authFetch(`${BASE}/issues/${issueId}/quote-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_id: quoteId }),
  });
  if (!res.ok) throw new Error('Failed to link quote');
  return res.json();
}

export async function unlinkIssueQuote(issueId, quoteId) {
  const res = await authFetch(`${BASE}/issues/${issueId}/quote-links/${quoteId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unlink quote');
  return res.json();
}

export async function createIssueKeyDate(issueId, fields) {
  const res = await authFetch(`${BASE}/issues/${issueId}/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create key date');
  }
  return res.json();
}

export async function updateIssueKeyDate(keyDateId, fields) {
  const res = await authFetch(`${BASE}/key-dates/${keyDateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update key date');
  return res.json();
}

export async function deleteIssueKeyDate(keyDateId) {
  const res = await authFetch(`${BASE}/key-dates/${keyDateId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete key date');
  return res.json();
}
