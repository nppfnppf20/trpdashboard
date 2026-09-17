import { authFetch } from '$lib/api/client.js';

export async function generateCustomDraft({ prompt, provider, use_house_style }) {
  const res = await authFetch('/api/draft-create/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, provider, use_house_style })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate document');
  }
  return res.json();
}
