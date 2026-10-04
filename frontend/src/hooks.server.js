import { createServerClient } from '@supabase/ssr';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/public';

/** @type {import('@sveltejs/kit').Handle} */
async function authHandle({ event, resolve }) {
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

// Security headers for every page the frontend serves (ASVS V3.4.1, V4.1.1, V3.2.1).
// The backend API sets its own via helmet; this covers the SvelteKit server.
/** @type {import('@sveltejs/kit').Handle} */
async function securityHeaders({ event, resolve }) {
  const response = await resolve(event);

  // Some responses (e.g. proxied fetch responses) have immutable headers; never let that break a request.
  try {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    // Not 'no-referrer': OpenStreetMap-style tile servers expect a referer.
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Microphone is used for voice dictation; nothing else needs camera/mic.
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(self)');

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('text/html') && !/charset=/i.test(contentType)) {
      response.headers.set('Content-Type', `${contentType}; charset=utf-8`);
    }
  } catch {
    // headers are immutable on this response — skip
  }

  return response;
}

export const handle = sequence(securityHeaders, authHandle);
