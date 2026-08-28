<script>
  import NoticesTab from '$lib/components/tenders/NoticesTab.svelte';
  import CouncilActivityTab from '$lib/components/tenders/CouncilActivityTab.svelte';
  import BuyerMatchingTab from '$lib/components/tenders/BuyerMatchingTab.svelte';
  import TendersSettingsTab from '$lib/components/tenders/TendersSettingsTab.svelte';

  let activeTab = 'notices'; // 'notices' | 'activity' | 'matching' | 'settings'
</script>

<div class="tenders-page">
  <header class="page-header">
    <h1 class="page-title">Tenders <span class="beta-tag">Beta</span></h1>
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

  <div class="card tab-content">
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

<style>
  .tenders-page {
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

  .beta-tag {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--color-amber-100);
    color: var(--color-amber-800);
    vertical-align: middle;
    margin-left: 0.3rem;
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
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
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
      border-left-color: var(--color-primary-500);
    }
  }
</style>
