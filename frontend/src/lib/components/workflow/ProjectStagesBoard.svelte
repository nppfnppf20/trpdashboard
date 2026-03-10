<script>
  import { onMount } from 'svelte';
  import ProjectStageCompletionModal from './ProjectStageCompletionModal.svelte';
  import ProjectStageAddIssueModal from './ProjectStageAddIssueModal.svelte';
  import ProjectStageEntryModal from './ProjectStageEntryModal.svelte';
  import {
    getStageBoard,
    initializeStageBoard,
    toggleStageApplicability,
    reorderStages,
    reorderIssueTracks,
    createIssueTrack,
    updateIssueTrack
  } from '$lib/services/workflowApi.js';

  function focusOnMount(node) { node.focus(); node.select(); }

  export let project = null;
  export let currentUserName = null;

  let stages = [];
  let tracks = [];
  let entries = [];
  let loading = false;
  let error = null;
  let showCompletionModal = false;
  let completionStage = null;
  let showAddIssueModal = false;
  let showEntryModal = false;
  let entryModalStage = null;
  let entryModalTrack = null;
  let entryModalExisting = null;
  let editingTrackId = null;
  let editingLabel = '';

  const RISK_ORDER = ['showstopper','extremely_high_risk','high_risk','medium_high_risk','medium_risk','medium_low_risk','low_risk'];
  function riskSortValue(level) { const i = RISK_ORDER.indexOf(level); return i === -1 ? 999 : i; }

  let sortedTracks = [];
  function applyRiskSort(t) {
    return [...t].sort((a, b) => riskSortValue(a.last_known_risk_level) - riskSortValue(b.last_known_risk_level));
  }

  const RISK_COLORS = {
    showstopper:         { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'Showstopper' },
    extremely_high_risk: { bg: '#fff7ed', text: '#9a3412', border: '#fb923c', label: 'Extremely High' },
    high_risk:           { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', label: 'High' },
    medium_high_risk:    { bg: '#fefce8', text: '#854d0e', border: '#fde047', label: 'Med-High' },
    medium_risk:         { bg: '#f0fdf4', text: '#166534', border: '#86efac', label: 'Medium' },
    medium_low_risk:     { bg: '#f0fdf4', text: '#166534', border: '#6ee7b7', label: 'Med-Low' },
    low_risk:            { bg: '#f0fdf4', text: '#14532d', border: '#4ade80', label: 'Low' }
  };

  function riskStyle(level) {
    const r = RISK_COLORS[level];
    return r ? `background:${r.bg};color:${r.text};border:1px solid ${r.border};` : '';
  }

  function riskLabel(level) {
    return RISK_COLORS[level]?.label || level || '—';
  }

  function getEntry(stageInstanceId, trackId) {
    return entries.find(e => e.project_stage_instance_id === stageInstanceId && e.issue_track_id === trackId) || null;
  }

  async function loadBoard() {
    if (!project?.id) return;
    loading = true;
    error = null;
    try {
      let board = await getStageBoard(project.id);
      if (board.stages.length === 0) board = await initializeStageBoard(project.id);
      stages = board.stages;
      tracks = board.tracks;
      entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleToggleApplicability(stage) {
    try {
      const res = await toggleStageApplicability(project.id, stage.instance_id);
      stages = stages.map(s => s.instance_id === stage.instance_id ? { ...s, is_applicable: res.is_applicable } : s);
    } catch {}
  }

  function openCompletionModal(stage) { completionStage = stage; showCompletionModal = true; }

  async function handleStageSaved() {
    showCompletionModal = false;
    completionStage = null;
    // Reload silently without triggering the loading state
    try {
      const board = await getStageBoard(project.id);
      stages = board.stages;
      tracks = board.tracks;
      entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
    } catch {}
  }

  async function handleAddIssue(event) {
    try {
      await createIssueTrack(project.id, { label: event.detail.label, discipline: event.detail.discipline });
      showAddIssueModal = false;
      const board = await getStageBoard(project.id);
      stages = board.stages; tracks = board.tracks; entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
    } catch {}
  }

  function startRename(track) {
    editingTrackId = track.id;
    editingLabel = track.label;
  }

  async function commitRename(track) {
    const trimmed = editingLabel.trim();
    editingTrackId = null;
    if (!trimmed || trimmed === track.label) return;
    try {
      const res = await updateIssueTrack(track.id, { label: trimmed });
      tracks = tracks.map(t => t.id === track.id ? { ...t, label: res.label } : t);
    } catch {}
  }

  function onRenameKeydown(event, track) {
    if (event.key === 'Enter') event.target.blur();
    if (event.key === 'Escape') { editingTrackId = null; }
  }

  async function handleDeleteTrack(track) {
    try {
      await updateIssueTrack(track.id, { isActive: false });
      tracks = tracks.filter(t => t.id !== track.id);
      sortedTracks = sortedTracks.filter(t => t.id !== track.id);
    } catch {}
  }

  async function handleToggleKeyIssue(track) {
    try {
      const res = await updateIssueTrack(track.id, { isKeyIssue: !track.is_key_issue });
      tracks = tracks.map(t => t.id === track.id ? { ...t, is_key_issue: res.is_key_issue } : t);
      sortedTracks = sortedTracks.map(t => t.id === track.id ? { ...t, is_key_issue: res.is_key_issue } : t);
    } catch {}
  }

  function openEntryModal(stage, track) {
    if (!stage.is_applicable) return;
    entryModalStage = stage;
    entryModalTrack = track;
    entryModalExisting = getEntry(stage.instance_id, track.id);
    showEntryModal = true;
  }

  function handleEntrySaved(event) {
    const saved = event.detail;
    // Update entries array locally
    const idx = entries.findIndex(e =>
      e.project_stage_instance_id === saved.project_stage_instance_id &&
      e.issue_track_id === saved.issue_track_id
    );
    if (idx >= 0) {
      entries[idx] = saved;
    } else {
      entries = [...entries, saved];
    }
    if (saved.risk_level) {
      tracks = tracks.map(t => t.id === saved.issue_track_id ? { ...t, last_known_risk_level: saved.risk_level } : t);
      sortedTracks = applyRiskSort(tracks);
    }
    showEntryModal = false;
  }

  $: if (project?.id) loadBoard();

  // ── Drag-and-drop column reordering ──────────────────────────────────────
  let draggedIdx = null;
  let dragOverIdx = null;

  function onDragStart(event, idx) {
    draggedIdx = idx;
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(event, idx) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverIdx = idx;
  }

  function onDragLeave() {
    dragOverIdx = null;
  }

  async function onDrop(event, idx) {
    event.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) { draggedIdx = null; dragOverIdx = null; return; }
    const reordered = [...stages];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(idx, 0, moved);
    stages = reordered;
    draggedIdx = null;
    dragOverIdx = null;
    try {
      await reorderStages(reordered.map(s => s.stage_definition_id));
    } catch {}
  }

  function onDragEnd() {
    draggedIdx = null;
    dragOverIdx = null;
  }

  // ── Drag-and-drop row reordering ─────────────────────────────────────────
  let draggedRowIdx = null;
  let dragOverRowIdx = null;

  function onRowDragStart(event, idx) {
    draggedRowIdx = idx;
    event.dataTransfer.effectAllowed = 'move';
  }

  function onRowDragOver(event, idx) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverRowIdx = idx;
  }

  function onRowDragLeave() { dragOverRowIdx = null; }

  async function onRowDrop(event, idx) {
    event.preventDefault();
    if (draggedRowIdx === null || draggedRowIdx === idx) { draggedRowIdx = null; dragOverRowIdx = null; return; }
    const reordered = [...sortedTracks];
    const [moved] = reordered.splice(draggedRowIdx, 1);
    reordered.splice(idx, 0, moved);
    sortedTracks = reordered;
    draggedRowIdx = null;
    dragOverRowIdx = null;
    try { await reorderIssueTracks(project.id, reordered.map(t => t.id)); } catch {}
  }

  function onRowDragEnd() { draggedRowIdx = null; dragOverRowIdx = null; }
</script>

{#if !project?.id}
  <p class="empty">Select a project to view its stage board.</p>
{:else if loading}
  <div class="loading"><div class="spinner"></div><p>Loading stage board…</p></div>
{:else if error}
  <p class="empty">Error: {error}</p>
{:else}
  <div class="board-header">
    <button class="btn btn-secondary btn-sm" on:click={() => (showAddIssueModal = true)}>
      <i class="las la-plus"></i> Add issue row
    </button>
  </div>

  <div class="table-wrapper board-scroll">
    <table class="data-table board-table">
      <thead>
        <tr>
          <th class="no-sort discipline-col">Discipline</th>
          <th class="no-sort track-col">Specific Issue</th>
          <th class="no-sort risk-col">Risk</th>
          <th class="no-sort key-issue-col">Key Issue?</th>
          {#each stages as stage, i}
            <th
              class="no-sort stage-col"
              class:stage-complete={stage.is_complete}
              class:stage-na={!stage.is_applicable}
              class:drag-over={dragOverIdx === i}
              class:dragging={draggedIdx === i}
              draggable={true}
              on:dragstart={e => onDragStart(e, i)}
              on:dragover={e => onDragOver(e, i)}
              on:dragleave={onDragLeave}
              on:drop={e => onDrop(e, i)}
              on:dragend={onDragEnd}
            >
              <div class="stage-th-inner">
                <button class="btn btn-ghost btn-sm btn-icon eye-toggle" title={stage.is_applicable ? 'Mark N/A' : 'Mark applicable'} on:click={() => handleToggleApplicability(stage)}>
                  <i class="las {stage.is_applicable ? 'la-eye' : 'la-eye-slash'}"></i>
                </button>
                <span class:na-text={!stage.is_applicable}>{stage.stage_name}</span>
                <button
                  class="btn btn-ghost btn-sm btn-icon complete-toggle"
                  class:is-done={stage.is_complete}
                  title={stage.is_complete ? 'Completed' : 'Mark complete'}
                  on:click={() => openCompletionModal(stage)}
                  disabled={!stage.is_applicable}
                >
                  <i class="{stage.is_complete ? 'las la-check-square' : 'lar la-square'}"></i>
                </button>
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sortedTracks as track, ri}
          <tr
            class:key-issue-row={track.is_key_issue}
            class:row-dragging={draggedRowIdx === ri}
            class:row-drag-over={dragOverRowIdx === ri}
            draggable={editingTrackId !== track.id}
            on:dragstart={e => onRowDragStart(e, ri)}
            on:dragover={e => onRowDragOver(e, ri)}
            on:dragleave={onRowDragLeave}
            on:drop={e => onRowDrop(e, ri)}
            on:dragend={onRowDragEnd}
          >
            <td class="discipline-cell">
              <div class="discipline-inner">
                <div class="track-actions">
                  <button class="action-btn edit-btn" title="Rename" on:click={() => startRename(track)}><i class="las la-pen"></i></button>
                  <button class="action-btn delete-btn" title="Delete row" on:click={() => handleDeleteTrack(track)}><i class="las la-trash"></i></button>
                </div>
                <span>{track.discipline || '—'}</span>
              </div>
            </td>
            <td class="track-cell">
              <div class="track-inner">
                {#if editingTrackId === track.id}
                  <input
                    class="rename-input"
                    bind:value={editingLabel}
                    on:blur={() => commitRename(track)}
                    on:keydown={e => onRenameKeydown(e, track)}
                    use:focusOnMount
                  />
                {:else}
                  <span class:text-bold={track.is_key_issue}>{track.label || '—'}</span>
                {/if}
              </div>
            </td>
            <td class="risk-cell">
              {#if track.last_known_risk_level}
                <span class="risk-chip" style={riskStyle(track.last_known_risk_level)}>{riskLabel(track.last_known_risk_level)}</span>
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
            <td class="key-issue-cell">
              <button class="btn btn-ghost btn-sm btn-icon key-flag" class:flagged={track.is_key_issue} on:click={() => handleToggleKeyIssue(track)} title={track.is_key_issue ? 'Remove key issue' : 'Mark as key issue'}>
                <i class="las la-flag"></i>
              </button>
            </td>
            {#each stages as stage}
              {@const entry = getEntry(stage.instance_id, track.id)}
              <td
                class="entry-cell"
                class:na-cell={!stage.is_applicable}
                class:entry-clickable={stage.is_applicable}
                on:click={() => openEntryModal(stage, track)}
              >
                {#if !stage.is_applicable}
                  <span class="text-muted">N/A</span>
                {:else if entry}
                  <div class="entry-inner">
                    {#if entry.risk_level}
                      <span class="risk-chip" style={riskStyle(entry.risk_level)}>{riskLabel(entry.risk_level)}</span>
                    {/if}
                    {#if entry.summary}<p class="entry-summary">{entry.summary}</p>{/if}
                  </div>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
        {#if sortedTracks.length === 0}
          <tr><td class="text-muted" colspan={stages.length + 4} style="text-align:center;padding:2rem">No issue rows yet. Add one above, or run an HLPV analysis to auto-seed rows.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
{/if}

{#if showCompletionModal && completionStage}
  <ProjectStageCompletionModal
    {project} stage={completionStage} {tracks} {currentUserName}
    on:saved={handleStageSaved}
    on:close={() => (showCompletionModal = false)}
  />
{/if}

{#if showAddIssueModal}
  <ProjectStageAddIssueModal on:add={handleAddIssue} on:close={() => (showAddIssueModal = false)} />
{/if}

{#if showEntryModal && entryModalStage && entryModalTrack}
  <ProjectStageEntryModal
    {project}
    stage={entryModalStage}
    track={entryModalTrack}
    existingEntry={entryModalExisting}
    on:saved={handleEntrySaved}
    on:close={() => (showEntryModal = false)}
  />
{/if}

<style>
  .board-header { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
  .board-scroll { overflow-x: auto; }
  .board-table { min-width: max-content; }
  .discipline-col { min-width: 140px; position: sticky; left: 0; background: #f8fafc; z-index: 2; }
  .discipline-cell { min-width: 140px; position: sticky; left: 0; background: white; z-index: 1; padding: 0.75rem 1rem; font-size: 0.875rem; color: #64748b; }
  .discipline-inner { display: flex; align-items: center; gap: 0.4rem; }
  .track-col { min-width: 160px; position: sticky; left: 140px; background: #f8fafc; z-index: 2; }
  .stage-col { min-width: 150px; text-align: center; cursor: grab; transition: background 0.15s; }
  .stage-col:not(.stage-complete):not(.stage-na):hover { background: #faf5ff; }
  .stage-col:active { cursor: grabbing; }
  .stage-col.stage-complete { background: #f0fdf4; }
  .stage-col.stage-complete:hover { background: #dcfce7; }
  .stage-col.stage-na { background: #f8fafc; }
  .stage-col.stage-na:hover { background: #f1f5f9; }
  .stage-col.dragging { opacity: 0.4; cursor: grabbing; }
  .stage-col.drag-over { box-shadow: inset 3px 0 0 #9333ea; background: #faf5ff; }
  .stage-th-inner { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.25rem; }
  .na-text { text-decoration: line-through; color: #94a3b8; }
  .eye-toggle i { font-size: 1.25rem; }
  .track-th-title { font-weight: 600; }
  .complete-toggle { color: #cbd5e1; transition: color 0.2s; }
  .complete-toggle i { font-size: 1.35rem; }
  .complete-toggle:hover:not(:disabled) { color: #10b981; }
  .complete-toggle.is-done { color: #10b981; }
  .track-cell { position: sticky; left: 140px; background: white; z-index: 1; min-width: 160px; }
  .track-inner { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
  .track-inner > span:not(.risk-chip) { flex: 1; min-width: 0; }
  .track-actions { display: none; align-items: center; gap: 0.15rem; flex-shrink: 0; }
  .discipline-inner:hover .track-actions { display: flex; }
  .rename-input {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0.4rem;
    border: 1px solid #9333ea;
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
  }
  .risk-col { min-width: 110px; text-align: center; }
  .risk-cell { text-align: center; vertical-align: middle; }
  .key-issue-col {
    position: sticky;
    left: 300px;
    background: #f8fafc;
    z-index: 2;
    min-width: 80px;
    text-align: center;
    white-space: nowrap;
  }
  .key-issue-cell {
    position: sticky;
    left: 300px;
    background: white;
    z-index: 1;
    text-align: center;
  }
  .key-flag { color: #cbd5e1; }
  .key-flag i { font-size: 1.25rem; }
  .key-flag.flagged { color: #f59e0b; }
  .key-issue-row .discipline-cell,
  .key-issue-row .track-cell,
  .key-issue-row .risk-cell,
  .key-issue-row .key-issue-cell { background: #fffbeb; }
  .board-table tbody tr { cursor: grab; }
  .board-table tbody tr:active { cursor: grabbing; }
  .row-dragging { opacity: 0.4; cursor: grabbing; }
  .row-drag-over td { box-shadow: inset 0 3px 0 #9333ea; }
  .key-issue-row .entry-cell { background: rgba(245, 158, 11, 0.04); }
  .risk-chip { font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.4rem; border-radius: 3px; white-space: nowrap; }
  .entry-cell { vertical-align: top; text-align: center; }
  .entry-cell .entry-inner { text-align: left; }
  .na-cell { background: #f8fafc; }
  .entry-inner { display: flex; flex-direction: column; gap: 0.3rem; }
  .entry-summary { margin: 0; font-size: 0.8125rem; color: #475569; line-height: 1.4; }
  .entry-clickable { cursor: pointer; }
  .entry-clickable:hover { background: #f5f3ff; }
</style>
