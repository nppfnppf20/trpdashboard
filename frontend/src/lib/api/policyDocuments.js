import { authFetch } from '$lib/api/client.js';

const BASE = '/api/lpa';

export async function getPolicyDocuments(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policy-documents`);
  if (!res.ok) throw new Error('Failed to fetch policy documents');
  return res.json();
}

export async function createPolicyDocument(projectId, data) {
  const res = await authFetch(`${BASE}/projects/${projectId}/policy-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create policy document');
  }
  return res.json();
}

export async function updatePolicyDocument(id, data) {
  const res = await authFetch(`${BASE}/policy-documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update policy document');
  return res.json();
}

export async function deletePolicyDocument(id) {
  const res = await authFetch(`${BASE}/policy-documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy document');
}
