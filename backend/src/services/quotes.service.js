/**
 * Quotes Service
 * Business logic for quote management
 */

import { pool } from '../db.js';
import { refreshSurveyorRatings } from './surveyorOrganisations.service.js';

/**
 * Get all quotes with optional filters
 * @param {Object} filters - { projectId, status, workStatus }
 */
export async function getQuotes(filters = {}) {
  let whereConditions = [];
  let queryParams = [];
  let paramCount = 1;

  if (filters.projectId) {
    whereConditions.push(`q.project_id = $${paramCount}`);
    queryParams.push(filters.projectId);
    paramCount++;
  }

  if (filters.instructionStatus) {
    whereConditions.push(`q.instruction_status = $${paramCount}`);
    queryParams.push(filters.instructionStatus);
    paramCount++;
  }

  if (filters.workStatus) {
    whereConditions.push(`q.work_status = $${paramCount}`);
    queryParams.push(filters.workStatus);
    paramCount++;
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `
    SELECT 
      q.id,
      q.project_id,
      q.project_code,
      q.surveyor_organisation_id,
      q.contact_id,
      q.discipline,
      q.total,
      q.instruction_status,
      q.partially_instructed_total,
      q.work_status,
      q.dependencies,
      q.site_visit_date,
      q.report_draft_date,
      q.operational_notes,
      q.quality,
      q.responsiveness,
      q.delivered_on_time,
      q.overall_review,
      q.review_notes,
      q.review_date,
      q.quote_notes,
      q.status,
      q.date as quote_date,
      q.created_at,
      q.updated_at,
      
      -- Project info
      p.project_name,
      p.address as project_address,
      
      -- Surveyor org info
      so.organisation as surveyor_organisation,
      so.discipline as surveyor_discipline,
      so.location as surveyor_location,
      
      -- Contact info
      c.name as contact_name,
      c.email as contact_email,
      c.phone_number as contact_phone,
      
      -- Line items
      json_agg(
        jsonb_build_object(
          'id', qli.id,
          'item', qli.item,
          'description', qli.description,
          'cost', qli.cost,
          'is_instructed', COALESCE(qli.is_instructed, false)
        ) ORDER BY qli.created_at
      ) FILTER (WHERE qli.id IS NOT NULL) as line_items

    FROM admin_console.quotes q
    LEFT JOIN public.projects p ON p.unique_id = q.project_id
    LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
    LEFT JOIN admin_console.contacts c ON c.id = q.contact_id
    LEFT JOIN admin_console.quote_line_items qli ON qli.quote_id = q.id
    ${whereClause}
    GROUP BY 
      q.id, p.project_name, p.address, 
      so.organisation, so.discipline, so.location,
      c.name, c.email, c.phone_number
    ORDER BY q.created_at DESC
  `;

  const result = await pool.query(query, queryParams);
  return result.rows;
}

/**
 * Get single quote by ID
 */
export async function getQuoteById(id) {
  const query = `
    SELECT 
      q.*,
      
      -- Project info
      p.project_name,
      p.project_id as project_code_from_projects,
      p.address as project_address,
      p.area as project_area,
      
      -- Surveyor org info
      so.organisation as surveyor_organisation,
      so.discipline as surveyor_discipline,
      so.location as surveyor_location,
      
      -- Contact info
      c.name as contact_name,
      c.email as contact_email,
      c.phone_number as contact_phone,
      
      -- Line items
      json_agg(
        jsonb_build_object(
          'id', qli.id,
          'item', qli.item,
          'description', qli.description,
          'cost', qli.cost,
          'is_instructed', COALESCE(qli.is_instructed, false)
        ) ORDER BY qli.created_at
      ) FILTER (WHERE qli.id IS NOT NULL) as line_items

    FROM admin_console.quotes q
    LEFT JOIN public.projects p ON p.unique_id = q.project_id
    LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
    LEFT JOIN admin_console.contacts c ON c.id = q.contact_id
    LEFT JOIN admin_console.quote_line_items qli ON qli.quote_id = q.id
    WHERE q.id = $1
    GROUP BY 
      q.id, p.project_name, p.project_id, p.address, p.area,
      so.organisation, so.discipline, so.location,
      c.name, c.email, c.phone_number
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Get projects with stats (uses the view)
 */
export async function getProjectsWithStats() {
  const query = `
    SELECT * FROM admin_console.projects_with_stats
    ORDER BY name
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get quote key dates for a project
 */
export async function getQuoteKeyDates(projectId) {
  const query = `
    SELECT 
      qkd.id,
      qkd.quote_id,
      qkd.title,
      qkd.date,
      qkd.colour,
      q.discipline,
      q.surveyor_organisation_id,
      q.operational_notes,
      so.organisation as surveyor_organisation
    FROM admin_console.quote_key_dates qkd
    JOIN admin_console.quotes q ON q.id = qkd.quote_id
    LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
    WHERE q.project_id = $1
    ORDER BY qkd.date
  `;

  const result = await pool.query(query, [projectId]);
  return result.rows;
}

/**
 * Get programme events for a project
 */
export async function getProgrammeEvents(projectId) {
  const query = `
    SELECT
      id,
      project_id,
      title,
      date,
      colour,
      created_at,
      updated_at
    FROM admin_console.programme_events
    WHERE project_id = $1
    ORDER BY date
  `;

  const result = await pool.query(query, [projectId]);
  return result.rows;
}

/**
 * Create a programme event
 */
export async function createProgrammeEvent(data) {
  const query = `
    INSERT INTO admin_console.programme_events (
      project_id,
      title,
      date,
      colour
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await pool.query(query, [
    data.project_id,
    data.title,
    data.date,
    data.colour || null
  ]);
  return result.rows[0];
}

/**
 * Update a programme event
 */
export async function updateProgrammeEvent(id, data) {
  const query = `
    UPDATE admin_console.programme_events
    SET
      title = $1,
      date = $2,
      colour = $3
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [
    data.title,
    data.date,
    data.colour || null,
    id
  ]);
  return result.rows[0];
}

/**
 * Delete a programme event
 */
export async function deleteProgrammeEvent(id) {
  const query = `
    DELETE FROM admin_console.programme_events
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Create a quote key date
 */
export async function createQuoteKeyDate(data) {
  const query = `
    INSERT INTO admin_console.quote_key_dates (
      quote_id,
      title,
      date,
      colour
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await pool.query(query, [
    data.quote_id,
    data.title,
    data.date,
    data.colour || null
  ]);
  return result.rows[0];
}

/**
 * Update a quote key date
 */
export async function updateQuoteKeyDate(id, data) {
  const query = `
    UPDATE admin_console.quote_key_dates
    SET
      title = $1,
      date = $2,
      colour = $3
    WHERE id = $4
    RETURNING *
  `;

  console.log('updateQuoteKeyDate service called');
  console.log('ID:', id);
  console.log('Data:', data);
  console.log('Query params:', [data.title, data.date, data.colour || null, id]);

  const result = await pool.query(query, [
    data.title,
    data.date,
    data.colour || null,
    id
  ]);
  
  console.log('Query result rowCount:', result.rowCount);
  console.log('Query result rows:', result.rows);
  
  return result.rows[0];
}

/**
 * Delete a quote key date
 */
export async function deleteQuoteKeyDate(id) {
  const query = `
    DELETE FROM admin_console.quote_key_dates
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Create a new quote with line items
 */
export async function createQuote(data) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert quote
    const quoteQuery = `
      INSERT INTO admin_console.quotes (
        project_id,
        project_code,
        surveyor_organisation_id,
        contact_id,
        discipline,
        total,
        quote_notes,
        date,
        instruction_status,
        work_status,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NULL, 'active')
      RETURNING *
    `;
    
    // Get project_code from project
    const projectCodeQuery = `SELECT project_id FROM public.projects WHERE unique_id = $1`;
    const projectResult = await client.query(projectCodeQuery, [data.project_id]);
    const project_code = projectResult.rows[0]?.project_id;
    
    const quoteResult = await client.query(quoteQuery, [
      data.project_id,
      project_code,
      data.surveyor_organisation_id,
      data.contact_id || null,
      data.discipline,
      data.total,
      data.quote_notes || null,
      data.date || new Date()
    ]);
    
    const quote = quoteResult.rows[0];
    
    // Insert line items if provided
    if (data.line_items && data.line_items.length > 0) {
      const lineItemQuery = `
        INSERT INTO admin_console.quote_line_items (
          quote_id,
          item,
          description,
          cost
        ) VALUES ($1, $2, $3, $4)
      `;
      
      for (const item of data.line_items) {
        await client.query(lineItemQuery, [
          quote.id,
          item.item,
          item.description || '',
          item.cost
        ]);
      }
    }
    
    await client.query('COMMIT');
    
    // Return the complete quote with line items
    return await getQuoteById(quote.id);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update quote instruction status
 */
export async function updateQuoteInstructionStatus(id, instructionStatus, selectedLineItems = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let partiallyInstructedTotal = null;

    // Reset all line items to not instructed first
    await client.query(
      `UPDATE admin_console.quote_line_items SET is_instructed = false WHERE quote_id = $1`,
      [id]
    );

    // If fully instructed, mark all line items as instructed
    if (instructionStatus === 'instructed') {
      await client.query(
        `UPDATE admin_console.quote_line_items SET is_instructed = true WHERE quote_id = $1`,
        [id]
      );
    }
    // If partially instructed, mark only selected line items as instructed
    else if (instructionStatus === 'partially instructed' && selectedLineItems && selectedLineItems.length > 0) {
      // Mark selected items as instructed
      await client.query(
        `UPDATE admin_console.quote_line_items SET is_instructed = true WHERE quote_id = $1 AND id = ANY($2)`,
        [id, selectedLineItems]
      );

      // Calculate total from selected line items
      const totalQuery = `
        SELECT SUM(cost) as total
        FROM admin_console.quote_line_items
        WHERE quote_id = $1 AND id = ANY($2)
      `;
      const totalResult = await client.query(totalQuery, [id, selectedLineItems]);
      partiallyInstructedTotal = totalResult.rows[0]?.total || 0;
    }

    // Update quote
    const updateQuery = `
      UPDATE admin_console.quotes
      SET
        instruction_status = $1,
        partially_instructed_total = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      instructionStatus,
      partiallyInstructedTotal,
      id
    ]);

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
 * Update quote notes
 */
export async function updateQuoteNotes(id, notes) {
  const query = `
    UPDATE admin_console.quotes
    SET
      quote_notes = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [notes, id]);
  return result.rows[0];
}

/**
 * Update quote work status
 */
export async function updateQuoteWorkStatus(id, workStatus) {
  const query = `
    UPDATE admin_console.quotes
    SET
      work_status = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [workStatus, id]);
  return result.rows[0];
}

/**
 * Update quote dependencies
 */
export async function updateQuoteDependencies(id, dependencies) {
  const query = `
    UPDATE admin_console.quotes
    SET
      dependencies = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [dependencies, id]);
  return result.rows[0];
}

/**
 * Update quote operational notes
 */
export async function updateQuoteOperationalNotes(id, operationalNotes) {
  const query = `
    UPDATE admin_console.quotes
    SET
      operational_notes = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [operationalNotes, id]);
  return result.rows[0];
}

/**
 * Update quote review
 */
export async function updateQuoteReview(id, reviewData) {
  const query = `
    UPDATE admin_console.quotes
    SET
      quality = $1,
      responsiveness = $2,
      delivered_on_time = $3,
      overall_review = $4,
      review_notes = $5,
      review_date = NOW(),
      updated_at = NOW()
    WHERE id = $6
    RETURNING *
  `;

  // Ensure values are null if undefined (PostgreSQL doesn't handle undefined)
  const params = [
    reviewData.quality ?? null,
    reviewData.responsiveness ?? null,
    reviewData.delivered_on_time ?? null,
    reviewData.overall_review ?? null,
    reviewData.review_notes ?? null,
    id
  ];

  console.log('updateQuoteReview - id:', id, 'params:', params);

  const result = await pool.query(query, params);
  const updatedQuote = result.rows[0];

  // Refresh the surveyor organisation's aggregated ratings
  if (updatedQuote?.surveyor_organisation_id) {
    try {
      await refreshSurveyorRatings(updatedQuote.surveyor_organisation_id);
      console.log('Refreshed ratings for surveyor org:', updatedQuote.surveyor_organisation_id);
    } catch (err) {
      console.error('Failed to refresh surveyor ratings:', err);
      // Don't throw - the review was saved successfully
    }
  }

  return updatedQuote;
}

/**
 * Delete a quote (cascades to line items)
 */
export async function deleteQuote(id) {
  const query = `
    DELETE FROM admin_console.quotes
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
}

/**
 * Update a quote with line items
 */
export async function updateQuote(id, data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update quote
    const quoteQuery = `
      UPDATE admin_console.quotes
      SET
        surveyor_organisation_id = $1,
        contact_id = $2,
        discipline = $3,
        total = $4,
        quote_notes = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const quoteResult = await client.query(quoteQuery, [
      data.surveyor_organisation_id,
      data.contact_id || null,
      data.discipline,
      data.total,
      data.quote_notes || null,
      id
    ]);

    if (quoteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Delete existing line items
    await client.query(
      'DELETE FROM admin_console.quote_line_items WHERE quote_id = $1',
      [id]
    );

    // Insert new line items if provided
    if (data.line_items && data.line_items.length > 0) {
      const lineItemQuery = `
        INSERT INTO admin_console.quote_line_items (
          quote_id,
          item,
          description,
          cost
        ) VALUES ($1, $2, $3, $4)
      `;

      for (const item of data.line_items) {
        await client.query(lineItemQuery, [
          id,
          item.item,
          item.description || '',
          item.cost
        ]);
      }
    }

    await client.query('COMMIT');

    // Return the complete updated quote with line items
    return await getQuoteById(id);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
