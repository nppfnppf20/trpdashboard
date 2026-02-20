import * as quoteRequestsService from '../services/quoteRequests.service.js';

/**
 * GET /api/admin-console/quote-request-templates
 * Get all templates, optionally filter by discipline
 */
export async function getTemplates(req, res) {
  try {
    const { discipline, is_active } = req.query;

    const filters = {};
    if (discipline) filters.discipline = discipline;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const templates = await quoteRequestsService.getTemplates(filters);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      details: error.message
    });
  }
}

/**
 * GET /api/admin-console/quote-request-templates/:id
 * Get a specific template by ID
 */
export async function getTemplateById(req, res) {
  try {
    const { id } = req.params;
    const template = await quoteRequestsService.getTemplateById(parseInt(id));

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      details: error.message
    });
  }
}

/**
 * GET /api/admin-console/projects/:projectId/sent-quote-requests
 * Get all sent requests for a project
 */
export async function getSentRequestsForProject(req, res) {
  try {
    const { projectId } = req.params;
    const sentRequests = await quoteRequestsService.getSentRequestsForProject(projectId);
    res.json(sentRequests);
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({
      error: 'Failed to fetch sent requests',
      details: error.message
    });
  }
}

/**
 * GET /api/admin-console/sent-quote-requests/:id
 * Get a specific sent request by ID
 */
export async function getSentRequestById(req, res) {
  try {
    const { id } = req.params;
    const sentRequest = await quoteRequestsService.getSentRequestById(parseInt(id));

    if (!sentRequest) {
      return res.status(404).json({ error: 'Sent request not found' });
    }

    res.json(sentRequest);
  } catch (error) {
    console.error('Error fetching sent request:', error);
    res.status(500).json({
      error: 'Failed to fetch sent request',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/projects/:projectId/sent-quote-requests
 * Create a new sent request with recipients
 */
export async function createSentRequest(req, res) {
  try {
    const { projectId } = req.params;
    const { templateId, emailContent, recipients, notes } = req.body;

    // Validation
    if (!emailContent) {
      return res.status(400).json({ error: 'Email content is required' });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    const data = {
      projectId,
      templateId: templateId || null,
      emailContent,
      recipients,
      notes: notes || null
    };

    const sentRequest = await quoteRequestsService.createSentRequest(data);
    res.status(201).json(sentRequest);
  } catch (error) {
    console.error('Error creating sent request:', error);
    res.status(500).json({
      error: 'Failed to create sent request',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/quote-request-templates/:id/merge
 * Merge template with project and surveyor data
 */
export async function mergeTemplate(req, res) {
  try {
    const { id } = req.params;
    const { projectId, surveyorIds } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const merged = await quoteRequestsService.mergeTemplate(
      parseInt(id),
      projectId,
      surveyorIds || []
    );

    res.json(merged);
  } catch (error) {
    console.error('Error merging template:', error);
    res.status(500).json({
      error: 'Failed to merge template',
      details: error.message
    });
  }
}

/**
 * DELETE /api/admin-console/quote-requests/sent-requests/:id
 * Delete a sent request and its recipients
 */
export async function deleteSentRequest(req, res) {
  try {
    const { id } = req.params;

    const result = await quoteRequestsService.deleteSentRequest(parseInt(id));

    if (!result) {
      return res.status(404).json({ error: 'Sent request not found' });
    }

    res.json({
      success: true,
      message: 'Sent request deleted successfully',
      id: result.id
    });
  } catch (error) {
    console.error('Error deleting sent request:', error);
    res.status(500).json({
      error: 'Failed to delete sent request',
      details: error.message
    });
  }
}

/**
 * PUT /api/admin-console/quote-request-templates/:id
 * Update template metadata and content
 */
export async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { templateName, description, subjectLine, templateContent } = req.body;

    const updates = {};
    if (templateName !== undefined) updates.templateName = templateName;
    if (description !== undefined) updates.description = description;
    if (subjectLine !== undefined) updates.subjectLine = subjectLine;
    if (templateContent !== undefined) updates.templateContent = templateContent;

    const template = await quoteRequestsService.updateTemplate(parseInt(id), updates);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      details: error.message
    });
  }
}
