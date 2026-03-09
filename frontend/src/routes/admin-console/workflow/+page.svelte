<script>
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/auth.js';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import WorkflowNotificationCentre from '$lib/components/workflow/WorkflowNotificationCentre.svelte';
  import ProjectStagesBoard from '$lib/components/workflow/ProjectStagesBoard.svelte';

  let activeTab = 'notifications'; // 'notifications' | 'stages'
  let selectedProject = null;

  // The current user's display name, used for "My Feed" scoping
  $: currentUserName = $user?.user_metadata?.full_name || $user?.email || null;

  function handleProjectSelected(event) {
    selectedProject = event.detail.project ?? null;
  }
</script>

<div class="workflow-page">
  <!-- Tab bar -->
  <div class="workflow-tabs">
    <button
      class="tab-btn"
      class:active={activeTab === 'notifications'}
      on:click={() => (activeTab = 'notifications')}
    >
      <i class="las la-bell"></i>
      Notification Centre
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'stages'}
      on:click={() => (activeTab = 'stages')}
    >
      <i class="las la-th"></i>
      Project Stages
    </button>
  </div>

  <!-- Project selector (shown on Stages tab only) -->
  {#if activeTab === 'stages'}
    <div class="project-selector-bar">
      <ProjectSelector on:projectSelected={handleProjectSelected} />
    </div>
  {/if}

  <!-- Tab content -->
  <div class="tab-content">
    {#if activeTab === 'notifications'}
      <WorkflowNotificationCentre {currentUserName} />
    {:else}
      <ProjectStagesBoard project={selectedProject} {currentUserName} />
    {/if}
  </div>
</div>

<style>
  .workflow-page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .workflow-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #64748b;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab-btn:hover {
    color: #1e293b;
  }

  .tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  .tab-btn i {
    font-size: 1.125rem;
  }

  .project-selector-bar {
    padding: 1rem 0 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    max-width: 400px;
  }

  .tab-content {
    flex: 1;
    padding-top: 1.5rem;
    overflow: auto;
  }
</style>
