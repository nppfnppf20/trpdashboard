<script>
  import NoticesTab from '$lib/components/tenders/NoticesTab.svelte';
  import CouncilActivityTab from '$lib/components/tenders/CouncilActivityTab.svelte';
  import BuyerMatchingTab from '$lib/components/tenders/BuyerMatchingTab.svelte';
  import TendersSettingsTab from '$lib/components/tenders/TendersSettingsTab.svelte';

  let activeTab = 'notices'; // 'notices' | 'activity' | 'matching' | 'settings'
</script>

<div class="tenders-page">
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <div class="page-container">
    <header class="page-header">
      <h1 class="page-title">Tenders</h1>
      <p class="page-subtitle">
        Procurement opportunities from Find a Tender, filtered for planning, regeneration and
        socio-economic consultancy work
      </p>
    </header>

    <div class="tab-navigation">
      <button
        class="tab-button"
        class:active={activeTab === 'notices'}
        on:click={() => (activeTab = 'notices')}
      >
        <i class="las la-file-contract"></i>
        Notices
      </button>
      <button
        class="tab-button"
        class:active={activeTab === 'activity'}
        on:click={() => (activeTab = 'activity')}
      >
        <i class="las la-landmark"></i>
        Council Activity
      </button>
      <button
        class="tab-button"
        class:active={activeTab === 'matching'}
        on:click={() => (activeTab = 'matching')}
      >
        <i class="las la-link"></i>
        Buyer Matching
      </button>
      <button
        class="tab-button"
        class:active={activeTab === 'settings'}
        on:click={() => (activeTab = 'settings')}
      >
        <i class="las la-sliders-h"></i>
        Settings
      </button>
    </div>

    <div class="tab-content">
      {#if activeTab === 'notices'}
        <NoticesTab />
      {:else if activeTab === 'activity'}
        <CouncilActivityTab />
      {:else if activeTab === 'matching'}
        <BuyerMatchingTab />
      {:else if activeTab === 'settings'}
        <TendersSettingsTab />
      {/if}
    </div>
  </div>
</div>

<style>
  .tenders-page {
    min-height: 100vh;
    background: var(--color-slate-50);
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
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    color: var(--color-slate-800);
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
    z-index: 10;
  }

  .home-button:hover {
    background: var(--color-slate-100);
    border-color: var(--color-slate-300);
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
    color: var(--color-slate-800);
    margin: 0 0 0.75rem 0;
  }

  .page-subtitle {
    font-size: 1.125rem;
    color: var(--color-slate-500);
    margin: 0;
  }

  .tab-navigation {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--color-slate-200);
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
    color: var(--color-slate-500);
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: var(--color-slate-800);
  }

  .tab-button.active {
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
  }

  .tab-button i {
    font-size: 1.5rem;
  }

  .tab-content {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
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
      border-bottom: 1px solid var(--color-slate-200);
      border-left: 3px solid transparent;
    }

    .tab-button.active {
      border-bottom-color: var(--color-slate-200);
      border-left-color: var(--color-primary-500);
    }
  }
</style>
