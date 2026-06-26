import { authFetch } from './client.js';

export async function processConsultationDoc(projectId, { file, text, fileName }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (fileName) formData.append('file_name', fileName);
  }
  const res = await authFetch(`/api/consultation/projects/${projectId}/process`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process consultation document');
  }
  return res.json(); // { suggestion: { consultee_name, date_received, position, comments }, source_file_name }
}

export async function getConsultationData(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch consultation data');
  return res.json(); // { responses: [...], meta: { last_exported_at, last_issued_to_client_at } }
}

export async function createConsultationResponse(projectId, fields) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create consultation response');
  }
  return res.json();
}

export async function updateConsultationResponse(responseId, fields) {
  const res = await authFetch(`/api/consultation/responses/${responseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update consultation response');
  return res.json();
}

export async function deleteConsultationResponse(responseId) {
  const res = await authFetch(`/api/consultation/responses/${responseId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete consultation response');
  return res.json();
}

export async function markConsultationExported(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to record export');
  return res.json(); // { last_exported_at, last_issued_to_client_at }
}

export async function markConsultationIssuedToClient(projectId) {
  const res = await authFetch(`/api/consultation/projects/${projectId}/issue-to-client`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to record issue to client');
  return res.json(); // { last_exported_at, last_issued_to_client_at }
}
