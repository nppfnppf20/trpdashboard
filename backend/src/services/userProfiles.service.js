import { pool } from '../db.js';

export async function getAllUserProfiles() {
  const result = await pool.query(`
    SELECT up.id, up.display_name, up.avatar_url, ur.role
    FROM public.user_profiles up
    LEFT JOIN public.user_roles ur ON ur.user_id = up.id
    ORDER BY up.display_name
  `);
  return result.rows;
}

export async function getProjectsForUser(userId) {
  const result = await pool.query(
    `SELECT id, unique_id, project_id, project_name, project_type, local_planning_authority,
            project_lead, project_manager, project_director,
            project_lead_user_id, project_manager_user_id, project_director_user_id,
            address, area, client, client_spv_name, sectors, sub_sectors,
            designations_on_site, relevant_nearby_designations, status,
            case_officer_name, case_officer_email, case_officer_phone_number,
            lpa_reference, submission_date, validation_date,
            lpa_consultation_end_date, committee_date, target_determination_date,
            determined_date, expiry_of_1st_stat_period_date, eot_date,
            six_months_appeal_window_date, comments, development_type, development_types,
            about_applicant, created_at, updated_at
     FROM projects
     WHERE project_lead_user_id = $1
        OR project_manager_user_id = $1
        OR project_director_user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function upsertUserProfile({ id, displayName, avatarUrl = null }) {
  const result = await pool.query(
    `INSERT INTO public.user_profiles (id, display_name, avatar_url, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
           updated_at = now()
     RETURNING id, display_name, avatar_url, created_at, updated_at`,
    [id, displayName, avatarUrl]
  );
  return result.rows[0];
}
