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

  let stages = [];   // [{instance_id, stage_name, display_order, is_complete, is_applicable, ...}]
  let tracks = [];   // [{id, label, is_key_issue, last_known_risk_level, ...}]
  let entries = [];  // [{project_stage_instance_id, issue_track_id, risk_level, summary, notes}]
  let loading = false;
  let error = null;

  let showCompletionModal = false;
  let completionStage = null;

  let showAddIssueModal = false;

  const RISK_COLORS = {
    showstopper:        { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'Showstopper' },
    extremely_high_risk:{ bg: '#fff7ed', text: '#9a3412', border: '#fb923c', label: 'Extremely High' },
    high_risk:          { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', label: 'High' },
    medium_high_risk:   { bg: '#fefce8', text: '#854d0e', border: '#fde047', label: 'Med-High' },
    medium_risk:        { bg: '#f0fdf4', text: '#166534', border: '#86efac', label: 'Medium' },
    medium_low_risk:    { bg: '#f0fdf4', text: '#166534', border: '#6ee7b7', label: 'Med-Low' },
    low_risk:           { bg: '#f0fdf4', text: '#14532d', border: '#4ade80', label: 'Low' }
  };

  function riskStyle(level) {
    const r = RISK_COLORS[level];
    if (!r) return '';
    return `background:${r.bg}; color:${r.text}; border-color:${r.border}`;
  }

  function riskLabel(level) {
    return RISK_COLORS[level]?.label || level || '—';
  }

  function getEntry(stageInstanceId, trackId) {
    return entries.find(
      e => e.project_stage_instance_id === stageInstanceId && e.issue_track_id === trackId
    ) || null;
  }

  async function loadBoard() {
    if (!project) return;
    loading = true;
    error = null;
    try {
      let board = await getStageBoard(project.id);
      // If no stages yet, initialize
      if (board.stages.length === 0) {
        board = await initializeStageBoard(project.id);
      }
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
    try {
      await toggleStageApplicability(project.id, stage.instance_id);
      await loadBoard();
    } catch (err) {
      console.error(err);
    }
  }

  function openCompletionModal(stage) {
    completionStage = stage;
    showCompletionModal = true;
  }

  async function handleStageSaved() {
    showCompletionModal = false;
    completionStage = null;
    await loadBoard();
  }

  async function handleAddIssue(event) {
    const { label } = event.detail;
    try {
      await createIssueTrack(project.id, { label });
      showAddIssueModal = false;
      await loadBoard();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleKeyIssue(track) {
    try {
      await updateIssueTrack(track.id, { isKeyIssue: !track.is_key_issue });
      await loadBoard();
    } catch (err) {
      console.error(err);
    }
  }

  $: if (project) loadBoard();
</script>

{#if !project}
  <div class="empty-state">
    <i class="las la-folder-open"></i>
    <p>Select a project to view its stage board.</p>
  </div>
{:else if loading}
  <div class="empty-state">
    <i class="las la-spinner la-spin"></i>
    <p>Loading stage board…</p>
  </div>
{:else if error}
  <div class="empty-state error">
    <i class="las la-exclamation-circle"></i>
    <p>{error}</p>
  </div>
{:else}
  <div class="board-header-row">
    <h2 class="project-name">{project.project_name}</h2>
    <button class="add-issue-btn" on:click={() => (showAddIssueModal = true)}>
      <i class="las la-plus"></i>
      Add issue row
    </button>
  </div>

  <div class="board-wrapper">
    <table class="board-table">
      <thead>
        <tr>
          <!-- Sticky left column header -->
          <th class="track-header sticky-left">Issue</th>
          {#each stages as stage}
            <th
              class="stage-header"
              class:not-applicable={!stage.is_applicable}
              class:complete={stage.is_complete}
            >
              <div class="stage-header-inner">
                <!-- Applicability toggle -->
                <button
                  class="applicability-toggle"
                  title={stage.is_applicable ? 'Mark as not applicable' : 'Mark as applicable'}
                  on:click={() => handleToggleApplicability(stage)}
                >
                  <i class="las {stage.is_applicable ? 'la-eye' : 'la-eye-slash'}"></i>
                </button>

                <span class="stage-name" class:na={!stage.is_applicable}>{stage.stage_name}</span>

                <!-- Complete checkbox -->
                <button
                  class="complete-btn"
                  class:done={stage.is_complete}
                  title={stage.is_complete ? 'Stage complete — click to reopen' : 'Mark stage complete'}
                  on:click={() => openCompletionModal(stage)}
                  disabled={!stage.is_applicable}
                >
                  <i class="las {stage.is_complete ? 'la-check-square' : 'la-square'}"></i>
                </button>
              </div>
            </th>
          {/each}
        </tr>
      </thead>

      <tbody>
        {#each tracks as track}
          <tr>
            <!-- Sticky left: track label + key issue toggle -->
            <td class="track-cell sticky-left">
              <div class="track-label-row">
                <button
                  class="key-issue-btn"
                  class:active={track.is_key_issue}
                  title={track.is_key_issue ? 'Remove key issue flag' : 'Mark as key issue'}
                  on:click={() => handleToggleKeyIssue(track)}
                >
                  <i class="las {track.is_key_issue ? 'la-flag' : 'la-flag'}"></i>
                </button>
                <span class="track-label" class:key-issue={track.is_key_issue}>
                  {track.label}
                </span>
                {#if track.last_known_risk_level}
                  <span class="risk-chip" style={riskStyle(track.last_known_risk_level)}>
                    {riskLabel(track.last_known_risk_level)}
                  </span>
                {/if}
              </div>
            </td>

            {#each stages as stage}
              {@const entry = getEntry(stage.instance_id, track.id)}
              <td
                class="entry-cell"
                class:not-applicable={!stage.is_applicable}
              >
                {#if !stage.is_applicable}
                  <span class="na-label">N/A</span>
                {:else if entry}
                  <div class="entry-content">
                    {#if entry.risk_level}
                      <span class="entry-risk" style={riskStyle(entry.risk_level)}>
                        {riskLabel(entry.risk_level)}
                      </span>
                    {/if}
                    {#if entry.summary}
                      <p class="entry-summary">{entry.summary}</p>
                    {/if}
                  </div>
                {:else}
                  <span class="empty-cell">—</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}

        {#if tracks.length === 0}
          <tr>
            <td class="no-tracks" colspan={stages.length + 1}>
              No issue rows yet. Add one or run an HLPV analysis to seed rows automatically.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
{/if}

{#if showCompletionModal && completionStage}
  <ProjectStageCompletionModal
    {project}
    stage={completionStage}
    {tracks}
    {currentUserName}
    on:saved={handleStageSaved}
    on:close={() => (showCompletionModal = false)}
  />
{/if}

{#if showAddIssueModal}
  <ProjectStageAddIssueModal
    on:add={handleAddIssue}
    on:close={() => (showAddIssueModal = false)}
  />
{/if}

<style>
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #94a3b8;
  }

  .empty-state i {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.75rem;
  }

  .empty-state.error { color: #ef4444; }
  .empty-state p { margin: 0; font-size: 0.9375rem; }

  .board-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .project-name {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .add-issue-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4375rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-issue-btn:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .board-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: white;
  }

  .board-table {
    border-collapse: collapse;
    width: 100%;
    min-width: max-content;
  }

  /* ── Sticky left column ── */
  .sticky-left {
    position: sticky;
    left: 0;
    z-index: 2;
    background: white;
  }

  /* ── Stage header ── */
  .stage-header {
    min-width: 160px;
    padding: 0;
    border-left: 1px solid #e2e8f0;
    border-bottom: 2px solid #e2e8f0;
    vertical-align: top;
  }

  .stage-header.complete { background: #f0fdf4; }
  .stage-header.not-applicable { background: #f8fafc; }

  .stage-header-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.625rem 0.5rem;
    text-align: center;
  }

  .stage-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.3;
  }

  .stage-name.na { color: #94a3b8; text-decoration: line-through; }

  .applicability-toggle,
  .complete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.125rem;
    color: #94a3b8;
    transition: color 0.15s;
  }

  .applicability-toggle:hover { color: #64748b; }
  .complete-btn:hover:not(:disabled) { color: #10b981; }
  .complete-btn.done { color: #10b981; }
  .complete-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ── Track header (left column header) ── */
  .track-header {
    min-width: 220px;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #64748b;
    text-align: left;
    border-bottom: 2px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
  }

  /* ── Track cell (left column body) ── */
  .track-cell {
    padding: 0.625rem 1rem;
    border-right: 1px solid #e2e8f0;
    border-bottom: 1px solid #f1f5f9;
    background: white;
    min-width: 220px;
  }

  .track-label-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .key-issue-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: #cbd5e1;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .key-issue-btn.active { color: #f59e0b; }
  .key-issue-btn:hover { color: #f59e0b; }

  .track-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
  }

  .track-label.key-issue { font-weight: 600; }

  .risk-chip {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
  }

  /* ── Entry cell ── */
  .entry-cell {
    padding: 0.5rem 0.75rem;
    border-left: 1px solid #e2e8f0;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
    min-width: 160px;
  }

  .entry-cell.not-applicable { background: #f8fafc; }

  .na-label {
    font-size: 0.8125rem;
    color: #cbd5e1;
  }

  .empty-cell {
    font-size: 0.8125rem;
    color: #e2e8f0;
  }

  .entry-content {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .entry-risk {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.4rem;
    border-radius: 3px;
    border: 1px solid;
  }

  .entry-summary {
    margin: 0;
    font-size: 0.8125rem;
    color: #475569;
    line-height: 1.4;
  }

  .no-tracks {
    padding: 2rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.875rem;
  }
</style>
