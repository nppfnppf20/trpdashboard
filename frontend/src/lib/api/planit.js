/**
 * PlanIt API
 * Similar schemes search and LLM keyword suggestions.
 */

import { authFetch } from '$lib/api/client.js';

const BASE = '/api/planit';

/**
 * Ask the LLM to generate PlanIt search suggestions based on the project's
 * sector, HLPV findings, and designations.
 *
 * @param {number} projectId
 * @returns {Promise<{ suggestions: Array<{ label: string, query: string }>, lpa: string }>}
 */
export async function suggestKeywords(projectId) {
  const res = await authFetch(`${BASE}/projects/${projectId}/suggest-keywords`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate suggestions');
  }
  return res.json();
}

/**
 * Search PlanIt for planning applications matching keywords within an LPA.
 *
 * @param {number} projectId
 * @param {{ keywords: string, lpa: string, page?: number, pg_sz?: number }} params
 * @returns {Promise<{ records: Array, total: number, from: number, to: number, lpa_used: string }>}
 */
export async function searchSimilarSchemes(projectId, { keywords, lpa, page = 1, pg_sz = 20 }) {
  const qs = new URLSearchParams({ keywords, lpa, page: String(page), pg_sz: String(pg_sz) });
  const res = await authFetch(`${BASE}/projects/${projectId}/search?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Search failed');
  }
  return res.json();
}
