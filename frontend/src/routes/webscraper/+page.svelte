<script>
  import RenewablesTab from '$lib/components/projectmap/RenewablesTab.svelte';
  import DataCentresTab from '$lib/components/projectmap/DataCentresTab.svelte';
  import ContractsFinderTab from '$lib/components/projectmap/ContractsFinderTab.svelte';

  let activeTab = 'renewables'; // 'renewables' | 'datacentres' | 'contracts'
</script>

<div class="webscraper-page">
  <!-- Header Section -->
  <header class="page-header">
    <h1 class="page-title">Web Scraper Data</h1>
    <p class="page-subtitle">
      View scraped planning application data for renewables and data centres across the UK
    </p>
  </header>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-button"
      class:active={activeTab === 'renewables'}
      on:click={() => activeTab = 'renewables'}
    >
      <i class="las la-solar-panel"></i>
      Renewables
    </button>
    <button
      class="tab-button"
      class:active={activeTab === 'datacentres'}
      on:click={() => activeTab = 'datacentres'}
    >
      <i class="las la-server"></i>
      Data Centres
    </button>
    <button
      class="tab-button"
      class:active={activeTab === 'contracts'}
      on:click={() => activeTab = 'contracts'}
    >
      <i class="las la-file-contract"></i>
      Gov.uk Contracts Finder
    </button>
  </div>

  <!-- Tab Content -->
  <div class="card tab-content">
    {#if activeTab === 'renewables'}
      <RenewablesTab />
    {:else if activeTab === 'datacentres'}
      <DataCentresTab />
    {:else if activeTab === 'contracts'}
      <ContractsFinderTab />
    {/if}
  </div>
</div>

<style>
  .webscraper-page {
    background: var(--color-slate-50);
    padding: 1.5rem 2rem;
  }

  .page-header {
    margin-bottom: 1.25rem;
  }

  .page-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    margin: 0;
    max-width: 560px;
    line-height: 1.5;
  }

  .tab-navigation {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 2px solid var(--color-slate-200);
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.75rem 1.125rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-slate-500);
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: var(--color-slate-800);
  }

  .tab-button.active {
    color: var(--color-amber-600);
    border-bottom-color: var(--color-amber-600);
  }

  .tab-button i {
    font-size: 1rem;
  }

  .tab-content {
    padding: 1.5rem;
  }

  @media (max-width: 768px) {
    .tab-navigation {
      flex-direction: column;
      gap: 0;
    }

    .tab-button {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-slate-200);
      border-left: 3px solid transparent;
    }

    .tab-button.active {
      border-bottom-color: var(--color-slate-200);
      border-left-color: var(--color-amber-600);
    }
  }
</style>
