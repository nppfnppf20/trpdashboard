<script>
  import { page } from '$app/stores';

  const navItems = [
    { path: '/admin-console/surveyors', label: 'Surveyors', icon: 'la-users' },
    { path: '/admin-console/clients', label: 'Clients', icon: 'la-building' }
  ];
</script>

<div class="admin-console-layout">
  <!-- Top header with home button and nav -->
  <header class="admin-header">
    <div class="header-left">
      <a href="/" class="home-button" title="Back to Home">
        <i class="las la-home"></i>
        <span>Home</span>
      </a>
      <h1 class="page-title"><i class="las la-cog"></i> Admin Console</h1>
    </div>
    <nav class="admin-nav">
      {#each navItems as item}
        <a
          href={item.path}
          class="nav-tab"
          class:active={$page.url.pathname.startsWith(item.path)}
        >
          <i class="las {item.icon}"></i>
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  </header>

  <main class="admin-content">
    <slot />
  </main>
</div>

<style>
  .admin-console-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #f5f7fa;
  }

  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 2px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .home-button {
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
  }

  .home-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .home-button i {
    font-size: 1.125rem;
  }

  .page-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-title i {
    color: #3b82f6;
  }

  .admin-nav {
    display: flex;
    gap: 0.5rem;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    color: #64748b;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-tab:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .nav-tab.active {
    background: #3b82f6;
    color: white;
  }

  .nav-tab i {
    font-size: 1.125rem;
  }

  .admin-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
    max-width: 100%;
    box-sizing: border-box;
  }
</style>
