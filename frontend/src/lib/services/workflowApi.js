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

export async function reorderProjectStages(projectId, orderedInstanceIds) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedInstanceIds })
  });
  if (!res.ok) throw new Error('Failed to reorder project stages');
  return res.json();
}

export async function createCustomStage(projectId, { name }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to create custom stage');
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

export async function saveStageEntry(projectId, stageInstanceId, { issueTrackId, riskLevel, notes }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/${stageInstanceId}/entry`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueTrackId, riskLevel, notes })
  });
  if (!res.ok) throw new Error('Failed to save stage entry');
  return res.json();
}

export async function getCurrentStageEntries(projectId, stageInstanceId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/stages/${stageInstanceId}/entries`);
  if (!res.ok) throw new Error('Failed to fetch current stage entries');
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

export async function createIssueTrack(projectId, { label, discipline, sortOrder }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, discipline, sortOrder })
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

// ─────────────────────────────────────────────────────────────────────────────
// Key Issues
// ─────────────────────────────────────────────────────────────────────────────

export async function createKeyIssue(projectId, { label, disciplineGroup, riskLevel, summary }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/key-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, disciplineGroup, riskLevel, summary })
  });
  if (!res.ok) throw new Error('Failed to create key issue');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Refusal Reasons (appeal projects)
// ─────────────────────────────────────────────────────────────────────────────

export async function getRefusalReasons(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/refusal-reasons`);
  if (!res.ok) throw new Error('Failed to fetch refusal reasons');
  return res.json(); // { reasons: [...] }
}

export async function createRefusalReason(projectId, { title, summary, riskLevel, isKeyIssue }) {
  const res = await authFetch(`${BASE}/projects/${projectId}/refusal-reasons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, summary, riskLevel, isKeyIssue })
  });
  if (!res.ok) throw new Error('Failed to create refusal reason');
  return res.json();
}

export async function updateRefusalReason(projectId, reasonId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/refusal-reasons/${reasonId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update refusal reason');
  return res.json();
}

export async function deleteRefusalReason(projectId, reasonId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/refusal-reasons/${reasonId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete refusal reason');
  return res.json();
}

export async function reorderRefusalReasons(projectId, orderedIds) {
  const res = await authFetch(`${BASE}/projects/${projectId}/refusal-reasons/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds })
  });
  if (!res.ok) throw new Error('Failed to reorder refusal reasons');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Stage Document Analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a document and get LLM-suggested notes per issue track.
 * Does NOT write anything to the DB — caller applies results to form state.
 *
 * @param {number} projectId
 * @param {number} stageInstanceId
 * @param {File} file
 * @param {Record<number, string>} userGuidance  optional per-issue guidance
 * @returns {Promise<{ stage_name: string, parse_warning: string|null, results: Array }>}
 */
/**
 * @param {number} projectId
 * @param {number} stageInstanceId
 * @param {{ file?: File, pastedText?: string }} source  — one of file or pastedText required
 * @param {Record<number, string>} userGuidance
 */
/**
 * Parse a file and return its size/truncation status — no LLM calls.
 * Call this on file select so the user sees any truncation warning upfront.
 *
 * @param {File} file
 * @returns {Promise<{ status: 'ok'|'truncated'|'rejected', total_chunks: number, analysed_chunks: number, warning: string|null }>}
 */
export async function checkDocumentSize(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`${BASE}/check-document-size`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Size check failed');
  return res.json();
}

export async function analyseStageDocument(projectId, stageInstanceId, source, userGuidance = {}) {
  const form = new FormData();
  if (source.file) {
    form.append('file', source.file);
  } else if (source.pastedText) {
    form.append('pasted_text', source.pastedText);
  }
  if (Object.keys(userGuidance).length) {
    form.append('user_guidance', JSON.stringify(userGuidance));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min client timeout
  let res;
  try {
    res = await authFetch(`${BASE}/projects/${projectId}/stages/${stageInstanceId}/analyse`, {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Analysis timed out after 5 minutes. Try a shorter document or paste the key section directly.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Surface the human-readable message for size errors
    throw Object.assign(new Error(err.message || 'Analysis failed'), { code: err.error });
  }
  return res.json();
}
