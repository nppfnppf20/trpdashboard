/**
 * Surveyor Organisations Service
 * Business logic for surveyor management
 */

import { pool } from '../db.js';

/**
 * Get all surveyor organisations with contacts and stored ratings
 */
export async function getAllSurveyorOrganisations() {
  const query = `
    SELECT
      so.id,
      so.organisation,
      so.discipline,
      so.location,
      so.notes,
      so.approval_status,
      so.created_at,
      so.updated_at,

      -- Stored ratings (pre-calculated)
      so.avg_quality,
      so.avg_responsiveness,
      so.avg_on_time,
      so.avg_overall,
      so.total_reviews,
      so.all_review_notes,
      so.ratings_updated_at,

      -- Aggregate contacts
      json_agg(
        DISTINCT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'phone_number', c.phone_number,
          'is_primary', c.is_primary
        )
      ) FILTER (WHERE c.id IS NOT NULL) as contacts,

      -- Count quotes by status (still calculated live as these change frequently)
      COUNT(DISTINCT q.id) FILTER (WHERE q.instruction_status = 'pending') as pending_quotes,
      COUNT(DISTINCT q.id) FILTER (WHERE q.instruction_status IN ('instructed', 'partially instructed')) as instructed_quotes,
      COUNT(DISTINCT q.id) FILTER (WHERE q.work_status = 'completed') as completed_quotes

    FROM admin_console.surveyor_organisations so
    LEFT JOIN admin_console.contacts c ON c.organisation_id = so.id AND c.organisation_type = 'surveyor'
    LEFT JOIN admin_console.quotes q ON q.surveyor_organisation_id = so.id
    GROUP BY so.id, so.organisation, so.discipline, so.location, so.notes, so.approval_status, so.created_at, so.updated_at,
             so.avg_quality, so.avg_responsiveness, so.avg_on_time, so.avg_overall, so.total_reviews, so.all_review_notes, so.ratings_updated_at
    ORDER BY so.organisation, so.discipline
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get single surveyor organisation by ID
 */
export async function getSurveyorOrganisationById(id) {
  const query = `
    SELECT
      so.id,
      so.organisation,
      so.discipline,
      so.location,
      so.notes,
      so.approval_status,
      so.created_at,
      so.updated_at,

      -- Stored ratings
      so.avg_quality,
      so.avg_responsiveness,
      so.avg_on_time,
      so.avg_overall,
      so.total_reviews,
      so.all_review_notes,
      so.ratings_updated_at,

      json_agg(
        DISTINCT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'phone_number', c.phone_number,
          'is_primary', c.is_primary
        )
      ) FILTER (WHERE c.id IS NOT NULL) as contacts

    FROM admin_console.surveyor_organisations so
    LEFT JOIN admin_console.contacts c ON c.organisation_id = so.id AND c.organisation_type = 'surveyor'
    WHERE so.id = $1
    GROUP BY so.id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Create a new surveyor organisation with optional contacts
 */
export async function createSurveyorOrganisation(data) {
  const { organisation, discipline, location, notes, approval_status, small_business, contacts = [] } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgResult = await client.query(
      `INSERT INTO admin_console.surveyor_organisations (organisation, discipline, location, notes, approval_status, small_business)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [organisation, discipline, location || null, notes || null, approval_status || 'approved', small_business || null]
    );
    const orgId = orgResult.rows[0].id;

    for (const contact of contacts) {
      await client.query(
        `INSERT INTO admin_console.contacts (name, email, phone_number, organisation_id, organisation_type, is_primary)
         VALUES ($1, $2, $3, $4, 'surveyor', $5)`,
        [contact.name, contact.email || null, contact.phone_number || null, orgId, contact.is_primary || false]
      );
    }

    await client.query('COMMIT');
    return getSurveyorOrganisationById(orgId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update a surveyor organisation and replace its contacts
 */
export async function updateSurveyorOrganisation(id, data) {
  const { organisation, discipline, location, notes, approval_status, small_business, contacts = [] } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE admin_console.surveyor_organisations
       SET organisation = $1, discipline = $2, location = $3, notes = $4,
           approval_status = $5, small_business = $6, updated_at = now()
       WHERE id = $7`,
      [organisation, discipline, location || null, notes || null, approval_status || 'approved', small_business || null, id]
    );

    // Replace contacts: delete existing, insert new
    await client.query(
      `DELETE FROM admin_console.contacts WHERE organisation_id = $1 AND organisation_type = 'surveyor'`,
      [id]
    );

    for (const contact of contacts) {
      await client.query(
        `INSERT INTO admin_console.contacts (name, email, phone_number, organisation_id, organisation_type, is_primary)
         VALUES ($1, $2, $3, $4, 'surveyor', $5)`,
        [contact.name, contact.email || null, contact.phone_number || null, id, contact.is_primary || false]
      );
    }

    await client.query('COMMIT');
    return getSurveyorOrganisationById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a surveyor organisation (contacts cascade via FK or deleted explicitly)
 */
export async function deleteSurveyorOrganisation(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM admin_console.contacts WHERE organisation_id = $1 AND organisation_type = 'surveyor'`,
      [id]
    );
    await client.query(
      `DELETE FROM admin_console.surveyor_organisations WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Refresh ratings for a single surveyor organisation
 */
export async function refreshSurveyorRatings(surveyorOrgId) {
  const query = `SELECT admin_console.refresh_surveyor_ratings($1)`;
  await pool.query(query, [surveyorOrgId]);
}

/**
 * Refresh ratings for all surveyor organisations
 */
export async function refreshAllSurveyorRatings() {
  const query = `SELECT admin_console.refresh_all_surveyor_ratings()`;
  await pool.query(query);
}

