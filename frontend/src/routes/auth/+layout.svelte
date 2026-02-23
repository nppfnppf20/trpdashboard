<script>
  import '../../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';

  let { children } = $props();

  onMount(() => {
    // Supabase sends recovery tokens as hash fragments (#access_token=...&type=recovery).
    // The PASSWORD_RECOVERY event can fire before onMount, so we handle both cases:
    // 1. Event fires after mount  → caught by the listener below
    // 2. Event already fired      → detected by inspecting the hash + checking the session

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goto('/auth/reset-password');
      }
    });

    // Fallback: if the event already fired before this listener was registered
    if (window.location.hash.includes('type=recovery')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) goto('/auth/reset-password');
      });
    }

    return () => subscription.unsubscribe();
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
