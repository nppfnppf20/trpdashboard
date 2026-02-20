/**
 * Auth Store
 * Reactive state management for authentication
 */

import { writable, derived, get } from 'svelte/store';
import { supabase, getUserRole, signOut as supabaseSignOut } from '$lib/supabase.js';
import { goto } from '$app/navigation';

// Core auth state
export const user = writable(null);
export const session = writable(null);
export const userRole = writable('viewer');
export const loading = writable(true);
export const sessionIdle = writable(false);

// Derived stores for convenience
export const isAuthenticated = derived(session, $session => !!$session);
export const isAdmin = derived(userRole, $role => $role === 'admin');
export const isSurveyor = derived(userRole, $role => $role === 'admin' || $role === 'surveyor');
export const isClient = derived(userRole, $role => ['admin', 'surveyor', 'client'].includes($role));

/**
 * Initialize auth state and set up listeners
 * Call this once on app startup.
 *
 * Registers onAuthStateChange FIRST so the token refresh that fires
 * after idle is the single source-of-truth.  Loading stays true until
 * the first auth event has been fully processed (including role fetch).
 */
export async function initAuth() {
  loading.set(true);

  supabase.auth.onAuthStateChange(async (event, newSession) => {
    console.log('Auth state changed:', event);

    if (newSession) {
      if (event === 'INITIAL_SESSION') {
        // First load – full initialisation
        session.set(newSession);
        user.set(newSession.user);
        try {
          const role = await getUserRole(newSession.user.id);
          userRole.set(role);
        } catch (e) {
          console.warn('Failed to fetch user role:', e);
          userRole.set('viewer');
        }
      }
      // SIGNED_IN / TOKEN_REFRESHED: do nothing.
      // The Supabase client already has the fresh token internally,
      // and getAccessToken() reads from it directly.
    } else {
      const hadSession = get(session) !== null;
      session.set(null);
      user.set(null);
      userRole.set('viewer');

      // If the user previously had a session, their session has expired
      // or they were signed out — redirect to login with a message
      if (hadSession || event === 'SIGNED_OUT') {
        loading.set(false);
        goto('/auth/login?expired=1');
        return;
      }
    }

    loading.set(false);
  });
}

/**
 * Sign out and clear auth state
 */
export async function signOut() {
  loading.set(true);

  try {
    const { error } = await supabaseSignOut();

    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }

    // Clear local state
    session.set(null);
    user.set(null);
    userRole.set('viewer');
  } finally {
    loading.set(false);
  }
}

/**
 * Check whether a JWT access token is expired or about to expire
 * @param {string} token
 * @param {number} [bufferMs=60000] - consider expired this many ms before real expiry
 * @returns {boolean}
 */
function isTokenExpired(token, bufferMs = 60_000) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 - Date.now() < bufferMs;
  } catch {
    return true;
  }
}

/**
 * Get current access token for API calls.
 * If the token is expired or about to expire, forces a refresh
 * so callers never send a stale JWT to the backend.
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // If the token is still fresh, return it immediately
    if (currentSession?.access_token && !isTokenExpired(currentSession.access_token)) {
      return currentSession.access_token;
    }

    // Token missing or expired – force a refresh using the refresh token
    const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
    if (error || !refreshedSession) {
      console.warn('Token refresh failed:', error?.message);
      return null;
    }

    // Keep stores in sync
    session.set(refreshedSession);
    user.set(refreshedSession.user);

    return refreshedSession.access_token;
  } catch (error) {
    console.warn('Failed to get access token:', error.message);
    return null;
  }
}
