<script>
  // Read-only Trackers + Surveyor Management browser for the profile page.
  // One project at a time: pick a project from the dropdown (blank until
  // chosen), then pick which tracker/Surveyor to view for it (also blank
  // until chosen). Deliberately a standalone widget rather than puppeting
  // TrackersWidget/SurveyorWidget from outside — those auto-select content
  // on load and carry their own write flows, neither of which fits here. No
  // add-advancement / upload — clicking a row opens its advancement log
  // (read-only) in a popup; editing happens in the project's own tracker.
  // Only trackers that actually have data for the chosen project are offered.
  import { getConsultationData } from '$lib/api/consultation.js';
  import { getConditionsData } from '$lib/api/conditions.js';
  import { getProgressData } from '$lib/api/progressTracker.js';
  import { getQuotes } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import AdvancementTimelineModal from '$lib/components/projects/overview/AdvancementTimelineModal.svelte';
  import SurveyorModal from '$lib/components/surveyor-management/SurveyorModal.svelte';

  export let projects = [];

  const TYPE_OPTIONS = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'conditions', label: 'Conditions' },
    { value: 'progress', label: 'Project' },
    { value: 'surveyor', label: 'Surveyor' },
  ];

  let selectedProjectId = ''; // blank until chosen
  let selectedType = '';      // blank until chosen (reset whenever the project changes)
  let loading = false;
  let error = null;
  let rows = [];    // tracker types

  $: selectedProject = projects.find(p => p.id == selectedProjectId) || null;

  // Cache keyed by "<type>:<projectId>" so flipping back to an
  // already-viewed project/tracker combo is instant.
  const cache = new Map();

  let loadedKey = null;
  $: {
    const key = (selectedProject && selectedType) ? `${selectedType}:${selectedProject.id}` : null;
    if (key !== loadedKey) {
      loadedKey = key;
      if (key) load();
      else rows = [];
    }
  }

  function handleProjectChange() {
    selectedType = ''; // switching projects always starts blank again
  }

  // ── Which trackers have data? Loaded all together when a project is picked
  // (cached, so choosing a tracker afterwards is instant) and only those with
  // something in them are offered as pills. ───────────────────────────────────
  let available = null;      // { consultation: bool, ... } for the selected project, null until known
  let availLoading = false;
  let availKey = null;
  $: {
    const k = selectedProject ? String(selectedProject.id) : null;
    if (k !== availKey) {
      availKey = k;
      available = null;
      if (selectedProject) loadAvailability(selectedProject);
    }
  }
  $: visibleTypes = available ? TYPE_OPTIONS.filter(o => available[o.value]) : [];

  async function loadAvailability(project) {
    availLoading = true;
    error = null;
    try {
      const [consultation, conditions, progress, surveyor] = await Promise.all([
        fetchTracker('consultation', project),
        fetchTracker('conditions', project),
        fetchTracker('progress', project),
        // A surveyor lookup failing shouldn't hide the trackers — just treat as nothing to show.
        fetchSurveyor(project).then(s => s.quotesSent + s.quotesReceived + s.quotesInstructed > 0).catch(() => false),
      ]);
      // The user may have switched project while this was loading.
      if (selectedProject?.id === project.id) {
        const items = { consultation, conditions, progress };
        available = {
          consultation: consultation.length > 0,
          conditions: conditions.length > 0,
          progress: progress.length > 0,
          surveyor,
        };
        // Open on whichever tracker holds the most text, rather than asking the user to pick.
        // (Surveyor is excluded — it opens its own popup rather than showing a list here.)
        if (!selectedType) {
          const biggest = ['consultation', 'conditions', 'progress']
            .filter(type => available[type])
            .map(type => ({ type, size: textSize(buildRows(type, items[type])) }))
            .sort((a, b) => b.size - a.size)[0];
          if (biggest) selectedType = biggest.type;
        }
      }
    } catch (err) {
      if (selectedProject?.id === project.id) error = err.message;
    } finally {
      if (selectedProject?.id === project.id) availLoading = false;
    }
  }

  // Rough measure of how much a tracker holds: the row names plus every log entry's summary.
  function textSize(rows) {
    return rows.reduce((sum, r) =>
      sum + (r.name?.length || 0) + r.timeline.reduce((s, t) => s + (t.summary?.length || 0), 0), 0);
  }

  async function load() {
    loading = true;
    error = null;
    try {
      rows = buildRows(selectedType, await fetchTracker(selectedType, selectedProject));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function fetchTracker(type, project) {
    const key = `${type}:${project.id}`;
    if (!cache.has(key)) {
      let items;
      if (type === 'consultation') items = (await getConsultationData(project.id)).responses || [];
      else if (type === 'conditions') items = (await getConditionsData(project.id)).conditions || [];
      else items = (await getProgressData(project.id)).issues || [];
      cache.set(key, items.map(item => ({ ...item, _projectId: project.id })));
    }
    return cache.get(key);
  }

  async function fetchSurveyor(project) {
    const key = `surveyor:${project.id}`;
    if (!cache.has(key)) {
      const [quotes, sentRequests] = await Promise.all([
        getQuotes({ projectId: project.unique_id }),
        getSentRequestsForProject(project.unique_id),
      ]);
      const instructed = quotes.filter(q =>
        q.instruction_status === 'instructed' || q.instruction_status === 'partially_instructed'
      );
      cache.set(key, {
        quotesSent: sentRequests.length,
        quotesReceived: quotes.length,
        quotesInstructed: instructed.length,
        instructedSpend: instructed.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0),
        worksCompleted: instructed.filter(q => q.work_status === 'completed').length,
        worksOutstanding: instructed.filter(q => q.work_status !== 'completed').length,
      });
    }
    return cache.get(key);
  }

  // ── Row shaping — mirrors TrackersWidget.svelte's helpers exactly, kept
  // read-only and self-contained here rather than reworking that (still-used
  // single-project, read-write) widget to be puppeted from outside. ────────
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
  function sortByDateDesc(arr, key) {
    return [...arr].sort((a, b) =>
      String(b[key] || '').localeCompare(String(a[key] || '')) || (b.id ?? 0) - (a.id ?? 0)
    );
  }
  function mainIssueActions(iss) {
    return (iss.actions || []).filter(a => !a.sub_issue_ids || a.sub_issue_ids.length === 0);
  }
  function mergedConditionTimeline(c) {
    const own = (c.advancements || []).map(a => ({ ...a, _kind: 'condition' }));
    const fromQuotes = (c.linked_quotes || []).flatMap(q =>
      (q.actions || []).map(a => ({ id: `q-${a.id}`, advancement_date: a.action_date, summary: a.summary }))
    );
    const fromKeyDates = (c.linked_quotes || []).flatMap(q =>
      (q.key_dates || []).map(kd => ({ id: `kd-${kd.id}`, advancement_date: kd.date, summary: kd.title }))
    );
    const fromInstructionStatus = (c.linked_quotes || [])
      .filter(q => q.instruction_status_changed_at)
      .map(q => ({
        id: `is-${q.quote_id}`,
        advancement_date: String(q.instruction_status_changed_at).slice(0, 10),
        summary: `Instruction status: ${q.instruction_status}`,
      }));
    return [...own, ...fromQuotes, ...fromKeyDates, ...fromInstructionStatus].sort((a, b) =>
      String(b.advancement_date || '').localeCompare(String(a.advancement_date || ''))
      || String(b.id).localeCompare(String(a.id))
    );
  }

  function buildRows(type, items) {
    if (type === 'consultation') {
      return items.map(r => {
        const adv = sortByDateDesc(r.advancements || [], 'advancement_date');
        return {
          id: r.id, projectId: r._projectId,
          name: r.consultee_name,
          badgeLabel: toTitleCase(r.position), badgeClass: positionBadgeClass(r.position),
          statusLabel: toTitleCase(r.status || 'In Progress'),
          statusClass: r.status === 'Closed Out' ? 'badge-neutral' : 'badge-info',
          latest: adv[0] ? { date: adv[0].advancement_date, summary: adv[0].summary } : null,
          count: adv.length,
          timeline: adv.map(a => ({
            id: a.id, date: a.advancement_date, summary: a.summary, fullText: a.full_text,
            sourceType: a.source_type, editable: false, sourceLabel: null,
          })),
        };
      });
    }
    if (type === 'conditions') {
      return items.map(c => {
        const timeline = mergedConditionTimeline(c);
        return {
          id: c.id, projectId: c._projectId,
          name: c.condition_number ? `Condition ${c.condition_number} — ${c.title}` : c.title,
          badgeLabel: null, badgeClass: null,
          statusLabel: toTitleCase(c.status || 'Not Started'), statusClass: conditionStatusBadgeClass(c.status),
          latest: timeline[0] ? { date: timeline[0].advancement_date, summary: timeline[0].summary } : null,
          count: timeline.length,
          timeline: timeline.map(a => ({
            id: a.id, date: a.advancement_date, summary: a.summary, fullText: a.full_text,
            sourceType: a.source_type, editable: false, sourceLabel: null,
          })),
        };
      });
    }
    return items.map(iss => {
      const acts = sortByDateDesc(mainIssueActions(iss), 'action_date');
      return {
        id: iss.id, projectId: iss._projectId,
        name: iss.title,
        badgeLabel: toTitleCase(iss.discipline), badgeClass: 'badge-neutral',
        statusLabel: iss.status === 'Complete' ? 'Resolved' : toTitleCase(iss.status || 'In Progress'), statusClass: iss.status === 'Complete' ? 'badge-success' : 'badge-info',
        latest: acts[0] ? { date: acts[0].action_date, summary: acts[0].summary } : null,
        count: acts.length,
        timeline: acts.map(a => ({
          id: a.id, date: a.action_date, summary: a.summary, fullText: a.full_text,
          sourceType: a.source_type, meetingNoteTitle: a.meeting_note_title, editable: false, sourceLabel: a.stage_name || null,
        })),
      };
    });
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // The row whose advancement log is open (read-only popup), or null.
  let logRow = null;

  // Surveyor Management popup for the chosen project — the same one the project
  // overview's expand button opens. Closing it drops the cached surveyor figures
  // (quotes may have changed) so the Surveyor pill's availability is rechecked next time.
  let showSurveyor = false;
  function closeSurveyor() {
    showSurveyor = false;
    if (selectedProject) cache.delete(`surveyor:${selectedProject.id}`);
  }

  $: currentLabel = TYPE_OPTIONS.find(o => o.value === selectedType)?.label ?? '';
</script>

<div class="widget ts-widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-clipboard-list"></i>
      Trackers &amp; Surveyor
    </div>
    <select class="form-input ts-select" bind:value={selectedProjectId} on:change={handleProjectChange}>
      <option value="">Select project...</option>
      {#each projects as p (p.id)}
        <option value={p.id}>{p.project_name}</option>
      {/each}
    </select>
  </div>
  <div class="widget-body ts-body">
    {#if !selectedProject}
      <div class="empty-state ts-empty">
        <p>Choose a project above to view its trackers and Surveyor Management.</p>
      </div>
    {:else}
      {#if availLoading || !available}
        <div class="ts-state">
          {#if error}{error}{:else}<div class="mini-spinner"></div> Checking trackers…{/if}
        </div>
      {:else if !visibleTypes.length}
        <div class="ts-state">No tracker or surveyor data yet for {selectedProject.project_name}.</div>
      {:else}
      <div class="ts-pills">
        {#each visibleTypes as opt (opt.value)}
          {#if opt.value === 'surveyor'}
            <!-- Opens the same Surveyor Management popup as the project overview's expand button -->
            <button class="tab-pill" on:click={() => (showSurveyor = true)} title="Open Surveyor Management">
              {opt.label} <i class="las la-expand-arrows-alt"></i>
            </button>
          {:else}
            <button class="tab-pill" class:active={selectedType === opt.value} on:click={() => selectedType = opt.value}>
              {opt.label}
            </button>
          {/if}
        {/each}
      </div>

      {#if !selectedType}
        <!-- Only reachable when Surveyor is the sole source with data (it opens its own popup). -->
        <div class="ts-state">Only Surveyor Management has data for {selectedProject.project_name}. Click Surveyor above to open it.</div>
      {:else if loading}
        <div class="ts-state"><div class="mini-spinner"></div> Loading…</div>
      {:else if error}
        <div class="ts-state ts-state-error">{error}</div>
      {:else if !rows.length}
        <div class="ts-state">No items in {currentLabel} yet.</div>
      {:else}
        {#each rows as row (row.id)}
          <div class="tr-row">
            <div class="tr-name">
              <div class="tr-name-text">{row.name}</div>
              {#if row.badgeLabel}<span class="badge {row.badgeClass}">{row.badgeLabel}</span>{/if}
            </div>
            {#if row.latest}
              <button class="progress-cell" on:click={() => (logRow = row)} title="View the full log">
                <span class="progress-cell-date">{formatDate(row.latest.date)} &middot; {row.count} update{row.count !== 1 ? 's' : ''}</span>
                <span class="progress-cell-summary">{row.latest.summary}</span>
              </button>
            {:else}
              <div class="progress-cell-empty"></div>
            {/if}
            {#if row.statusLabel}<span class="badge {row.statusClass}">{row.statusLabel}</span>{/if}
          </div>
        {/each}
      {/if}
      {/if}
    {/if}
  </div>
</div>

{#if showSurveyor && selectedProject}
  <SurveyorModal project={selectedProject} onClose={closeSurveyor} />
{/if}

<AdvancementTimelineModal
  show={!!logRow}
  title={logRow ? `${logRow.name} — log` : ''}
  items={logRow?.timeline ?? []}
  readOnly
  onClose={() => (logRow = null)}
/>

<style>
  .ts-widget { grid-row: span 2; }
  .ts-select { font-size: 0.75rem; padding: 0.35rem 0.5rem; width: auto; }

  .ts-body { display: flex; flex-direction: column; gap: 0; padding-top: 6px; }
  .ts-empty { flex: 1; }

  .ts-pills { display: flex; gap: 6px; padding: 0 4px 10px; }
  .tab-pill {
    font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 999px;
    display: flex; align-items: center; gap: 5px;
    background: var(--color-slate-100); color: var(--color-slate-600);
    border: none; cursor: pointer; font-family: inherit;
  }
  .tab-pill.active { background: var(--color-slate-900); color: var(--color-white); }

  .ts-state { padding: 1.5rem; text-align: center; color: var(--color-slate-400); font-size: 0.83rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .ts-state-error { color: var(--color-red-600); }

  .tr-row { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 0 4px; border-bottom: 1px solid var(--color-slate-100); }
  .tr-row:last-child { border-bottom: none; }
  .tr-name { flex: 1; min-width: 0; }
  .tr-name-text { font-size: 12.5px; font-weight: 600; color: var(--color-slate-900); margin-bottom: 2px; }

  .tr-row .badge { font-size: 0.625rem; padding: 0.09rem 0.5rem; flex-shrink: 0; }

  .progress-cell {
    flex: 1.6; min-width: 0; height: 40px; box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: center; text-align: left;
    background: var(--color-slate-50); border: none; border-radius: 8px; padding: 0 10px; cursor: pointer;
  }
  .progress-cell:hover { background: var(--color-slate-100); }
  .progress-cell-date { font-size: 10px; color: var(--color-slate-400); }
  .progress-cell-summary { font-size: 11.5px; color: var(--color-slate-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .progress-cell-empty { flex: 1.6; height: 40px; box-sizing: border-box; }

  .mini-spinner {
    display: inline-block; width: 0.9rem; height: 0.9rem;
    border: 2px solid var(--color-slate-200); border-top-color: var(--color-primary-600);
    border-radius: 50%; animation: ts-spin 0.7s linear infinite;
  }
  @keyframes ts-spin { to { transform: rotate(360deg); } }
</style>
