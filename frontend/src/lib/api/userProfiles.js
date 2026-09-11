/**
 * User Profiles API Client
 * Frontend API methods for the app-account directory and login-time sync
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/users';

/**
 * Get every synced user profile (id, display_name, avatar_url, role)
 * @returns {Promise<Array<Object>>}
 */
export async function getUsers() {
  const response = await authFetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Get every project where the given user is linked as lead, manager, or
 * director (via project_lead_user_id / project_manager_user_id / project_director_user_id).
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
export async function getProjectsForUser(userId) {
  const response = await authFetch(`${API_BASE_URL}/${userId}/projects`);

  if (!response.ok) {
    throw new Error('Failed to fetch projects for user');
  }

  return response.json();
}

/**
 * Upsert the logged-in user's own profile row from their Supabase account.
 * Called once per session on login — safe to call repeatedly.
 * @returns {Promise<Object>}
 */
export async function syncMyProfile() {
  const response = await authFetch(`${API_BASE_URL}/me/sync`, { method: 'POST' });

  if (!response.ok) {
    throw new Error('Failed to sync user profile');
  }

  return response.json();
}
