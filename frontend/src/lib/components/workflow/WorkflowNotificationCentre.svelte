<script>
  import { onMount } from 'svelte';
  import WorkflowNotificationFilters from './WorkflowNotificationFilters.svelte';
  import WorkflowNotificationFeed from './WorkflowNotificationFeed.svelte';
  import { getNotifications } from '$lib/services/workflowApi.js';

  export let currentUserName = null;

  let scope = 'team';
  let filters = { projectId: null, sourceType: null, dateFrom: null, dateTo: null };
  let items = [];
  let loading = false;
  let error = null;

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await getNotifications({
        scope,
        userName: scope === 'mine' ? currentUserName : undefined,
        ...filters
      });
      items = res.items;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleFiltersChange(event) {
    filters = event.detail;
    load();
  }

  onMount(load);
</script>

<div class="notification-centre">
  <div class="centre-controls">
    <div class="scope-toggle">
      <button class="btn {scope === 'team' ? 'btn-primary' : 'btn-secondary'}" on:click={() => { scope = 'team'; load(); }}>
        <i class="las la-users"></i> Team Feed
      </button>
      <button class="btn {scope === 'mine' ? 'btn-primary' : 'btn-secondary'}" on:click={() => { scope = 'mine'; load(); }} disabled={!currentUserName}>
        <i class="las la-user"></i> My Feed
      </button>
    </div>
    <WorkflowNotificationFilters {filters} on:change={handleFiltersChange} />
  </div>

  {#if loading}
    <div class="loading-state"><div class="spinner"></div><p>Loading notifications…</p></div>
  {:else if error}
    <div class="error-state"><i class="las la-exclamation-circle"></i><p>Error: {error}</p></div>
  {:else}
    <WorkflowNotificationFeed {items} />
  {/if}
</div>

<style>
  .notification-centre {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .centre-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.875rem 1.25rem;
  }

  .scope-toggle {
    display: flex;
    gap: 0.5rem;
    border-right: 1px solid #e2e8f0;
    padding-right: 1rem;
  }
</style>
