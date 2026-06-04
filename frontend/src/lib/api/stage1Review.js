import { authFetch } from '$lib/api/client.js';

const BASE = '/api/stage1-review';

export async function generateStage1Review(projectId, { briefingNoteId } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_note_id: briefingNoteId ?? null })
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
