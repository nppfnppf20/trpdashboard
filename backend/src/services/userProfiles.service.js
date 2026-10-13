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

// Cross-project "my actions" — meeting actions assigned to this account.
export async function getMeetingActionsForUser(userId, status = null) {
  const params = [userId];
  if (status) params.push(status);
  const result = await pool.query(
    `SELECT a.*, t.title AS meeting_title, t.meeting_date, p.project_name
     FROM planning_applications.meeting_actions a
     LEFT JOIN planning_applications.meeting_transcripts t ON t.id = a.transcript_id
     LEFT JOIN public.projects p ON p.id = a.project_id
     WHERE a.assigned_user_id = $1${status ? ' AND a.status = $2' : ''}
     ORDER BY
       CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
       a.due_date ASC,
       a.created_at ASC`,
    params
  );
  return result.rows;
}

// Prefers the name on file in admin_console.team_members (matched by login
// email) over the Supabase-supplied fallback, since most accounts don't have
// user_metadata.full_name set — without this, display_name silently falls
// back to the raw email, which then can't exact-match the "First Last"
// strings in projects.project_lead/manager/director (see 166_backfill_*.sql).
export async function upsertUserProfile({ id, email, fallbackDisplayName, avatarUrl = null }) {
  const result = await pool.query(
    `INSERT INTO public.user_profiles (id, display_name, avatar_url, updated_at)
     VALUES (
       $1,
       COALESCE(
         (SELECT first_name || ' ' || last_name FROM admin_console.team_members WHERE LOWER(email) = LOWER($4)),
         $2
       ),
       $3,
       now()
     )
     ON CONFLICT (id) DO UPDATE
       SET display_name = COALESCE(
             (SELECT first_name || ' ' || last_name FROM admin_console.team_members WHERE LOWER(email) = LOWER($4)),
             EXCLUDED.display_name
           ),
           avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
           updated_at = now()
     RETURNING id, display_name, avatar_url, created_at, updated_at`,
    [id, fallbackDisplayName, avatarUrl, email]
  );
  return result.rows[0];
}
