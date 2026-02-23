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
    // Logged-in users are redirected to home, except for callback and unauthorized pages
    if (session && pathname !== '/auth/callback' && pathname !== '/auth/unauthorized' && pathname !== '/auth/reset-password') {
      throw redirect(303, '/');
    }
    return resolve(event);
  }

  // Protect all other routes — must be authenticated
  if (!session) {
    throw redirect(303, '/auth/login');
  }

  // Check the user has the admin role
  const { data: roleData } = await event.locals.supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  const role = roleData?.role || 'viewer';
  event.locals.userRole = role;

  if (role !== 'admin') {
    throw redirect(303, '/auth/unauthorized');
  }

  return resolve(event);
}
