<script>
  // Actions saved from meetings, with Resolve and progress-update controls.
  // The parent supplies `load` (returns the action rows) so this works for one
  // meeting, one project, or several projects merged. Changing `loadKey`
  // reloads; `dispatch('changed')` tells the parent counts may be stale.
  import { createEventDispatcher } from 'svelte';
  import { addMeetingActionUpdate } from '$lib/api/meetingNotes.js';

  export let load;
  export let loadKey = '';
  export let showProject = false;     // tag each row with its project name (merged views)
  export let showCompleted = false;   // include resolved actions, greyed out
  export let showMeeting = false;     // show which meeting an action came from
  export let emptyText = 'No actions.';
  /** @type {'open' | 'resolved' | 'all' | null} */
  export let statusFilter = null;     // 'open' | 'resolved' | 'all' — overrides showCompleted when set
  export let search = '';             // case-insensitive match on action text, owner and meeting

  const dispatch = createEventDispatcher();

  let actions = [];
  let loading = true;
  let error = null;
  let lastKey = null;

  $: if (loadKey !== lastKey) {
    lastKey = loadKey;
    reload();
  }

  export async function reload() {
    loading = actions.length === 0;
    error = null;
    try {
      actions = (await load()) || [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: visible = actions.filter(a => {
    const status = statusFilter ?? (showCompleted ? 'all' : 'open');
    if (status === 'open' && a.status === 'complete') return false;
    if (status === 'resolved' && a.status !== 'complete') return false;
    const q = search.trim().toLowerCase();
    return !q || [a.action_text, a.owner, a.meeting_title, a.project_name].some(v => v?.toLowerCase().includes(q));
  });

  let editingId = null;
  let draft = '';
  let busyId = null;

  function startUpdate(a) {
    editingId = a.id;
    draft = '';
  }

  async function submit(a, update_type, update_text = null) {
    busyId = a.id;
    error = null;
    try {
      await addMeetingActionUpdate(a.id, { update_type, update_text });
      editingId = null;
      draft = '';
      await reload();
      dispatch('changed');
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
  }

  function isOverdue(a) {
    return a.status !== 'complete' && a.due_date && a.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }
</script>

<div class="mal">
  {#if error}<p class="mal-error">{error}</p>{/if}
  {#if loading}
    <p class="mal-state">Loading…</p>
  {:else if visible.length === 0}
    <p class="mal-state">{emptyText}</p>
  {:else}
    {#each visible as a (a.id)}
      <div class="mal-row" class:mal-row--done={a.status === 'complete'}>
        <div class="mal-main">
          <div class="mal-line">
            {#if a.status === 'complete'}<i class="las la-check-circle mal-tick"></i>{/if}
            <span class="mal-text">{a.action_text}</span>
          </div>
          <div class="mal-meta">
            {#if a.owner}<span>{a.owner}</span>{/if}
            {#if a.due_date}<span class:mal-overdue={isOverdue(a)}>Due {formatDate(a.due_date)}</span>{/if}
            {#if showMeeting && a.meeting_title}<span>from {a.meeting_title}</span>{/if}
            {#if showProject && a.project_name}<span class="badge badge-neutral">{a.project_name}</span>{/if}
          </div>
          {#each a.updates || [] as u}
            <div class="mal-update">
              <span class="mal-update-date">{formatDate(u.created_at)}</span>
              {#if u.update_type === 'completed'}<strong>Resolved.</strong>{/if}
              {u.update_text || ''}
            </div>
          {/each}

          {#if editingId === a.id}
            <div class="mal-edit">
              <input
                class="form-input"
                type="text"
                placeholder="What's happened on this action…"
                bind:value={draft}
                on:keydown={(e) => e.key === 'Enter' && draft.trim() && submit(a, 'progress', draft)}
              />
              <button class="btn btn-primary btn-sm" disabled={!draft.trim() || busyId === a.id} on:click={() => submit(a, 'progress', draft)}>Save</button>
              <button class="btn btn-ghost btn-sm" on:click={() => (editingId = null)}>Cancel</button>
            </div>
          {/if}
        </div>

        {#if a.status !== 'complete' && editingId !== a.id}
          <div class="mal-buttons">
            <button class="btn btn-secondary btn-sm" disabled={busyId === a.id} on:click={() => startUpdate(a)}>
              <i class="las la-comment"></i> Update
            </button>
            <button class="btn btn-secondary btn-sm" disabled={busyId === a.id} on:click={() => submit(a, 'completed')}>
              <i class="las la-check"></i> Resolve
            </button>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .mal { display: flex; flex-direction: column; gap: 0.5rem; }
  .mal-state { margin: 0; font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .mal-error { margin: 0; font-size: 0.8rem; color: var(--color-red-600); }
  .mal-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); font-size: 0.8rem; }
  .mal-row--done { opacity: 0.6; }
  .mal-row--done .mal-text { text-decoration: line-through; }
  .mal-main { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1; }
  .mal-line { display: flex; align-items: flex-start; gap: 0.3rem; }
  .mal-tick { color: var(--color-emerald-600); margin-top: 1px; }
  .mal-text { color: var(--color-slate-800); font-weight: 500; }
  .mal-meta { display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; font-size: 0.72rem; color: var(--color-slate-500); }
  .mal-overdue { color: var(--color-red-600); font-weight: 600; }
  .mal-update { font-size: 0.75rem; color: var(--color-slate-600); padding-left: 0.6rem; border-left: 2px solid var(--color-slate-200); }
  .mal-update-date { color: var(--color-slate-400); margin-right: 0.3rem; }
  .mal-edit { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem; }
  .mal-buttons { display: flex; gap: 0.35rem; flex-shrink: 0; }
</style>
