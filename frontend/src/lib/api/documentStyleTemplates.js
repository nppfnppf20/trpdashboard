import { authFetch } from '$lib/api/client.js';

const BASE = '/api/admin-console/style-templates';

export async function listDocumentStyleTemplates() {
  const res = await authFetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch style templates');
  return res.json();
}

export async function createDocumentStyleTemplate(data) {
  const res = await authFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create style template');
  }
  return res.json();
}

export async function updateDocumentStyleTemplate(id, data) {
  const res = await authFetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update style template');
  }
  return res.json();
}

export async function deleteDocumentStyleTemplate(id) {
  const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete style template');
  return res.json();
}
