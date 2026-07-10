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

/**
 * Create a new surveyor organisation
 */
export async function createSurveyorOrganisation(data) {
  const response = await authFetch(`${API_BASE_URL}/surveyor-organisations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error || 'Failed to create surveyor organisation';
    throw new Error(err.details ? `${message}: ${err.details}` : message);
  }

  return await response.json();
}

/**
 * Update a surveyor organisation
 */
export async function updateSurveyorOrganisation(id, data) {
  const response = await authFetch(`${API_BASE_URL}/surveyor-organisations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error || 'Failed to update surveyor organisation';
    throw new Error(err.details ? `${message}: ${err.details}` : message);
  }

  return await response.json();
}

/**
 * Delete a surveyor organisation
 */
export async function deleteSurveyorOrganisation(id) {
  const response = await authFetch(`${API_BASE_URL}/surveyor-organisations/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error || 'Failed to delete surveyor organisation';
    throw new Error(err.details ? `${message}: ${err.details}` : message);
  }

  return await response.json();
}
