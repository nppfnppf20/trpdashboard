/**
 * Projects API Client
 * Frontend API methods for project information management
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/projects';

/**
 * Get project information
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object|null>} Project information or null if not found
 */
export async function getProjectInformation(projectId) {
  const response = await authFetch(`${API_BASE_URL}/${projectId}/information`);

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No project information exists yet
    }
    throw new Error('Failed to fetch project information');
  }

  return await response.json();
}

/**
 * Update project information
 * @param {string} projectId - Project UUID
 * @param {Object} data - Project information fields
 * @returns {Promise<Object>} Updated project information
 */
export async function updateProjectInformation(projectId, data) {
  const response = await authFetch(`${API_BASE_URL}/${projectId}/information`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to update project information');
  }

  const result = await response.json();
  return result.data;
}
