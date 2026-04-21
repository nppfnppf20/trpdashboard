/**
 * Appeal API Client
 */

import { authFetch } from './client.js';

export async function getKeyIssues(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/key-issues`);
  if (!res.ok) throw new Error('Failed to fetch key issues');
  return res.json();
}

export async function updateKeyIssueSummary(trackId, summary) {
  const res = await authFetch(`/api/appeal/key-issues/${trackId}/summary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary })
  });
  if (!res.ok) throw new Error('Failed to update summary');
  return res.json();
}

export async function getArgument(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/argument`);
  if (!res.ok) throw new Error('Failed to fetch argument');
  return res.json();
}

export async function saveArgument(projectId, argumentHtml) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/argument`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ argument_html: argumentHtml })
  });
  if (!res.ok) throw new Error('Failed to save argument');
  return res.json();
}

export async function generateArgument(projectId, initialNotes) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initial_notes: initialNotes })
  });
  if (!res.ok) throw new Error('Failed to generate argument');
  return res.json();
}

export async function getDocuments(projectId) {
  const res = await authFetch(`/api/appeal/projects/${projectId}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`/api/appeal/projects/${projectId}/documents`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function updateDocumentStatus(docId, reviewStatus) {
  const res = await authFetch(`/api/appeal/documents/${docId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status: reviewStatus })
  });
  if (!res.ok) throw new Error('Failed to update document status');
  return res.json();
}
