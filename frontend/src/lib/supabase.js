/**
 * Supabase Client for Browser
 * Used for authentication and user-context operations
 */

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Auth will not work.');
}

/**
 * Browser Supabase client
 * Uses SSR-compatible client for SvelteKit with cookie-based storage
 * This ensures browser and server share the same session
 */
export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    cookies: {
      getAll: () => {
        if (typeof document === 'undefined') return [];
        return document.cookie.split(';').map(cookie => {
          const [name, ...rest] = cookie.trim().split('=');
          return { name, value: rest.join('=') };
        }).filter(c => c.name);
      },
      setAll: (cookiesToSet) => {
        if (typeof document === 'undefined') return;
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookie = `${name}=${value}`;
          if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`;
          if (options?.path) cookie += `; Path=${options.path}`;
          if (options?.domain) cookie += `; Domain=${options.domain}`;
          if (options?.secure) cookie += '; Secure';
          if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`;
          document.cookie = cookie;
        });
      }
    }
  }
);

/**
 * Get current session
 * @returns {Promise<Session|null>}
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

/**
 * Get current user
 * @returns {Promise<User|null>}
 */
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: AuthResponse, error: Error|null}>}
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

/**
 * Sign up with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: AuthResponse, error: Error|null}>}
 */
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  return { data, error };
}

/**
 * Sign out current user
 * @returns {Promise<{error: Error|null}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get user's role from user_roles table
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return 'viewer'; // Default role
  }

  return data?.role || 'viewer';
}
