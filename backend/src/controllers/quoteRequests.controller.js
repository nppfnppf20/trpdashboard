import * as quoteRequestsService from '../services/quoteRequests.service.js';
import { pool } from '../db.js';
import { analyseBriefingForDisciplines, suggestEmailEdits } from '../services/surveyorBriefing.service.js';
import { sendEmail, sendBatch } from '../services/emailService.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';

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
 * POST /api/admin-console/quote-requests/projects/:projectId/analyse-disciplines
 * Analyse the project's latest briefing note and suggest disciplines + 4★+ surveyors.
 */
export async function analyseDisciplines(req, res) {
  const { projectId } = req.params;
  const { briefing_note_id, development_type: developmentType = null } = req.body;
  try {
    const noteQuery = briefing_note_id
      ? `SELECT ds.summary_html
         FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE ds.id = $1 AND p.unique_id = $2`
      : `SELECT ds.summary_html
         FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE p.unique_id = $1
           AND ds.doc_type IN ('briefing_transcript', 'briefing_note')
         ORDER BY ds.created_at DESC LIMIT 1`;
    const noteParams = briefing_note_id ? [parseInt(briefing_note_id), projectId] : [projectId];
    const { rows: noteRows } = await pool.query(noteQuery, noteParams);

    if (!noteRows.length || !noteRows[0].summary_html) {
      return res.status(404).json({ error: 'No briefing note found for this project. Upload a briefing note first.' });
    }
    const briefingText = noteRows[0].summary_html;

    const [templates, guidingBrief] = await Promise.all([
      quoteRequestsService.getTemplates({}),
      getGuidingBrief('surveyor_briefing', developmentType)
    ]);
    const availableDisciplines = [...new Set(templates.filter(t => t.discipline).map(t => t.discipline))];

    const disciplineSuggestions = await analyseBriefingForDisciplines(briefingText, availableDisciplines, guidingBrief);

    const results = await Promise.all(
      disciplineSuggestions.map(async ({ discipline, reasoning }) => {
        const template = templates.find(t => t.discipline?.toLowerCase() === discipline.toLowerCase()) ?? null;

        const { rows: surveyors } = await pool.query(
          `SELECT so.id, so.organisation, so.discipline, so.location,
                  so.avg_overall, so.avg_quality, so.avg_responsiveness, so.avg_on_time, so.total_reviews,
                  json_agg(
                    DISTINCT jsonb_build_object(
                      'id', c.id, 'name', c.name, 'email', c.email, 'is_primary', c.is_primary
                    )
                  ) FILTER (WHERE c.id IS NOT NULL) AS contacts
           FROM admin_console.surveyor_organisations so
           LEFT JOIN admin_console.contacts c
             ON c.organisation_id = so.id AND c.organisation_type = 'surveyor'
           WHERE LOWER(so.discipline) = LOWER($1)
             AND so.avg_overall >= 4
             AND so.approval_status = 'approved'
           GROUP BY so.id
           ORDER BY so.avg_overall DESC`,
          [discipline]
        );

        return { discipline, reasoning, template, surveyors };
      })
    );

    res.json({ suggestions: results });
  } catch (err) {
    console.error('analyseDisciplines error:', err);
    res.status(500).json({ error: 'Failed to analyse disciplines', details: err.message });
  }
}

/**
 * GET /api/admin-console/quote-requests/surveyors?discipline=X
 * Return 4★+ approved surveyors for a given discipline.
 */
export async function getSurveyorsForDiscipline(req, res) {
  const { discipline } = req.query;
  if (!discipline) return res.status(400).json({ error: 'discipline is required' });
  try {
    const { rows } = await pool.query(
      `SELECT so.id, so.organisation, so.discipline, so.location,
              so.avg_overall, so.avg_quality, so.avg_responsiveness, so.avg_on_time, so.total_reviews,
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', c.id, 'name', c.name, 'email', c.email, 'is_primary', c.is_primary
                )
              ) FILTER (WHERE c.id IS NOT NULL) AS contacts
       FROM admin_console.surveyor_organisations so
       LEFT JOIN admin_console.contacts c
         ON c.organisation_id = so.id AND c.organisation_type = 'surveyor'
       WHERE LOWER(so.discipline) = LOWER($1)
         AND so.avg_overall >= 4
         AND so.approval_status = 'approved'
       GROUP BY so.id
       ORDER BY so.avg_overall DESC`,
      [discipline]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch surveyors', details: err.message });
  }
}

/**
 * POST /api/admin-console/quote-requests/projects/:projectId/suggest-email-edits
 * Suggest scope-section edits to a briefing email based on the project briefing note.
 */
export async function suggestEmailEditsForDiscipline(req, res) {
  const { projectId } = req.params;
  const { briefing_note_id, discipline, template_content } = req.body;

  if (!discipline || !template_content) {
    return res.status(400).json({ error: 'discipline and template_content are required' });
  }

  try {
    const noteQuery = briefing_note_id
      ? `SELECT ds.summary_html
         FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE ds.id = $1 AND p.unique_id = $2`
      : `SELECT ds.summary_html
         FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE p.unique_id = $1
           AND ds.doc_type IN ('briefing_transcript', 'briefing_note')
         ORDER BY ds.created_at DESC LIMIT 1`;
    const noteParams = briefing_note_id ? [parseInt(briefing_note_id), projectId] : [projectId];
    const { rows: noteRows } = await pool.query(noteQuery, noteParams);

    if (!noteRows.length || !noteRows[0].summary_html) {
      return res.status(404).json({ error: 'No briefing note found for this project' });
    }

    const result = await suggestEmailEdits(noteRows[0].summary_html, discipline, template_content);
    res.json(result);
  } catch (err) {
    console.error('suggestEmailEditsForDiscipline error:', err);
    res.status(500).json({ error: 'Failed to suggest email edits', details: err.message });
  }
}

/**
 * POST /api/admin-console/quote-requests/projects/:projectId/send-briefings
 * Send briefing emails via Resend and record in sent_quote_requests.
 * Body: { templateId, emailContent, subject, recipients: [{surveyorId, contactId, contactEmail, contactName, surveyorOrganisation}], notes }
 */
export async function sendBriefingEmails(req, res) {
  const { projectId } = req.params;
  const { templateId, emailContent, subject, recipients, notes } = req.body;

  if (!emailContent) return res.status(400).json({ error: 'emailContent is required' });
  if (!subject) return res.status(400).json({ error: 'subject is required' });
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }

  try {
    // Look up the integer project id for the email log
    const { rows: projectRows } = await pool.query(
      'SELECT id FROM public.projects WHERE unique_id = $1', [projectId]
    );
    const intProjectId = projectRows[0]?.id ?? null;

    // Save the sent request record first
    const sentRequest = await quoteRequestsService.createSentRequest({
      projectId,
      templateId: templateId || null,
      emailContent,
      recipients: recipients.map(r => ({ surveyorId: r.surveyorId, contactId: r.contactId })),
      notes: notes || null
    });

    // Send emails - one per recipient that has an email address
    const emailsToSend = recipients
      .filter(r => r.contactEmail)
      .map(r => ({
        to: r.contactEmail,
        subject,
        html: emailContent,
        type: 'surveyor_briefing',
        projectId: intProjectId
      }));

    const results = await sendBatch(emailsToSend);

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.status(201).json({ sentRequest, results, sent, failed });
  } catch (error) {
    console.error('sendBriefingEmails error:', error);
    res.status(500).json({ error: 'Failed to send briefing emails', details: error.message });
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
