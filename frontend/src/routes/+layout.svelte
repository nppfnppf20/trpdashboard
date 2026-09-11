<script>
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { initAuth, loading, sessionIdle } from '$lib/stores/auth.js';
  import { startLlmStatusPolling } from '$lib/stores/llmStatus.js';
  import Sidebar from '$lib/components/shared/Sidebar.svelte';
  import LlmStatusBanner from '$lib/components/shared/LlmStatusBanner.svelte';
  import ProjectViewModal from '$lib/components/projects/ProjectViewModal.svelte';
  import EditProjectModal from '$lib/components/projects/EditProjectModal.svelte';
  import SurveyorWorkspace from '$lib/components/surveyor-management/SurveyorWorkspace.svelte';
  import PlanningWorkspace from '$lib/components/planning-application/PlanningWorkspace.svelte';
  import ProfileWorkspace from '$lib/components/profile/ProfileWorkspace.svelte';
  import { projects, selectedProject, selectedProjectId, loadProjects, selectProject } from '$lib/stores/projectSelection.js';
  import {
    mainView, mainViewProjectId, mainViewInitialTab, mainViewReturnTab, mainViewUserId,
    editModalOpen, editModalProjectId,
    closeProjectModal, openProjectModal, openSurveyorManagement, openPlanningDeliverables, openProfile, closeEditModal
  } from '$lib/stores/projectViewModal.js';

  let { children } = $props();

  let isAuthShell = $derived(!$page.url.pathname.startsWith('/auth'));

  // Reloading the page normally drops back to the routed page and loses
  // whatever project workspace/tab was open, because mainView/mainViewProjectId
  // are plain in-memory stores. To survive a reload, the same state is
  // mirrored into the URL (?view=&pid=&tab=) below, and read back once here
  // on boot. urlSyncEnabled stays false until that one-time restore finishes,
  // so the sync effect doesn't wipe the params it's still trying to read.
  let restoring = $state(true);
  let urlSyncEnabled = $state(false);

  onMount(() => {
    initAuth();
    const unsubscribe = loading.subscribe(async (isLoading) => {
      if (isLoading || urlSyncEnabled) return;
      await restoreFromUrl();
      restoring = false;
      urlSyncEnabled = true;
    });
    return unsubscribe;
  });

  async function restoreFromUrl() {
    const params = new URL(window.location.href).searchParams;
    const view = params.get('view');
    const pid = params.get('pid');
    const tab = params.get('tab');
    const uid = params.get('uid');

    if (view === 'profile' && uid) {
      openProfile(uid);
      return;
    }

    if (!view || !pid) return;

    try {
      await loadProjects();
      // project.id is a numeric DB id but URLSearchParams always hands back a
      // string, so match loosely and restore using the real (typed) id from
      // the loaded list rather than the raw string out of the URL.
      const match = get(projects).find(p => String(p.id) === pid);
      if (!match) return; // stale link — leave the normal page showing

      selectProject(match.id);
      if (view === 'project') openProjectModal(match.id, tab || null);
      else if (view === 'surveyor') openSurveyorManagement(match.id, tab || null);
      else if (view === 'planning') openPlanningDeliverables(match.id);
    } catch (err) {
      console.warn('Failed to restore project workspace from URL:', err);
    }
  }

  function syncUrlFromState(view, projectId, tab, userId) {
    const url = new URL(window.location.href);
    if (view === 'profile' && userId) {
      url.searchParams.set('view', 'profile');
      url.searchParams.set('uid', userId);
      url.searchParams.delete('pid');
      url.searchParams.delete('tab');
    } else if (view && projectId) {
      url.searchParams.set('view', view);
      url.searchParams.set('pid', projectId);
      if (tab) url.searchParams.set('tab', tab);
      else url.searchParams.delete('tab');
      url.searchParams.delete('uid');
    } else {
      url.searchParams.delete('view');
      url.searchParams.delete('pid');
      url.searchParams.delete('tab');
      url.searchParams.delete('uid');
    }
    replaceState(url, {});
  }

  // 'surveyor'/'planning' workspaces re-render off $selectedProjectId when you
  // switch projects mid-workspace (mainViewProjectId only tracks the 'project'
  // view — see Sidebar's pickProject), so the URL has to follow whichever one
  // the current view actually reads from.
  let urlSyncProjectId = $derived($mainView === 'project' ? $mainViewProjectId : $selectedProjectId);

  $effect(() => {
    if (browser && urlSyncEnabled) {
      syncUrlFromState($mainView, urlSyncProjectId, $mainViewInitialTab, $mainViewUserId);
    }
  });

  // Poll AI provider credit/quota status only once the user is authenticated
  // (avoids hitting the API from the login page).
  $effect(() => {
    if (browser && isAuthShell && !$loading) {
      return startLlmStatusPolling();
    }
  });

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

{#if $loading || restoring}
  <div class="app-loading">
    <div class="app-loading-spinner"></div>
    <div class="app-loading-text">Loading...</div>
  </div>
{:else if isAuthShell}
  <LlmStatusBanner />
  <div class="app-shell">
    <Sidebar />
    <div class="app-main">
      {#if $mainView === 'project'}
        <ProjectViewModal
          isOpen={true}
          projectId={$mainViewProjectId}
          initialTab={$mainViewInitialTab}
          onClose={handlePanelClose}
        />
      {:else if $mainView === 'surveyor'}
        <SurveyorWorkspace project={$selectedProject} initialTab={$mainViewInitialTab} onClose={handlePanelClose} />
      {:else if $mainView === 'planning'}
        <PlanningWorkspace project={$selectedProject} />
      {:else if $mainView === 'profile'}
        <ProfileWorkspace userId={$mainViewUserId} onClose={handlePanelClose} />
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
