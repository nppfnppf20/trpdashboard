<script>
  import { getUsers, getProjectsForUser } from '$lib/api/userProfiles.js';
  import { user as currentUser } from '$lib/stores/auth.js';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import KeyDatesWidget from '$lib/components/projects/overview/KeyDatesWidget.svelte';
  import MeetingNotesWidget from '$lib/components/projects/overview/MeetingNotesWidget.svelte';
  import TrackersSurveyorWidget from './TrackersSurveyorWidget.svelte';
  import CrossProjectChatWidget from './CrossProjectChatWidget.svelte';
  import EmailTonesSettings from './EmailTonesSettings.svelte';

  export let userId = null;
  export let onClose = () => {};

  $: isOwnProfile = !!$currentUser && userId === $currentUser.id;
  let emailTonesOpen = false;

  let profile = null;
  let allProjects = [];
  let loading = false;
  let error = null;
  let loadedForId = null;

  // 'all' merges every project the user is linked to into one view below;
  // 'select' narrows via the multi-select. selectedLabels starts pre-filled
  // with every project on load, so switching to 'select' narrows down
  // rather than starting from nothing.
  let scope = 'all';
  let selectedLabels = [];

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

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }
</script>

<div class="pw-workspace">
  {#if loading}
    <div class="loading-state">
      <i class="las la-spinner la-spin"></i>
      <p>Loading profile...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <p>{error}</p>
    </div>
  {:else if profile}
    <div class="pw-header">
      <div class="pw-header-info">
        <div class="pw-avatar">{initials(profile.display_name)}</div>
        <div>
          <h1 class="pw-name">{profile.display_name}</h1>
          {#if profile.role}<span class="badge badge-neutral">{profile.role}</span>{/if}
        </div>
        {#if isOwnProfile}
          <button class="btn btn-icon btn-ghost" on:click={() => (emailTonesOpen = true)} title="Email tones" aria-label="Email tones">
            <i class="las la-sliders-h"></i>
          </button>
        {/if}
      </div>
      <button class="btn btn-icon btn-ghost" on:click={onClose} title="Close" aria-label="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="pw-scope-bar">
      <div class="tab-navigation pw-scope-toggle">
        <button type="button" class="tab-button" class:active={scope === 'all'} on:click={() => scope = 'all'}>
          All my projects ({allProjects.length})
        </button>
        <button type="button" class="tab-button" class:active={scope === 'select'} on:click={() => scope = 'select'}>
          Select projects
        </button>
      </div>
      {#if scope === 'select'}
        <div class="pw-scope-select">
          <MultiSelectDropdown options={projectOptions} bind:selected={selectedLabels} placeholder="Select projects..." />
        </div>
      {/if}
    </div>

    {#if visibleProjects.length === 0}
      <div class="empty-state">
        <i class="las la-project-diagram"></i>
        <p>{allProjects.length === 0 ? "This person isn't linked as lead, manager, or director on any project." : 'No projects match the current selection.'}</p>
      </div>
    {:else}
      <div class="pw-grid">
        <TrackersSurveyorWidget projects={visibleProjects} />
        <CrossProjectChatWidget projects={visibleProjects} />
        <MeetingNotesWidget project={visibleProjects[0]} projects={visibleProjects} />
        <KeyDatesWidget project={visibleProjects[0]} projects={visibleProjects} />
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <i class="las la-user"></i>
      <p>No profile selected.</p>
    </div>
  {/if}
</div>

{#if emailTonesOpen}
  <EmailTonesSettings onClose={() => (emailTonesOpen = false)} />
{/if}

<style>
  .pw-workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-slate-100);
  }

  .pw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
  }

  .pw-header-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .pw-avatar {
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

  .pw-name {
    margin: 0 0 0.15rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-900);
  }

  .pw-scope-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-wrap: wrap;
  }

  .pw-scope-toggle {
    width: auto;
    border-bottom: none;
    background: var(--color-slate-100);
    border-radius: var(--radius-md);
    padding: 0.2rem;
  }

  .pw-scope-toggle .tab-button {
    flex: none;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-sm, 4px);
    border-bottom: none;
    font-size: 0.8rem;
  }

  .pw-scope-toggle .tab-button.active {
    background: var(--color-white);
    box-shadow: var(--shadow-sm);
  }

  .pw-scope-select {
    min-width: 260px;
  }

  .pw-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    grid-template-rows: minmax(320px, 2fr) minmax(160px, 1fr);
    gap: 1rem;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.75rem;
  }

  /* Trackers & Surveyor declares its own grid-row: span 2 (.ts-widget).
     Four widgets in this 3-column grid leaves one cell short in row 2 —
     Key Dates (the last child) spans both remaining columns to fill it. */
  .pw-grid > :global(.widget:last-child) { grid-column: span 2; }

  @media (max-width: 1100px) {
    .pw-grid {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: none;
      min-height: 0;
    }
    .pw-grid > :global(.widget:last-child) { grid-column: auto; }
  }

  .loading-state, .error-state, .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
