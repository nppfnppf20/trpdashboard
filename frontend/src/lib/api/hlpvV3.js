import { authFetch } from '$lib/api/client.js';

const BASE = '/api/hlpv-v3';

export async function generateHlpvV3(projectId, { briefingNoteId, provider } = {}) {
  const res = await authFetch(`${BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ briefing_note_id: briefingNoteId ?? null, provider: provider ?? null })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate High-Level Planning View');
  }
  return res.json();
}
