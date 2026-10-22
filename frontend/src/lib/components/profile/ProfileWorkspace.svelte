<script>
  import { getUsers, getProjectsForUser } from '$lib/api/userProfiles.js';
  import { user as currentUser } from '$lib/stores/auth.js';
  import ProjectScopeMenu from './ProjectScopeMenu.svelte';
  import KeyDatesWidget from '$lib/components/projects/overview/KeyDatesWidget.svelte';
  import MeetingNotesWidget from '$lib/components/projects/overview/MeetingNotesWidget.svelte';
  import TrackersModal from './TrackersModal.svelte';
  import CrossProjectChatWidget from './CrossProjectChatWidget.svelte';
  import EmailTonesSettings from './EmailTonesSettings.svelte';

  export let userId = null;
  export let onClose = () => {};

  $: isOwnProfile = !!$currentUser && userId === $currentUser.id;
  let emailTonesOpen = false;
  let trackersOpen = false;

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

  // "Shared with": a quick way to tick the project list — ticking colleagues ticks
  // the projects this person has in common with them. Several ticked = projects ALL
  // of them are on (together with this person), not any one of them. Being "on" a
  // project means being its linked lead, manager or director.
  let allUsers = [];
  let sharedLabels = [];

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
      allUsers = users;
      allProjects = userProjects;
      scope = 'all';
      selectedLabels = allProjects.map(p => p.project_name);
      sharedLabels = [];
    } catch (err) {
      console.error('Failed to load profile:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: projectOptions = allProjects.map(p => ({ id: p.id, label: p.project_name }));
  $: scopeProjects = scope === 'all'
    ? allProjects
    : allProjects.filter(p => selectedLabels.includes(p.project_name));

  const projectPeople = p =>
    [p.project_lead_user_id, p.project_manager_user_id, p.project_director_user_id].filter(Boolean).map(String);

  // Everyone else who is on at least one of this person's projects.
  $: sharedOptions = (() => {
    const ids = new Set(allProjects.flatMap(projectPeople));
    ids.delete(String(userId));
    return allUsers
      .filter(u => ids.has(String(u.id)))
      .map(u => ({ id: u.id, label: u.display_name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();
  $: sharedIds = sharedLabels
    .map(label => sharedOptions.find(o => o.label === label)?.id)
    .filter(Boolean)
    .map(String);

  $: visibleProjects = scopeProjects;

  // Ticking colleagues re-ticks the project list to exactly the projects this
  // person is on together with ALL of them (none ticked = every project again).
  // The project ticks stay the single source of truth, so they can be adjusted by hand afterwards.
  function applyShared(labels) {
    sharedLabels = labels;
    const ids = labels
      .map(label => sharedOptions.find(o => o.label === label)?.id)
      .filter(Boolean)
      .map(String);
    selectedLabels = allProjects
      .filter(p => ids.every(id => projectPeople(p).includes(id)))
      .map(p => p.project_name);
  }

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
      <div class="pw-scope-pills" role="group" aria-label="Which projects to show">
        <button type="button" class="pw-pill" class:active={scope === 'all'} aria-pressed={scope === 'all'} on:click={() => scope = 'all'}>
          <i class="las la-layer-group"></i> All projects
          <span class="pw-pill-count">{allProjects.length}</span>
        </button>
        <!-- The pill is the dropdown's trigger: the project list opens directly beneath it. -->
        <ProjectScopeMenu {projectOptions} bind:selected={selectedLabels} {sharedOptions} shared={sharedLabels} on:sharedChange={(e) => applyShared(e.detail)}>
          <button
            slot="trigger"
            let:toggle
            let:open
            type="button"
            class="pw-pill"
            class:active={scope === 'select'}
            aria-pressed={scope === 'select'}
            aria-haspopup="dialog"
            aria-expanded={open}
            on:click={() => { scope = 'select'; toggle(); }}
          >
            <i class="las la-filter"></i> Select projects
            {#if scope === 'select'}<span class="pw-pill-count">{visibleProjects.length}/{allProjects.length}</span>{/if}
            <i class="las la-angle-down pw-pill-chev" class:open></i>
          </button>
        </ProjectScopeMenu>
      </div>
      <button type="button" class="pw-pill pw-trackers-btn" on:click={() => (trackersOpen = true)} disabled={visibleProjects.length === 0}>
        <i class="las la-clipboard-list"></i> Trackers &amp; Surveyor
      </button>
    </div>

    {#if visibleProjects.length === 0}
      <div class="empty-state">
        <i class="las la-project-diagram"></i>
        <p>{allProjects.length === 0
          ? "This person isn't linked as lead, manager, or director on any project."
          : scope === 'select' && sharedIds.length
            ? `No projects shared with ${sharedLabels.length === 1 ? sharedLabels[0] : 'all of those people'}.`
            : 'No projects match the current selection.'}</p>
      </div>
    {:else}
      <div class="pw-grid">
        <CrossProjectChatWidget projects={visibleProjects} />
        <KeyDatesWidget
          project={visibleProjects[0]}
          projects={visibleProjects}
          userId={profile.id}
          userName={profile.display_name}
          mineLabel={isOwnProfile ? 'My actions' : `${profile.display_name.split(' ')[0]}'s actions`}
        />
        <MeetingNotesWidget project={visibleProjects[0]} projects={visibleProjects} />
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <i class="las la-user"></i>
      <p>No profile selected.</p>
    </div>
  {/if}
</div>

{#if trackersOpen}
  <TrackersModal projects={visibleProjects} onClose={() => (trackersOpen = false)} />
{/if}

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
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-wrap: wrap;
  }

  .pw-scope-pills { display: flex; gap: 6px; }

  /* Same pill look as the pills inside the widgets */
  .pw-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 12px; border: none; border-radius: var(--radius-pill); cursor: pointer;
    background: var(--color-slate-100); color: var(--color-slate-600);
    font-family: inherit; font-size: 0.75rem; font-weight: 600; white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }
  .pw-pill:hover:not(:disabled) { background: var(--color-slate-200); }
  .pw-pill.active { background: var(--color-slate-900); color: var(--color-white); }
  .pw-pill i { font-size: 0.9375rem; }
  .pw-pill:disabled { opacity: 0.5; cursor: not-allowed; }
  .pw-pill-count {
    min-width: 1.15rem; padding: 0 0.35rem; border-radius: var(--radius-pill);
    background: var(--color-slate-200); color: var(--color-slate-700);
    font-size: 0.6875rem; line-height: 1.15rem; text-align: center;
  }
  .pw-pill.active .pw-pill-count { background: var(--color-slate-700); color: var(--color-white); }
  .pw-pill .pw-pill-chev { font-size: 0.75rem; margin-left: -2px; transition: transform 0.15s; }
  .pw-pill .pw-pill-chev.open { transform: rotate(180deg); }

  .pw-trackers-btn { margin-left: auto; }

  /* Three full-height widgets side by side: chat and actions get the room,
     meeting notes sits beside them, narrower. */
  .pw-grid {
    display: grid;
    grid-template-columns: 1.3fr 1.3fr 0.9fr;
    grid-template-rows: minmax(420px, 1fr);
    gap: 1rem;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.75rem;
  }

  @media (max-width: 1100px) {
    .pw-grid {
      grid-template-columns: 1fr;
      grid-template-rows: none;
      grid-auto-rows: minmax(420px, auto);
    }
  }

  .loading-state, .error-state, .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
