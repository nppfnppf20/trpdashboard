<script>
  import { onMount } from 'svelte';
  import { getTopics, getTimeline } from '$lib/api/ingestion.js';
  import TopicsPanel from './TopicsPanel.svelte';
  import TimelineGrid from './TimelineGrid.svelte';

  export let project;   // full project object — we need project.id

  $: projectId = project?.id;

  let activeTab = 'topics';
  let topics = [];
  let timeline = { issues: [], documents: [] };
  let loading = true;
  let error = null;

  onMount(() => {
    if (projectId) loadAll();
  });

  $: if (projectId) loadAll();

  async function loadAll() {
    loading = true;
    error = null;
    try {
      topics = await getTopics(projectId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadTimeline() {
    try {
      timeline = await getTimeline(projectId);
    } catch (err) {
      console.error('Timeline load failed:', err);
    }
  }

  async function handleTopicsChanged() {
    topics = await getTopics(projectId);
  }

  // Load timeline data when switching to the tab
  $: if (activeTab === 'timeline') loadTimeline();
</script>

<div class="ingestion-panel">
  <!-- Sub-tab nav -->
  <div class="sub-tabs">
    <button class="sub-tab" class:active={activeTab === 'topics'} on:click={() => activeTab = 'topics'}>
      <i class="las la-tags"></i> Topics
      {#if topics.length > 0}<span class="count-badge">{topics.length}</span>{/if}
    </button>
    <button class="sub-tab" class:active={activeTab === 'timeline'} on:click={() => activeTab = 'timeline'}>
      <i class="las la-chart-bar"></i> Timeline
    </button>
  </div>

  <div class="panel-body">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading…</p>
      </div>
    {:else if error}
      <div class="error-state">
        <i class="las la-exclamation-circle"></i>
        <p>{error}</p>
        <button on:click={loadAll}>Retry</button>
      </div>
    {:else if activeTab === 'topics'}
      <div class="tab-content scrollable">
        <TopicsPanel
          {topics}
          {projectId}
          onTopicsChanged={handleTopicsChanged}
        />
      </div>

    {:else if activeTab === 'timeline'}
      <div class="tab-content timeline-tab">
        <TimelineGrid
          issues={timeline.issues}
          documents={timeline.documents}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .ingestion-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sub-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    padding: 0 0.5rem;
  }

  .sub-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    position: relative;
  }
  .sub-tab.active { color: var(--color-purple-600); border-bottom-color: var(--color-purple-600); }
  .sub-tab:hover:not(.active) { color: var(--color-slate-800); }

  .count-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--color-violet-100);
    color: var(--color-purple-700);
    padding: 0.1rem 0.4rem;
    border-radius: 20px;
    min-width: 16px;
    text-align: center;
  }

.panel-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tab-content {
    flex: 1;
    min-height: 0;
  }

  .tab-content.scrollable {
    overflow-y: auto;
    padding: 1.25rem;
  }

  .tab-content.timeline-tab {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
  }

  .divider {
    height: 1px;
    background: var(--color-slate-200);
    margin: 1.25rem 0;
  }

.loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
    padding: 3rem;
  }
  .error-state i { font-size: 2rem; color: var(--color-red-500); }
  .error-state button {
    padding: 0.5rem 1rem; background: var(--color-purple-600); color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }

  .spinner {
    width: 2.5rem; height: 2.5rem;
    border: 3px solid var(--color-slate-100); border-top-color: var(--color-purple-600);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-docs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--color-slate-400);
    text-align: center;
  }
  .empty-docs i { font-size: 2rem; }
  .empty-docs p { margin: 0; font-size: 0.875rem; }
</style>
