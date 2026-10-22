<script>
  import { tick } from 'svelte';
  import { popoverStyle } from '$lib/utils/popoverPosition.js';
  import ProgrammeTab from '$lib/components/projects/ProgrammeTab.svelte';
  import ActionsModal from './ActionsModal.svelte';
  import AddMeetingActionModal from './AddMeetingActionModal.svelte';
  import MeetingActionsList from '$lib/components/projects/MeetingActionsList.svelte';
  import { getMeetingActions } from '$lib/api/meetingNotes.js';
  import ViewDateModal from '$lib/components/admin-console/ViewDateModal.svelte';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import { getConditionsData, updateConditionKeyDate, deleteConditionKeyDate } from '$lib/api/conditions.js';
  import { getProgressData, updateIssueKeyDate, deleteIssueKeyDate } from '$lib/api/progressTracker.js';
  import { getConsultationData, updateConsultationKeyDate, deleteConsultationKeyDate } from '$lib/api/consultation.js';
  import { getProgrammeEvents, updateProgrammeEvent, deleteProgrammeEvent } from '$lib/api/quotes.js';
  import { updateProjectMilestoneResolved } from '$lib/api/projects.js';
  import { keyDatesVersion, actionsVersion, bumpKeyDatesVersion } from '$lib/stores/keyDates.js';
  import { debounce } from '$lib/utils/debounce.js';

  // Sourced from the project's own fixed date fields (already loaded with
  // the project — no fetch needed) PLUS the direct key dates owned by
  // Conditions/Issues/Consultation tracker rows, plus freestanding programme
  // events (e.g. a date accepted from a Meeting Notes summary) — all fetched
  // below, same tables/calls ProgrammeTab.svelte uses, so anything added
  // there or via an "Add Advancement"/meeting-note date suggestion shows up
  // here too. "Programme" opens the project-level Programme view in a popup
  // over this page (rather than navigating away to its own tab), which
  // additionally covers quote-linked dates these don't.
  export let project;
  // Optional — when set (non-empty), merges upcoming dates from all these
  // projects instead of just `project`, each tagged with its own project so
  // per-row Resolve/Edit/Delete keep working correctly no matter which
  // project a given row came from (see `dates` and the handle* functions).
  export let projects = null;
  $: merged = Array.isArray(projects) && projects.length > 0;
  $: projectList = merged ? projects : (project ? [project] : []);

  // Profile page only — whose actions "mine" means. With no userId (the project
  // overview) the Mine/All choice is not offered.
  export let userId = null;
  export let userName = null;          // fallback match on the free-text owner when an action has no linked account
  export let mineLabel = 'My actions';

  // Two tabs: outstanding meeting Actions (default) and Key Dates.
  let tab = 'actions';

  // ── Actions filter: Mine/All, then which projects. Applied client-side to the
  // loaded rows (MeetingActionsList `rowFilter`), so ticking never refetches.
  // Projects are stored as the *unticked* ids so the default is every project. ──
  let onlyMine = false;
  let hiddenActionProjectIds = new Set();
  let filterOpen = false;
  let filterBtn;
  let filterEl;
  let filterStyle = '';

  let actionProjectKey = null;
  $: {
    const k = projectList.map(p => p.id).sort((a, b) => a - b).join(',');
    if (k !== actionProjectKey) {
      actionProjectKey = k;
      hiddenActionProjectIds = new Set(); // a different set of projects starts with everything ticked
    }
  }

  $: canFilterMine = !!userId;
  $: canFilterProjects = merged && projectList.length > 1;
  $: showActionsFilter = canFilterMine || canFilterProjects;
  $: tickedProjects = projectList.length - projectList.filter(p => hiddenActionProjectIds.has(p.id)).length;
  $: filterActive = onlyMine || hiddenActionProjectIds.size > 0;

  function isMine(a) {
    if (a.assigned_user_id) return String(a.assigned_user_id) === String(userId);
    return !!userName && a.owner?.trim().toLowerCase() === userName.trim().toLowerCase();
  }
  $: actionRowFilter = filterActive
    ? (a) => (!onlyMine || isMine(a)) && !hiddenActionProjectIds.has(a.project_id)
    : null;

  async function toggleFilter() {
    filterOpen = !filterOpen;
    if (filterOpen) {
      filterStyle = 'visibility:hidden;'; // hidden until measured, so it can't flash off-screen
      await tick();
      filterStyle = popoverStyle(filterBtn, filterEl, 250);
    }
  }

  function toggleActionProject(id) {
    const next = new Set(hiddenActionProjectIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    hiddenActionProjectIds = next;
  }

  function setAllActionProjects(ticked) {
    hiddenActionProjectIds = ticked ? new Set() : new Set(projectList.map(p => p.id));
  }

  $: actionsLoadKey = projectList.map(p => p.id).sort((a, b) => a - b).join(',') + ':' + $actionsVersion;
  async function loadActions() {
    const perProject = await Promise.all(projectList.map(async proj => {
      const rows = await getMeetingActions(proj.id, 'pending');
      return rows.map(r => ({ ...r, project_name: proj.project_name }));
    }));
    return perProject.flat();
  }

  let showProgrammeModal = false;
  let showActionsModal = false;
  let showAddAction = false;
  let trackerKeyDates = []; // [{ date, title, source?, _project }] merged from conditions/issues/consultation/programme events

  // Per-project cache so re-ticking an already-seen project in the merged
  // multi-select is instant and doesn't refetch. bumpKeyDatesVersion()
  // (fired elsewhere after a tracker mutation) clears it, since that's a
  // "something changed, refetch for real" signal — everything else (the
  // multi-select toggling) is debounced so a burst of quick ticks collapses
  // into one load instead of one per click.
  const cache = new Map();
  const scheduleLoad = debounce(loadTrackerKeyDates, 350);

  let loadedKey = null;
  let loadedAtVersion = null;

  $: {
    const key = projectList.map(p => p.id).sort((a, b) => a - b).join(',');
    const versionChanged = $keyDatesVersion !== loadedAtVersion;
    if (versionChanged) cache.clear();
    if (key && (key !== loadedKey || versionChanged)) {
      loadedKey = key;
      loadedAtVersion = $keyDatesVersion;
      if (versionChanged || cache.size === 0) loadTrackerKeyDates(projectList);
      else scheduleLoad(projectList);
    }
  }

  async function loadTrackerKeyDates(projs) {
    try {
      const missing = projs.filter(p => !cache.has(p.id));
      if (missing.length) {
        const fetched = await Promise.all(missing.map(async (proj) => {
          const [condData, progData, consData, events] = await Promise.all([
            getConditionsData(proj.id),
            getProgressData(proj.id),
            getConsultationData(proj.id),
            getProgrammeEvents(proj.unique_id),
          ]);
          // `source` labels match ProgrammeTab.svelte's row titles exactly, so
          // the same row reads the same way in both places. `type`/`id`/`colour`/
          // `is_resolved` are carried through so a row can be opened in the same
          // ViewDateModal Programme uses, to resolve/edit/delete it from here too.
          const keyDatesOf = (rows, type, sourceOf) => (rows || []).flatMap(r => (r.key_dates || []).map(kd => ({
            id: kd.id, date: kd.date, title: kd.title, colour: kd.colour, is_resolved: kd.is_resolved, type, source: sourceOf(r), _project: proj
          })));
          const rows = [
            ...keyDatesOf(condData.conditions, 'direct-condition', c => c.condition_number ? `Condition ${c.condition_number} — ${c.title}` : c.title),
            ...keyDatesOf(progData.issues, 'direct-issue', i => i.title),
            ...keyDatesOf(consData.responses, 'direct-consultation', r => r.consultee_name),
            ...(events || []).map(e => ({ id: e.id, date: e.date, title: e.title, colour: e.colour, is_resolved: e.is_resolved, type: 'project', _project: proj })),
          ];
          return [proj.id, rows];
        }));
        for (const [id, rows] of fetched) cache.set(id, rows);
      }
      trackerKeyDates = projs.flatMap(p => cache.get(p.id) || []);
    } catch (err) {
      console.error('KeyDatesWidget: failed to load tracker key dates', err);
      trackerKeyDates = [];
    }
  }

  const FIELDS = [
    ['submission_date', 'Submission Date'],
    ['validation_date', 'Validation Date'],
    ['lpa_consultation_end_date', 'LPA Consultation End'],
    ['committee_date', 'Committee Date'],
    ['target_determination_date', 'Target Determination'],
    ['determined_date', 'Determined Date'],
    ['expiry_of_1st_stat_period_date', '1st Stat Period Expiry'],
    ['eot_date', 'EOT Date'],
    ['six_months_appeal_window_date', '6-Month Appeal Window'],
  ];

  // Optimistic local overrides for the fixed fields' resolved state, keyed
  // by `${projectId}:${fieldKey}` — applied on top of each project's own
  // `<field>_resolved` columns (migration 163) so a toggle here shows
  // instantly without waiting on the parent modal to refetch the project.
  /** @type {Record<string, boolean>} */
  let milestoneResolvedOverrides = {};

  // No cap — .widget-body already scrolls (see cards.css), so all upcoming
  // dates are shown, soonest first, rather than just the next few. Resolved
  // dates drop out entirely here (Programme just greys them out instead).
  $: dates = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const projectDates = projectList.flatMap(proj => FIELDS.map(([key, label]) => {
      const overrideKey = `${proj.id}:${key}`;
      return {
        id: `project-field-${proj.id}-${key}`,
        date: proj?.[key],
        title: label,
        type: 'project-field',
        fieldKey: key,
        is_resolved: overrideKey in milestoneResolvedOverrides ? milestoneResolvedOverrides[overrideKey] : !!proj?.[`${key}_resolved`],
        _project: proj,
      };
    }));
    return [...projectDates, ...trackerKeyDates]
      .filter(d => d.date && String(d.date).slice(0, 10) >= today && !d.is_resolved)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  })();

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function openProgramme() {
    showProgrammeModal = true;
  }

  // ── View/resolve/edit/delete a tracker-, programme-event-, or fixed
  // project-field-owned date — same ViewDateModal/AddKeyDateModal pair
  // ProgrammeTab.svelte uses, so behaviour matches exactly. The fixed
  // project fields (FIELDS above, type 'project-field') only support
  // Resolve here — Edit/Delete redirect to the project's Details tab,
  // since there's no key-date row behind them, just a plain column. ──────
  let showViewDateModal = false;
  let showEditDateModal = false;
  let selectedDate = null;

  function handleViewDate(d) {
    if (!d.id) return;
    selectedDate = d;
    showViewDateModal = true;
  }

  function handleEditDate(date) {
    showViewDateModal = false;
    if (date.type === 'project-field') {
      alert("This date comes from the project's own details — edit it from the project's Details tab.");
      return;
    }
    selectedDate = date;
    showEditDateModal = true;
  }

  async function handleDeleteDate(date) {
    if (date.type === 'project-field') {
      alert("This date comes from the project's own details — it can't be removed here.");
      return;
    }
    try {
      if (date.type === 'project') await deleteProgrammeEvent(date.id);
      else if (date.type === 'direct-condition') await deleteConditionKeyDate(date.id);
      else if (date.type === 'direct-issue') await deleteIssueKeyDate(date.id);
      else if (date.type === 'direct-consultation') await deleteConsultationKeyDate(date.id);
      bumpKeyDatesVersion();
    } catch (err) {
      alert('Failed to delete date: ' + err.message);
    }
  }

  async function handleResolveDate(date) {
    try {
      if (date.type === 'project-field') {
        await updateProjectMilestoneResolved(date._project.id, date.fieldKey, date.is_resolved);
        milestoneResolvedOverrides = { ...milestoneResolvedOverrides, [`${date._project.id}:${date.fieldKey}`]: date.is_resolved };
        return;
      }
      if (date.type === 'project') await updateProgrammeEvent(date.id, { title: date.title, date: date.date, colour: date.colour, is_resolved: date.is_resolved });
      else if (date.type === 'direct-condition') await updateConditionKeyDate(date.id, { is_resolved: date.is_resolved });
      else if (date.type === 'direct-issue') await updateIssueKeyDate(date.id, { is_resolved: date.is_resolved });
      else if (date.type === 'direct-consultation') await updateConsultationKeyDate(date.id, { is_resolved: date.is_resolved });
      bumpKeyDatesVersion();
    } catch (err) {
      alert('Failed to update date: ' + err.message);
    }
  }

  async function handleSubmitEditDate(event) {
    const { type, data } = event.detail;
    try {
      if (type === 'project') await updateProgrammeEvent(data.id, { title: data.title, date: data.date, colour: data.color });
      else if (type === 'direct-condition') await updateConditionKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
      else if (type === 'direct-issue') await updateIssueKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
      else if (type === 'direct-consultation') await updateConsultationKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
      bumpKeyDatesVersion();
    } catch (err) {
      alert('Failed to save date: ' + err.message);
    }
    showEditDateModal = false;
    selectedDate = null;
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="kd-tabs" role="tablist">
      <button type="button" role="tab" class="btn btn-sm" class:btn-secondary={tab === 'actions'} class:btn-ghost={tab !== 'actions'} aria-selected={tab === 'actions'} on:click={() => (tab = 'actions')}>
        <i class="las la-tasks"></i> Actions
      </button>
      <button type="button" role="tab" class="btn btn-sm" class:btn-secondary={tab === 'dates'} class:btn-ghost={tab !== 'dates'} aria-selected={tab === 'dates'} on:click={() => (tab = 'dates')}>
        <i class="las la-calendar-alt"></i> Key Dates
      </button>
    </div>
    {#if tab === 'actions'}
      <div class="kd-head-actions">
        {#if showActionsFilter}
          <button
            class="widget-icon-btn"
            class:kd-filter-active={filterOpen || filterActive}
            bind:this={filterBtn}
            on:click|stopPropagation={toggleFilter}
            title="Filter actions"
            aria-label="Filter actions"
          >
            <i class="las la-filter"></i>
            {#if filterActive}{onlyMine ? 'Mine' : ''}{onlyMine && hiddenActionProjectIds.size ? ' · ' : ''}{hiddenActionProjectIds.size ? `${tickedProjects}/${projectList.length}` : ''}{/if}
          </button>
        {/if}
        <button class="widget-icon-btn" on:click={() => (showAddAction = true)} title="Add an action manually" aria-label="Add action">
          <i class="las la-plus"></i>
        </button>
        <button class="widget-icon-btn" on:click={() => (showActionsModal = true)} title="Open all actions" aria-label="Open all actions">
          <i class="las la-expand-arrows-alt"></i>
        </button>
      </div>
    {:else if !merged}
      <button class="widget-icon-btn" on:click={openProgramme} title="Open the Programme" aria-label="Open the Programme">
        <i class="las la-expand-arrows-alt"></i>
      </button>
    {/if}
  </div>
  {#if tab === 'actions'}
    <div class="widget-body kd-body">
      <MeetingActionsList
        load={loadActions}
        loadKey={actionsLoadKey}
        showProject={merged}
        showMeeting
        groupByAction
        compact
        rowFilter={actionRowFilter}
        emptyText={filterActive ? 'No open actions match the filter.' : 'No open actions.'}
      />
    </div>
  {:else}
  <div class="widget-body kd-body">
    {#if !dates.length}
      <div class="kd-state">No dates yet.</div>
    {:else}
      {#each dates as d}
        <div class="kd-row" class:kd-row-clickable={!!d.id} on:click={() => handleViewDate(d)}>
          <span class="kd-dot"></span>
          <span class="kd-date">{formatDate(d.date)}</span>
          <span class="kd-title">{d.title}</span>
          {#if d.source}<span class="kd-source">· {d.source}</span>{/if}
          {#if merged}<span class="badge badge-neutral kd-project-tag">{d._project.project_name}</span>{/if}
        </div>
      {/each}
    {/if}
  </div>
  {/if}
</div>

{#if filterOpen && tab === 'actions'}
  <div class="kd-filter-popover" style={filterStyle} bind:this={filterEl} on:click|stopPropagation>
    {#if canFilterMine}
      <div class="kd-filter-heading">Show</div>
      <label class="kd-filter-option">
        <input type="radio" name="kd-actions-scope" checked={onlyMine} on:change={() => (onlyMine = true)} />
        <span>{mineLabel}</span>
      </label>
      <label class="kd-filter-option">
        <input type="radio" name="kd-actions-scope" checked={!onlyMine} on:change={() => (onlyMine = false)} />
        <span>All actions</span>
      </label>
    {/if}
    {#if canFilterProjects}
      <div class="kd-filter-heading kd-filter-heading-row" class:kd-filter-divider={canFilterMine}>
        <span>Projects</span>
        <span class="kd-filter-links">
          <button type="button" on:click={() => setAllActionProjects(true)}>All</button>
          <button type="button" on:click={() => setAllActionProjects(false)}>None</button>
        </span>
      </div>
      <div class="kd-filter-list">
        {#each projectList as p (p.id)}
          <label class="kd-filter-option">
            <input type="checkbox" checked={!hiddenActionProjectIds.has(p.id)} on:change={() => toggleActionProject(p.id)} />
            <span>{p.project_name}</span>
          </label>
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if showAddAction}
  <AddMeetingActionModal projects={projectList} onClose={() => (showAddAction = false)} />
{/if}

{#if showActionsModal}
  <ActionsModal projects={projectList} onClose={() => (showActionsModal = false)} />
{/if}

{#if showProgrammeModal}
  <div class="pgm-backdrop" on:click|self={() => showProgrammeModal = false} role="presentation">
    <div class="pgm-modal">
      <ProgrammeTab {project} onClose={() => showProgrammeModal = false} />
    </div>
  </div>
{/if}

<ViewDateModal
  show={showViewDateModal}
  date={selectedDate}
  on:edit={(e) => handleEditDate(e.detail)}
  on:delete={(e) => handleDeleteDate(e.detail)}
  on:resolve={(e) => handleResolveDate(e.detail)}
  on:close={() => { showViewDateModal = false; selectedDate = null; }}
/>

<AddKeyDateModal
  show={showEditDateModal}
  type={selectedDate?.type}
  typeLabel={selectedDate?.type?.startsWith('direct-') ? 'Key Date' : null}
  existingDate={selectedDate}
  on:submit={handleSubmitEditDate}
  on:close={() => { showEditDateModal = false; selectedDate = null; }}
/>

<svelte:window on:click={() => (filterOpen = false)} />

<style>
  .kd-filter-active { color: var(--color-primary-700); background: var(--color-primary-50); }

  /* Fixed, not absolute: the widget card clips overflow. */
  .kd-filter-popover {
    position: fixed; z-index: 1000; width: 250px; padding: 4px 0;
    background: var(--color-white); border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md); box-shadow: var(--shadow-dropdown);
  }
  .kd-filter-heading {
    padding: 6px 10px 2px; font-size: 0.625rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-400);
  }
  .kd-filter-heading-row { display: flex; align-items: center; justify-content: space-between; }
  .kd-filter-divider { margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--color-slate-100); }
  .kd-filter-links { display: flex; gap: 8px; text-transform: none; letter-spacing: 0; }
  .kd-filter-links button {
    background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
    font-size: 0.6875rem; font-weight: 600; color: var(--color-primary-600);
  }
  .kd-filter-links button:hover { text-decoration: underline; }
  .kd-filter-list { max-height: 220px; overflow-y: auto; }
  .kd-filter-option {
    display: flex; align-items: center; gap: 8px; padding: 5px 10px;
    font-size: 0.75rem; color: var(--color-slate-700); cursor: pointer;
  }
  .kd-filter-option:hover { background: var(--color-slate-50); }
  .kd-filter-option input { width: 13px; height: 13px; accent-color: var(--color-primary-500); cursor: pointer; flex-shrink: 0; }

  .kd-tabs { display: flex; gap: 0.35rem; }
  .kd-head-actions { display: flex; align-items: center; gap: 0.5rem; }
  .kd-body { display: flex; flex-direction: column; gap: 9px; }
  .kd-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .kd-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 4px 8px; font-size: 12px; }
  .kd-row-clickable { cursor: pointer; border-radius: var(--radius-sm); margin: -2px -4px; padding: 2px 4px; }
  .kd-row-clickable:hover { background: var(--color-slate-50); }
  .kd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary-600); flex-shrink: 0; margin-top: 5px; }
  .kd-date { color: var(--color-slate-500); white-space: nowrap; flex-shrink: 0; padding-top: 1px; }
  .kd-title { color: var(--color-slate-800); }
  .kd-source { color: var(--color-slate-400); }
  .kd-project-tag { margin-left: auto; }

  .pgm-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1.5rem;
  }
  .pgm-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 95%;
    max-width: 1400px;
    height: 88vh;
    padding: 1.75rem;
    box-sizing: border-box;
    overflow-y: auto;
  }
</style>
