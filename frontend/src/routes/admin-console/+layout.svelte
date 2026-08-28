<script>
  import { page } from '$app/stores';

  const navItems = [
    { path: '/admin-console/surveyors', label: 'Surveyors', icon: 'la-users' },
    { path: '/admin-console/clients', label: 'Clients', icon: 'la-building' },
    { path: '/admin-console/planning-templates', label: 'Policy Templates', icon: 'la-clipboard-list' },
    { path: '/admin-console/issue-templates', label: 'Per Issue Planning Assessment Templates', icon: 'la-tags' },
    { path: '/admin-console/guiding-briefs', label: 'Guiding Briefs', icon: 'la-book-open' },
    { path: '/admin-console/prompt-map', label: 'Prompt Map', icon: 'la-project-diagram' },
    { path: '/admin-console/llm-settings', label: 'AI Providers', icon: 'la-robot' }
  ];
</script>

<div class="admin-console-layout">
  <!-- Top header with home button and nav -->
  <header class="admin-header">
    <div class="header-left">
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
    background: var(--color-slate-50);
  }

  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem 0;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    box-shadow: var(--shadow-sm);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1rem;
  }

  .page-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-title i {
    color: var(--color-primary-500);
  }

  .admin-nav {
    display: flex;
    gap: 0;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    color: var(--color-slate-500);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-tab:hover {
    color: var(--color-slate-800);
    background: var(--color-slate-50);
  }

  .nav-tab.active {
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
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
