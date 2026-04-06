<script>
  import { onMount } from 'svelte';
  import { getTopics, getDocuments, getTimeline } from '$lib/api/ingestion.js';
  import { authFetch } from '$lib/api/client.js';
  import TopicsPanel from './TopicsPanel.svelte';
  import DocumentUpload from './DocumentUpload.svelte';
  import DocumentCard from './DocumentCard.svelte';
  import TimelineGrid from './TimelineGrid.svelte';
  import ReviewConfirmScreen from './ReviewConfirmScreen.svelte';

  export let project;   // full project object — we need project.id

  $: projectId = project?.id;

  let activeTab = 'topics';
  let topics = [];
  let documents = [];
  let stages = [];
  let timeline = { issues: [], documents: [] };
  let loading = true;
  let error = null;

  // Review screen state
  let reviewDocumentId = null;

  onMount(() => {
    if (projectId) loadAll();
  });

  $: if (projectId) loadAll();

  async function loadAll() {
    loading = true;
    error = null;
    try {
      [topics, documents, stages] = await Promise.all([
        getTopics(projectId),
        getDocuments(projectId),
        fetchStages(projectId)
      ]);
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

  // Fetch project stage instances so DocumentUpload can show a dropdown
  async function fetchStages(pid) {
    try {
      const res = await authFetch(`/api/admin-console/workflow/projects/${pid}/stages`);
      if (!res.ok) return [];
      const data = await res.json();
      // data shape from workflow service: { stages: [...] }
      return (data.stages ?? []).map(s => ({
        instance_id: s.instance_id,
        stage_name: s.stage_name,
        user_guidance: s.user_guidance ?? null
      }));
    } catch {
      return [];
    }
  }

  async function handleTopicsChanged() {
    topics = await getTopics(projectId);
  }

  async function handleDocumentUploaded(result) {
    documents = await getDocuments(projectId);
    // If this was a preset-stage document, prompt user to review immediately
    if (result?.status === 'awaiting_review') {
      reviewDocumentId = result.documentId;
    }
    // Refresh timeline if on that tab
    if (activeTab === 'timeline') await loadTimeline();
  }

  async function handleConfirmed() {
    reviewDocumentId = null;
    documents = await getDocuments(projectId);
    if (activeTab === 'timeline') await loadTimeline();
  }

  function handleReview(doc) {
    reviewDocumentId = doc.id;
  }

  // Load timeline data when switching to the tab
  $: if (activeTab === 'timeline') loadTimeline();
</script>

<!-- Review screen overlays everything when active -->
{#if reviewDocumentId}
  <ReviewConfirmScreen
    documentId={reviewDocumentId}
    onConfirmed={handleConfirmed}
    onCancel={() => reviewDocumentId = null}
  />
{/if}

<div class="ingestion-panel">
  <!-- Sub-tab nav -->
  <div class="sub-tabs">
    <button class="sub-tab" class:active={activeTab === 'topics'} on:click={() => activeTab = 'topics'}>
      <i class="las la-tags"></i> Topics
      {#if topics.length > 0}<span class="count-badge">{topics.length}</span>{/if}
    </button>
    <button class="sub-tab" class:active={activeTab === 'documents'} on:click={() => activeTab = 'documents'}>
      <i class="las la-file-alt"></i> Documents
      {#if documents.length > 0}<span class="count-badge">{documents.length}</span>{/if}
      {#if documents.some(d => d.status === 'awaiting_review')}
        <span class="review-dot" title="Documents awaiting review"></span>
      {/if}
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

    {:else if activeTab === 'documents'}
      <div class="tab-content scrollable">
        <DocumentUpload
          {projectId}
          {topics}
          {stages}
          onUploaded={handleDocumentUploaded}
        />

        <div class="divider"></div>

        {#if documents.length === 0}
          <div class="empty-docs">
            <i class="las la-inbox"></i>
            <p>No documents uploaded yet.</p>
          </div>
        {:else}
          <div class="doc-list">
            {#each documents as doc (doc.id)}
              <DocumentCard
                {doc}
                {projectId}
                onReview={handleReview}
                onTopicAdded={handleTopicsChanged}
              />
            {/each}
          </div>
        {/if}
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
    border-bottom: 1px solid #e2e8f0;
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
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    position: relative;
  }
  .sub-tab.active { color: #9333ea; border-bottom-color: #9333ea; }
  .sub-tab:hover:not(.active) { color: #1e293b; }

  .count-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: #f3e8ff;
    color: #7e22ce;
    padding: 0.1rem 0.4rem;
    border-radius: 20px;
    min-width: 16px;
    text-align: center;
  }

  .review-dot {
    width: 7px;
    height: 7px;
    background: #f59e0b;
    border-radius: 50%;
    margin-left: 2px;
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
    background: #e2e8f0;
    margin: 1.25rem 0;
  }

  .doc-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    padding: 3rem;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .error-state button {
    padding: 0.5rem 1rem; background: #9333ea; color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }

  .spinner {
    width: 2.5rem; height: 2.5rem;
    border: 3px solid #f3f4f6; border-top-color: #9333ea;
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-docs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #94a3b8;
    text-align: center;
  }
  .empty-docs i { font-size: 2rem; }
  .empty-docs p { margin: 0; font-size: 0.875rem; }
</style>
