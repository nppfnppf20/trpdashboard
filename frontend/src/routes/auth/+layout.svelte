<script>
  import '../../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';

  let { children } = $props();

  onMount(() => {
    // Supabase sends recovery/invite tokens as a hash fragment:
    // #access_token=...&refresh_token=...&type=recovery
    // Hash fragments are never sent to the server, so we handle them here
    // by parsing the hash and calling setSession() explicitly.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if ((type === 'recovery' || type === 'invite') && accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (!error) goto('/auth/reset-password');
        });
    }
  });
</script>

<div style="min-height: 100vh; background: #f3f4f6; display: flex; flex-direction: column; justify-content: center; padding: 3rem 1.5rem;">
  <div style="margin: 0 auto; width: 100%; max-width: 28rem;">
    <h2 style="margin-top: 1.5rem; text-align: center; font-size: 2rem; font-weight: 800; color: #111827;">
      Login
    </h2>
  </div>

  <div style="margin-top: 2rem; margin-left: auto; margin-right: auto; width: 100%; max-width: 28rem;">
    <div style="background: white; padding: 2rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border-radius: 0.5rem;">
      {@render children?.()}
    </div>
  </div>
</div>
