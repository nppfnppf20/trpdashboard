import { authFetch } from '$lib/api/client.js';

export async function listIssueTypes() {
  const res = await authFetch('/api/issue-types');
  if (!res.ok) throw new Error('Failed to fetch issue types');
  return res.json();
}

export async function createIssueType(data) {
  const res = await authFetch('/api/issue-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create issue type');
  }
  return res.json();
}

export async function updateIssueType(id, data) {
  const res = await authFetch(`/api/issue-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update issue type');
  }
  return res.json();
}

export async function deleteIssueType(id) {
  const res = await authFetch(`/api/issue-types/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete issue type');
  return res.json();
}
