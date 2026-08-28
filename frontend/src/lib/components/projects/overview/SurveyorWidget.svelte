<script>
  import { onMount } from 'svelte';
  import { getQuotes } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import { openSurveyorManagement } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;
  $: uniqueId = project?.unique_id;

  let stats = null;
  let loading = true;
  let error = null;

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      const [quotes, sentRequests] = await Promise.all([
        getQuotes({ projectId: uniqueId }),
        getSentRequestsForProject(uniqueId),
      ]);

      const instructed = quotes.filter(q =>
        q.instruction_status === 'instructed' || q.instruction_status === 'partially_instructed'
      );
      const instructedSpend = instructed.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
      const worksCompleted = instructed.filter(q => q.work_status === 'completed');
      const worksOutstanding = instructed.filter(q => q.work_status !== 'completed');

      stats = {
        quotesSent: sentRequests.length,
        quotesReceived: quotes.length,
        quotesInstructed: instructed.length,
        instructedSpend,
        worksCompleted: worksCompleted.length,
        worksOutstanding: worksOutstanding.length,
      };
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openManage() {
    openSurveyorManagement(projectId);
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-user-tie"></i>
      Surveyor
    </div>
    <button class="widget-expand" on:click={openManage}>
      Manage <i class="las la-angle-right"></i>
    </button>
  </div>
  <div class="widget-body sv-body">
    {#if loading}
      <div class="sv-state">Loading…</div>
    {:else if error}
      <div class="sv-state sv-state-error">{error}</div>
    {:else if stats}
      <div class="sv-stats">
        <div><div class="sv-num">{stats.quotesSent}</div><div class="sv-label">Sent</div></div>
        <div><div class="sv-num">{stats.quotesReceived}</div><div class="sv-label">Received</div></div>
        <div><div class="sv-num">{stats.quotesInstructed}</div><div class="sv-label">Instructed</div></div>
      </div>
      <div class="sv-spend">£{stats.instructedSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} instructed spend</div>
      <div class="sv-badges">
        <span class="badge badge-warning">{stats.worksOutstanding} outstanding</span>
        <span class="badge badge-success">{stats.worksCompleted} completed</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .sv-body { display: flex; flex-direction: column; gap: 10px; }
  .sv-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .sv-state-error { color: var(--color-red-600); }
  .sv-stats { display: flex; gap: 16px; }
  .sv-num { font-size: 17px; font-weight: 700; color: var(--color-slate-900); }
  .sv-label { font-size: 10px; color: var(--color-slate-400); }
  .sv-spend { font-size: 12px; font-weight: 600; color: var(--color-slate-700); }
  .sv-badges { display: flex; gap: 6px; }
</style>
