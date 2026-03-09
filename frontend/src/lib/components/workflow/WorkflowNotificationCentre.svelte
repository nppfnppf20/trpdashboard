<script>
  import { onMount } from 'svelte';
  import WorkflowNotificationFilters from './WorkflowNotificationFilters.svelte';
  import WorkflowNotificationFeed from './WorkflowNotificationFeed.svelte';
  import { getNotifications } from '$lib/services/workflowApi.js';

  export let currentUserName = null;

  let scope = 'team'; // 'team' | 'mine'
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

  function handleScopeChange(newScope) {
    scope = newScope;
    load();
  }

  onMount(load);
</script>

<div class="notification-centre">
  <!-- Scope toggle -->
  <div class="scope-toggle">
    <button
      class="scope-btn"
      class:active={scope === 'team'}
      on:click={() => handleScopeChange('team')}
    >
      <i class="las la-users"></i>
      Team Feed
    </button>
    <button
      class="scope-btn"
      class:active={scope === 'mine'}
      on:click={() => handleScopeChange('mine')}
      disabled={!currentUserName}
      title={!currentUserName ? 'No user name available' : undefined}
    >
      <i class="las la-user"></i>
      My Feed
    </button>
  </div>

  <WorkflowNotificationFilters {filters} on:change={handleFiltersChange} />

  {#if loading}
    <div class="state-message">
      <i class="las la-spinner la-spin"></i>
      Loading notifications…
    </div>
  {:else if error}
    <div class="state-message error">
      <i class="las la-exclamation-circle"></i>
      {error}
    </div>
  {:else}
    <WorkflowNotificationFeed {items} />
  {/if}
</div>

<style>
  .notification-centre {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .scope-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .scope-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 2rem;
    background: white;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .scope-btn:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .scope-btn.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .scope-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .state-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #64748b;
    font-size: 0.9375rem;
    justify-content: center;
  }

  .state-message.error {
    color: #ef4444;
  }
</style>
