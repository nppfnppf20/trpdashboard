<script>
  import { createEventDispatcher } from 'svelte';
  export let filters = { projectId: null, sourceType: null, dateFrom: null, dateTo: null };
  const dispatch = createEventDispatcher();

  const sourceTypes = [
    { value: '', label: 'All sources' },
    { value: 'stage_completed', label: 'Stage completed' },
    { value: 'stage_upcoming', label: 'Upcoming stages' },
    { value: 'stage_overdue', label: 'Overdue stages' },
    { value: 'key_issue', label: 'Key issues' },
    { value: 'scraper_renewables', label: 'Scraper: Renewables' },
    { value: 'scraper_datacentres', label: 'Scraper: Data Centres' },
    { value: 'scraper_contracts', label: 'Scraper: Contracts' }
  ];

  let sourceType = filters.sourceType || '';
  let dateFrom = filters.dateFrom || '';
  let dateTo = filters.dateTo || '';

  function emit() {
    dispatch('change', { sourceType: sourceType || null, dateFrom: dateFrom || null, dateTo: dateTo || null, projectId: filters.projectId });
  }

  function clear() { sourceType = ''; dateFrom = ''; dateTo = ''; emit(); }
  $: hasActive = sourceType || dateFrom || dateTo;
</script>

<div class="filter-bar">
  <select bind:value={sourceType} on:change={emit}>
    {#each sourceTypes as s}<option value={s.value}>{s.label}</option>{/each}
  </select>
  <input type="date" bind:value={dateFrom} on:change={emit} title="From" />
  <span>-</span>
  <input type="date" bind:value={dateTo} on:change={emit} title="To" />
  {#if hasActive}
    <button class="btn btn-secondary btn-sm" on:click={clear}><i class="las la-times"></i> Clear</button>
  {/if}
</div>

<style>
  .filter-bar { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }
  select, input[type="date"] {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  select:focus, input[type="date"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  span { color: #94a3b8; font-size: 0.875rem; }
</style>
