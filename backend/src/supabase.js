/**
 * Supabase Client Configuration
 * Provides admin client (bypasses RLS) and user-context client factory
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn('Warning: SUPABASE_URL not set');
}

if (!supabaseServiceKey) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY not set');
}

/**
 * Admin Supabase client - uses service role key
 * Bypasses Row Level Security - use for admin operations only
 */
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Create a Supabase client with user's JWT token
 * Respects Row Level Security based on user's role
 * @param {string} accessToken - User's JWT access token
 * @returns {SupabaseClient} Supabase client instance
 */
export function createSupabaseClient(accessToken) {
  return createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
