<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { signInWithEmail } from '$lib/supabase.js';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let sessionExpired = $derived($page.url.searchParams.has('expired'));

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const { data, error: authError } = await signInWithEmail(email, password);

      if (authError) {
        error = authError.message;
        return;
      }

      // Redirect to home on success
      goto('/');
    } catch (err) {
      error = err.message || 'An error occurred during sign in';
    } finally {
      loading = false;
    }
  }
</script>

<h3 style="font-size: 1.125rem; font-weight: 500; color: var(--color-slate-900); margin-bottom: 1.5rem;">Sign in to your account</h3>

{#if sessionExpired}
  <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-red-50); border: 1px solid var(--color-amber-200); color: var(--color-amber-800); border-radius: 0.375rem; font-size: 0.875rem;">
    Your session has expired. Please sign in again.
  </div>
{/if}

{#if error}
  <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-red-50); border: 1px solid var(--color-red-200); color: var(--color-red-800); border-radius: 0.375rem; font-size: 0.875rem;">
    {error}
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

  <button
    type="submit"
    disabled={loading}
    style="width: 100%; display: flex; justify-content: center; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; box-shadow: var(--shadow-sm); font-size: 0.875rem; font-weight: 500; color: var(--color-white); background: var(--color-primary-600); cursor: pointer; {loading ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
  >
    {loading ? 'Signing in...' : 'Sign in'}
  </button>
</form>

<p style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem; color: var(--color-slate-600);">
  Don't have an account?
  <a href="/auth/signup" style="font-weight: 500; color: var(--color-primary-600); text-decoration: none;">
    Sign up
  </a>
</p>
