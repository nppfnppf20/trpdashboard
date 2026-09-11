<script>
  import ProgrammeTab from '$lib/components/projects/ProgrammeTab.svelte';
  import ViewDateModal from '$lib/components/admin-console/ViewDateModal.svelte';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import { getConditionsData, updateConditionKeyDate, deleteConditionKeyDate } from '$lib/api/conditions.js';
  import { getProgressData, updateIssueKeyDate, deleteIssueKeyDate } from '$lib/api/progressTracker.js';
  import { getConsultationData, updateConsultationKeyDate, deleteConsultationKeyDate } from '$lib/api/consultation.js';
  import { getProgrammeEvents, updateProgrammeEvent, deleteProgrammeEvent } from '$lib/api/quotes.js';
  import { updateProjectMilestoneResolved } from '$lib/api/projects.js';
  import { keyDatesVersion, bumpKeyDatesVersion } from '$lib/stores/keyDates.js';
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

  let showProgrammeModal = false;
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
    <div class="widget-title">
      <i class="las la-calendar-alt"></i>
      Key Dates
    </div>
    {#if !merged}
      <button class="widget-expand" on:click={openProgramme}>
        Programme <i class="las la-angle-right"></i>
      </button>
    {/if}
  </div>
  <div class="widget-body kd-body">
    {#if !dates.length}
      <div class="kd-state">No upcoming dates.</div>
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
</div>

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

<style>
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
