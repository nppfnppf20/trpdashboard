<script>
  import MarketingWorkspace from '$lib/components/marketing/MarketingWorkspace.svelte';
</script>

<div class="page">
  <header class="topbar">
    <span class="topbar-title">Marketing <span class="beta-tag">Beta</span></span>
  </header>

  <div class="main">
    <MarketingWorkspace />
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--color-slate-50);
  }

  .topbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 52px;
    padding: 0 1rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    z-index: 10;
  }

  .topbar-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.4rem;
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
  }

  .main {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .main :global(.workspace) {
    flex: 1;
    min-height: 0;
    height: calc(100vh - 52px);
    display: flex;
    flex-direction: column;
  }

  .main :global(.draft-editor-panel) {
    height: calc(100vh - 52px - 46px);
  }
</style>
