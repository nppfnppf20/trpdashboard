<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { user, userRole, signOut } from '$lib/stores/auth.js';
  import {
    projects, selectedProjectId, selectedProject, hasSelectedProject,
    loadProjects, selectProject, clearProjectSelection
  } from '$lib/stores/projectSelection.js';
  import {
    mainView, mainViewInitialTab,
    openProjectModal, closeProjectModal,
    openSurveyorManagement, openPlanningDeliverables
  } from '$lib/stores/projectViewModal.js';

  onMount(() => {
    loadProjects();
  });

  const globalNavItems = [
    { href: '/', label: 'Projects', icon: 'la-project-diagram' },
    { href: '/policy', label: 'Policy & Industry Updates', icon: 'la-newspaper' },
    { href: '/meeting-notes', label: 'Meeting Notes', icon: 'la-file-signature' },
    { href: '/tenders', label: 'Tenders', icon: 'la-landmark', beta: true },
    { href: '/marketing', label: 'Marketing', icon: 'la-bullhorn', beta: true },
    { href: '/webscraper', label: 'Web Scraper Data', icon: 'la-database' },
    { href: '/socioeconomics', label: 'Socioeconomics', icon: 'la-chart-bar' }
  ];
  const adminNavItem = { href: '/admin-console', label: 'Admin Console', icon: 'la-cog' };

  const overviewItem = { label: 'Overview', icon: 'la-info-circle', tab: 'details' };
  const projectDetailsItem = { label: 'Project Details', icon: 'la-id-card', tab: 'project_details' };
  const surveyorManagementItem = { label: 'Surveyor Management', icon: 'la-user-tie' };
  const planningDeliverablesItem = { label: 'Planning Deliverables', icon: 'la-clipboard-list' };
  const workspaceGroups = [
    {
      label: 'Site & Policy',
      items: [
        { label: 'Site Boundary', icon: 'la-map-marked-alt', tab: 'site_boundary' },
        { label: 'Policy & History', icon: 'la-history', tab: 'policy_and_history' }
      ]
    },
    {
      label: 'Trackers',
      items: [
        { label: 'Consultation Tracker', icon: 'la-clipboard-list', tab: 'consultation_tracker' },
        { label: 'Conditions Tracker', icon: 'la-shield-alt', tab: 'conditions_tracker' },
        { label: 'Project Tracker', icon: 'la-chart-line', tab: 'progress_tracker' },
        { label: 'Programme', icon: 'la-calendar-alt', tab: 'programme' }
      ]
    },
    {
      label: 'Team',
      items: [
        { label: 'Project Chat', icon: 'la-comments', tab: 'project_chat' },
        { label: 'Meeting Notes', icon: 'la-comment-alt', tab: 'meeting_notes' }
      ]
    }
  ];

  // Still-in-construction tools, tucked away behind a collapsed "Beta"
  // group so the main Project Workspace list stays short.
  const betaItems = [
    { label: 'Similar Schemes', icon: 'la-search', tab: 'similar_schemes' },
    { label: 'LPA Decision Analysis', icon: 'la-balance-scale', tab: 'lpa_decision_analysis' },
    { label: 'Conflict Check', icon: 'la-exclamation-triangle', tab: 'conflict' },
    { label: 'HLPV', icon: 'la-sun', tab: 'hlpv' },
    { label: 'Project Docs', icon: 'la-folder-open', tab: 'project_docs' },
    { label: 'Stages', icon: 'la-layer-group', tab: 'stages' },
    { label: 'Completeness', icon: 'la-check-circle', tab: 'completeness' }
  ];
  let betaOpen = false;

  let switcherOpen = false;

  function toggleSwitcher() {
    switcherOpen = !switcherOpen;
  }

  function pickProject(id) {
    // If you're picking a project from a global page (not already inside a
    // project workspace), jump straight into that project's Overview
    // rather than leaving you on the same global page with just the
    // switcher updated underneath you.
    const wasGeneralView = $mainView === null;
    selectProject(id);
    switcherOpen = false;
    if (wasGeneralView) {
      openProjectModal(id, 'details');
    }
  }

  function openWorkspaceTab(tab) {
    if ($selectedProjectId) {
      openProjectModal($selectedProjectId, tab);
    }
  }

  function openWorkspaceSurveyorManagement() {
    if ($selectedProjectId) {
      openSurveyorManagement($selectedProjectId);
    }
  }

  function openWorkspacePlanningDeliverables() {
    if ($selectedProjectId) {
      openPlanningDeliverables($selectedProjectId);
    }
  }

  function initials(name) {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  }

  $: displayName = $user?.user_metadata?.full_name || $user?.email || '';

  async function handleLogout() {
    await signOut();
    window.location.href = '/auth/login';
  }
</script>

<div class="sidebar">
  <div class="brand">
    <div class="brand-mark">TR</div>
    <div class="brand-name">TRP Dashboard</div>
  </div>

  <div class="nav-scroll">
    <div class="section-label">Project Workspace</div>

    <div class="switcher-wrap">
      <button class="switcher" class:filled={$hasSelectedProject} on:click={toggleSwitcher}>
        <span class="switcher-left">
          {#if $hasSelectedProject}
            <span class="switcher-icon filled">{initials($selectedProject?.project_name)}</span>
            <span class="switcher-text-wrap">
              <span class="switcher-title">{$selectedProject?.project_name}</span>
              <span class="switcher-meta">{$selectedProject?.project_id}</span>
            </span>
          {:else}
            <span class="switcher-icon"><i class="las la-folder"></i></span>
            <span class="switcher-text">Select a project&hellip;</span>
          {/if}
        </span>
        <i class="las la-angle-down switcher-caret {switcherOpen ? 'open' : ''}"></i>
      </button>
      {#if switcherOpen}
        <div class="switcher-dropdown" role="menu">
          {#if $hasSelectedProject}
            <button class="switcher-dropdown-item clear" on:click={() => { clearProjectSelection(); switcherOpen = false; }}>
              <i class="las la-times"></i> Clear selection
            </button>
            <div class="switcher-dropdown-divider"></div>
          {/if}
          {#each $projects as project (project.id)}
            <button
              class="switcher-dropdown-item {project.id === $selectedProjectId ? 'active' : ''}"
              on:click={() => pickProject(project.id)}
              role="menuitem"
            >
              <span class="switcher-dropdown-name">{project.project_name}</span>
              <span class="switcher-dropdown-ref">{project.project_id}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if $hasSelectedProject}
      <button
        class="nav-item workspace-item"
        class:active={$mainView === 'project' && $mainViewInitialTab === overviewItem.tab}
        on:click={() => openWorkspaceTab(overviewItem.tab)}
      >
        <i class="las {overviewItem.icon}"></i>
        <span>{overviewItem.label}</span>
      </button>
      <button
        class="nav-item workspace-item"
        class:active={$mainView === 'project' && $mainViewInitialTab === projectDetailsItem.tab}
        on:click={() => openWorkspaceTab(projectDetailsItem.tab)}
      >
        <i class="las {projectDetailsItem.icon}"></i>
        <span>{projectDetailsItem.label}</span>
      </button>
      <button
        class="nav-item workspace-item"
        class:active={$mainView === 'surveyor'}
        on:click={openWorkspaceSurveyorManagement}
      >
        <i class="las {surveyorManagementItem.icon}"></i>
        <span>{surveyorManagementItem.label}</span>
      </button>
      <button
        class="nav-item workspace-item"
        class:active={$mainView === 'planning'}
        on:click={openWorkspacePlanningDeliverables}
      >
        <i class="las {planningDeliverablesItem.icon}"></i>
        <span>{planningDeliverablesItem.label}</span>
      </button>

      {#each workspaceGroups as group}
        <div class="group-label">{group.label}</div>
        {#each group.items as item}
          <button
            class="nav-item workspace-item"
            class:active={$mainView === 'project' && $mainViewInitialTab === item.tab}
            on:click={() => openWorkspaceTab(item.tab)}
          >
            <i class="las {item.icon}"></i>
            <span>{item.label}</span>
          </button>
        {/each}
      {/each}

      <button class="beta-toggle" on:click={() => betaOpen = !betaOpen}>
        <i class="las la-flask"></i>
        <span>Beta</span>
        <i class="las la-angle-down beta-caret {betaOpen ? 'open' : ''}"></i>
      </button>
      {#if betaOpen}
        {#each betaItems as item}
          <button
            class="nav-item workspace-item"
            class:active={$mainView === 'project' && $mainViewInitialTab === item.tab}
            on:click={() => openWorkspaceTab(item.tab)}
          >
            <i class="las {item.icon}"></i>
            <span>{item.label}</span>
          </button>
        {/each}
      {/if}
    {:else}
      <div class="workspace-empty">
        <i class="las la-folder-open"></i>
        <div>Pick a project above to open its trackers, chat, docs and more.</div>
      </div>
    {/if}

    <div class="divider"></div>
    <div class="section-label">Global</div>
    {#each globalNavItems as item}
      <a href={item.href} class="nav-item" class:active={$mainView === null && ($page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href)))} on:click={closeProjectModal}>
        <i class="las {item.icon}"></i>
        <span>{item.label}</span>
        {#if item.beta}<span class="beta-tag">BETA</span>{/if}
      </a>
    {/each}

    <div class="divider"></div>
    <a href={adminNavItem.href} class="nav-item" class:active={$mainView === null && $page.url.pathname.startsWith(adminNavItem.href)} on:click={closeProjectModal}>
      <i class="las {adminNavItem.icon}"></i>
      <span>{adminNavItem.label}</span>
    </a>
  </div>

  <div class="profile">
    <div class="avatar">{initials(displayName)}</div>
    <div class="profile-text">
      <div class="profile-name">{displayName}</div>
      <div class="profile-role">{$userRole}</div>
    </div>
    <button class="logout-btn" on:click={handleLogout} title="Logout" aria-label="Logout">
      <i class="las la-sign-out-alt"></i>
    </button>
  </div>
</div>

<style>
  .sidebar {
    width: var(--sidebar-width);
    flex-shrink: 0;
    background: var(--color-white);
    border-right: 1px solid var(--color-slate-200);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-5) var(--space-4);
  }

  .brand-mark {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    background: var(--color-primary-600);
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.8125rem;
    flex-shrink: 0;
  }

  .brand-name {
    font-weight: 700;
    font-size: 0.90625rem;
    color: var(--color-slate-900);
  }

  .nav-scroll {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-1) var(--space-2) var(--space-2);
  }

  .section-label {
    font-size: 0.65625rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    color: var(--color-slate-400);
    text-transform: uppercase;
    padding: var(--space-3) var(--space-2) var(--space-2);
  }

  .group-label {
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-slate-400);
    text-transform: uppercase;
    padding: var(--space-2) var(--space-2) var(--space-1);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0.4375rem var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-slate-600);
    font-size: 0.8125rem;
    font-weight: 500;
    margin-bottom: 1px;
    text-decoration: none;
    width: 100%;
    background: none;
    border: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .nav-item i {
    flex-shrink: 0;
    color: var(--color-slate-400);
    font-size: 1rem;
    width: 1rem;
    text-align: center;
  }

  .nav-item:hover {
    background: var(--color-slate-100);
  }

  .nav-item.active {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    font-weight: 600;
  }

  .nav-item.active i {
    color: var(--color-primary-600);
  }

  .beta-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 0.4375rem var(--space-2);
    margin-top: var(--space-1);
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    color: var(--color-slate-400);
    font-size: 0.65625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .beta-toggle:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-600);
  }

  .beta-toggle i:first-child {
    font-size: 0.875rem;
  }

  .beta-caret {
    margin-left: auto;
    font-size: 0.875rem;
    transition: transform 0.15s ease;
  }

  .beta-caret.open {
    transform: rotate(180deg);
  }

  .beta-tag {
    margin-left: auto;
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-amber-800);
    background: var(--color-amber-100);
    border-radius: 4px;
    padding: 2px 5px;
  }

  .divider {
    height: 1px;
    background: var(--color-slate-200);
    margin: var(--space-2) var(--space-2);
  }

  .switcher-wrap {
    position: relative;
    margin: var(--space-1) var(--space-2) var(--space-2);
  }

  .switcher {
    width: 100%;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    background: var(--color-white);
    cursor: pointer;
    font-family: inherit;
  }

  .switcher.filled {
    border-color: var(--color-primary-200);
    background: var(--color-primary-50);
  }

  .switcher-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .switcher-icon {
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    background: var(--color-slate-100);
    color: var(--color-slate-400);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .switcher-icon.filled {
    background: var(--color-primary-600);
    color: var(--color-white);
  }

  .switcher-text {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    font-weight: 500;
  }

  .switcher-text-wrap {
    min-width: 0;
    text-align: left;
  }

  .switcher-title {
    display: block;
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-slate-900);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .switcher-meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--color-slate-500);
  }

  .switcher-caret {
    color: var(--color-slate-400);
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .switcher-caret.open {
    transform: rotate(180deg);
  }

  .switcher.filled .switcher-caret {
    color: var(--color-primary-600);
  }

  .switcher-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 20;
    padding: var(--space-1);
    max-height: 320px;
    overflow-y: auto;
  }

  .switcher-dropdown-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .switcher-dropdown-item:hover,
  .switcher-dropdown-item.active {
    background: var(--color-slate-100);
  }

  .switcher-dropdown-item.clear {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-slate-500);
    font-size: 0.8125rem;
  }

  .switcher-dropdown-divider {
    height: 1px;
    background: var(--color-slate-100);
    margin: var(--space-1) 0;
  }

  .switcher-dropdown-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .switcher-dropdown-ref {
    font-size: 0.6875rem;
    color: var(--color-slate-400);
  }

  .workspace-empty {
    margin: var(--space-1) var(--space-2) var(--space-2);
    padding: var(--space-4) var(--space-3);
    border: 1px dashed var(--color-slate-300);
    border-radius: var(--radius-md);
    text-align: center;
    color: var(--color-slate-400);
    font-size: 0.71875rem;
    line-height: 1.5;
  }

  .workspace-empty i {
    font-size: 1.25rem;
    margin-bottom: var(--space-1);
    display: block;
  }

  .profile {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-slate-200);
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-slate-800);
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .profile-text {
    min-width: 0;
    flex: 1;
  }

  .profile-name {
    font-size: 0.78125rem;
    font-weight: 600;
    color: var(--color-slate-800);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-role {
    font-size: 0.6875rem;
    color: var(--color-slate-400);
    text-transform: capitalize;
  }

  .logout-btn {
    background: none;
    border: none;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: var(--space-1);
    flex-shrink: 0;
  }

  .logout-btn:hover {
    color: var(--color-slate-700);
  }
</style>
