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
