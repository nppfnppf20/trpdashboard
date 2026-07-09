// @ts-nocheck
// Actions tracker for instructed surveys — mirrors $lib/api/conditions.js advancements
import { authFetch } from './client.js';

const API_BASE = '/api/admin-console/quote-actions';

export async function getQuoteActions(projectId) {
  const res = await authFetch(`${API_BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch actions');
  return res.json(); // [{ id, quote_id, action_date, summary, full_text, source_type }]
}

export async function createQuoteActions(projectId, { action_date, full_text, source_type, items }) {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_date, full_text, source_type, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save actions');
  }
  return res.json(); // created rows
}

export async function suggestQuoteActionSummaries(projectId, { full_text, items }) {
  const res = await authFetch(`${API_BASE}/projects/${projectId}/actions/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_text, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate summaries');
  }
  return res.json(); // { suggestions: [{ quote_id, summary }] }
}

export async function updateQuoteAction(actionId, fields) {
  const res = await authFetch(`${API_BASE}/actions/${actionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to update action');
  }
  return res.json();
}

export async function deleteQuoteAction(actionId) {
  const res = await authFetch(`${API_BASE}/actions/${actionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete action');
  return res.json();
}
