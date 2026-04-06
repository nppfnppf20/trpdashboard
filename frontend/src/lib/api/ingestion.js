/**
 * Ingestion API
 * All fetch calls for the issue_tracker feature.
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/ingestion';

// ─────────────────────────────────────────────────────────────────────────────
// Topics
// ─────────────────────────────────────────────────────────────────────────────

export async function getTopics(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

export async function createTopic(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create topic');
  return res.json();
}

export async function updateTopic(topicId, data) {
  const res = await authFetch(`${BASE}/topics/${topicId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update topic');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocuments(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

/**
 * Upload a file for ingestion.
 * Uses FormData so we can send the file binary alongside metadata.
 *
 * @param {number} projectId
 * @param {File} file
 * @param {{ stage_label?: string, stage_instance_id?: number }} meta
 */
export async function uploadDocument(projectId, file, meta = {}) {
  const form = new FormData();
  form.append('file', file);
  if (meta.stage_label)      form.append('stage_label', meta.stage_label);
  if (meta.stage_instance_id) form.append('stage_instance_id', String(meta.stage_instance_id));

  const res = await authFetch(`${BASE}/projects/${projectId}/documents`, {
    method: 'POST',
    body: form
    // No Content-Type header — browser sets it with boundary automatically for FormData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Review / Confirm
// ─────────────────────────────────────────────────────────────────────────────

export async function getDraft(documentId) {
  const res = await authFetch(`${BASE}/documents/${documentId}/draft`);
  if (!res.ok) throw new Error('Failed to fetch draft');
  return res.json();
}

export async function confirmDocument(documentId, payload) {
  const res = await authFetch(`${BASE}/documents/${documentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to confirm document');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill
// ─────────────────────────────────────────────────────────────────────────────

export async function getBackfillPreview(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/backfill-preview`);
  if (!res.ok) throw new Error('Failed to fetch backfill preview');
  return res.json();
}

/**
 * @param {number} projectId
 * @param {{ document_id: number, suggested_topic_index: number, run_backfill: boolean }} payload
 */
export async function acceptSuggestedTopic(projectId, payload) {
  const res = await authFetch(`${BASE}/projects/${projectId}/topics/accept-suggested`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to accept suggested topic');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

export async function getTimeline(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/timeline`);
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}
