/**
 * Planning Deliverables Controller
 * Handles HTTP requests for planning deliverables and templates
 */

import { pool } from '../db.js';
import { mergeTemplateWithProject, contentToHTML, htmlToContent } from '../services/templateMerge.service.js';

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
 * Get all deliverables for a specific project
 */
export async function getDeliverablesForProject(req, res) {
  const { projectId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        pd.*,
        pt.template_name,
        p.project_name
       FROM planning_deliverables.planning_deliverables pd
       JOIN planning_deliverables.planning_templates pt ON pd.template_id = pt.id
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
        pt.template_name,
        pt.template_type,
        p.project_name,
        p.project_id as project_reference
       FROM planning_deliverables.planning_deliverables pd
       JOIN planning_deliverables.planning_templates pt ON pd.template_id = pt.id
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

export default {
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  createDeliverable,
  getDeliverablesForProject,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  getDeliverableAsHTML,
  updateDeliverableFromHTML
};

