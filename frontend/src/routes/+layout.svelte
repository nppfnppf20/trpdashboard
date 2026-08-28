<script>
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth, loading, sessionIdle } from '$lib/stores/auth.js';
  import Sidebar from '$lib/components/shared/Sidebar.svelte';
  import ProjectViewModal from '$lib/components/projects/ProjectViewModal.svelte';
  import EditProjectModal from '$lib/components/projects/EditProjectModal.svelte';
  import SurveyorWorkspace from '$lib/components/surveyor-management/SurveyorWorkspace.svelte';
  import PlanningWorkspace from '$lib/components/planning-application/PlanningWorkspace.svelte';
  import { selectedProject } from '$lib/stores/projectSelection.js';
  import {
    mainView, mainViewProjectId, mainViewInitialTab, mainViewReturnTab,
    editModalOpen, editModalProjectId,
    closeProjectModal, openProjectModal, openEditModal, closeEditModal
  } from '$lib/stores/projectViewModal.js';

  let { children } = $props();

  let isAuthShell = $derived(!$page.url.pathname.startsWith('/auth'));

  onMount(() => {
    initAuth();
  });

  function handleEditFromView() {
    const id = $mainViewProjectId;
    closeProjectModal();
    openEditModal(id);
  }

  // Closing a tab that was drilled into from another tab (e.g. Overview's
  // "expand tracker" button) goes back to that tab instead of exiting the
  // whole workspace.
  function handlePanelClose() {
    if ($mainViewReturnTab) {
      openProjectModal($mainViewProjectId, $mainViewReturnTab);
    } else {
      closeProjectModal();
    }
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if $sessionIdle}
  <div style="position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 10000;">
    <div style="background: white; border-radius: 0.5rem; padding: 2rem; max-width: 400px; text-align: center; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);">
      <p style="margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; color: var(--color-slate-900);">Session Idle</p>
      <p style="margin: 0 0 1.5rem; font-size: 0.875rem; color: var(--color-slate-600);">Your session is idle. Please reload the page to continue.</p>
      <button
        onclick={() => window.location.reload()}
        style="padding: 0.5rem 1.5rem; background: var(--color-primary-600); color: white; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;"
      >Reload Page</button>
    </div>
  </div>
{/if}

{#if $loading}
  <div class="app-loading">
    <div class="app-loading-spinner"></div>
    <div class="app-loading-text">Loading...</div>
  </div>
{:else if isAuthShell}
  <div class="app-shell">
    <Sidebar />
    <div class="app-main">
      {#if $mainView === 'project'}
        <ProjectViewModal
          isOpen={true}
          projectId={$mainViewProjectId}
          initialTab={$mainViewInitialTab}
          onClose={handlePanelClose}
          onEdit={handleEditFromView}
        />
      {:else if $mainView === 'surveyor'}
        <SurveyorWorkspace project={$selectedProject} initialTab={$mainViewInitialTab} />
      {:else if $mainView === 'planning'}
        <PlanningWorkspace project={$selectedProject} />
      {:else}
        {@render children?.()}
      {/if}
    </div>
  </div>

  <EditProjectModal
    isOpen={$editModalOpen}
    projectId={$editModalProjectId}
    onClose={closeEditModal}
    onProjectUpdated={closeEditModal}
  />
{:else}
  {@render children?.()}
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .app-main {
    flex: 1;
    min-width: 0;
    max-width: none;
    margin: 0;
  }

  .app-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: var(--color-slate-100);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .app-loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: app-loading-spin 0.8s linear infinite;
  }

  .app-loading-text {
    color: var(--color-slate-600);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  @keyframes app-loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
