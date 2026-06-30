import { authFetch } from '$lib/api/client.js';

const BASE = '/api/marketing';

export async function getMarketingDraftTypes() {
  const res = await authFetch(`${BASE}/draft-types`);
  if (!res.ok) throw new Error('Failed to fetch marketing draft types');
  return res.json();
}

export async function getMarketingDraft(typeId) {
  const res = await authFetch(`${BASE}/drafts/${typeId}`);
  if (!res.ok) throw new Error('Failed to fetch draft');
  return res.json();
}

export async function saveMarketingDraft(typeId, contentHtml) {
  const res = await authFetch(`${BASE}/drafts/${typeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_html: contentHtml })
  });
  if (!res.ok) throw new Error('Failed to save draft');
  return res.json();
}

export async function generateMarketingDraft(typeId, { selectedTopicKeys = [], userAngle = null } = {}) {
  const res = await authFetch(`${BASE}/drafts/${typeId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selected_topic_keys: selectedTopicKeys, user_angle: userAngle })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to generate draft');
  }
  return res.json();
}
