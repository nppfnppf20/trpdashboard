<script>
  import MarketingWorkspace from '$lib/components/marketing/MarketingWorkspace.svelte';
</script>

<div class="page">
  <header class="topbar">
    <a href="/" class="home-btn" title="Back to Home">
      <i class="las la-home"></i>
    </a>
    <span class="topbar-title">Marketing</span>
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
    background: #f8fafc;
  }

  .topbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 52px;
    padding: 0 1rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    z-index: 10;
  }

  .home-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: #475569;
    text-decoration: none;
    font-size: 1.1rem;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .home-btn:hover { background: #f1f5f9; color: #1e293b; }

  .topbar-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
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
