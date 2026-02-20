/**
 * Quote Requests API Client
 * Frontend API methods for quote request management
 */

import { authFetch } from './client.js';

const API_BASE = '/api/admin-console/quote-requests';

/**
 * Get all quote request templates
 * @param {string} discipline - Optional discipline filter
 * @returns {Promise<Array>} Array of template objects
 */
export async function getTemplates(discipline = null) {
  const url = discipline
    ? `${API_BASE}/templates?discipline=${encodeURIComponent(discipline)}`
    : `${API_BASE}/templates`;

  const response = await authFetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to fetch templates');
  }
  return response.json();
}

/**
 * Get a specific template by ID
 * @param {number} templateId - Template ID
 * @returns {Promise<Object>} Template object
 */
export async function getTemplateById(templateId) {
  const response = await authFetch(`${API_BASE}/templates/${templateId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to fetch template');
  }
  return response.json();
}

/**
 * Get all sent quote requests for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Array of sent request objects with recipients
 */
export async function getSentRequestsForProject(projectId) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/sent-requests`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to fetch sent requests');
  }
  return response.json();
}

/**
 * Get a specific sent request by ID
 * @param {number} requestId - Sent request ID
 * @returns {Promise<Object>} Sent request object with recipients
 */
export async function getSentRequestById(requestId) {
  const response = await authFetch(`${API_BASE}/sent-requests/${requestId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to fetch sent request');
  }
  return response.json();
}

/**
 * Save a sent quote request with recipients
 * @param {string} projectId - Project UUID
 * @param {Object} data - { templateId, emailContent, recipients: [{surveyorId, contactId}], notes }
 * @returns {Promise<Object>} Created sent request object
 */
export async function saveSentRequest(projectId, data) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/sent-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to save sent request');
  }
  return response.json();
}

/**
 * Merge template with project and surveyor data
 * @param {number} templateId - Template ID
 * @param {string} projectId - Project UUID
 * @param {Array<number>} surveyorIds - Array of surveyor organisation IDs
 * @returns {Promise<Object>} { content: mergedHTML, subjectLine: mergedSubject, templateName }
 */
export async function mergeTemplate(templateId, projectId, surveyorIds = []) {
  const response = await authFetch(`${API_BASE}/templates/${templateId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, surveyorIds })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to merge template');
  }
  return response.json();
}

/**
 * Delete a sent request
 * @param {number} requestId - Sent request ID
 * @returns {Promise<Object>} Success response
 */
export async function deleteSentRequest(requestId) {
  const response = await authFetch(`${API_BASE}/sent-requests/${requestId}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to delete sent request');
  }
  return response.json();
}

/**
 * Update a template
 * @param {number} templateId - Template ID
 * @param {Object} updates - { templateName, description, subjectLine, templateContent }
 * @returns {Promise<Object>} Updated template object
 */
export async function updateTemplate(templateId, updates) {
  const response = await authFetch(`${API_BASE}/templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to update template');
  }
  return response.json();
}
