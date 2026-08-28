<script>
  import { supabase } from '$lib/supabase.js';
  import { goto } from '$app/navigation';

  let password = $state('');
  let confirm = $state('');
  let error = $state('');
  let loading = $state(false);
  let done = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';

    if (password !== confirm) {
      error = 'Passwords do not match.';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }

    loading = true;

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      error = updateError.message;
      loading = false;
      return;
    }

    done = true;
    setTimeout(() => goto('/'), 2000);
  }
</script>

<h3 style="font-size: 1.125rem; font-weight: 500; color: var(--color-slate-900); margin-bottom: 1.5rem;">Set your password</h3>

{#if done}
  <div style="padding: 0.75rem; background: var(--color-slate-100); border: 1px solid var(--color-emerald-100); color: var(--color-green-800); border-radius: 0.375rem; font-size: 0.875rem;">
    Password set successfully. Redirecting…
  </div>
{:else}
  {#if error}
    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-red-50); border: 1px solid var(--color-red-200); color: var(--color-red-800); border-radius: 0.375rem; font-size: 0.875rem;">
      {error}
    </div>
  {/if}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 1.5rem;">
    <div>
      <label for="password" style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-slate-700); margin-bottom: 0.25rem;">
        New password
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
      <label for="confirm" style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--color-slate-700); margin-bottom: 0.25rem;">
        Confirm password
      </label>
      <input
        id="confirm"
        type="password"
        bind:value={confirm}
        required
        style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-300); border-radius: 0.375rem; box-shadow: var(--shadow-sm); box-sizing: border-box;"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      style="width: 100%; display: flex; justify-content: center; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; color: var(--color-white); background: var(--color-primary-600); cursor: pointer; {loading ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
    >
      {loading ? 'Saving…' : 'Set password'}
    </button>
  </form>
{/if}
