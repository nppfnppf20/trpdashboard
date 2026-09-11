<script>
  import { onMount } from 'svelte';
  import { getUsers } from '$lib/api/userProfiles.js';
  import { openProfile } from '$lib/stores/projectViewModal.js';

  let users = [];
  let loading = true;
  let error = null;

  onMount(async () => {
    try {
      users = await getUsers();
    } catch (err) {
      console.error('Failed to load team directory:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  });

  function initials(name) {
    if (!name) return '?';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }
</script>

<div class="team-page">
  <header class="page-header">
    <h1 class="page-title">Team</h1>
    <p class="page-subtitle">Everyone who's logged into the dashboard. Open a profile to see their projects.</p>
  </header>

  {#if loading}
    <div class="state-message">Loading...</div>
  {:else if error}
    <div class="state-message error">{error}</div>
  {:else if users.length === 0}
    <div class="state-message">No team members found yet.</div>
  {:else}
    <div class="team-grid">
      {#each users as u (u.id)}
        <button type="button" class="team-card" on:click={() => openProfile(u.id)}>
          <div class="avatar">{initials(u.display_name)}</div>
          <div class="team-card-text">
            <div class="team-card-name">{u.display_name}</div>
            {#if u.role}<div class="team-card-role">{u.role}</div>{/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .team-page {
    background: var(--color-slate-50);
    padding: 1.5rem 2rem;
  }

  .page-header {
    margin-bottom: 1.25rem;
  }

  .page-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    margin: 0;
    max-width: 560px;
    line-height: 1.5;
  }

  .state-message {
    color: var(--color-slate-500);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .state-message.error {
    color: var(--color-red-600);
  }

  .team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .team-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.875rem 1rem;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .team-card:hover {
    border-color: var(--color-primary-300);
    box-shadow: var(--shadow-sm);
  }

  .avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .team-card-text {
    min-width: 0;
  }

  .team-card-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .team-card-role {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    text-transform: capitalize;
  }
</style>
