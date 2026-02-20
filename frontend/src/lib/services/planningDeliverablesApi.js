/**
 * Planning Deliverables API Service
 * Frontend service for interacting with planning deliverables backend
 */

import { authFetch } from '$lib/api/client.js';

/**
 * Get all available templates
 * @returns {Promise<Array>} Array of template objects
 */
export async function getTemplates() {
  try {
    const response = await authFetch('/api/planning/templates');
    
    if (!response.ok) {
      throw new Error('Failed to fetch templates');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
}

/**
 * Get a specific template by ID
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Template object
 */
export async function getTemplate(id) {
  try {
    const response = await authFetch(`/api/planning/templates/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
}

/**
 * Update a template
 * @param {number} id - Template ID
 * @param {Object} updates - Object containing fields to update (templateName, description, templateContent)
 * @returns {Promise<Object>} Updated template
 */
export async function updateTemplate(id, updates) {
  try {
    const response = await authFetch(`/api/planning/templates/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update template');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
}

/**
 * Create a new deliverable from a template
 * @param {number} projectId - Project ID
 * @param {number} templateId - Template ID
 * @param {string} deliverableName - Optional custom name
 * @returns {Promise<Object>} Created deliverable
 */
export async function createDeliverable(projectId, templateId, deliverableName = null) {
  try {
    const response = await authFetch('/api/planning/deliverables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId,
        templateId,
        deliverableName
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create deliverable');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating deliverable:', error);
    throw error;
  }
}

/**
 * Get all deliverables for a specific project
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Array of deliverable objects
 */
export async function getProjectDeliverables(projectId) {
  try {
    const response = await authFetch(`/api/planning/deliverables/project/${projectId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project deliverables');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching project deliverables:', error);
    throw error;
  }
}

/**
 * Get a specific deliverable by ID
 * @param {number} id - Deliverable ID
 * @returns {Promise<Object>} Deliverable object
 */
export async function getDeliverable(id) {
  try {
    const response = await authFetch(`/api/planning/deliverables/${id}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch deliverable');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching deliverable:', error);
    throw error;
  }
}

/**
 * Update a deliverable
 * @param {number} id - Deliverable ID
 * @param {Object} updates - Object containing fields to update (content, deliverableName, status)
 * @returns {Promise<Object>} Updated deliverable
 */
export async function updateDeliverable(id, updates) {
  try {
    const response = await authFetch(`/api/planning/deliverables/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update deliverable');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating deliverable:', error);
    throw error;
  }
}

/**
 * Delete a deliverable
 * @param {number} id - Deliverable ID
 * @returns {Promise<Object>} Success response
 */
export async function deleteDeliverable(id) {
  try {
    const response = await authFetch(`/api/planning/deliverables/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete deliverable');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting deliverable:', error);
    throw error;
  }
}

/**
 * Get deliverable content as HTML (for rich text editor)
 * @param {number} id - Deliverable ID
 * @returns {Promise<Object>} Object with html property
 */
export async function getDeliverableAsHTML(id) {
  try {
    const response = await authFetch(`/api/planning/deliverables/${id}/html`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch deliverable HTML');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching deliverable HTML:', error);
    throw error;
  }
}

/**
 * Update deliverable from HTML (from rich text editor)
 * @param {number} id - Deliverable ID
 * @param {string} html - HTML content
 * @returns {Promise<Object>} Updated deliverable
 */
export async function updateDeliverableFromHTML(id, html) {
  try {
    const response = await authFetch(`/api/planning/deliverables/${id}/html`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ html })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update deliverable from HTML');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating deliverable from HTML:', error);
    throw error;
  }
}

/**
 * Export deliverable to PDF or Word (placeholder for future implementation)
 * @param {number} id - Deliverable ID
 * @param {string} format - 'pdf' or 'docx'
 * @returns {Promise<Blob>} Document blob
 */
export async function exportDeliverable(id, format = 'pdf') {
  // This will be implemented in phase 2 with document export
  console.warn('Export functionality not yet implemented');
  throw new Error('Export functionality coming soon');
}

export default {
  getTemplates,
  getTemplate,
  updateTemplate,
  createDeliverable,
  getProjectDeliverables,
  getDeliverable,
  updateDeliverable,
  deleteDeliverable,
  getDeliverableAsHTML,
  updateDeliverableFromHTML,
  exportDeliverable
};

