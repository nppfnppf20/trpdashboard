import { authFetch } from '$lib/api/client.js';

const BASE = '/api/stage1-review';

export async function generateStage1Review(projectId, { briefingNoteId, draftTypeSlug } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_note_id: briefingNoteId ?? null, draft_type_slug: draftTypeSlug ?? null })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate Stage 1 Review');
  }
  return res.json();
}

export async function getStage1Context(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/context`);
  if (!res.ok) throw new Error('Failed to fetch Stage 1 context');
  return res.json(); // { guidingBrief, projectBrief, toneExampleLoaded }
}

export async function getStage1StartingDocs(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/starting-docs`);
  if (!res.ok) throw new Error('Failed to fetch Stage 1 starting docs');
  return res.json();
}

export async function upsertStage1StartingDocText(projectId, slotSlug, contentText) {
  const res = await authFetch(`${BASE}/projects/${projectId}/starting-docs/${slotSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_text: contentText }),
  });
  if (!res.ok) throw new Error('Failed to save starting doc');
  return res.json();
}

export async function upsertStage1StartingDocFile(projectId, slotSlug, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`${BASE}/projects/${projectId}/starting-docs/${slotSlug}`, {
    method: 'PUT',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload starting doc');
  return res.json();
}

export async function deleteStage1StartingDoc(projectId, slotSlug) {
  const res = await authFetch(`${BASE}/projects/${projectId}/starting-docs/${slotSlug}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete starting doc');
  return res.json();
}
