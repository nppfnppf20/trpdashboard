import { authFetch } from './client.js';

const BASE = '/api/policy-updates';

export async function listPolicyItems() {
  const res = await authFetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch policy items');
  return res.json();
}

export async function uploadPolicyDocument({ file, text, sourceName, userNotes, policyDate }) {
  const formData = new FormData();
  if (userNotes)   formData.append('user_notes',   userNotes);
  if (policyDate)  formData.append('policy_date',  policyDate);
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
    if (sourceName) formData.append('source_name', sourceName);
  }
  const res = await authFetch(`${BASE}/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to process policy document');
  }
  return res.json();
}

export async function updatePolicyDocument(id, fields) {
  const res = await authFetch(`${BASE}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update policy document');
  return res.json();
}

export async function deletePolicyDocument(id) {
  const res = await authFetch(`${BASE}/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy document');
  return res.json();
}

export async function updatePolicyInsight(id, fields) {
  const res = await authFetch(`${BASE}/insights/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update insight');
  return res.json();
}

export async function deletePolicyInsight(id) {
  const res = await authFetch(`${BASE}/insights/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete insight');
  return res.json();
}
