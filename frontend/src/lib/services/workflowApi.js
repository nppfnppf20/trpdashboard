/**
 * Workflow API Service
 * Frontend service for the project stages board and notification centre
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/admin-console/workflow';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Centre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ scope?: 'team'|'mine', userName?: string, projectId?: number,
 *           sourceType?: string, dateFrom?: string, dateTo?: string }} params
 */
export async function getNotifications(params = {}) {
  const qs = new URLSearchParams();
  if (params.scope)      qs.set('scope', params.scope);
  if (params.userName)   qs.set('userName', params.userName);
  if (params.projectId)  qs.set('projectId', String(params.projectId));
  if (params.sourceType) qs.set('sourceType', params.sourceType);
  if (params.dateFrom)   qs.set('dateFrom', params.dateFrom);
  if (params.dateTo)     qs.set('dateTo', params.dateTo);

  const res = await authFetch(`${BASE}/notifications?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Stage Board
// ─────────────────────────────────────────────────────────────────────────────

export async function getStageBoard(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages`);
  if (!res.ok) throw new Error('Failed to fetch stage board');
  return res.json();
}

export async function initializeStageBoard(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/initialize`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to initialize stage board');
  return res.json();
}

/**
 * @param {number} projectId
 * @param {number} stageInstanceId
 * @param {{ entries: Array, completedBy?: string }} body
 */
export async function completeStage(projectId, stageInstanceId, body) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/${stageInstanceId}/complete`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to complete stage');
  return res.json();
}

export async function updateStage(projectId, stageInstanceId, updates) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/${stageInstanceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update stage');
  return res.json();
}

export async function reorderStages(orderedIds) {
  const res = await authFetch(`${BASE}/stages/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds })
  });
  if (!res.ok) throw new Error('Failed to reorder stages');
  return res.json();
}

export async function toggleStageApplicability(projectId, stageInstanceId) {
  const res = await authFetch(
    `${BASE}/projects/${projectId}/stages/${stageInstanceId}/applicability`,
    { method: 'PUT' }
  );
  if (!res.ok) throw new Error('Failed to toggle stage applicability');
  return res.json();
}

export async function getPriorStageEntries(projectId, stageInstanceId) {
  const res = await authFetch(
    `${BASE}/projects/${projectId}/stages/${stageInstanceId}/prior-entries`
  );
  if (!res.ok) throw new Error('Failed to fetch prior stage entries');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Tracks
// ─────────────────────────────────────────────────────────────────────────────

export async function reorderIssueTracks(projectId, orderedIds) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issues/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds })
  });
  if (!res.ok) throw new Error('Failed to reorder issue tracks');
  return res.json();
}

export async function createIssueTrack(projectId, { label, sortOrder }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, sortOrder })
  });
  if (!res.ok) throw new Error('Failed to create issue track');
  return res.json();
}

export async function updateIssueTrack(issueTrackId, updates) {
  const res = await authFetch(`${BASE}/issues/${issueTrackId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update issue track');
  return res.json();
}
