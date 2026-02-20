/**
 * Lookups API Client
 * Frontend API methods for fetching dropdown options
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/lookups';

/**
 * Get all options for a lookup type
 * @param {string} lookupType - The type of lookup (e.g., 'client_organisations')
 * @returns {Promise<Array>} Array of { id, label } objects
 */
export async function getLookupOptions(lookupType) {
  const response = await authFetch(`${API_BASE_URL}/${lookupType}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch lookup options');
  }

  const result = await response.json();
  return result.options;
}

/**
 * Get available lookup types
 * @returns {Promise<Array<string>>} List of available lookup type keys
 */
export async function getAvailableLookupTypes() {
  const response = await authFetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error('Failed to fetch lookup types');
  }

  const result = await response.json();
  return result.types;
}
