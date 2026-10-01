<script>
  import SurveyorPanels from '$lib/components/surveyor-management/SurveyorPanels.svelte';
  import SentBriefingsHistory from '$lib/components/surveyor-briefings/SentBriefingsHistory.svelte';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';

  // Surveyor Management in a modal (opened from the overview widget): the same Quotes /
  // Instructed / Reviews panels as the full page, plus Briefings showing only the list of sent
  // fee quote requests (no master templates).
  export let project;
  export let onClose = () => {};
  export let onOpenFullPage = null; // (tab) => void — optional link through to the full page

  let activeTab = 'briefings';

  const tabs = [
    { id: 'briefings', label: 'Briefings', icon: 'la-clipboard-list' },
    { id: 'quotes', label: 'Quotes', icon: 'la-file-invoice-dollar' },
    { id: 'instructed', label: 'Instructed', icon: 'la-tasks' },
    { id: 'reviews', label: 'Reviews', icon: 'la-star' }
  ];

  let sentRequests = [];
  let sentLoading = true;
  let sentError = null;
  let sentLoadedFor = null;

  $: if (project?.unique_id && project.unique_id !== sentLoadedFor) {
    sentLoadedFor = project.unique_id;
    loadSentRequests(project.unique_id);
  }

  async function loadSentRequests(uniqueId) {
    sentLoading = true;
    sentError = null;
    try {
      sentRequests = await getSentRequestsForProject(uniqueId);
    } catch (err) {
      console.error('Error loading sent requests:', err);
      sentError = err.message;
    } finally {
      sentLoading = false;
    }
  }

  function handleSentDeleted(event) {
    sentRequests = sentRequests.filter(r => r.id !== event.detail.id);
  }
</script>

<div
  class="sm-backdrop"
  role="dialog"
  tabindex="-1"
  on:click|self={onClose}
  on:keydown={(e) => e.key === 'Escape' && onClose()}
>
  <div class="sm-modal">
    <div class="sm-header">
      <div class="sm-title">
        <i class="las la-user-tie"></i>
        <h2>Surveyor Management</h2>
        <span class="sm-project">{project?.project_name}</span>
        {#if project?.project_id}<span class="sm-ref">{project.project_id}</span>{/if}
      </div>
      <div class="sm-header-actions">
        {#if onOpenFullPage}
          <button class="sm-link-btn" on:click={() => onOpenFullPage(activeTab)}>
            Open full page <i class="las la-external-link-alt"></i>
          </button>
        {/if}
        <button class="sm-close" on:click={onClose} title="Close" aria-label="Close">&times;</button>
      </div>
    </div>

    <div class="sm-tabs">
      {#each tabs as tab}
        <button class="sm-tab" class:active={activeTab === tab.id} on:click={() => activeTab = tab.id}>
          <i class="las {tab.icon}"></i>
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    <div class="sm-body">
      {#if activeTab === 'briefings'}
        <div class="sm-card">
          <h3 class="sm-card-title">Sent Fee Quote Requests</h3>
          {#if sentLoading}
            <p class="sm-state">Loading…</p>
          {:else if sentError}
            <p class="sm-state sm-state-error">{sentError}</p>
          {:else}
            <SentBriefingsHistory {sentRequests} on:deleted={handleSentDeleted} />
          {/if}
        </div>
      {/if}
      <!-- Mounted once so loaded quotes survive switching tabs -->
      <SurveyorPanels {project} {activeTab} />
    </div>
  </div>
</div>

<style>
  .sm-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .sm-modal {
    background: var(--color-slate-100);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 1280px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .sm-title { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
  .sm-title > i { font-size: 1.25rem; color: var(--color-primary-500); }
  .sm-title h2 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-slate-800); white-space: nowrap; }
  .sm-project { font-size: 0.875rem; color: var(--color-slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sm-ref {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    background: var(--color-slate-100);
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    white-space: nowrap;
  }

  .sm-header-actions { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

  .sm-link-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    background: var(--color-white);
    color: var(--color-slate-600);
    font-size: 0.78rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .sm-link-btn:hover { background: var(--color-slate-50); color: var(--color-primary-600); border-color: var(--color-primary-200); }

  .sm-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    line-height: 1;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0 0.25rem;
  }
  .sm-close:hover { color: var(--color-slate-800); }

  .sm-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 1.25rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .sm-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 1rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--color-slate-500);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .sm-tab:hover { color: var(--color-primary-500); background: var(--color-slate-50); }
  .sm-tab.active { color: var(--color-primary-500); border-bottom-color: var(--color-primary-500); background: var(--color-slate-50); }

  .sm-card {
    background: var(--color-white);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    padding: 1.25rem 1.5rem;
  }
  .sm-card-title { margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: var(--color-slate-600); }
  .sm-state { margin: 0; padding: 1.5rem 0; text-align: center; color: var(--color-slate-400); }
  .sm-state-error { color: var(--color-red-500); }

  .sm-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem;
  }
</style>
