/**
 * Cross-Project Chat API Client
 * Standalone from projectChat.js — talks to /api/cross-project-chat, a
 * separate backend feature that answers questions grounded across multiple
 * projects at once (see crossProjectChat.service.js for how it qualifies
 * source IDs per project to avoid collisions).
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/cross-project-chat';

/**
 * @param {number[]} projectIds
 * @returns {Promise<{ projects: Array<{ id: number, groups: any[], budget: number }> }>}
 */
export async function getCrossProjectSources(projectIds) {
  const response = await authFetch(`${API_BASE_URL}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_ids: projectIds }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load chat sources');
  }
  return response.json();
}

/**
 * @param {number[]} projectIds
 * @param {{ sources: Record<string, object>, messages: Array<{role: string, content: string}> }} payload
 */
export async function sendCrossProjectChat(projectIds, { sources, messages, emailToneId }) {
  const response = await authFetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_ids: projectIds, sources, messages, emailToneId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to send message');
  }
  return response.json();
}
