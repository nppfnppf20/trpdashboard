/**
 * LPA Analysis API
 * Relevant policies CRUD + LPA decision document upload/analysis + synthesis.
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/lpa';

// ─────────────────────────────────────────────────────────────────────────────
// Relevant Policies
// ─────────────────────────────────────────────────────────────────────────────

export async function getPolicies(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policies`);
  if (!res.ok) throw new Error('Failed to fetch policies');
  return res.json();
}

export async function createPolicy(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create policy');
  }
  return res.json();
}

export async function updatePolicy(policyId, data) {
  const res = await authFetch(`${BASE}/policies/${policyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update policy');
  return res.json();
}

export async function deletePolicy(policyId) {
  const res = await authFetch(`${BASE}/policies/${policyId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// LPA Decision Documents
// ─────────────────────────────────────────────────────────────────────────────

export async function getLpaDocuments(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/lpa-documents`);
  if (!res.ok) throw new Error('Failed to fetch LPA documents');
  return res.json();
}

export async function uploadLpaDocument(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`${BASE}/projects/${projectId}/lpa-documents`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function deleteLpaDocument(projectId, docId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/lpa-documents/${docId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis / Synthesis
// ─────────────────────────────────────────────────────────────────────────────

export async function getLpaAnalysis(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/lpa-analysis`);
  if (!res.ok) throw new Error('Failed to fetch analysis');
  return res.json();
}

export async function triggerSynthesis(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/lpa-analysis/synthesise`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Synthesis failed');
  return res.json();
}
