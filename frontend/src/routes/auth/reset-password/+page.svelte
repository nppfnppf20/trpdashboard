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

<h3 style="font-size: 1.125rem; font-weight: 500; color: #111827; margin-bottom: 1.5rem;">Set your password</h3>

{#if done}
  <div style="padding: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 0.375rem; font-size: 0.875rem;">
    Password set successfully. Redirecting…
  </div>
{:else}
  {#if error}
    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 0.375rem; font-size: 0.875rem;">
      {error}
    </div>
  {/if}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 1.5rem;">
    <div>
      <label for="password" style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem;">
        New password
      </label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); box-sizing: border-box;"
      />
    </div>

    <div>
      <label for="confirm" style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem;">
        Confirm password
      </label>
      <input
        id="confirm"
        type="password"
        bind:value={confirm}
        required
        style="margin-top: 0.25rem; display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); box-sizing: border-box;"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      style="width: 100%; display: flex; justify-content: center; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; color: white; background: #2563eb; cursor: pointer; {loading ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
    >
      {loading ? 'Saving…' : 'Set password'}
    </button>
  </form>
{/if}
