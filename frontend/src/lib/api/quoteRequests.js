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
 * Analyse project briefing note(s)/meeting note(s) and suggest disciplines + 4★+ surveyors.
 * @param {string} projectId - Project UUID
 * @param {Object} params - { sources, developmentType }
 * @param {Array<{type: 'briefing_note'|'meeting_note', id: number, full?: boolean}>} params.sources - Selected sources (empty = latest briefing note)
 * @returns {Promise<{suggestions: Array}>} suggestions: [{ discipline, reasoning, template, surveyors }]
 */
export async function analyseDisciplines(projectId, { sources = [], developmentType = null } = {}) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/analyse-disciplines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, development_type: developmentType })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to analyse disciplines');
  }
  return response.json();
}

/**
 * Suggest scope-section edits to a briefing email from the selected source(s).
 * @param {string} projectId - Project UUID
 * @param {Object} params - { sources, discipline, templateContent }
 * @returns {Promise<{hasChanges: boolean, reasoning: string, suggestedContent: string|null}>}
 */
export async function suggestEmailEditsForDiscipline(projectId, { sources = [], discipline, templateContent }) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/suggest-email-edits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, discipline, template_content: templateContent })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to suggest email edits');
  }
  return response.json();
}

/**
 * List briefing notes and meeting notes available as draft sources, with
 * character counts for the context-budget meter.
 * @param {string} projectId - Project UUID
 * @returns {Promise<{briefingNotes: Array, meetingNotes: Array, budget: number}>}
 */
export async function getBriefingSources(projectId) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/briefing-sources`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to fetch briefing sources');
  }
  return response.json();
}

/**
 * Send briefing emails via Resend and record as sent.
 * @param {string} projectId - Project UUID
 * @param {Object} data - { templateId, emailContent, subject, recipients: [{surveyorId, contactId, contactEmail, contactName, surveyorOrganisation}], notes }
 * @returns {Promise<{sentRequest, results, sent, failed}>}
 */
export async function sendBriefingEmails(projectId, data) {
  const response = await authFetch(`${API_BASE}/projects/${projectId}/send-briefings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || 'Failed to send briefing emails');
  }
  return response.json();
}

/**
 * Update a template
 * @param {number} templateId - Template ID
 * @param {Object} updates - { templateName, description, subjectLine, templateContent }
 * @returns {Promise<Object>} Updated template object
 */
export async function getSurveyorsForDiscipline(discipline) {
  const response = await authFetch(`${API_BASE}/surveyors?discipline=${encodeURIComponent(discipline)}`);
  if (!response.ok) throw new Error('Failed to fetch surveyors');
  return response.json();
}

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
