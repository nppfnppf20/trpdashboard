<script>
  import SurveyorBriefingPanel from '$lib/components/surveyor-briefings/SurveyorBriefingPanel.svelte';
  import SurveyorPanels from '$lib/components/surveyor-management/SurveyorPanels.svelte';
  import { mainViewInitialTab } from '$lib/stores/projectViewModal.js';

  export let project;
  export let initialTab = null;
  export let onClose = () => {};

  let activeTab = initialTab ?? 'briefings';

  const tabs = [
    { id: 'briefings', label: 'Briefings', icon: 'la-clipboard-list' },
    { id: 'quotes', label: 'Quotes', icon: 'la-file-invoice-dollar' },
    { id: 'instructed', label: 'Instructed', icon: 'la-tasks' },
    { id: 'reviews', label: 'Reviews', icon: 'la-star' }
  ];

  function handleTabChange(newTab) {
    activeTab = newTab;
    // Keeps the shared mainViewInitialTab store (mirrored into the URL by
    // +layout.svelte) in sync, so a reload lands back on this tab instead
    // of always resetting to 'briefings'.
    mainViewInitialTab.set(newTab);
  }
</script>

<div class="workspace">
  {#if project}
    <div class="workspace-header">
      <div class="header-info">
        <h1>{project.project_name}</h1>
        {#if project.project_id}<span class="project-ref">{project.project_id}</span>{/if}
      </div>
      <button class="close-btn" on:click={onClose} title="Close" aria-label="Close">&times;</button>
    </div>

    <!-- Tabs navigation -->
    <div class="tabs-bar">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          on:click={() => handleTabChange(tab.id)}
        >
          <i class="las {tab.icon}"></i>
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    <!-- Content area -->
    <div class="content-area">
      {#if activeTab === 'briefings'}
        <div class="content-panel">
          <SurveyorBriefingPanel selectedProject={project} />
        </div>
      {/if}
      <!-- Always mounted so the loaded quotes survive switching tabs; renders nothing on 'briefings' -->
      <SurveyorPanels {project} {activeTab} />
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-project-diagram"></i>
      <h2>No project selected</h2>
      <p>Select a project from the sidebar to manage surveyor information</p>
    </div>
  {/if}
</div>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    /* Scaled to 87% on top of the global 90% root size. zoom also shrinks
       the vh-based height, so divide it back out to keep filling the screen. */
    zoom: 0.87;
    height: calc(100vh / 0.87);
    background: var(--color-slate-100);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-info h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .project-ref {
    font-size: 0.8rem;
    color: var(--color-slate-400);
    background: var(--color-slate-100);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--color-slate-800);
  }

  .tabs-bar {
    display: flex;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    padding: 0 1.5rem;
    gap: 0.25rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--color-slate-500);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-btn i {
    font-size: 1.125rem;
  }

  .tab-btn:hover {
    color: var(--color-primary-500);
    background: var(--color-slate-50);
  }

  .tab-btn.active {
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
    background: var(--color-slate-50);
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .content-panel {
    background: white;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-slate-400);
  }

  .empty-state i {
    font-size: 5rem;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: var(--color-slate-500);
  }

  .empty-state p {
    margin: 0;
  }
</style>
