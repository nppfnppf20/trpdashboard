/**
 * AI Provider Status API Client
 * Backs the app-wide warning banner shown when Claude or OpenAI is out of credit/quota.
 */

import { authFetch } from './client.js';

export async function getLlmStatus() {
  const response = await authFetch('/api/llm-status');
  if (!response.ok) throw new Error('Failed to fetch LLM provider status');
  return await response.json();
}
