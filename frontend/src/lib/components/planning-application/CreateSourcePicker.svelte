<script>
  // Source tree + context meter for the Create card. Same catalogue and budget as
  // Project Chat (GET /api/project-chat/:id/sources), but the meter also counts
  // `extraChars` (the document being written and the doc type's example), because
  // all of it shares the one context window.
  import { onMount, createEventDispatcher } from 'svelte';
  import { getChatSources } from '$lib/api/projectChat.js';

  export let project;
  export let extraChars = 0;
  export let disabled = false;

  const CONTEXT_BUDGET = 200000;
  const dispatch = createEventDispatcher();

  // Not offered here, same as Project Chat ('documents' is being phased out).
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions', 'documents', 'project_details', 'meetings'];

  let groups = [];
  let loading = true;
  let loadError = null;

  let detailsSelected = true;
  let selectedGroups = new Set();
  let selectedMeetingIds = new Set();
  let meetingsOpen = true;

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const data = await getChatSources(project.id);
      groups = data.groups;
      detailsSelected = groups.some(g => g.key === 'project_details');
    } catch (err) {
      console.error('Error loading sources:', err);
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  $: detailsGroup = groups.find(g => g.key === 'project_details');
  $: meetingGroup = groups.find(g => g.key === 'meetings');
  $: otherGroups = groups.filter(g => !HIDDEN_GROUP_KEYS.includes(g.key));

  function toggleMeeting(id) {
    const next = new Set(selectedMeetingIds);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedMeetingIds = next;
  }

  function toggleMeetingsGroup() {
    const ids = (meetingGroup?.items ?? []).map(i => i.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedMeetingIds.has(id));
    selectedMeetingIds = allSelected ? new Set() : new Set(ids);
  }

  function toggleGroup(key) {
    const next = new Set(selectedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    selectedGroups = next;
  }

  $: meetingIds = (meetingGroup?.items ?? []).map(i => i.id);
  $: allMeetingsSelected = meetingIds.length > 0 && meetingIds.every(id => selectedMeetingIds.has(id));
  $: someMeetingsSelected = meetingIds.some(id => selectedMeetingIds.has(id));

  $: sourcesChars =
    (detailsSelected ? (detailsGroup?.chars ?? 0) : 0) +
    (meetingGroup?.items ?? []).filter(m => selectedMeetingIds.has(m.id)).reduce((acc, m) => acc + (m.chars ?? 0), 0) +
    groups.filter(g => selectedGroups.has(g.key)).reduce((acc, g) => acc + (g.chars ?? 0), 0);
  $: totalChars = sourcesChars + extraChars;
  $: pct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: overBudget = totalChars > CONTEXT_BUDGET;

  // Tell the parent what to send and whether it fits.
  $: dispatch('change', {
    sources: {
      project_details: detailsSelected,
      document_ids: [],
      meeting_ids: [...selectedMeetingIds],
      groups: [...selectedGroups],
    },
    overBudget,
    anySelected: detailsSelected || selectedGroups.size > 0 || selectedMeetingIds.size > 0,
  });

  const fmtChars = c => (c >= 1000 ? `${Math.round(c / 1000)}k` : `${c}`);
</script>

<div class="csp" class:csp--disabled={disabled}>
  <div class="csp-title">Sources</div>
  {#if loading}
    <div class="csp-note"><div class="csp-spinner"></div> Loading sources…</div>
  {:else if loadError}
    <div class="csp-note csp-note--error">
      <p>{loadError}</p>
      <button class="btn btn-secondary" on:click={load}>Retry</button>
    </div>
  {:else}
    <div class="csp-scroll">
      <p class="csp-hint">Tick what the AI can write from. With nothing ticked it writes only from what you tell it.</p>

      {#if detailsGroup}
        <label class="csp-row">
          <input type="checkbox" bind:checked={detailsSelected} />
          <span class="csp-label">Project Details</span>
          <span class="csp-chars">{fmtChars(detailsGroup.chars)}</span>
        </label>
      {/if}

      {#if meetingGroup}
        <div class="csp-row csp-row--group">
          <input
            type="checkbox"
            checked={allMeetingsSelected}
            indeterminate={someMeetingsSelected && !allMeetingsSelected}
            disabled={meetingIds.length === 0}
            on:change={toggleMeetingsGroup}
          />
          <button class="csp-toggle" on:click={() => meetingsOpen = !meetingsOpen}>
            <i class="las {meetingsOpen ? 'la-angle-down' : 'la-angle-right'}"></i>
            <span>{meetingGroup.label} ({meetingGroup.items.length})</span>
          </button>
        </div>
        {#if meetingsOpen}
          {#each meetingGroup.items as item (item.id)}
            <label class="csp-row csp-row--item">
              <input type="checkbox" checked={selectedMeetingIds.has(item.id)} on:change={() => toggleMeeting(item.id)} />
              <span class="csp-label" title={item.label}>{item.label}</span>
              <span class="csp-chars">{fmtChars(item.chars)}</span>
            </label>
          {:else}
            <div class="csp-empty">None yet</div>
          {/each}
        {/if}
      {/if}

      {#each otherGroups as group (group.key)}
        <label class="csp-row" class:csp-row--disabled={group.count === 0}>
          <input type="checkbox" checked={selectedGroups.has(group.key)} disabled={group.count === 0} on:change={() => toggleGroup(group.key)} />
          <span class="csp-label">{group.label} ({group.count})</span>
          {#if group.chars > 0}<span class="csp-chars">{fmtChars(group.chars)}</span>{/if}
        </label>
      {/each}
    </div>

    <div class="csp-meter">
      <span class="csp-meter-label">~{pct}% of context window used</span>
      <div class="csp-meter-track">
        <div class="csp-meter-fill" class:csp-meter-fill--warn={pct >= 50} class:csp-meter-fill--high={pct >= 75} style="width:{pct}%"></div>
      </div>
      <span class="csp-meter-sub">Includes the document ({fmtChars(extraChars)})</span>
      {#if overBudget}<span class="csp-meter-error">Untick some sources to make room</span>{/if}
    </div>
  {/if}
</div>

<style>
  .csp {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-white);
  }
  .csp--disabled { opacity: 0.6; pointer-events: none; }

  .csp-title {
    padding: 0.75rem 0.85rem 0.25rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-slate-500);
  }
  .csp-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.25rem 0.5rem 0.5rem;
  }
  .csp-hint {
    margin: 0 0.35rem 0.5rem;
    font-size: 0.72rem;
    line-height: 1.4;
    color: var(--color-slate-400);
  }

  .csp-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.3rem 0.35rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    color: var(--color-slate-700);
    cursor: pointer;
  }
  .csp-row:hover { background: var(--color-slate-50); }
  .csp-row--item { padding-left: 1.5rem; }
  .csp-row--group { cursor: default; }
  .csp-row--disabled { opacity: 0.5; cursor: default; }

  .csp-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .csp-chars {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--color-slate-400);
  }
  .csp-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .csp-empty {
    padding: 0.2rem 1.5rem;
    font-size: 0.75rem;
    font-style: italic;
    color: var(--color-slate-400);
  }

  .csp-note {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 0.85rem;
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }
  .csp-note--error { color: var(--color-red-600); }
  .csp-note--error p { margin: 0; }
  .csp-spinner {
    width: 0.8rem;
    height: 0.8rem;
    border: 2px solid var(--color-slate-300);
    border-top-color: var(--color-slate-500);
    border-radius: 50%;
    animation: csp-spin 0.8s linear infinite;
  }
  @keyframes csp-spin { to { transform: rotate(360deg); } }

  .csp-meter {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem 0.85rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }
  .csp-meter-label { font-size: 0.75rem; color: var(--color-slate-600); }
  .csp-meter-sub { font-size: 0.68rem; color: var(--color-slate-400); }
  .csp-meter-error { font-size: 0.72rem; color: var(--color-red-600); }
  .csp-meter-track {
    height: 6px;
    border-radius: 3px;
    background: var(--color-slate-200);
    overflow: hidden;
  }
  .csp-meter-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--color-emerald-600);
    transition: width 0.2s ease, background 0.2s ease;
  }
  .csp-meter-fill--warn { background: var(--color-amber-600); }
  .csp-meter-fill--high { background: var(--color-red-600); }
</style>
