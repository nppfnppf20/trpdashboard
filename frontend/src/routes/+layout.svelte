<script>
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { onMount } from 'svelte';
  import { initAuth, loading, sessionIdle } from '$lib/stores/auth.js';

  let { children } = $props();

  onMount(() => {
    initAuth();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if $sessionIdle}
  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
    <div style="background: white; border-radius: 0.5rem; padding: 2rem; max-width: 400px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.15);">
      <p style="margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; color: #111827;">Session Idle</p>
      <p style="margin: 0 0 1.5rem; font-size: 0.875rem; color: #4b5563;">Your session is idle. Please reload the page to continue.</p>
      <button
        onclick={() => window.location.reload()}
        style="padding: 0.5rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;"
      >Reload Page</button>
    </div>
  </div>
{/if}

{#if $loading}
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="color: #4b5563; font-size: 1rem;">Loading...</div>
  </div>
{:else}
  {@render children?.()}
{/if}
