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
    dispatch('change', {
      sourceType: sourceType || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      projectId: filters.projectId
    });
  }

  function clearFilters() {
    sourceType = '';
    dateFrom = '';
    dateTo = '';
    emit();
  }

  $: hasActiveFilters = sourceType || dateFrom || dateTo;
</script>

<div class="filters-bar">
  <select bind:value={sourceType} on:change={emit} class="filter-select">
    {#each sourceTypes as st}
      <option value={st.value}>{st.label}</option>
    {/each}
  </select>

  <div class="date-range">
    <input
      type="date"
      bind:value={dateFrom}
      on:change={emit}
      class="date-input"
      placeholder="From"
      title="From date"
    />
    <span class="date-sep">—</span>
    <input
      type="date"
      bind:value={dateTo}
      on:change={emit}
      class="date-input"
      placeholder="To"
      title="To date"
    />
  </div>

  {#if hasActiveFilters}
    <button class="clear-btn" on:click={clearFilters} title="Clear filters">
      <i class="las la-times"></i>
      Clear
    </button>
  {/if}
</div>

<style>
  .filters-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-select,
  .date-input {
    padding: 0.4375rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    cursor: pointer;
  }

  .filter-select:focus,
  .date-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .date-range {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-sep {
    color: #94a3b8;
    font-size: 0.875rem;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4375rem 0.875rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
</style>
