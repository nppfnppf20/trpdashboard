<script>
  import { signOut } from '$lib/supabase.js';
  import { goto } from '$app/navigation';

  async function handleSignOut() {
    await signOut();
    goto('/auth/login');
  }
</script>

<h3 style="font-size: 1.125rem; font-weight: 500; color: var(--color-slate-900); margin-bottom: 1rem;">Access restricted</h3>

<p style="font-size: 0.875rem; color: var(--color-slate-500); margin-bottom: 1.5rem;">
  Your account does not have permission to access this application.
  Please contact your administrator to request access.
</p>

<button
  onclick={handleSignOut}
  style="width: 100%; display: flex; justify-content: center; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; color: white; background: var(--color-primary-600); cursor: pointer;"
>
  Sign out
</button>
