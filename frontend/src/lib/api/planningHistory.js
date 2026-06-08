import { authFetch } from '$lib/api/client.js';

const BASE = '/api/lpa';

export async function getPlanningHistory(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/planning-history`);
  if (!res.ok) throw new Error('Failed to fetch planning history');
  return res.json();
}

export async function createPlanningHistoryEntry(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/planning-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create entry');
  }
  return res.json();
}

export async function updatePlanningHistoryEntry(id, data) {
  const res = await authFetch(`${BASE}/planning-history/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function deletePlanningHistoryEntry(id) {
  const res = await authFetch(`${BASE}/planning-history/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete entry');
}
