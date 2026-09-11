<script>
  import { getUsers, getProjectsForUser } from '$lib/api/userProfiles.js';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import ProjectOverviewTab from '$lib/components/projects/overview/ProjectOverviewTab.svelte';

  export let userId = null;
  export let onClose = () => {};

  let profile = null;
  let allProjects = [];
  let loading = false;
  let error = null;
  let loadedForId = null;

  // 'all' shows every project the user is linked to; 'select' narrows via
  // the multi-select below. selectedLabels starts pre-filled with every
  // project on load, so switching to 'select' narrows down rather than
  // starting from nothing.
  let scope = 'all';
  let selectedLabels = [];
  let expandedIds = new Set();

  $: if (userId && userId !== loadedForId) {
    loadedForId = userId;
    loadProfile(userId);
  } else if (!userId) {
    loadedForId = null;
    profile = null;
    allProjects = [];
  }

  async function loadProfile(id) {
    loading = true;
    error = null;
    try {
      const [users, userProjects] = await Promise.all([
        getUsers(),
        getProjectsForUser(id)
      ]);
      profile = users.find(u => u.id === id) || null;
      allProjects = userProjects;
      scope = 'all';
      selectedLabels = allProjects.map(p => p.project_name);
      // Auto-expand when there are only a few projects; otherwise start
      // collapsed so opening a busy profile doesn't fire off a widget's
      // worth of requests per project all at once.
      expandedIds = new Set(allProjects.length <= 3 ? allProjects.map(p => p.id) : []);
    } catch (err) {
      console.error('Failed to load profile:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: projectOptions = allProjects.map(p => ({ id: p.id, label: p.project_name }));
  $: visibleProjects = scope === 'all'
    ? allProjects
    : allProjects.filter(p => selectedLabels.includes(p.project_name));

  function toggleExpanded(id) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    expandedIds = expandedIds;
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }
</script>

<div class="workspace">
  {#if loading}
    <div class="empty-state">
      <i class="las la-spinner la-spin"></i>
      <h2>Loading profile...</h2>
    </div>
  {:else if error}
    <div class="empty-state">
      <i class="las la-exclamation-triangle"></i>
      <h2>Failed to load profile</h2>
      <p>{error}</p>
    </div>
  {:else if profile}
    <div class="workspace-header">
      <div class="header-info">
        <div class="avatar">{initials(profile.display_name)}</div>
        <div>
          <h1>{profile.display_name}</h1>
          {#if profile.role}<span class="role-badge">{profile.role}</span>{/if}
        </div>
      </div>
      <button class="close-btn" on:click={onClose} title="Close" aria-label="Close">&times;</button>
    </div>

    <div class="scope-bar">
      <div class="scope-toggle">
        <button type="button" class:active={scope === 'all'} on:click={() => scope = 'all'}>
          All my projects ({allProjects.length})
        </button>
        <button type="button" class:active={scope === 'select'} on:click={() => scope = 'select'}>
          Select projects
        </button>
      </div>
      {#if scope === 'select'}
        <div class="scope-select">
          <MultiSelectDropdown options={projectOptions} bind:selected={selectedLabels} placeholder="Select projects..." />
        </div>
      {/if}
    </div>

    <div class="content-area">
      {#if visibleProjects.length === 0}
        <div class="empty-state">
          <i class="las la-project-diagram"></i>
          <h2>No projects</h2>
          <p>{allProjects.length === 0 ? 'This person isn\'t linked as lead, manager, or director on any project.' : 'No projects match the current selection.'}</p>
        </div>
      {:else}
        {#each visibleProjects as proj (proj.id)}
          <div class="profile-project-card">
            <button type="button" class="profile-project-header" on:click={() => toggleExpanded(proj.id)}>
              <i class="las {expandedIds.has(proj.id) ? 'la-chevron-down' : 'la-chevron-right'}"></i>
              <span class="profile-project-name">{proj.project_name}</span>
              {#if proj.project_id}<span class="project-ref">{proj.project_id}</span>{/if}
              {#if proj.status}<span class="profile-project-status">{proj.status}</span>{/if}
            </button>
            {#if expandedIds.has(proj.id)}
              <div class="profile-project-body">
                <ProjectOverviewTab project={proj} />
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-user"></i>
      <h2>No profile selected</h2>
    </div>
  {/if}
</div>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
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
    gap: 0.75rem;
  }

  .avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .header-info h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .role-badge {
    display: inline-block;
    margin-top: 0.15rem;
    font-size: 0.7rem;
    text-transform: capitalize;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
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

  .scope-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    flex-wrap: wrap;
  }

  .scope-toggle {
    display: flex;
    gap: 0.25rem;
    background: var(--color-slate-100);
    border-radius: 0.5rem;
    padding: 0.2rem;
  }

  .scope-toggle button {
    border: none;
    background: none;
    padding: 0.4rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-600);
    cursor: pointer;
    transition: all 0.15s;
  }

  .scope-toggle button.active {
    background: white;
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .scope-select {
    min-width: 260px;
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .profile-project-card {
    background: white;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .profile-project-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .profile-project-header i {
    color: var(--color-slate-400);
    font-size: 0.9rem;
  }

  .profile-project-name {
    font-weight: 600;
    color: var(--color-slate-800);
    flex: 1;
  }

  .project-ref {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    background: var(--color-slate-100);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .profile-project-status {
    font-size: 0.75rem;
    color: var(--color-primary-600);
    background: var(--color-primary-100);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .profile-project-body {
    border-top: 1px solid var(--color-slate-200);
    height: 600px;
    display: flex;
  }

  .profile-project-body :global(.ov-grid) {
    flex: 1;
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
