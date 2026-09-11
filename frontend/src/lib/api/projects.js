/**
 * Projects API Client
 * Frontend API methods for project information management
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/projects';

/**
 * List all projects
 * @returns {Promise<Array<Object>>} All projects, unfiltered
 */
export async function getProjects() {
  const response = await authFetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  return await response.json();
}

/**
 * Get a single project by id
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object>} Project
 */
export async function getProject(projectId) {
  const response = await authFetch(`${API_BASE_URL}/${projectId}`);

  if (!response.ok) {
    throw new Error('Failed to load project');
  }

  return await response.json();
}

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

/**
 * Mark one of the project's fixed milestone date fields (Submission,
 * Validation, Committee, etc.) resolved or unresolved.
 * @param {string} projectId - Project UUID
 * @param {string} field - Field key, e.g. 'submission_date'
 * @param {boolean} isResolved
 * @returns {Promise<Object>} { id, [field]_resolved }
 */
export async function updateProjectMilestoneResolved(projectId, field, isResolved) {
  const response = await authFetch(`${API_BASE_URL}/${projectId}/milestone-resolved`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, is_resolved: isResolved })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update milestone date');
  }

  return await response.json();
}
