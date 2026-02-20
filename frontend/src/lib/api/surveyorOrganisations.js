/**
 * Surveyor Organisations API Client
 * Frontend API methods for surveyor management
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/admin-console';

/**
 * Get all surveyor organisations with ratings
 */
export async function getAllSurveyorOrganisations() {
  const response = await authFetch(`${API_BASE_URL}/surveyor-organisations`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch surveyor organisations: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Get single surveyor organisation by ID
 */
export async function getSurveyorOrganisationById(id) {
  const response = await authFetch(`${API_BASE_URL}/surveyor-organisations/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch surveyor organisation');
  }

  return await response.json();
}
