/**
 * Planning Deliverables Controller
 * Handles HTTP requests for planning deliverables and templates
 */

import { pool } from '../db.js';
import { mergeTemplateWithProject, contentToHTML, htmlToContent } from '../services/templateMerge.service.js';
import { parseFile } from '../services/parser.service.js';
import { incorporateTargetedParagraphs, resolveProvider } from '../services/llm.service.js';

/**
 * Get all available templates
 */
export async function getAllTemplates(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, template_name, template_type, description, version, is_active, created_at, template_content
       FROM planning_deliverables.planning_templates
       WHERE is_active = true
       ORDER BY template_type, template_name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

/**
 * Get a specific template by ID
 */
export async function getTemplateById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM planning_deliverables.planning_templates WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

/**
 * Update a template
 */
export async function updateTemplate(req, res) {
  const { id } = req.params;
  const { templateName, description, templateContent } = req.body;

  try {
    // Build update query dynamically based on what's provided
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (templateName !== undefined) {
      updates.push(`template_name = $${paramCount}`);
      values.push(templateName);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (templateContent !== undefined) {
      updates.push(`template_content = $${paramCount}`);
      values.push(templateContent);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE planning_deliverables.planning_templates
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template', details: error.message });
  }
}

/**
 * Generate (upsert) a deliverable by template_type — used by PA workspace letter-doc cards
 */
export async function generateDeliverableByType(req, res) {
  const { projectId, templateType } = req.body;
  try {
    if (!projectId || !templateType) {
      return res.status(400).json({ error: 'projectId and templateType are required' });
    }

    const [templateResult, projectResult] = await Promise.all([
      pool.query(
        `SELECT * FROM planning_deliverables.planning_templates
         WHERE template_type = $1 AND is_active = true
         ORDER BY version DESC LIMIT 1`,
        [templateType]
      ),
      pool.query('SELECT * FROM public.projects WHERE id = $1', [projectId])
    ]);

    if (!templateResult.rows.length) return res.status(404).json({ error: `No active template found for type: ${templateType}` });
    if (!projectResult.rows.length) return res.status(404).json({ error: 'Project not found' });

    const template = templateResult.rows[0];
    const project = projectResult.rows[0];
    const mergedContent = mergeTemplateWithProject(template, project);
    const html = contentToHTML(mergedContent);

    const existing = await pool.query(
      `SELECT id FROM planning_deliverables.planning_deliverables
       WHERE project_id = $1 AND deliverable_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [projectId, templateType]
    );

    let deliverable;
    if (existing.rows.length) {
      const upd = await pool.query(
        `UPDATE planning_deliverables.planning_deliverables
         SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(mergedContent), existing.rows[0].id]
      );
      deliverable = upd.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO planning_deliverables.planning_deliverables
           (project_id, template_id, deliverable_name, deliverable_type, content, status)
         VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
        [projectId, template.id, `${template.template_name} - ${project.project_name}`, templateType, JSON.stringify(mergedContent)]
      );
      deliverable = ins.rows[0];
    }

    res.json({ deliverable, html });
  } catch (error) {
    console.error('Error generating deliverable by type:', error);
    res.status(500).json({ error: 'Failed to generate deliverable', details: error.message });
  }
}

/**
 * Create a new deliverable by merging template with project data
 */
export async function createDeliverable(req, res) {
  const { projectId, templateId, deliverableName } = req.body;

  try {
    // Validate required fields
    if (!projectId || !templateId) {
      return res.status(400).json({
        error: 'projectId and templateId are required'
      });
    }

    // Fetch project data
    const projectResult = await pool.query(
      `SELECT * FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Fetch template
    const templateResult = await pool.query(
      `SELECT * FROM planning_deliverables.planning_templates WHERE id = $1 AND is_active = true`,
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const project = projectResult.rows[0];
    const template = templateResult.rows[0];

    // Merge template with project data
    const mergedContent = mergeTemplateWithProject(template, project);

    // Generate default deliverable name if not provided
    const finalName = deliverableName || 
      `${template.template_name} - ${project.project_name}`;

    // Insert new deliverable
    const insertResult = await pool.query(
      `INSERT INTO planning_deliverables.planning_deliverables
       (project_id, template_id, deliverable_name, deliverable_type, content, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        projectId,
        templateId,
        finalName,
        template.template_type,
        JSON.stringify(mergedContent),
        'draft'
      ]
    );

    res.json({
      success: true,
      deliverable: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating deliverable:', error);
    res.status(500).json({ error: 'Failed to create deliverable', details: error.message });
  }
}

/**
 * Create a deliverable directly from HTML, with no underlying template —
 * used to save the blank document / custom-prompt editor into the project's
 * Planning Deliverables list.
 */
export async function createCustomDeliverable(req, res) {
  const { projectId, deliverableName, html } = req.body;

  if (!projectId || !deliverableName?.trim() || !html?.trim()) {
    return res.status(400).json({ error: 'projectId, deliverableName, and html are required' });
  }

  try {
    const projectResult = await pool.query(`SELECT id FROM projects WHERE id = $1`, [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const content = htmlToContent(html);

    const insertResult = await pool.query(
      `INSERT INTO planning_deliverables.planning_deliverables
       (project_id, template_id, deliverable_name, deliverable_type, content, status)
       VALUES ($1, NULL, $2, 'custom_document', $3, 'draft')
       RETURNING *`,
      [projectId, deliverableName.trim(), JSON.stringify(content)]
    );

    res.json({ success: true, deliverable: insertResult.rows[0] });
  } catch (error) {
    console.error('Error creating custom deliverable:', error);
    res.status(500).json({ error: 'Failed to create deliverable', details: error.message });
  }
}

/**
 * Get all deliverables for a specific project
 */
export async function getDeliverablesForProject(req, res) {
  const { projectId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        pd.*,
        COALESCE(pt.template_name, 'Custom Document') AS template_name,
        p.project_name
       FROM planning_deliverables.planning_deliverables pd
       LEFT JOIN planning_deliverables.planning_templates pt ON pd.template_id = pt.id
       JOIN projects p ON pd.project_id = p.id
       WHERE pd.project_id = $1
       ORDER BY pd.updated_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching project deliverables:', error);
    res.status(500).json({ error: 'Failed to fetch deliverables' });
  }
}

/**
 * Get a specific deliverable by ID
 */
export async function getDeliverableById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        pd.*,
        COALESCE(pt.template_name, 'Custom Document') AS template_name,
        pt.template_type,
        p.project_name,
        p.project_id as project_reference
       FROM planning_deliverables.planning_deliverables pd
       LEFT JOIN planning_deliverables.planning_templates pt ON pd.template_id = pt.id
       JOIN projects p ON pd.project_id = p.id
       WHERE pd.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching deliverable:', error);
    res.status(500).json({ error: 'Failed to fetch deliverable' });
  }
}

/**
 * Update a deliverable's content
 */
export async function updateDeliverable(req, res) {
  const { id } = req.params;
  const { content, deliverableName, status } = req.body;

  try {
    // Build update query dynamically based on what's provided
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(JSON.stringify(content));
      paramCount++;
    }

    if (deliverableName !== undefined) {
      updates.push(`deliverable_name = $${paramCount}`);
      values.push(deliverableName);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE planning_deliverables.planning_deliverables
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    res.json({
      success: true,
      deliverable: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating deliverable:', error);
    res.status(500).json({ error: 'Failed to update deliverable' });
  }
}

/**
 * Delete a deliverable
 */
export async function deleteDeliverable(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM planning_deliverables.planning_deliverables WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    res.json({
      success: true,
      message: 'Deliverable deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deliverable:', error);
    res.status(500).json({ error: 'Failed to delete deliverable' });
  }
}

/**
 * Get deliverable content as HTML (for rich text editor)
 */
export async function getDeliverableAsHTML(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT content FROM planning_deliverables.planning_deliverables WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    const content = result.rows[0].content;
    const html = contentToHTML(content);

    res.json({ html });
  } catch (error) {
    console.error('Error converting deliverable to HTML:', error);
    res.status(500).json({ error: 'Failed to convert deliverable' });
  }
}

/**
 * Update deliverable from HTML (from rich text editor)
 */
export async function updateDeliverableFromHTML(req, res) {
  const { id } = req.params;
  const { html } = req.body;

  try {
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Convert HTML back to structured content
    const content = htmlToContent(html);

    const result = await pool.query(
      `UPDATE planning_deliverables.planning_deliverables
       SET content = $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(content), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    res.json({
      success: true,
      deliverable: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating deliverable from HTML:', error);
    res.status(500).json({ error: 'Failed to update deliverable' });
  }
}

/**
 * AI-edit a set of paragraphs within a deliverable (highlight-driven quick
 * edit, or "whole document" when the caller passes every paragraph) — mirrors
 * appeal.controller.js's incorporateTargeted, minus the appeal-specific
 * issues/guiding-brief/specialist-report machinery, since generic
 * deliverables (letters, blank documents, etc.) have none of that context.
 */
export async function incorporateDeliverableTargeted(req, res) {
  const { id } = req.params;
  const { document_text, document_title, document_html, user_notes = null, provider: requestedProvider, doc_type } = req.body ?? {};
  const paragraphs = JSON.parse(req.body?.paragraphs || '[]');

  if (!paragraphs?.length) return res.status(400).json({ error: 'paragraphs required' });
  if (!document_text && !req.file && !user_notes?.trim()) {
    return res.status(400).json({ error: 'document_text, file, or user_notes required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT pd.deliverable_name, p.id AS project_id, p.project_name, pt.description AS document_purpose
       FROM planning_deliverables.planning_deliverables pd
       JOIN projects p ON pd.project_id = p.id
       LEFT JOIN planning_deliverables.planning_templates pt ON pt.id = pd.template_id
       WHERE pd.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Deliverable not found' });
    const projectId = rows[0].project_id;

    const provider = await resolveProvider('planning_deliverable_incorporation', requestedProvider);

    let documentText = '', filename = null;
    if (req.file) {
      const parsed = await parseFile(req.file.buffer, req.file.originalname);
      documentText = parsed.text;
      filename = document_title || req.file.originalname;
    } else if (document_text) {
      documentText = document_text;
      filename = document_title || 'Pasted document';
    }

    // Background context only (see incorporateTargetedParagraphs) — the
    // model isn't told to use any of this, it's there so an instruction like
    // "assess every criterion of this policy" doesn't silently fail just
    // because the policy's full wording or other criteria live outside the
    // highlighted paragraph(s).
    const [{ rows: projectPolicies }, { rows: issues }] = await Promise.all([
      pool.query(
        `SELECT pp.policy_reference, pp.policy_name, pp.policy_text, pp.relevant_supporting_text, pp.is_key_policy, pd.plan_name
         FROM public.project_policies pp
         LEFT JOIN public.policy_documents pd ON pd.id = pp.plan_id
         WHERE pp.project_id = $1
         ORDER BY pp.policy_type, pp.policy_reference`,
        [projectId]
      ),
      pool.query(
        `SELECT label, discipline, argument_for FROM admin_console.drafting_issues WHERE project_id = $1 ORDER BY sort_order, id`,
        [projectId]
      ),
    ]);

    const updated = await incorporateTargetedParagraphs({
      paragraphs,
      documentText,
      filename,
      issues,
      userNotes: user_notes,
      projectName: rows[0].project_name,
      draftTypeName: rows[0].deliverable_name,
      documentPurpose: rows[0].document_purpose ?? null,
      docType: doc_type ?? null,
      fullDocumentHtml: document_html ?? null,
      projectPolicies,
      provider,
    });
    res.json({ updated });
  } catch (error) {
    console.error('Error incorporating into deliverable:', error);
    res.status(500).json({ error: error.message });
  }
}

export default {
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  createDeliverable,
  createCustomDeliverable,
  getDeliverablesForProject,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  getDeliverableAsHTML,
  updateDeliverableFromHTML,
  incorporateDeliverableTargeted
};

