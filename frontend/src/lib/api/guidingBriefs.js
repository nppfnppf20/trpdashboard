import { authFetch } from '$lib/api/client.js';

export async function listDocumentTypes() {
  const res = await authFetch('/api/guiding-briefs/doc-types');
  if (!res.ok) throw new Error('Failed to fetch document types');
  return res.json();
}

export async function listGuidingBriefs() {
  const res = await authFetch('/api/guiding-briefs');
  if (!res.ok) throw new Error('Failed to fetch guiding briefs');
  return res.json();
}

export async function createGuidingBrief(data) {
  const res = await authFetch('/api/guiding-briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create guiding brief');
  }
  return res.json();
}

export async function updateGuidingBrief(id, data) {
  const res = await authFetch(`/api/guiding-briefs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update guiding brief');
  }
  return res.json();
}

export async function deleteGuidingBrief(id) {
  const res = await authFetch(`/api/guiding-briefs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete guiding brief');
  return res.json();
}

export async function reviewDraftAgainstBrief({ draft_html, document_type, development_type }) {
  const res = await authFetch('/api/guiding-briefs/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_html, document_type, development_type })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to review draft');
  }
  return res.json();
}
