<script>
  import { onMount } from 'svelte';
  import ProjectStageCompletionModal from './ProjectStageCompletionModal.svelte';
  import ProjectStageAddIssueModal from './ProjectStageAddIssueModal.svelte';
  import ProjectStageEntryModal from './ProjectStageEntryModal.svelte';
  import PopulateFromBriefingModal from '$lib/components/briefing-populate/PopulateFromBriefingModal.svelte';
  import {
    getStageBoard,
    initializeStageBoard,
    toggleStageApplicability,
    reorderStages,
    reorderIssueTracks,
    createIssueTrack,
    updateIssueTrack,
    getRefusalReasons,
    createRefusalReason,
    updateRefusalReason,
    deleteRefusalReason,
    createCustomStage,
    reorderProjectStages
  } from '$lib/services/workflowApi.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';

  function focusOnMount(node) { node.focus(); node.select(); }

  export let project = null;
  export let currentUserName = null;

  let stages = [];
  let tracks = [];
  let keyIssues = [];
  let entries = [];
  let loading = false;
  let error = null;
  let showCompletionModal = false;
  let completionStage = null;
  let showAddIssueModal = false;
  let showPopulateModal = false;
  let showEntryModal = false;
  let entryModalStage = null;
  let entryModalTrack = null;
  let entryModalExisting = null;
  let editingTrackId = null;
  let editingLabel = '';
  let addingTrack = false;
  let newTrackDiscipline = '';
  let newTrackLabel = '';
  let issueTypes = [];
  let issueTypePickerTrackId = null;

  onMount(async () => {
    try { issueTypes = await listIssueTypes(); }
    catch (err) { console.error('Failed to load issue types', err); }
  });

  // Stage columns visibility — set false to show simplified Key Issues view
  const showStageColumns = false;

  // Custom stage state
  let showAddStageForm = false;
  let newStageName = '';
  let addingStage = false;

  // Appeal-specific state
  $: isAppealProject = project?.project_type === 'Appeal';
  let refusalReasons = [];
  let showAddReasonForm = false;
  let editingReasonId = null;
  let newReason = { title: '', summary: '', riskLevel: '', isKeyIssue: false };
  let editingReasonData = { title: '', summary: '', riskLevel: '', isKeyIssue: false };

  const DISCIPLINES = [
    { value: 'heritage',   label: 'Heritage' },
    { value: 'landscape',  label: 'Landscape' },
    { value: 'ecology',    label: 'Ecology' },
    { value: 'ag_land',    label: 'Agricultural Land' },
    { value: 'renewables', label: 'Renewables' },
    { value: 'trees',      label: 'Trees' },
    { value: 'airfields',  label: 'Airfields' },
    { value: 'flood',      label: 'Flood Risk' },
    { value: 'aviation',   label: 'Aviation' },
    { value: 'highways',   label: 'Highways' },
    { value: 'amenity',    label: 'Amenity' }
  ];

  const RISK_LEVELS = [
    { value: 'showstopper',         label: 'Showstopper' },
    { value: 'extremely_high_risk', label: 'Extremely High' },
    { value: 'high_risk',           label: 'High' },
    { value: 'medium_high_risk',    label: 'Med-High' },
    { value: 'medium_risk',         label: 'Medium' },
    { value: 'medium_low_risk',     label: 'Med-Low' },
    { value: 'low_risk',            label: 'Low' }
  ];

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

  function getKeyIssueEntry(stageInstanceId, keyIssueId) {
    return entries.find(e => e.project_stage_instance_id === stageInstanceId && e.key_issue_id === keyIssueId) || null;
  }

  function isHLPVStage(stage) {
    return stage.stage_name === 'High-Level Planning View';
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
      keyIssues = board.keyIssues || [];
      entries = board.entries;
      sortedTracks = applyRiskSort(tracks);

      if (isAppealProject) {
        const data = await getRefusalReasons(project.id);
        refusalReasons = data.reasons || [];
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleAddReason() {
    if (!newReason.title.trim()) return;
    try {
      const created = await createRefusalReason(project.id, {
        title: newReason.title.trim(),
        summary: newReason.summary.trim() || null,
        riskLevel: newReason.riskLevel || null,
        isKeyIssue: newReason.isKeyIssue
      });
      refusalReasons = [...refusalReasons, created];
      newReason = { title: '', summary: '', riskLevel: '', isKeyIssue: false };
      showAddReasonForm = false;
    } catch {}
  }

  function startEditReason(reason) {
    editingReasonId = reason.id;
    editingReasonData = {
      title: reason.title,
      summary: reason.summary || '',
      riskLevel: reason.risk_level || '',
      isKeyIssue: reason.is_key_issue
    };
  }

  async function commitEditReason(reason) {
    if (!editingReasonData.title.trim()) return;
    try {
      const updated = await updateRefusalReason(project.id, reason.id, {
        title: editingReasonData.title.trim(),
        summary: editingReasonData.summary.trim() || null,
        riskLevel: editingReasonData.riskLevel || null,
        isKeyIssue: editingReasonData.isKeyIssue
      });
      refusalReasons = refusalReasons.map(r => r.id === reason.id ? updated : r);
      editingReasonId = null;
    } catch {}
  }

  async function handleDeleteReason(reason) {
    try {
      await deleteRefusalReason(project.id, reason.id);
      refusalReasons = refusalReasons.filter(r => r.id !== reason.id);
    } catch {}
  }

  async function handleToggleReasonKeyIssue(reason) {
    try {
      const updated = await updateRefusalReason(project.id, reason.id, {
        title: reason.title,
        summary: reason.summary || null,
        riskLevel: reason.risk_level || null,
        isKeyIssue: !reason.is_key_issue
      });
      refusalReasons = refusalReasons.map(r => r.id === reason.id ? updated : r);
    } catch {}
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
      keyIssues = board.keyIssues || [];
      entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
    } catch {}
  }

  async function handleAddIssue(event) {
    try {
      await createIssueTrack(project.id, { label: event.detail.label, discipline: event.detail.discipline, issue_type_id: event.detail.issue_type_id, riskLevel: event.detail.riskLevel, isKeyIssue: event.detail.isKeyIssue });
      showAddIssueModal = false;
      const board = await getStageBoard(project.id);
      stages = board.stages; tracks = board.tracks; keyIssues = board.keyIssues || []; entries = board.entries;
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

  function toggleIssueTypePicker(track) {
    issueTypePickerTrackId = issueTypePickerTrackId === track.id ? null : track.id;
  }

  async function assignIssueType(track, issueTypeIdRaw) {
    const issueTypeId = issueTypeIdRaw ? parseInt(issueTypeIdRaw, 10) : null;
    issueTypePickerTrackId = null;
    if (issueTypeId === (track.issue_type_id ?? null)) return;
    try {
      await updateIssueTrack(track.id, { issue_type_id: issueTypeId });
      const matched = issueTypeId ? issueTypes.find(t => t.id === issueTypeId) : null;
      const patch = {
        issue_type_id: issueTypeId,
        issue_type_label: matched?.label ?? null,
        issue_type_development_type: matched?.development_type ?? null,
      };
      tracks = tracks.map(t => t.id === track.id ? { ...t, ...patch } : t);
      sortedTracks = sortedTracks.map(t => t.id === track.id ? { ...t, ...patch } : t);
    } catch (err) {
      console.error('Failed to assign issue type', err);
    }
  }

  async function commitAddTrack() {
    const trimmed = newTrackLabel.trim();
    if (!trimmed) { addingTrack = false; newTrackDiscipline = ''; newTrackLabel = ''; return; }
    try {
      await createIssueTrack(project.id, { label: trimmed, discipline: newTrackDiscipline.trim() || null });
      newTrackDiscipline = '';
      newTrackLabel = '';
      addingTrack = false;
      const board = await getStageBoard(project.id);
      stages = board.stages; tracks = board.tracks; keyIssues = board.keyIssues || []; entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
    } catch {}
  }

  function onAddTrackKeydown(event) {
    if (event.key === 'Enter') commitAddTrack();
    if (event.key === 'Escape') { addingTrack = false; newTrackDiscipline = ''; newTrackLabel = ''; }
  }

  function onAddDisciplineKeydown(event) {
    if (event.key === 'Escape') { addingTrack = false; newTrackDiscipline = ''; newTrackLabel = ''; }
  }

  async function handleAddStage() {
    const trimmed = newStageName.trim();
    if (!trimmed) { showAddStageForm = false; return; }
    addingStage = true;
    try {
      const board = await createCustomStage(project.id, { name: trimmed });
      stages = board.stages;
      tracks = board.tracks;
      keyIssues = board.keyIssues || [];
      entries = board.entries;
      sortedTracks = applyRiskSort(tracks);
      newStageName = '';
      showAddStageForm = false;
    } catch {}
    addingStage = false;
  }

  function onAddStageKeydown(event) {
    if (event.key === 'Enter') handleAddStage();
    if (event.key === 'Escape') { showAddStageForm = false; newStageName = ''; }
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
      await reorderProjectStages(project.id, reordered.map(s => s.instance_id));
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
  <!-- ── Standard Board ─────────────────────────────────────────────────── -->
  <div class="board-header">
    <button class="btn btn-secondary btn-sm" on:click={() => (showAddIssueModal = true)}>
      <i class="las la-plus"></i> Add issue row
    </button>
    <button class="btn btn-secondary btn-sm" on:click={() => (showPopulateModal = true)}>
      <i class="las la-magic"></i> Populate from Briefing
    </button>
    {#if showStageColumns}
      <button class="btn btn-secondary btn-sm" on:click={() => { showAddStageForm = !showAddStageForm; newStageName = ''; }}>
        <i class="las la-plus"></i> Add stage
      </button>
      {#if showAddStageForm}
        <div class="add-stage-form">
          <input
            class="rename-input"
            placeholder="Stage name"
            bind:value={newStageName}
            on:keydown={onAddStageKeydown}
            use:focusOnMount
          />
          <button class="btn btn-primary btn-sm" disabled={addingStage} on:click={handleAddStage}>
            {addingStage ? 'Adding…' : 'Add'}
          </button>
          <button class="btn btn-secondary btn-sm" on:click={() => { showAddStageForm = false; newStageName = ''; }}>Cancel</button>
        </div>
      {/if}
    {/if}
  </div>

  <div class="table-wrapper board-scroll">
    <table class="data-table board-table">
      <thead>
        <tr>
          <th class="no-sort discipline-col">Discipline</th>
          <th class="no-sort track-col">Specific Issue</th>
          <th class="no-sort risk-col">Risk</th>
          <th class="no-sort key-issue-col">Key Issue?</th>
          {#if showStageColumns}
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
          {/if}
        </tr>
      </thead>
      <tbody>
        <!-- KEY ISSUES SECTION -->
        {#if keyIssues.length > 0}
          <tr class="section-header-row">
            <td colspan={showStageColumns ? stages.length + 4 : 4} class="section-header-cell">
              <i class="las la-exclamation-triangle"></i> Key Issues
            </td>
          </tr>
          {#each keyIssues as ki}
            <tr class="key-issue-row ki-row">
              <td class="discipline-cell">
                <div class="discipline-inner">
                  {#if ki.discipline_group}
                    <span class="discipline-badge">{ki.discipline_group}</span>
                  {/if}
                </div>
              </td>
              <td class="track-cell">
                <div class="track-inner">
                  <span class="text-bold">{ki.label}</span>
                </div>
              </td>
              <td class="risk-cell">
                {#if ki.last_known_risk_level}
                  <span class="risk-chip" style={riskStyle(ki.last_known_risk_level)}>{riskLabel(ki.last_known_risk_level)}</span>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>
              <td class="key-issue-cell">
                <span class="ki-flag-static" title="Key Issue"><i class="las la-flag"></i></span>
              </td>
              {#if showStageColumns}
                {#each stages as stage}
                  {@const kiEntry = getKeyIssueEntry(stage.instance_id, ki.id)}
                  <td
                    class="entry-cell"
                    class:na-cell={!stage.is_applicable}
                    class:entry-clickable={stage.is_applicable && !isHLPVStage(stage)}
                    class:hlpv-cell={isHLPVStage(stage)}
                  >
                    {#if !stage.is_applicable}
                      <span class="text-muted">N/A</span>
                    {:else if kiEntry}
                      <div class="entry-inner">
                        {#if kiEntry.risk_level}
                          <span class="risk-chip" style={riskStyle(kiEntry.risk_level)}>{riskLabel(kiEntry.risk_level)}</span>
                        {/if}
                        {#if kiEntry.summary}<p class="entry-summary">{kiEntry.summary}</p>{/if}
                      </div>
                    {:else}
                      <span class="text-muted">—</span>
                    {/if}
                  </td>
                {/each}
              {/if}
            </tr>
          {/each}
          <tr class="section-header-row">
            <td colspan={showStageColumns ? stages.length + 4 : 4} class="section-header-cell">
              <i class="las la-layer-group"></i> Disciplines
            </td>
          </tr>
        {/if}

        <!-- DISCIPLINE TRACKS SECTION -->
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
                  <button class="action-btn tag-btn" title="Assign issue type (snippet template)" on:click={() => toggleIssueTypePicker(track)}><i class="las la-tag"></i></button>
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
                  {#if track.issue_type_label}
                    <span class="issue-type-badge" title="Linked snippet template">{track.issue_type_label}{track.issue_type_development_type ? ` - ${track.issue_type_development_type}` : ''}</span>
                  {/if}
                {/if}
                {#if issueTypePickerTrackId === track.id}
                  <select
                    class="issue-type-select"
                    value={track.issue_type_id ?? ''}
                    on:change={e => assignIssueType(track, e.target.value)}
                    on:blur={() => issueTypePickerTrackId = null}
                    use:focusOnMount
                  >
                    <option value="">No issue type</option>
                    {#each issueTypes as it}
                      <option value={it.id}>{it.label}{it.development_type ? ` - ${it.development_type}` : ''}</option>
                    {/each}
                  </select>
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
            {#if showStageColumns}
              {#each stages as stage}
                {@const entry = getEntry(stage.instance_id, track.id)}
                <td
                  class="entry-cell"
                  class:na-cell={!stage.is_applicable}
                  class:entry-clickable={stage.is_applicable && !isHLPVStage(stage)}
                  class:hlpv-cell={isHLPVStage(stage)}
                  on:click={() => { if (!isHLPVStage(stage)) openEntryModal(stage, track); }}
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
            {/if}
          </tr>
        {/each}
        <!-- Inline add-track row -->
        {#if addingTrack}
          <tr class="add-track-row">
            <td class="discipline-cell">
              <select
                class="add-discipline-select"
                bind:value={newTrackDiscipline}
                on:keydown={onAddDisciplineKeydown}
                use:focusOnMount
              >
                <option value="">Discipline…</option>
                {#each DISCIPLINES as d}<option value={d.value}>{d.label}</option>{/each}
              </select>
            </td>
            <td class="track-cell">
              <div class="track-inner">
                <input
                  class="rename-input"
                  placeholder="Specific issue…"
                  bind:value={newTrackLabel}
                  on:keydown={onAddTrackKeydown}
                />
              </div>
            </td>
            <td colspan={showStageColumns ? stages.length + 2 : 2} style="vertical-align:middle; padding-left:0.5rem;">
              <button class="btn btn-primary btn-sm" on:click={commitAddTrack}>Save</button>
              <button class="btn btn-ghost btn-sm" on:click={() => { addingTrack = false; newTrackDiscipline = ''; newTrackLabel = ''; }}>Cancel</button>
            </td>
          </tr>
        {:else}
          <tr class="add-track-row">
            <td colspan={showStageColumns ? stages.length + 4 : 4}>
              <button class="btn btn-ghost btn-sm add-row-btn" on:click={() => (addingTrack = true)}>
                <i class="las la-plus"></i> Add row
              </button>
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

{/if}
<!-- end main board conditional -->

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

<PopulateFromBriefingModal
  show={showPopulateModal}
  projectId={project?.id}
  onClose={() => (showPopulateModal = false)}
  onComplete={() => { showPopulateModal = false; loadBoard(); }}
/>

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
  .board-header { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .add-stage-form { display: flex; align-items: center; gap: 0.4rem; }
  .board-scroll { overflow-x: auto; }
  .board-table { min-width: max-content; }
  .discipline-col { min-width: 140px; position: sticky; left: 0; background: var(--color-slate-50); z-index: 2; }
  .discipline-cell { min-width: 140px; position: sticky; left: 0; background: white; z-index: 1; padding: 0.75rem 1rem; font-size: 0.875rem; color: var(--color-slate-500); }
  .discipline-inner { display: flex; align-items: center; gap: 0.4rem; }
  .track-col { min-width: 160px; position: sticky; left: 140px; background: var(--color-slate-50); z-index: 2; }
  .stage-col { min-width: 150px; text-align: center; cursor: grab; transition: background 0.15s; }
  .stage-col:not(.stage-complete):not(.stage-na):hover { background: var(--color-purple-50); }
  .stage-col:active { cursor: grabbing; }
  .stage-col.stage-complete { background: var(--color-slate-100); }
  .stage-col.stage-complete:hover { background: var(--color-emerald-100); }
  .stage-col.stage-na { background: var(--color-slate-50); }
  .stage-col.stage-na:hover { background: var(--color-slate-100); }
  .stage-col.dragging { opacity: 0.4; cursor: grabbing; }
  .stage-col.drag-over { box-shadow: inset 3px 0 0 var(--color-purple-600); background: var(--color-purple-50); }
  .stage-th-inner { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.25rem; }
  .na-text { text-decoration: line-through; color: var(--color-slate-400); }
  .eye-toggle i { font-size: 1.25rem; }
  .track-th-title { font-weight: 600; }
  .complete-toggle { color: var(--color-slate-300); transition: color 0.2s; }
  .complete-toggle i { font-size: 1.35rem; }
  .complete-toggle:hover:not(:disabled) { color: var(--color-emerald-500); }
  .complete-toggle.is-done { color: var(--color-emerald-500); }
  .track-cell { position: sticky; left: 140px; background: white; z-index: 1; min-width: 160px; }
  .track-inner { display: flex; align-items: center; gap: 0.4rem; min-width: 0; flex-wrap: wrap; }
  .track-inner > span:not(.risk-chip):not(.issue-type-badge) { flex: 1; min-width: 0; }
  .issue-type-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-violet-600);
    background: var(--color-violet-50);
    border: 1px solid var(--color-violet-200);
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .issue-type-select {
    width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--color-purple-600);
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
  }
  .track-actions { display: none; align-items: center; gap: 0.15rem; flex-shrink: 0; }
  .discipline-inner:hover .track-actions { display: flex; }
  .rename-input {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--color-purple-600);
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    box-shadow: var(--focus-ring-blue);
  }
  .risk-col { min-width: 110px; text-align: center; }
  .risk-cell { text-align: center; vertical-align: middle; }
  .key-issue-col {
    position: sticky;
    left: 300px;
    background: var(--color-slate-50);
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
  .key-flag { color: var(--color-slate-300); }
  .key-flag i { font-size: 1.25rem; }
  .key-flag.flagged { color: var(--color-amber-500); }
  .key-issue-row .discipline-cell,
  .key-issue-row .track-cell,
  .key-issue-row .risk-cell,
  .key-issue-row .key-issue-cell { background: var(--color-red-50); }
  .board-table tbody tr:not(.add-track-row) { cursor: grab; }
  .board-table tbody tr:not(.add-track-row):active { cursor: grabbing; }
  .row-dragging { opacity: 0.4; cursor: grabbing; }
  .row-drag-over td { box-shadow: inset 0 3px 0 var(--color-purple-600); }
  .key-issue-row .entry-cell { background: rgba(245, 158, 11, 0.04); }
  .risk-chip { font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.4rem; border-radius: 3px; white-space: nowrap; }
  .entry-cell { vertical-align: top; text-align: center; }
  .entry-cell .entry-inner { text-align: left; }
  .na-cell { background: var(--color-slate-50); }
  .entry-inner { display: flex; flex-direction: column; gap: 0.3rem; }
  .entry-summary { margin: 0; font-size: 0.8125rem; color: var(--color-slate-600); line-height: 1.4; }
  .entry-clickable { cursor: pointer; }
  .entry-clickable:hover { background: var(--color-violet-50); }

  /* HLPV stage cells — read-only, no hover */
  .hlpv-cell { background: var(--color-slate-50); cursor: default; }

  /* Section header rows */
  .section-header-row td { background: var(--color-slate-100); padding: 0.35rem 1rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid var(--color-slate-200); }
  .section-header-cell { white-space: nowrap; }
  .section-header-cell i { margin-right: 0.3rem; }

  /* Key issue rows in the ki-row section */
  .ki-row .discipline-cell,
  .ki-row .track-cell,
  .ki-row .risk-cell,
  .ki-row .key-issue-cell { background: var(--color-red-50); }
  .ki-row .entry-cell { background: rgba(245, 158, 11, 0.04); }

  /* Discipline badge on key issue rows */
  .discipline-badge { font-size: 0.65rem; font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 3px; background: var(--color-indigo-100); color: var(--color-violet-800); text-transform: capitalize; }

  /* Static flag for key issues (always flagged, not a button) */
  .ki-flag-static { color: var(--color-amber-500); font-size: 1.1rem; }

  .add-discipline-select {
    width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--color-purple-600);
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    box-shadow: var(--focus-ring-blue);
    background: white;
  }

  /* Add row button */
  .add-track-row td { border-top: 1px dashed var(--color-slate-200); padding: 0.4rem 0.75rem; cursor: default; }
  .add-track-row:active { cursor: default; }
  .add-row-btn { color: var(--color-slate-400); font-size: 0.8125rem; width: 100%; justify-content: flex-start; }
  .add-row-btn:hover { color: var(--color-purple-600); background: var(--color-purple-50); }

  /* ── Appeal board ─────────────────────────────────────────────────────── */
  .appeal-board { display: flex; flex-direction: column; gap: 1.5rem; }

  .appeal-stages {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .appeal-stage-card {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    background: white;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-slate-800);
    min-width: 200px;
  }

  .appeal-stage-card.complete { background: var(--color-slate-100); border-color: var(--color-slate-400); }
  .appeal-stage-card.na { background: var(--color-slate-50); border-color: var(--color-slate-200); }

  .appeal-stage-name { flex: 1; }

  /* Reason for Refusal panel */
  .rfr-panel {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .rfr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .rfr-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .rfr-empty { color: var(--color-slate-400); font-size: 0.875rem; padding: 0.5rem 0; }

  .reason-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 0;
    border-bottom: 1px solid var(--color-slate-100);
  }

  .reason-row:last-child { border-bottom: none; }
  .reason-row.key-issue { background: var(--color-red-50); border-radius: 6px; padding: 0.875rem 0.75rem; margin: 0 -0.75rem; }

  .reason-content { flex: 1; min-width: 0; }

  .reason-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .reason-title { font-size: 0.875rem; color: var(--color-slate-800); }
  .reason-summary { margin: 0; font-size: 0.8125rem; color: var(--color-slate-500); line-height: 1.5; }

  .reason-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .reason-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .reason-form-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reason-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    outline: none;
  }

  .reason-input:focus { border-color: var(--color-purple-600); box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.08); }
  .reason-title-input { flex: 1; }

  .reason-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    outline: none;
    min-width: 140px;
  }

  .reason-key-issue-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.875rem;
    color: var(--color-slate-600);
    white-space: nowrap;
    cursor: pointer;
  }

  .reason-form-actions { display: flex; gap: 0.5rem; }

  .action-btn.flagged { color: var(--color-amber-500) !important; }
</style>
