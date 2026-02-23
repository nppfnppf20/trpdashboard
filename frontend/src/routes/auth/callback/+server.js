import { redirect } from '@sveltejs/kit';

export async function GET({ url, locals: { supabase } }) {
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');

  // Handle token-based links (invite, password reset)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      // Send invite and recovery flows to the set-password page
      if (type === 'invite' || type === 'recovery') {
        throw redirect(303, '/auth/reset-password');
      }
      throw redirect(303, '/');
    }

    console.error('OTP verification error:', error.message);
    throw redirect(303, '/auth/login?error=invalid_link');
  }

  // Handle OAuth / PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      throw redirect(303, '/');
    }

    console.error('Code exchange error:', error.message);
    throw redirect(303, '/auth/login?error=invalid_link');
  }

  // Nothing to process
  throw redirect(303, '/auth/login');
}
