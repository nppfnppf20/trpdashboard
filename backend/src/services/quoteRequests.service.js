import { pool } from '../db.js';

/**
 * Get all templates, optionally filter by discipline and is_active
 * @param {Object} filters - Optional filters { discipline, is_active }
 * @returns {Promise<Array>} Array of template objects
 */
export async function getTemplates(filters = {}) {
  let whereConditions = [];
  let queryParams = [];
  let paramCount = 1;

  if (filters.discipline) {
    whereConditions.push(`(discipline = $${paramCount} OR discipline IS NULL)`);
    queryParams.push(filters.discipline);
    paramCount++;
  }

  if (filters.is_active !== undefined) {
    whereConditions.push(`is_active = $${paramCount}`);
    queryParams.push(filters.is_active);
    paramCount++;
  } else {
    // Default to only active templates
    whereConditions.push(`is_active = TRUE`);
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  const query = `
    SELECT
      id,
      template_name,
      discipline,
      description,
      subject_line,
      template_content,
      is_active,
      created_at,
      updated_at
    FROM admin_console.quote_request_templates
    ${whereClause}
    ORDER BY
      CASE
        WHEN discipline IS NULL THEN 1
        ELSE 0
      END,
      discipline,
      template_name
  `;

  const result = await pool.query(query, queryParams);
  return result.rows;
}

/**
 * Get a specific template by ID
 * @param {number} id - Template ID
 * @returns {Promise<Object>} Template object
 */
export async function getTemplateById(id) {
  const query = `
    SELECT
      id,
      template_name,
      discipline,
      description,
      subject_line,
      template_content,
      is_active,
      created_at,
      updated_at
    FROM admin_console.quote_request_templates
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Get all sent requests for a project with recipients
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Array of sent request objects with recipients
 */
export async function getSentRequestsForProject(projectId) {
  const query = `
    SELECT
      sqr.id,
      sqr.project_id,
      sqr.template_id,
      sqr.sent_date,
      sqr.email_content,
      sqr.notes,
      qrt.template_name,
      qrt.discipline as template_discipline,
      json_agg(
        json_build_object(
          'id', so.id,
          'organisation', so.organisation,
          'discipline', so.discipline,
          'contact_id', c.id,
          'contact_name', c.name,
          'contact_email', c.email
        ) ORDER BY so.organisation
      ) FILTER (WHERE so.id IS NOT NULL) as recipients
    FROM admin_console.sent_quote_requests sqr
    LEFT JOIN admin_console.quote_request_templates qrt ON qrt.id = sqr.template_id
    LEFT JOIN admin_console.quote_request_recipients qrr ON qrr.sent_request_id = sqr.id
    LEFT JOIN admin_console.surveyor_organisations so ON so.id = qrr.surveyor_organisation_id
    LEFT JOIN admin_console.contacts c ON c.id = qrr.contact_id
    WHERE sqr.project_id = $1
    GROUP BY sqr.id, qrt.template_name, qrt.discipline
    ORDER BY sqr.sent_date DESC
  `;

  const result = await pool.query(query, [projectId]);
  return result.rows;
}

/**
 * Get a specific sent request with full details
 * @param {number} id - Sent request ID
 * @returns {Promise<Object>} Sent request object with recipients
 */
export async function getSentRequestById(id) {
  const query = `
    SELECT
      sqr.id,
      sqr.project_id,
      sqr.template_id,
      sqr.sent_date,
      sqr.email_content,
      sqr.notes,
      qrt.template_name,
      qrt.discipline as template_discipline,
      json_agg(
        json_build_object(
          'id', so.id,
          'organisation', so.organisation,
          'discipline', so.discipline,
          'contact_id', c.id,
          'contact_name', c.name,
          'contact_email', c.email
        ) ORDER BY so.organisation
      ) FILTER (WHERE so.id IS NOT NULL) as recipients
    FROM admin_console.sent_quote_requests sqr
    LEFT JOIN admin_console.quote_request_templates qrt ON qrt.id = sqr.template_id
    LEFT JOIN admin_console.quote_request_recipients qrr ON qrr.sent_request_id = sqr.id
    LEFT JOIN admin_console.surveyor_organisations so ON so.id = qrr.surveyor_organisation_id
    LEFT JOIN admin_console.contacts c ON c.id = qrr.contact_id
    WHERE sqr.id = $1
    GROUP BY sqr.id, qrt.template_name, qrt.discipline
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Create a sent request with recipients (uses transaction for atomicity)
 * @param {Object} data - { projectId, templateId, emailContent, recipients: [{surveyorId, contactId}], notes }
 * @returns {Promise<Object>} Created sent request with ID
 */
export async function createSentRequest(data) {
  const { projectId, templateId, emailContent, recipients, notes } = data;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert the sent request
    const insertRequestQuery = `
      INSERT INTO admin_console.sent_quote_requests
        (project_id, template_id, email_content, notes, sent_date)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, project_id, template_id, sent_date, email_content, notes
    `;

    const requestResult = await client.query(insertRequestQuery, [
      projectId,
      templateId,
      emailContent,
      notes || null
    ]);

    const sentRequestId = requestResult.rows[0].id;

    // Insert recipients
    if (recipients && recipients.length > 0) {
      const recipientValues = recipients.map((recipient, index) => {
        const baseIndex = index * 3;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`;
      }).join(', ');

      const recipientParams = recipients.flatMap(r => [
        sentRequestId,
        r.surveyorId,
        r.contactId || null
      ]);

      const insertRecipientsQuery = `
        INSERT INTO admin_console.quote_request_recipients
          (sent_request_id, surveyor_organisation_id, contact_id)
        VALUES ${recipientValues}
      `;

      await client.query(insertRecipientsQuery, recipientParams);
    }

    await client.query('COMMIT');

    // Return the created request with recipients
    return getSentRequestById(sentRequestId);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Merge template with project and surveyor data
 * @param {number} templateId - Template ID
 * @param {string} projectId - Project UUID
 * @param {Array<number>} surveyorIds - Array of surveyor organisation IDs
 * @returns {Promise<Object>} { content: mergedHTML, subjectLine: mergedSubject }
 */
export async function mergeTemplate(templateId, projectId, surveyorIds) {
  // Get template
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  // Get project data
  const projectQuery = `
    SELECT
      p.project_name,
      p.project_id as project_code,
      p.address,
      p.area,
      p.client,
      p.client_spv_name,
      p.sub_sector,
      p.sector
    FROM public.projects p
    WHERE p.unique_id = $1
  `;
  const projectResult = await pool.query(projectQuery, [projectId]);
  const project = projectResult.rows[0];

  if (!project) {
    throw new Error('Project not found');
  }

  // Get surveyor data if provided
  let surveyorName = 'Surveyor';
  let discipline = template.discipline || '';

  if (surveyorIds && surveyorIds.length > 0) {
    const surveyorQuery = `
      SELECT organisation, discipline
      FROM admin_console.surveyor_organisations
      WHERE id = ANY($1)
      ORDER BY organisation
    `;
    const surveyorResult = await pool.query(surveyorQuery, [surveyorIds]);
    const surveyors = surveyorResult.rows;

    if (surveyors.length === 1) {
      surveyorName = surveyors[0].organisation;
      discipline = surveyors[0].discipline;
    } else if (surveyors.length > 1) {
      surveyorName = surveyors.map(s => s.organisation).join(', ');
      // Use first surveyor's discipline or template discipline
      discipline = surveyors[0].discipline || template.discipline || '';
    }
  }

  // Placeholder replacement function
  function replacePlaceholders(text) {
    return text
      .replace(/\[PROJECT_NAME\]/g, project.project_name || '')
      .replace(/\[PROJECT_CODE\]/g, project.project_code || '')
      .replace(/\[ADDRESS\]/g, project.address || '')
      .replace(/\[AREA\]/g, project.area || '')
      .replace(/\[CLIENT_NAME\]/g, project.client || project.client_spv_name || '')
      .replace(/\[PROJECT_TYPE\]/g, project.sub_sector || '')
      .replace(/\[SECTOR\]/g, project.sector || '')
      .replace(/\[SURVEYOR_NAME\]/g, surveyorName)
      .replace(/\[DISCIPLINE\]/g, discipline)
      .replace(/\[CONTACT_NAME\]/g, surveyorName) // Fallback to org name if no specific contact
      .replace(/\[DATE\]/g, new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }));
  }

  // Merge template content and subject line
  const mergedContent = replacePlaceholders(template.template_content);
  const mergedSubject = replacePlaceholders(template.subject_line);

  return {
    content: mergedContent,
    subjectLine: mergedSubject,
    templateName: template.template_name
  };
}

/**
 * Delete a sent request and its recipients
 * @param {number} id - Sent request ID
 * @returns {Promise<Object>} Deleted request ID
 */
export async function deleteSentRequest(id) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete recipients first (foreign key constraint)
    await client.query(
      'DELETE FROM admin_console.quote_request_recipients WHERE sent_request_id = $1',
      [id]
    );

    // Delete the sent request
    const result = await client.query(
      'DELETE FROM admin_console.sent_quote_requests WHERE id = $1 RETURNING id',
      [id]
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a template
 * @param {number} id - Template ID
 * @param {Object} updates - { templateName, description, subjectLine, templateContent }
 * @returns {Promise<Object>} Updated template object
 */
export async function updateTemplate(id, updates) {
  const { templateName, description, subjectLine, templateContent } = updates;

  // Build dynamic update query
  const setClauses = [];
  const values = [];
  let paramCount = 1;

  if (templateName !== undefined) {
    setClauses.push(`template_name = $${paramCount}`);
    values.push(templateName);
    paramCount++;
  }

  if (description !== undefined) {
    setClauses.push(`description = $${paramCount}`);
    values.push(description);
    paramCount++;
  }

  if (subjectLine !== undefined) {
    setClauses.push(`subject_line = $${paramCount}`);
    values.push(subjectLine);
    paramCount++;
  }

  if (templateContent !== undefined) {
    setClauses.push(`template_content = $${paramCount}`);
    values.push(templateContent);
    paramCount++;
  }

  if (setClauses.length === 0) {
    throw new Error('No updates provided');
  }

  // Always update the updated_at timestamp
  setClauses.push(`updated_at = NOW()`);

  // Add ID as last parameter
  values.push(id);

  const query = `
    UPDATE admin_console.quote_request_templates
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}
