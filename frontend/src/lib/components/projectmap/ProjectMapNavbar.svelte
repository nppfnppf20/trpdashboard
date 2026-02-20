<script>
  import RenewablesTab from './RenewablesTab.svelte';
  import DataCentresTab from './DataCentresTab.svelte';

  // Active tab state
  let activeTab = 'renewables'; // Default to renewables tab

  function setActiveTab(tab) {
    activeTab = tab;
  }
</script>

<div class="project-map-navbar">
  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-button"
      class:active={activeTab === 'renewables'}
      on:click={() => setActiveTab('renewables')}
    >
      <i class="las la-wind"></i>
      <span>Planit Renewables</span>
    </button>
    <button
      class="tab-button"
      class:active={activeTab === 'datacentres'}
      on:click={() => setActiveTab('datacentres')}
    >
      <i class="las la-server"></i>
      <span>Planit Data Centres</span>
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'renewables'}
      <RenewablesTab />
    {:else if activeTab === 'datacentres'}
      <DataCentresTab />
    {/if}
  </div>
</div>

<style>
  .project-map-navbar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .tab-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: transparent;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
  }

  .tab-button i {
    font-size: 1.125rem;
  }

  .tab-button:hover:not(.active) {
    color: #374151;
    background: #f3f4f6;
  }

  .tab-button.active {
    color: #9333ea;
    background: white;
    border-bottom-color: #9333ea;
  }

  /* Tab Content */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    background: white;
  }
</style>
