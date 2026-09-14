import { authFetch } from './client.js';

const API_BASE_URL = '/api/draft-comments';

export async function getDraftComments(projectId, draftKind, draftTypeId) {
  const params = new URLSearchParams({ projectId, draftKind, draftTypeId });
  const res = await authFetch(`${API_BASE_URL}?${params}`);
  if (!res.ok) throw new Error('Failed to load comments');
  return res.json();
}

export async function createDraftComment({ projectId, draftKind, draftTypeId, paragraphId, quotedText, body }) {
  const res = await authFetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, draftKind, draftTypeId, paragraphId, quotedText, body }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to create comment');
  }
  return res.json();
}

export async function updateDraftComment(id, { body, resolved }) {
  const res = await authFetch(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, resolved }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to update comment');
  }
  return res.json();
}

export async function deleteDraftComment(id) {
  const res = await authFetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to delete comment');
  }
}
