<script>
  import {
    getConsultationData,
    createConsultationAdvancements,
    suggestConsultationAdvancementSummaries,
    updateConsultationAdvancement,
    deleteConsultationAdvancement,
    createConsultationKeyDate,
    updateConsultationKeyDate,
    deleteConsultationKeyDate,
  } from '$lib/api/consultation.js';
  import {
    getConditionsData,
    createConditionAdvancements,
    suggestConditionAdvancementSummaries,
    updateConditionAdvancement,
    deleteConditionAdvancement,
    createConditionKeyDate,
    updateConditionKeyDate,
    deleteConditionKeyDate,
  } from '$lib/api/conditions.js';
  import {
    getProgressData,
    createActions,
    suggestActionSummaries,
    updateAction,
    deleteAction,
    createIssueKeyDate,
    updateIssueKeyDate,
    deleteIssueKeyDate,
  } from '$lib/api/progressTracker.js';
  import AddConsultationAdvancementModal from '$lib/components/projects/AddConsultationAdvancementModal.svelte';
  import AddAdvancementModal from '$lib/components/projects/AddAdvancementModal.svelte';
  import AddActionModal from '$lib/components/projects/AddActionModal.svelte';
  import AdvancementTimelineModal from './AdvancementTimelineModal.svelte';
  import MasterAdvancementsModal from '$lib/components/projects/MasterAdvancementsModal.svelte';
  import { openProjectModal } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;

  let activeType = 'consultation'; // 'consultation' | 'conditions' | 'progress'
  let hasAutoSelected = false;

  let responses = [];
  let conditions = [];
  let issues = [];
  let loading = true;
  let error = null;

  // Reload whenever projectId changes to a different project — not just on
  // first mount — so switching projects from the sidebar while already on
  // the Overview page actually refreshes this widget instead of leaving the
  // previous project's data (and tracker selection) showing.
  let loadedProjectId = null;
  $: if (projectId && projectId !== loadedProjectId) {
    loadedProjectId = projectId;
    hasAutoSelected = false;
    load();
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const [c, k, p] = await Promise.all([
        getConsultationData(projectId),
        getConditionsData(projectId),
        getProgressData(projectId),
      ]);
      responses = c.responses || [];
      conditions = k.conditions || [];
      issues = p.issues || [];

      if (!hasAutoSelected) {
        hasAutoSelected = true;
        autoSelectActiveType();
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Default to whichever tracker has the most information for this project —
  // same "most content" heuristic Project Chat uses to auto-pick a default
  // source, just measured as total advancement/action entries here (chars
  // aren't available without a dedicated catalogue call like chat's).
  // Falls back to item count on a tie or when nothing has advancements yet,
  // so a populated-but-quiet tracker still beats an empty one. Only runs on
  // the first load — later refreshes (after adding/editing an entry) leave
  // whatever the user has manually selected alone. The same ranking also
  // orders the pills themselves (most-data tracker sits leftmost) — set once
  // here rather than kept live, so the pills don't reshuffle every time the
  // user just clicks between tabs.
  let pillOrder = ['consultation', 'conditions', 'progress'];

  function autoSelectActiveType() {
    const entryCounts = {
      consultation: responses.reduce((sum, r) => sum + (r.advancements?.length || 0), 0),
      conditions: conditions.reduce((sum, c) => sum + mergedConditionTimeline(c).length, 0),
      progress: issues.reduce((sum, iss) => sum + mainIssueActions(iss).length, 0),
    };
    const itemCounts = { consultation: responses.length, conditions: conditions.length, progress: issues.length };

    const ranked = Object.keys(entryCounts).sort((aType, bType) =>
      entryCounts[bType] - entryCounts[aType] || itemCounts[bType] - itemCounts[aType]
    );
    pillOrder = ranked;

    const bestType = ranked[0];
    const bestEntries = entryCounts[bestType];
    if (bestEntries > 0 || itemCounts[bestType] > 0) {
      activeType = bestType;
    }
  }

  const PILL_LABELS = { consultation: 'Consultation', conditions: 'Conditions', progress: 'Project' };

  function sortByDateDesc(arr, key) {
    return [...arr].sort((a, b) =>
      String(b[key] || '').localeCompare(String(a[key] || '')) || (b.id ?? 0) - (a.id ?? 0)
    );
  }

  function mainIssueActions(iss) {
    return (iss.actions || []).filter(a => !a.sub_issue_ids || a.sub_issue_ids.length === 0);
  }

  // Mirrors ConditionsTrackerTab.svelte's mergedTimeline(c) exactly — quote
  // actions, key dates and instruction-status changes interleaved with the
  // condition's own advancements, read-only except the condition's own rows.
  function mergedConditionTimeline(c) {
    const own = (c.advancements || []).map(a => ({ ...a, _kind: 'condition' }));
    const fromQuotes = (c.linked_quotes || []).flatMap(q =>
      (q.actions || []).map(a => ({
        id: `q-${a.id}`,
        advancement_date: a.action_date,
        summary: a.summary,
        full_text: a.full_text,
        source_type: a.source_type,
        _kind: 'quote',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromKeyDates = (c.linked_quotes || []).flatMap(q =>
      (q.key_dates || []).map(kd => ({
        id: `kd-${kd.id}`,
        advancement_date: kd.date,
        summary: kd.title,
        full_text: null,
        _kind: 'key_date',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromInstructionStatus = (c.linked_quotes || [])
      .filter(q => q.instruction_status_changed_at)
      .map(q => ({
        id: `is-${q.quote_id}`,
        advancement_date: String(q.instruction_status_changed_at).slice(0, 10),
        summary: `Instruction status: ${q.instruction_status}`,
        full_text: null,
        _kind: 'instruction_status',
        _org: q.organisation || 'Quote',
      }));
    return [...own, ...fromQuotes, ...fromKeyDates, ...fromInstructionStatus].sort((a, b) =>
      String(b.advancement_date || '').localeCompare(String(a.advancement_date || ''))
      || String(b.id).localeCompare(String(a.id))
    );
  }

  // Some source fields (discipline, status) come back from the API in
  // ALL CAPS — normalize to Title Case for display so badges read cleanly
  // regardless of how the backend happens to store them.
  function toTitleCase(str) {
    if (!str) return str;
    return String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function positionBadgeClass(pos) {
    if (pos === 'Objection') return 'badge-danger';
    if (pos === 'Conditional Support') return 'badge-warning';
    if (pos === 'Support') return 'badge-success';
    return 'badge-neutral';
  }
  function conditionStatusBadgeClass(s) {
    if (s === 'Discharged') return 'badge-success';
    if (s === 'Not Started') return 'badge-neutral';
    return 'badge-warning';
  }

  $: consultationRows = responses.map(r => {
    const adv = sortByDateDesc(r.advancements || [], 'advancement_date');
    return {
      id: r.id,
      name: r.consultee_name,
      badgeLabel: toTitleCase(r.position),
      badgeClass: positionBadgeClass(r.position),
      statusLabel: toTitleCase(r.status || 'In Progress'),
      statusClass: r.status === 'Closed Out' ? 'badge-neutral' : 'badge-info',
      latest: adv[0] ? { date: adv[0].advancement_date, summary: adv[0].summary } : null,
      count: adv.length,
    };
  });

  $: conditionRows = conditions.map(c => {
    const merged = mergedConditionTimeline(c);
    return {
      id: c.id,
      name: c.condition_number ? `Condition ${c.condition_number} — ${c.title}` : c.title,
      badgeLabel: null,
      badgeClass: null,
      statusLabel: toTitleCase(c.status || 'Not Started'),
      statusClass: conditionStatusBadgeClass(c.status),
      latest: merged[0] ? { date: merged[0].advancement_date, summary: merged[0].summary } : null,
      count: merged.length,
    };
  });

  $: progressRows = issues.map(iss => {
    const acts = sortByDateDesc(mainIssueActions(iss), 'action_date');
    return {
      id: iss.id,
      name: iss.title,
      badgeLabel: toTitleCase(iss.discipline),
      badgeClass: 'badge-neutral',
      statusLabel: toTitleCase(iss.status || 'In Progress'),
      statusClass: iss.status === 'Complete' ? 'badge-success' : 'badge-info',
      latest: acts[0] ? { date: acts[0].action_date, summary: acts[0].summary } : null,
      count: acts.length,
    };
  });

  $: activeRows = activeType === 'consultation' ? consultationRows : activeType === 'conditions' ? conditionRows : progressRows;
  $: activeTrackerLabel = activeType === 'consultation' ? 'Consultation Tracker' : activeType === 'conditions' ? 'Conditions Tracker' : 'Project Tracker';
  $: activeTrackerTabId = activeType === 'consultation' ? 'consultation_tracker' : activeType === 'conditions' ? 'conditions_tracker' : 'progress_tracker';

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Bulk "Add Advancement" modal ──────────────────────────────────────────
  let showBulkAdd = false;
  let bulkPreselectId = null;

  function openBulkAdd(preselectId = null) {
    bulkPreselectId = preselectId;
    showBulkAdd = true;
  }

  function handleBulkDone() {
    load();
  }

  function handleBulkClose() {
    showBulkAdd = false;
    bulkPreselectId = null;
    load();
  }

  // ── Per-row timeline popup ────────────────────────────────────────────────
  let timelineRow = null; // { kind, id, name }

  function openTimelineFor(row) {
    timelineRow = { kind: activeType, id: row.id, name: row.name };
  }

  function closeTimeline() {
    timelineRow = null;
    load();
  }

  // responses/conditions/issues are passed in explicitly (rather than just
  // closed over) so they appear directly in the reactive statement below —
  // Svelte's dependency tracking only looks at identifiers referenced in the
  // statement itself, not inside a called function's body, so without this
  // the list would go stale after `load()` reassigns those arrays (e.g.
  // right after adding an entry) until timelineRow itself next changes.
  $: timelineItems = timelineRow ? buildTimelineItems(timelineRow, responses, conditions, issues) : [];

  function buildTimelineItems(row, responses, conditions, issues) {
    if (row.kind === 'consultation') {
      const r = responses.find(x => x.id === row.id);
      return sortByDateDesc(r?.advancements || [], 'advancement_date').map(a => ({
        id: a.id, date: a.advancement_date, summary: a.summary, fullText: a.full_text,
        sourceType: a.source_type, editable: true, sourceLabel: null,
      }));
    }
    if (row.kind === 'conditions') {
      const c = conditions.find(x => x.id === row.id);
      if (!c) return [];
      return mergedConditionTimeline(c).map(a => ({
        id: a.id, date: a.advancement_date, summary: a.summary, fullText: a.full_text,
        sourceType: a.source_type, editable: a._kind === 'condition',
        sourceLabel: a._kind === 'quote' ? `${a._org} · quote`
          : a._kind === 'key_date' ? `${a._org} · key date`
          : a._kind === 'instruction_status' ? a._org : null,
      }));
    }
    const iss = issues.find(x => x.id === row.id);
    return sortByDateDesc(mainIssueActions(iss || {}), 'action_date').map(a => ({
      id: a.id, date: a.action_date, summary: a.summary, fullText: a.full_text,
      sourceType: a.source_type, editable: true, sourceLabel: a.stage_name || null,
    }));
  }

  // ── Per-row direct key dates (shown inside the timeline popup) ─────────────
  $: timelineKeyDates = timelineRow ? buildKeyDates(timelineRow, responses, conditions, issues) : [];

  function buildKeyDates(row, responses, conditions, issues) {
    if (row.kind === 'consultation') return responses.find(x => x.id === row.id)?.key_dates || [];
    if (row.kind === 'conditions') return conditions.find(x => x.id === row.id)?.key_dates || [];
    return issues.find(x => x.id === row.id)?.key_dates || [];
  }

  async function timelineAddKeyDate(form) {
    if (timelineRow.kind === 'consultation') await createConsultationKeyDate(timelineRow.id, form);
    else if (timelineRow.kind === 'conditions') await createConditionKeyDate(timelineRow.id, form);
    else await createIssueKeyDate(timelineRow.id, form);
    await load();
  }

  async function timelineUpdateKeyDate(id, form) {
    if (timelineRow.kind === 'consultation') await updateConsultationKeyDate(id, form);
    else if (timelineRow.kind === 'conditions') await updateConditionKeyDate(id, form);
    else await updateIssueKeyDate(id, form);
    await load();
  }

  async function timelineDeleteKeyDate(id) {
    if (timelineRow.kind === 'consultation') await deleteConsultationKeyDate(id);
    else if (timelineRow.kind === 'conditions') await deleteConditionKeyDate(id);
    else await deleteIssueKeyDate(id);
    await load();
  }

  // ── Master advancements (all rows of the active tracker, flattened) ────────
  let showMasterAdvancements = false;

  function kindBadgeFor(a) {
    if (a._kind === 'quote') return { icon: 'la-file-invoice-dollar', label: a._org, title: 'From the linked quote\'s actions log in surveyor management' };
    if (a._kind === 'key_date') return { icon: 'la-calendar', label: a._org, title: 'Key date from the linked quote in surveyor management' };
    if (a._kind === 'instruction_status') return { icon: 'la-flag', label: a._org, title: 'Instruction status change from the linked quote in surveyor management' };
    return null;
  }

  $: masterAdvancementItems = (
    activeType === 'consultation'
      ? responses.flatMap(r => sortByDateDesc(r.advancements || [], 'advancement_date').map(a => ({
          id: `${r.id}-${a.id}`,
          date: a.advancement_date,
          summary: a.summary,
          fullText: a.full_text,
          sourceType: a.source_type,
          rowId: r.id,
          rowTitle: r.consultee_name,
        })))
      : activeType === 'conditions'
      ? conditions.flatMap(c => mergedConditionTimeline(c).map(a => ({
          id: `${c.id}-${a.id}`,
          date: a.advancement_date,
          summary: a.summary,
          fullText: a.full_text,
          sourceType: a._kind === 'condition' ? a.source_type : null,
          kindBadge: kindBadgeFor(a),
          rowId: c.id,
          rowTitle: c.condition_number ? `Condition ${c.condition_number} — ${c.title}` : c.title,
        })))
      : issues.flatMap(iss => sortByDateDesc(mainIssueActions(iss), 'action_date').map(a => ({
          id: `${iss.id}-${a.id}`,
          date: a.action_date,
          summary: a.summary,
          fullText: a.full_text,
          sourceType: a.source_type,
          rowId: iss.id,
          rowTitle: iss.title,
        })))
  ).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)));

  function jumpToRowFromMaster(rowId) {
    const row = activeRows.find(r => r.id === rowId);
    if (row) openTimelineFor(row);
  }

  async function timelineAdd(form) {
    if (timelineRow.kind === 'consultation') {
      await createConsultationAdvancements(projectId, {
        advancement_date: form.date, full_text: form.fullText, source_type: form.sourceType,
        items: [{ response_id: timelineRow.id, summary: form.summary }],
      });
    } else if (timelineRow.kind === 'conditions') {
      await createConditionAdvancements(projectId, {
        advancement_date: form.date, full_text: form.fullText, source_type: form.sourceType,
        items: [{ condition_id: timelineRow.id, summary: form.summary }],
      });
    } else {
      await createActions(projectId, {
        action_date: form.date, full_text: form.fullText, source_type: form.sourceType, stage_instance_id: null,
        items: [{ issue_id: timelineRow.id, summary: form.summary, sub_issue_ids: [], quote_id: null }],
      });
    }
    await load();
  }

  async function timelineUpdate(id, form) {
    if (timelineRow.kind === 'consultation') {
      await updateConsultationAdvancement(id, {
        advancement_date: form.date, full_text: form.fullText, source_type: form.sourceType, summary: form.summary,
      });
    } else if (timelineRow.kind === 'conditions') {
      await updateConditionAdvancement(id, {
        advancement_date: form.date, full_text: form.fullText, source_type: form.sourceType, summary: form.summary,
      });
    } else {
      await updateAction(id, { action_date: form.date, full_text: form.fullText, summary: form.summary });
    }
    await load();
  }

  async function timelineDelete(id) {
    if (timelineRow.kind === 'consultation') await deleteConsultationAdvancement(id);
    else if (timelineRow.kind === 'conditions') await deleteConditionAdvancement(id);
    else await deleteAction(id);
    await load();
  }

  async function timelineGenerate(fullText) {
    if (timelineRow.kind === 'consultation') {
      const { suggestions } = await suggestConsultationAdvancementSummaries(projectId, {
        full_text: fullText, items: [{ response_id: timelineRow.id, user_summary: null }],
      });
      return suggestions[0]?.summary || '';
    }
    if (timelineRow.kind === 'conditions') {
      const { suggestions } = await suggestConditionAdvancementSummaries(projectId, {
        full_text: fullText, items: [{ condition_id: timelineRow.id, user_summary: null }],
      });
      return suggestions[0]?.summary || '';
    }
    const { suggestions } = await suggestActionSummaries(projectId, {
      full_text: fullText, items: [{ issue_id: timelineRow.id, user_summary: null }],
    });
    return suggestions[0]?.summary || '';
  }

  function openFullTracker() {
    openProjectModal(projectId, activeTrackerTabId, 'details');
  }
</script>

<div class="widget tr-widget">
  <div class="widget-head tr-head">
    <div>
      <div class="widget-title">
        <i class="las la-clipboard-list"></i>
        Trackers
      </div>
      <div class="tr-pills">
        {#each pillOrder as type (type)}
          <button class="tab-pill" class:active={activeType === type} on:click={() => activeType = type}>
            {PILL_LABELS[type]}
          </button>
        {/each}
      </div>
    </div>
    <div class="tr-head-actions">
      <button class="btn btn-primary btn-sm" on:click={() => openBulkAdd(null)} disabled={!activeRows.length}>
        <i class="las la-history"></i> Add Advancement
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => showMasterAdvancements = true} disabled={!activeRows.length}>
        <i class="las la-stream"></i> All Advancements
      </button>
      <button class="btn btn-icon btn-secondary" title="Open full {activeTrackerLabel}" on:click={openFullTracker}>
        <i class="las la-expand-arrows-alt"></i>
      </button>
    </div>
  </div>

  <div class="widget-body tr-body">
    {#if loading}
      <div class="tr-state"><div class="mini-spinner"></div> Loading…</div>
    {:else if error}
      <div class="tr-state tr-state-error">{error}</div>
    {:else if !activeRows.length}
      <div class="tr-state">No items in {activeTrackerLabel} yet.</div>
    {:else}
      {#each activeRows as row (row.id)}
        <div class="tr-row">
          <div class="tr-name">
            <div class="tr-name-text">{row.name}</div>
            {#if row.badgeLabel}<span class="badge {row.badgeClass}">{row.badgeLabel}</span>{/if}
          </div>
          {#if row.latest}
            <button class="progress-cell" on:click={() => openTimelineFor(row)} title="View history">
              <span class="progress-cell-date">{formatDate(row.latest.date)} &middot; {row.count} update{row.count !== 1 ? 's' : ''}</span>
              <span class="progress-cell-summary">{row.latest.summary}</span>
            </button>
          {:else}
            <div class="progress-cell-empty">
              <button class="add-icon-btn" on:click={() => openBulkAdd(row.id)} title="Add first advancement">
                <i class="las la-plus"></i>
              </button>
            </div>
          {/if}
          {#if row.statusLabel}<span class="badge {row.statusClass}">{row.statusLabel}</span>{/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if activeType === 'consultation'}
  <AddConsultationAdvancementModal
    bind:show={showBulkAdd}
    {projectId}
    {responses}
    preselectedResponseId={bulkPreselectId}
    on:done={handleBulkDone}
    on:close={handleBulkClose}
  />
{:else if activeType === 'conditions'}
  <AddAdvancementModal
    bind:show={showBulkAdd}
    {projectId}
    {conditions}
    preselectedConditionId={bulkPreselectId}
    on:done={handleBulkDone}
    on:close={handleBulkClose}
  />
{:else}
  <AddActionModal
    bind:show={showBulkAdd}
    {projectId}
    {issues}
    preselectedIssueId={bulkPreselectId}
    on:done={handleBulkDone}
    on:close={handleBulkClose}
  />
{/if}

<MasterAdvancementsModal
  bind:show={showMasterAdvancements}
  title="All Advancements · {activeTrackerLabel}"
  items={masterAdvancementItems}
  onJumpToRow={jumpToRowFromMaster}
  onClose={() => showMasterAdvancements = false}
/>

{#if timelineRow}
  <AdvancementTimelineModal
    show={!!timelineRow}
    title="{timelineRow.name} · {activeTrackerLabel}"
    items={timelineItems}
    onAdd={timelineAdd}
    onUpdate={timelineUpdate}
    onDelete={timelineDelete}
    onGenerate={timelineGenerate}
    onClose={closeTimeline}
    keyDates={timelineKeyDates}
    onAddKeyDate={timelineAddKeyDate}
    onUpdateKeyDate={timelineUpdateKeyDate}
    onDeleteKeyDate={timelineDeleteKeyDate}
  />
{/if}

<style>
  .tr-widget { grid-row: span 2; }
  .tr-head { align-items: flex-start; }
  .tr-pills { display: flex; gap: 6px; margin-top: 16px; }
  .tab-pill {
    font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 999px;
    display: flex; align-items: center; gap: 5px;
    background: var(--color-slate-100); color: var(--color-slate-600);
    border: none; cursor: pointer; font-family: inherit;
  }
  .tab-pill.active { background: var(--color-slate-900); color: var(--color-white); }
  .tr-head-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

  .tr-body { display: flex; flex-direction: column; gap: 0; padding-top: 6px; }
  .tr-state { padding: 1.5rem; text-align: center; color: var(--color-slate-400); font-size: 0.83rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .tr-state-error { color: var(--color-red-600); }

  .tr-row { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 0 4px; border-bottom: 1px solid var(--color-slate-100); }
  .tr-row:last-child { border-bottom: none; }
  .tr-name { flex: 1; min-width: 0; }
  .tr-name-text { font-size: 12.5px; font-weight: 600; color: var(--color-slate-900); margin-bottom: 2px; }

  /* The shared .badge/.badge-* classes are the same geometry used
     everywhere else (e.g. ProjectsTable's status pill) — full-size in this
     dense, small-type widget reads as oversized and blocky, so trim it
     down proportionately to this row's own type scale. Colors/radius still
     come from the shared classes. */
  .tr-row .badge {
    font-size: 0.625rem;
    padding: 0.09rem 0.5rem;
    flex-shrink: 0;
  }
  .tr-name .badge { margin-top: 2px; }

  .progress-cell {
    flex: 1.6; min-width: 0; height: 40px; box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: center; text-align: left;
    background: var(--color-slate-50); border: none; border-radius: 8px; padding: 0 10px; cursor: pointer;
  }
  .progress-cell:hover { background: var(--color-slate-100); }
  .progress-cell-date { font-size: 10px; color: var(--color-slate-400); }
  .progress-cell-summary { font-size: 11.5px; color: var(--color-slate-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .progress-cell-empty {
    flex: 1.6; height: 40px; box-sizing: border-box;
    display: flex; align-items: center;
  }

  .add-icon-btn {
    width: 22px; height: 22px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    border: 1px dashed var(--color-slate-300); background: none; border-radius: 50%;
    font-size: 11px; color: var(--color-slate-500); cursor: pointer; padding: 0;
  }
  .add-icon-btn:hover { background: var(--color-slate-50); color: var(--color-slate-700); }

  .mini-spinner {
    display: inline-block; width: 0.9rem; height: 0.9rem;
    border: 2px solid var(--color-slate-200); border-top-color: var(--color-primary-600);
    border-radius: 50%; animation: tr-spin 0.7s linear infinite;
  }
  @keyframes tr-spin { to { transform: rotate(360deg); } }
</style>
