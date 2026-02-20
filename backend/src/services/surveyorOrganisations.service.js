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

