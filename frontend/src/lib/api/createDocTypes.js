import { authFetch } from '$lib/api/client.js';

const BASE = '/api/admin-console/create-doc-types';

async function failure(res, fallback) {
  const err = await res.json().catch(() => ({}));
  return new Error(err.error || fallback);
}

/** @param {{activeOnly?: boolean}} [opts] */
export async function listCreateDocTypes({ activeOnly = false } = {}) {
  const res = await authFetch(activeOnly ? `${BASE}?active=1` : BASE);
  if (!res.ok) throw await failure(res, 'Failed to fetch document types');
  return res.json();
}

export async function createCreateDocType(data) {
  const res = await authFetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await failure(res, 'Failed to create document type');
  return res.json();
}

export async function updateCreateDocType(id, data) {
  const res = await authFetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await failure(res, 'Failed to update document type');
  return res.json();
}

export async function deleteCreateDocType(id) {
  const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await failure(res, 'Failed to delete document type');
  return res.json();
}
