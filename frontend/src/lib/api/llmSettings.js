/**
 * LLM Provider Settings API Client
 * Central admin console page for toggling which AI provider each process uses.
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/admin-console/llm-settings';

export async function getLlmSettings() {
  const response = await authFetch(API_BASE_URL);
  if (!response.ok) throw new Error('Failed to fetch LLM settings');
  return await response.json();
}

export async function updateLlmSetting(key, provider) {
  const response = await authFetch(`${API_BASE_URL}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to update LLM setting');
  }
  return await response.json();
}
