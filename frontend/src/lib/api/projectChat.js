import { authFetch } from './client.js';

export async function getChatSources(projectId) {
  const res = await authFetch(`/api/project-chat/${projectId}/sources`);
  if (!res.ok) throw new Error('Failed to load chat sources');
  return res.json(); // { groups: [...], budget }
}

export async function sendProjectChat(projectId, { messages, sources }) {
  const res = await authFetch(`/api/project-chat/${projectId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, sources })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Chat request failed');
  }
  return res.json(); // { reply, citations, sources_used, context_chars }
}
