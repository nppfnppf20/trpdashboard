// @ts-nocheck
import { authFetch } from './client.js';

export async function getConditionsData(projectId) {
  const res = await authFetch(`/api/conditions/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch conditions data');
  return res.json(); // { conditions: [{ ..., requirements: [...] }], meta: { last_exported_at, last_issued_to_client_at } }
}

export async function createCondition(projectId, fields) {
  const res = await authFetch(`/api/conditions/projects/${projectId}/conditions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create condition');
  }
  return res.json();
}

export async function updateCondition(conditionId, fields) {
  const res = await authFetch(`/api/conditions/conditions/${conditionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update condition');
  return res.json();
}

export async function deleteCondition(conditionId) {
  const res = await authFetch(`/api/conditions/conditions/${conditionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete condition');
  return res.json();
}

export async function createConditionRequirement(conditionId, fields) {
  const res = await authFetch(`/api/conditions/conditions/${conditionId}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create requirement');
  }
  return res.json();
}

export async function updateConditionRequirement(requirementId, fields) {
  const res = await authFetch(`/api/conditions/requirements/${requirementId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update requirement');
  return res.json();
}

export async function deleteConditionRequirement(requirementId) {
  const res = await authFetch(`/api/conditions/requirements/${requirementId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete requirement');
  return res.json();
}

export async function createConditionAdvancements(projectId, { advancement_date, full_text, source_type, items }) {
  const res = await authFetch(`/api/conditions/projects/${projectId}/advancements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advancement_date, full_text, source_type, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to save advancement');
  }
  return res.json(); // [advancement rows]
}

export async function suggestConditionAdvancementSummaries(projectId, { full_text, items }) {
  const res = await authFetch(`/api/conditions/projects/${projectId}/advancements/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_text, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate summaries');
  }
  return res.json(); // { suggestions: [{ condition_id, summary }] }
}

export async function updateConditionAdvancement(advancementId, fields) {
  const res = await authFetch(`/api/conditions/advancements/${advancementId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update advancement');
  return res.json();
}

export async function deleteConditionAdvancement(advancementId) {
  const res = await authFetch(`/api/conditions/advancements/${advancementId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete advancement');
  return res.json();
}

export async function markConditionsExported(projectId) {
  const res = await authFetch(`/api/conditions/projects/${projectId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to record export');
  return res.json(); // { last_exported_at, last_issued_to_client_at }
}

export async function markConditionsIssuedToClient(projectId) {
  const res = await authFetch(`/api/conditions/projects/${projectId}/issue-to-client`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to record issue to client');
  return res.json(); // { last_exported_at, last_issued_to_client_at }
}
