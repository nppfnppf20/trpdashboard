<script>
  import { onMount } from 'svelte';
  import ProjectStageCompletionModal from './ProjectStageCompletionModal.svelte';
  import ProjectStageAddIssueModal from './ProjectStageAddIssueModal.svelte';
  import {
    getStageBoard,
    initializeStageBoard,
    toggleStageApplicability,
    createIssueTrack,
    updateIssueTrack
  } from '$lib/services/workflowApi.js';

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
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleToggleApplicability(stage) {
    try { await toggleStageApplicability(project.id, stage.instance_id); await loadBoard(); } catch {}
  }

  function openCompletionModal(stage) { completionStage = stage; showCompletionModal = true; }

  async function handleStageSaved() { showCompletionModal = false; completionStage = null; await loadBoard(); }

  async function handleAddIssue(event) {
    try { await createIssueTrack(project.id, { label: event.detail.label }); showAddIssueModal = false; await loadBoard(); } catch {}
  }

  async function handleToggleKeyIssue(track) {
    try { await updateIssueTrack(track.id, { isKeyIssue: !track.is_key_issue }); await loadBoard(); } catch {}
  }

  $: if (project?.id) loadBoard();
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
          <th class="no-sort track-col">Issue</th>
          {#each stages as stage}
            <th class="no-sort stage-col" class:stage-complete={stage.is_complete} class:stage-na={!stage.is_applicable}>
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
        {#each tracks as track}
          <tr>
            <td class="track-cell">
              <div class="track-inner">
                <button class="btn btn-ghost btn-sm btn-icon key-flag" class:flagged={track.is_key_issue} on:click={() => handleToggleKeyIssue(track)} title={track.is_key_issue ? 'Remove key issue' : 'Mark as key issue'}>
                  <i class="las la-flag"></i>
                </button>
                <span class:text-bold={track.is_key_issue}>{track.label}</span>
                {#if track.last_known_risk_level}
                  <span class="risk-chip" style={riskStyle(track.last_known_risk_level)}>{riskLabel(track.last_known_risk_level)}</span>
                {/if}
              </div>
            </td>
            {#each stages as stage}
              {@const entry = getEntry(stage.instance_id, track.id)}
              <td class="entry-cell" class:na-cell={!stage.is_applicable}>
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
        {#if tracks.length === 0}
          <tr><td class="text-muted" colspan={stages.length + 1} style="text-align:center;padding:2rem">No issue rows yet. Add one above, or run an HLPV analysis to auto-seed rows.</td></tr>
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

<style>
  .board-header { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
  .board-scroll { overflow-x: auto; }
  .board-table { min-width: max-content; }
  .track-col { min-width: 220px; position: sticky; left: 0; background: #f8fafc; z-index: 2; }
  .stage-col { min-width: 150px; text-align: center; }
  .stage-col.stage-complete { background: #f0fdf4; }
  .stage-col.stage-na { background: #f8fafc; }
  .stage-th-inner { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.25rem; }
  .na-text { text-decoration: line-through; color: #94a3b8; }
  .eye-toggle i { font-size: 1.25rem; }
  .complete-toggle { color: #cbd5e1; transition: color 0.2s; }
  .complete-toggle i { font-size: 1.35rem; }
  .complete-toggle:hover:not(:disabled) { color: #10b981; }
  .complete-toggle.is-done { color: #10b981; }
  .track-cell { position: sticky; left: 0; background: white; z-index: 1; }
  .track-inner { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
  .track-inner > span:not(.risk-chip) { flex: 1; min-width: 0; }
  .key-flag { color: #cbd5e1; }
  .key-flag.flagged { color: #f59e0b; }
  .risk-chip { font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.4rem; border-radius: 3px; white-space: nowrap; }
  .entry-cell { vertical-align: top; text-align: center; }
  .entry-cell .entry-inner { text-align: left; }
  .na-cell { background: #f8fafc; }
  .entry-inner { display: flex; flex-direction: column; gap: 0.3rem; }
  .entry-summary { margin: 0; font-size: 0.8125rem; color: #475569; line-height: 1.4; }
</style>
