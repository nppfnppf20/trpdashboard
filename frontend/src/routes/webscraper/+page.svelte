<script>
  import RenewablesTab from '$lib/components/projectmap/RenewablesTab.svelte';
  import DataCentresTab from '$lib/components/projectmap/DataCentresTab.svelte';
  import ContractsFinderTab from '$lib/components/projectmap/ContractsFinderTab.svelte';

  let activeTab = 'renewables'; // 'renewables' | 'datacentres' | 'contracts'
</script>

<div class="webscraper-page">
  <!-- Home button in top-left corner -->
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <div class="page-container">
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
    <div class="tab-content">
      {#if activeTab === 'renewables'}
        <RenewablesTab />
      {:else if activeTab === 'datacentres'}
        <DataCentresTab />
      {:else if activeTab === 'contracts'}
        <ContractsFinderTab />
      {/if}
    </div>

  </div>
</div>

<style>
  .webscraper-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 2rem 1rem;
    position: relative;
  }

  .home-button {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #1e293b;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .home-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .home-button i {
    font-size: 1.125rem;
  }

  .page-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
  }

  .page-subtitle {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0;
  }

  .tab-navigation {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid #e2e8f0;
    justify-content: center;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 1.125rem;
    font-weight: 500;
    color: #64748b;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #1e293b;
  }

  .tab-button.active {
    color: #f97316;
    border-bottom-color: #f97316;
  }

  .tab-button i {
    font-size: 1.5rem;
  }

  .tab-content {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .page-title {
      font-size: 2rem;
    }

    .tab-navigation {
      flex-direction: column;
      gap: 0;
    }

    .tab-button {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      border-left: 3px solid transparent;
    }

    .tab-button.active {
      border-bottom-color: #e2e8f0;
      border-left-color: #f97316;
    }
  }
</style>
