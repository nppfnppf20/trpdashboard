/**
 * Client Organisations API Client
 * Frontend API methods for client management
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/admin-console';

/**
 * Get all client organisations
 */
export async function getAllClientOrganisations() {
  const response = await authFetch(`${API_BASE_URL}/client-organisations`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch client organisations: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Get single client organisation by ID
 */
export async function getClientOrganisationById(id) {
  const response = await authFetch(`${API_BASE_URL}/client-organisations/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch client organisation');
  }

  return await response.json();
}

/**
 * Create a new client organisation
 */
export async function createClientOrganisation(data) {
  const response = await authFetch(`${API_BASE_URL}/client-organisations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create client organisation');
  }

  return await response.json();
}

/**
 * Update a client organisation
 */
export async function updateClientOrganisation(id, data) {
  const response = await authFetch(`${API_BASE_URL}/client-organisations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update client organisation');
  }

  return await response.json();
}

/**
 * Delete a client organisation
 */
export async function deleteClientOrganisation(id) {
  const response = await authFetch(`${API_BASE_URL}/client-organisations/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete client organisation');
  }

  return await response.json();
}

/**
 * Get contacts count for a client organisation (for delete confirmation)
 */
export async function getClientContactsCount(id) {
  const response = await authFetch(`${API_BASE_URL}/client-organisations/${id}/contacts-count`);

  if (!response.ok) {
    throw new Error('Failed to get contacts count');
  }

  return await response.json();
}
