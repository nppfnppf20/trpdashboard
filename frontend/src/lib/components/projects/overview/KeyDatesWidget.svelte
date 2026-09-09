<script>
  import ProgrammeTab from '$lib/components/projects/ProgrammeTab.svelte';
  import { getConditionsData } from '$lib/api/conditions.js';
  import { getProgressData } from '$lib/api/progressTracker.js';
  import { getConsultationData } from '$lib/api/consultation.js';
  import { getProgrammeEvents } from '$lib/api/quotes.js';
  import { keyDatesVersion } from '$lib/stores/keyDates.js';

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

  let showProgrammeModal = false;
  let trackerKeyDates = []; // [{ date, title, source? }] merged from conditions/issues/consultation/programme events
  let loadedForId = null;
  let loadedAtVersion = null;

  $: if (project?.id && (project.id !== loadedForId || $keyDatesVersion !== loadedAtVersion)) loadTrackerKeyDates(project, $keyDatesVersion);

  async function loadTrackerKeyDates(proj, version) {
    loadedForId = proj.id;
    loadedAtVersion = version;
    try {
      const [condData, progData, consData, events] = await Promise.all([
        getConditionsData(proj.id),
        getProgressData(proj.id),
        getConsultationData(proj.id),
        getProgrammeEvents(proj.unique_id),
      ]);
      // `source` labels match ProgrammeTab.svelte's row titles exactly, so
      // the same row reads the same way in both places.
      const keyDatesOf = (rows, sourceOf) => (rows || []).flatMap(r => (r.key_dates || []).map(kd => ({ date: kd.date, title: kd.title, source: sourceOf(r) })));
      trackerKeyDates = [
        ...keyDatesOf(condData.conditions, c => c.condition_number ? `Condition ${c.condition_number} — ${c.title}` : c.title),
        ...keyDatesOf(progData.issues, i => i.title),
        ...keyDatesOf(consData.responses, r => r.consultee_name),
        ...(events || []).map(e => ({ date: e.date, title: e.title })),
      ];
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

  // No cap — .widget-body already scrolls (see cards.css), so all upcoming
  // dates are shown, soonest first, rather than just the next few.
  $: dates = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const projectDates = FIELDS.map(([key, label]) => ({ date: project?.[key], title: label }));
    return [...projectDates, ...trackerKeyDates]
      .filter(d => d.date && String(d.date).slice(0, 10) >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  })();

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function openProgramme() {
    showProgrammeModal = true;
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-calendar-alt"></i>
      Key Dates
    </div>
    <button class="widget-expand" on:click={openProgramme}>
      Programme <i class="las la-angle-right"></i>
    </button>
  </div>
  <div class="widget-body kd-body">
    {#if !dates.length}
      <div class="kd-state">No upcoming dates.</div>
    {:else}
      {#each dates as d}
        <div class="kd-row">
          <span class="kd-dot"></span>
          <span class="kd-date">{formatDate(d.date)}</span>
          <span class="kd-title">{d.title}</span>
          {#if d.source}<span class="kd-source">· {d.source}</span>{/if}
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

<style>
  .kd-body { display: flex; flex-direction: column; gap: 9px; }
  .kd-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .kd-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 4px 8px; font-size: 12px; }
  .kd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary-600); flex-shrink: 0; margin-top: 5px; }
  .kd-date { color: var(--color-slate-500); white-space: nowrap; flex-shrink: 0; padding-top: 1px; }
  .kd-title { color: var(--color-slate-800); }
  .kd-source { color: var(--color-slate-400); }

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
