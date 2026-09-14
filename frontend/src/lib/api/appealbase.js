/**
 * Appealbase API Client
 * Planning appeal precedent search (proxied through our backend)
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/appealbase';

export async function searchAppeals(params) {
  const response = await authFetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new Error(e.error || 'Search failed');
  }
  return await response.json();
}

export async function retrieveAppeal(reference) {
  const response = await authFetch(`${API_BASE_URL}/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference })
  });
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to retrieve decision');
  }
  return await response.json();
}
