import { createServerClient } from '@supabase/ssr';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

export async function handle({ event, resolve }) {
  // Create Supabase client for server-side
  event.locals.supabase = createServerClient(
    env.PUBLIC_SUPABASE_URL,
    env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        }
      }
    }
  );

  // Get session with error handling for expired/invalid tokens
  event.locals.getSession = async () => {
    try {
      const { data: { session }, error } = await event.locals.supabase.auth.getSession();
      if (error) {
        console.warn('Session error:', error.message);
        return null;
      }
      return session;
    } catch (error) {
      console.warn('Failed to get session:', error.message);
      return null;
    }
  };

  const session = await event.locals.getSession();
  const pathname = event.url.pathname;

  // Allow auth routes without session
  if (pathname.startsWith('/auth')) {
    // If already logged in, redirect to home
    if (session && pathname !== '/auth/callback') {
      throw redirect(303, '/');
    }
    return resolve(event);
  }

  // Protect all other routes
  if (!session) {
    throw redirect(303, '/auth/login');
  }

  return resolve(event);
}
