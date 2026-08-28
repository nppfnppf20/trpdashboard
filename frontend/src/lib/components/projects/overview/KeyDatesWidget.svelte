<script>
  import { openSurveyorManagement } from '$lib/stores/projectViewModal.js';

  // Sourced directly from the project's own date fields (already loaded with
  // the project — no fetch needed). "Programme" still deep-links to the
  // fuller Gantt view under Surveyor Management, which additionally covers
  // quote-derived programme events these fields don't.
  export let project;
  $: projectId = project?.id;

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

  $: dates = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return FIELDS
      .map(([key, label]) => ({ date: project?.[key], title: label }))
      .filter(d => d.date && String(d.date).slice(0, 10) >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 4);
  })();

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function openProgramme() {
    openSurveyorManagement(projectId, 'programme');
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
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .kd-body { display: flex; flex-direction: column; gap: 9px; }
  .kd-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .kd-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .kd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary-600); flex-shrink: 0; }
  .kd-date { color: var(--color-slate-500); width: 40px; flex-shrink: 0; }
  .kd-title { color: var(--color-slate-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
