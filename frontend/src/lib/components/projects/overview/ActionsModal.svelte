<script>
  // Large overlay view of meeting actions for one project (or several, merged),
  // opened from the Overview widget's Actions tab. Sits on top of the page so
  // closing it returns to where you were without a reload.
  import MeetingActionsList from '$lib/components/projects/MeetingActionsList.svelte';
  import { getMeetingActions } from '$lib/api/meetingNotes.js';
  import AddMeetingActionModal from './AddMeetingActionModal.svelte';
  import { bumpActionsVersion, actionsVersion } from '$lib/stores/keyDates.js';
  import { isActionMine } from '$lib/utils/actionOwnership.js';

  export let projects = [];
  export let onClose = () => {};
  // Profile page only. With a userId the toolbar offers My actions | All actions,
  // starting on whatever the widget behind it was set to (`mineOnly`) but changed
  // here independently.
  export let userId = null;
  export let userName = null;
  export let mineLabel = 'My actions';
  export let mineOnly = false;

  let showAdd = false;
  let onlyMine = mineOnly && !!userId;
  $: canFilterMine = !!userId;
  $: rowFilter = canFilterMine && onlyMine ? (a) => isActionMine(a, userId, userName) : null;

  $: merged = projects.length > 1;
  // actionsVersion in the key so the list reloads after an action is added.
  $: loadKey = projects.map(p => p.id).sort((a, b) => a - b).join(',') + ':' + $actionsVersion;

  let statusFilter = 'open';
  let search = '';

  async function load() {
    const perProject = await Promise.all(projects.map(async proj => {
      const rows = await getMeetingActions(proj.id);
      return rows.map(r => ({ ...r, project_name: proj.project_name }));
    }));
    return perProject.flat();
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="am-backdrop" role="dialog" aria-modal="true" tabindex="-1" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="am-modal">
    <div class="am-header">
      <h2 class="am-title"><i class="las la-tasks"></i> Actions</h2>
      <div class="am-header-actions">
        <button class="btn btn-primary btn-sm" on:click={() => (showAdd = true)}>
          <i class="las la-plus"></i> Add action
        </button>
        <button class="btn btn-icon btn-ghost" on:click={onClose} title="Close" aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>
    </div>

    <div class="am-toolbar">
      <div class="am-pills">
        {#each [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']] as [key, label]}
          <button type="button" class="btn btn-sm" class:btn-secondary={statusFilter === key} class:btn-ghost={statusFilter !== key} on:click={() => (statusFilter = key)}>
            {label}
          </button>
        {/each}
        {#if canFilterMine}
          <span class="am-divider" aria-hidden="true"></span>
          <button type="button" class="btn btn-sm" class:btn-secondary={onlyMine} class:btn-ghost={!onlyMine} aria-pressed={onlyMine} on:click={() => (onlyMine = true)}>
            <i class="las la-user"></i> {mineLabel}
          </button>
          <button type="button" class="btn btn-sm" class:btn-secondary={!onlyMine} class:btn-ghost={onlyMine} aria-pressed={!onlyMine} on:click={() => (onlyMine = false)}>
            <i class="las la-users"></i> All actions
          </button>
        {/if}
      </div>
      <input class="form-input am-search" type="search" placeholder="Search actions, owners, meetings…" bind:value={search} />
    </div>

    <div class="am-body">
      <MeetingActionsList
        {load}
        {loadKey}
        {statusFilter}
        {search}
        {rowFilter}
        showMeeting
        groupByAction
        showNotes={false}
        showProject={merged}
        emptyText={statusFilter === 'resolved' ? 'No resolved actions.' : statusFilter === 'open' ? 'No outstanding actions.' : 'No actions.'}
        on:changed={bumpActionsVersion}
      />
    </div>
  </div>
</div>

{#if showAdd}
  <AddMeetingActionModal {projects} onClose={() => (showAdd = false)} />
{/if}

<style>
  .am-header-actions { display: flex; align-items: center; gap: 0.5rem; }
  .am-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1.5rem;
  }
  .am-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 95%;
    max-width: 1100px;
    height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .am-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .am-title { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.5rem; }
  .am-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 1.75rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .am-pills { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .am-divider { width: 1px; height: 1.25rem; margin: 0 0.35rem; background: var(--color-slate-200); }
  .am-search { max-width: 20rem; }
  .am-body { flex: 1; min-height: 0; overflow-y: auto; padding: 1rem 1.75rem 1.5rem; }
</style>
