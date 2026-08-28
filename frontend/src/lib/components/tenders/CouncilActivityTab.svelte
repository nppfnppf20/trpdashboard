<script>
  import { onMount } from 'svelte';
  import { getStats } from '$lib/api/tenders.js';

  let stats = [];
  let loading = true;
  let errorMsg = '';

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatValue(amount) {
    if (amount === null || amount === undefined) return '-';
    return `£${Number(amount).toLocaleString('en-GB')}`;
  }

  function activityLabel(notices36m) {
    const n = Number(notices36m);
    if (n >= 5) return { label: 'High', cls: 'high' };
    if (n >= 2) return { label: 'Medium', cls: 'medium' };
    if (n >= 1) return { label: 'Low', cls: 'low' };
    return { label: 'None', cls: 'none' };
  }

  onMount(async () => {
    try {
      stats = await getStats();
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="activity-tab">
  {#if errorMsg}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <h3>Error loading council activity</h3>
      <p>{errorMsg}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading council activity…</p>
    </div>
  {:else if stats.length > 0}
    <p class="tab-intro">
      Councils ranked by relevant procurement activity. Activity bands: High = 5+ relevant notices in
      36 months, Medium = 2–4, Low = 1. Grows more useful as historical data is backfilled.
    </p>
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Council</th>
            <th>Region</th>
            <th>Type</th>
            <th>Activity</th>
            <th>Notices (12m)</th>
            <th>Notices (36m)</th>
            <th>Awards (36m)</th>
            <th>Total value (36m)</th>
            <th>Avg value (36m)</th>
            <th>Most recent</th>
          </tr>
        </thead>
        <tbody>
          {#each stats as row (row.id)}
            {@const band = activityLabel(row.notices_36m)}
            <tr>
              <td class="cell-name">{row.name}</td>
              <td>{row.region || '-'}</td>
              <td class="cell-type">{(row.authority_type || '-').replace('_', ' ')}</td>
              <td><span class="activity-badge activity-{band.cls}">{band.label}</span></td>
              <td class="cell-num">{row.notices_12m}</td>
              <td class="cell-num">{row.notices_36m}</td>
              <td class="cell-num">{row.awards_36m}</td>
              <td class="cell-num">{formatValue(row.total_value_36m)}</td>
              <td class="cell-num">{formatValue(row.avg_value_36m)}</td>
              <td class="cell-date">{formatDate(row.most_recent)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-landmark"></i>
      <p>No council activity yet - run a sync from the Notices tab</p>
    </div>
  {/if}
</div>

<style>
  .activity-tab { display: flex; flex-direction: column; gap: 0.75rem; }

  .tab-intro { margin: 0; font-size: 0.8rem; color: var(--color-slate-500); }

  .loading-state, .empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-slate-500);
    text-align: center;
  }

  .empty-state { color: var(--color-slate-400); }
  .empty-state i, .error-state i { font-size: 3rem; margin-bottom: 1rem; }
  .error-state { color: var(--color-red-800); }
  .error-state h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; }
  .error-state p { margin: 0; font-size: 0.875rem; }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid var(--color-slate-100);
    border-top: 3px solid var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  .table-wrapper { overflow: auto; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .data-table thead { position: sticky; top: 0; background: var(--color-slate-50); z-index: 10; }
  .data-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600);
    border-bottom: 2px solid var(--color-slate-200);
    white-space: nowrap;
  }
  .data-table tbody tr { border-bottom: 1px solid var(--color-slate-100); }
  .data-table tbody tr:hover { background-color: var(--color-slate-50); }
  .data-table td { padding: 0.5rem 0.75rem; color: var(--color-slate-700); }

  .cell-name { font-weight: 500; color: var(--color-slate-800); }
  .cell-type { text-transform: capitalize; }
  .cell-num { text-align: right; white-space: nowrap; }
  .cell-date { white-space: nowrap; color: var(--color-slate-500); }

  .activity-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
  }
  .activity-high { background: var(--color-emerald-100); color: var(--color-emerald-800); }
  .activity-medium { background: var(--color-amber-100); color: var(--color-amber-800); }
  .activity-low { background: var(--color-indigo-100); color: var(--color-violet-800); }
  .activity-none { background: var(--color-slate-200); color: var(--color-slate-600); }
</style>
