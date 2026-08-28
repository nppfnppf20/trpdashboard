<script>
  import { goto } from '$app/navigation';
  import { signUpWithEmail } from '$lib/supabase.js';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    success = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }

    loading = true;

    try {
      const { data, error: authError } = await signUpWithEmail(email, password);

      if (authError) {
        error = authError.message;
        return;
      }

      success = 'Account created! Please check your email to confirm your account.';
    } catch (err) {
      error = err.message || 'An error occurred during sign up';
    } finally {
      loading = false;
    }
  }
</script>

<h3 style="font-size: 1.125rem; font-weight: 500; color: var(--color-slate-900); margin-bottom: 1.5rem;">Create your account</h3>

{#if error}
  <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-red-50); border: 1px solid var(--color-red-200); color: var(--color-red-800); border-radius: 0.375rem; font-size: 0.875rem;">
    {error}
  </div>
{/if}

{#if success}
  <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-slate-100); border: 1px solid var(--color-emerald-100); color: var(--color-green-800); border-radius: 0.375rem; font-size: 0.875rem;">
    {success}
  </div>
{/if}

<form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 1.5rem;">
  <div>
    <label for="email" style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-slate-700); margin-bottom: 0.25rem;">
      Email address
    </label>
    <input
      id="email"
      type="email"
      bind:value={email}
      required
      style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-300); border-radius: 0.375rem; box-shadow: var(--shadow-sm); box-sizing: border-box;"
    />
  </div>

  <div>
    <label for="password" style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-slate-700); margin-bottom: 0.25rem;">
      Password
    </label>
    <input
      id="password"
      type="password"
      bind:value={password}
      required
      style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-300); border-radius: 0.375rem; box-shadow: var(--shadow-sm); box-sizing: border-box;"
    />
  </div>

  <div>
    <label for="confirmPassword" style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-slate-700); margin-bottom: 0.25rem;">
      Confirm Password
    </label>
    <input
      id="confirmPassword"
      type="password"
      bind:value={confirmPassword}
      required
      style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-300); border-radius: 0.375rem; box-shadow: var(--shadow-sm); box-sizing: border-box;"
    />
  </div>

  <button
    type="submit"
    disabled={loading}
    style="width: 100%; display: flex; justify-content: center; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; box-shadow: var(--shadow-sm); font-size: 0.875rem; font-weight: 500; color: var(--color-white); background: var(--color-primary-600); cursor: pointer; {loading ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
  >
    {loading ? 'Creating account...' : 'Sign up'}
  </button>
</form>

<p style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem; color: var(--color-slate-600);">
  Already have an account?
  <a href="/auth/login" style="font-weight: 500; color: var(--color-primary-600); text-decoration: none;">
    Sign in
  </a>
</p>
