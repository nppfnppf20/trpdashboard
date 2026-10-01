import * as quoteRequestsService from '../services/quoteRequests.service.js';
import { pool } from '../db.js';
import { analyseBriefingForDisciplines, suggestEmailEdits } from '../services/surveyorBriefing.service.js';
import { sendEmail, sendBatch } from '../services/emailService.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { getDefaultToneForUser } from '../services/emailTones.service.js';
import { getLookupOptions } from '../services/lookups.service.js';
import { CONTEXT_BUDGET } from '../services/projectChat.service.js';

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

// Matches a person's name as written in the notes (full, first-name-only, surname-only, any
// casing) to one contact of an organisation. Returns the contact id, or null if none or ambiguous.
function matchContactByName(contacts, rawName) {
  const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  const wanted = norm(rawName);
  if (!wanted.length) return null;
  const exact = contacts.filter(c => norm(c.name).join(' ') === wanted.join(' '));
  if (exact.length === 1) return exact[0].id;
  const partial = contacts.filter(c => {
    const tokens = norm(c.name);
    return wanted.every(w => tokens.includes(w));
  });
  return partial.length === 1 ? partial[0].id : null;
}

// Last-resort, LLM-independent check on one organisation's contacts. First tries a full name
// appearing verbatim in the notes/instructions; then a first name appearing as a whole word.
// Only returns an id when exactly one contact fits at that level (so two "Sam"s stay ambiguous).
function findContactNamedInText(contacts, text) {
  const hay = ` ${String(text ?? '').toLowerCase().replace(/\s+/g, ' ')} `;
  const clean = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

  const byFullName = contacts.filter(c => {
    const name = clean(c.name);
    return name.includes(' ') && hay.includes(name);
  });
  if (byFullName.length === 1) return byFullName[0].id;
  if (byFullName.length > 1) return null;

  const words = new Set(hay.split(/[^a-z]+/).filter(Boolean));
  const byFirstName = contacts.filter(c => {
    const first = clean(c.name).split(' ')[0].replace(/[^a-z]/g, '');
    return first.length >= 2 && words.has(first);
  });
  return byFirstName.length === 1 ? byFirstName[0].id : null;
}

/**
 * POST /api/admin-console/quote-requests/projects/:projectId/analyse-disciplines
 * Analyse the project's latest briefing note and suggest disciplines + 4★+ surveyors.
 */
export async function analyseDisciplines(req, res) {
  const { projectId } = req.params;
  const { sources = [], development_type: developmentType = null, guidance = '' } = req.body;
  try {
    // No latest-note fallback: either notes/docs are ticked, or the user's instructions are the only source
    const hasGuidance = typeof guidance === 'string' && guidance.trim().length > 0;
    if (!sources.length && !hasGuidance) {
      return res.status(400).json({ error: 'Select at least one note or doc, or write instructions to draft from.' });
    }
    const briefingText = sources.length
      ? await quoteRequestsService.resolveBriefingSourceTexts(sources, projectId)
      : '';

    if (sources.length && !briefingText) {
      return res.status(404).json({ error: 'The selected notes could not be found or are empty.' });
    }
    if (briefingText.length > CONTEXT_BUDGET) {
      const pct = Math.round(briefingText.length / CONTEXT_BUDGET * 100);
      return res.status(400).json({ error: `Selected sources exceed the context budget (~${pct}%). Untick some sources or switch a full transcript to its summary and try again.` });
    }

    const [templates, guidingBrief, disciplineOptions] = await Promise.all([
      quoteRequestsService.getTemplates({}),
      getGuidingBrief('surveyor_briefing', developmentType),
      getLookupOptions('surveyor_disciplines')
    ]);
    // Master discipline list (admin_console.surveyor_disciplines), plus any
    // discipline used by a template that isn't in that list, as a safety net —
    // no longer limited to only disciplines that already have a template.
    const availableDisciplines = [...new Set([
      ...disciplineOptions.map(d => d.label),
      ...templates.filter(t => t.discipline).map(t => t.discipline)
    ])];

    const { rows: surveyorOrgs } = await pool.query(
      `SELECT id, organisation, discipline
         FROM admin_console.surveyor_organisations
        WHERE approval_status = 'approved'
        ORDER BY organisation`
    );
    const { rows: contactRows } = await pool.query(
      `SELECT c.id, c.name, c.organisation_id
         FROM admin_console.contacts c
         JOIN admin_console.surveyor_organisations so ON so.id = c.organisation_id
        WHERE c.organisation_type = 'surveyor' AND so.approval_status = 'approved'
        ORDER BY c.name`
    );
    const orgById = new Map(surveyorOrgs.map(o => [o.id, o]));
    for (const o of surveyorOrgs) o.contacts = [];
    for (const c of contactRows) orgById.get(c.organisation_id)?.contacts.push({ id: c.id, name: c.name });

    const disciplineSuggestions = await analyseBriefingForDisciplines(
      briefingText, availableDisciplines, guidingBrief, typeof guidance === 'string' ? guidance : '', surveyorOrgs
    );

    const generalTemplate = templates.find(t => t.discipline === null) ?? null;

    const results = await Promise.all(
      disciplineSuggestions.map(async ({ discipline, reasoning, named_surveyors }) => {
        // Only trust ids that exist and whose own discipline matches this entry. A contact id is
        // only kept if that person actually belongs to the named organisation.
        const namedById = new Map();
        for (const n of Array.isArray(named_surveyors) ? named_surveyors : []) {
          const id = String(n?.id ?? '');
          const org = orgById.get(id);
          if (!org || org.discipline?.toLowerCase() !== discipline.toLowerCase()) continue;
          const contactId = n.contact_id ? String(n.contact_id).replace(/[\[\]\s]/g, '') : null;
          const validContact = (contactId && org.contacts.find(c => c.id === contactId)?.id)
            ?? matchContactByName(org.contacts, n.contact_name)
            ?? findContactNamedInText(org.contacts, `${briefingText}
${guidance}`);
          namedById.set(id, validContact ?? namedById.get(id) ?? null);
        }
        const namedIds = [...namedById.keys()];
        console.log(`[analyseDisciplines] ${discipline} named_surveyors from LLM:`, JSON.stringify(named_surveyors), '→ resolved:', JSON.stringify([...namedById]));

        const specificTemplate = templates.find(t => t.discipline?.toLowerCase() === discipline.toLowerCase()) ?? null;
        const template = specificTemplate ?? generalTemplate;
        const hasSpecificTemplate = !!specificTemplate;

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
             AND so.approval_status = 'approved'
             AND (so.avg_overall >= 4 OR so.id = ANY($2::uuid[]))
           GROUP BY so.id
           ORDER BY so.avg_overall DESC NULLS LAST`,
          [discipline, namedIds]
        );
        // Surveyors named in the notes/instructions are flagged so the UI pre-ticks them
        // (and, if a person was named, mentionedContactId says which contact to pre-select)
        for (const sv of surveyors) {
          sv.mentioned = namedById.has(sv.id);
          sv.mentionedContactId = namedById.get(sv.id) ?? null;
        }

        return { discipline, reasoning, template, hasSpecificTemplate, surveyors };
      })
    );

    res.json({ suggestions: results });
  } catch (err) {
    console.error('analyseDisciplines error:', err);
    res.status(500).json({ error: 'Failed to analyse disciplines', details: err.message });
  }
}

/**
 * GET /api/admin-console/quote-requests/projects/:projectId/briefing-sources
 * List briefing notes and (project) meeting notes available as draft sources,
 * with character counts so the frontend can show a context-budget meter
 * without loading the full text of every note into the page.
 */
export async function listBriefingSources(req, res) {
  const { projectId } = req.params;
  try {
    const [{ rows: briefingNotes }, { rows: meetingNotes }] = await Promise.all([
      pool.query(
        `SELECT ds.id, ds.title, ds.file_name, ds.created_at,
                LENGTH(ds.summary_html) AS summary_chars,
                LENGTH(ds.transcript_text) AS transcript_chars
         FROM planning_applications.document_summaries ds
         JOIN public.projects p ON p.id = ds.project_id
         WHERE p.unique_id = $1
           AND ds.doc_type IN ('briefing_transcript', 'briefing_note')
         ORDER BY ds.created_at DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT mt.id, mt.title, mt.meeting_date, mt.created_at,
                LENGTH(ms.summary_html) AS summary_chars,
                LENGTH(mt.transcript_text) AS transcript_chars
         FROM planning_applications.meeting_transcripts mt
         JOIN planning_applications.meeting_summaries ms ON ms.transcript_id = mt.id
         JOIN public.projects p ON p.id = mt.project_id
         WHERE p.unique_id = $1 AND mt.meeting_type = 'project'
         ORDER BY mt.meeting_date DESC NULLS LAST, mt.created_at DESC`,
        [projectId]
      ),
    ]);
    res.json({ briefingNotes, meetingNotes, budget: CONTEXT_BUDGET });
  } catch (err) {
    console.error('listBriefingSources error:', err);
    res.status(500).json({ error: 'Failed to fetch briefing sources', details: err.message });
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
  const { sources = [], discipline, template_content, guidance = '' } = req.body;

  if (!discipline || !template_content) {
    return res.status(400).json({ error: 'discipline and template_content are required' });
  }

  try {
    // No latest-note fallback: either notes/docs are ticked, or the user's instructions are the only source
    const hasGuidance = typeof guidance === 'string' && guidance.trim().length > 0;
    if (!sources.length && !hasGuidance) {
      return res.status(400).json({ error: 'Select at least one note or doc, or write instructions to draft from.' });
    }
    const briefingText = sources.length
      ? await quoteRequestsService.resolveBriefingSourceTexts(sources, projectId)
      : '';

    if (sources.length && !briefingText) {
      return res.status(404).json({ error: 'The selected notes could not be found or are empty.' });
    }
    if (briefingText.length > CONTEXT_BUDGET) {
      const pct = Math.round(briefingText.length / CONTEXT_BUDGET * 100);
      return res.status(400).json({ error: `Selected sources exceed the context budget (~${pct}%). Untick some sources or switch a full transcript to its summary and try again.` });
    }

    // The sender's own default tone; none set up = no tone, just the anti-AI-slop block
    const tone = await getDefaultToneForUser(req.user?.id).catch(err => {
      console.error('getDefaultToneForUser failed, drafting without a tone:', err);
      return null;
    });
    const result = await suggestEmailEdits(briefingText, discipline, template_content, typeof guidance === 'string' ? guidance : '', tone);
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
