<script>
  import { goto } from '$app/navigation';
  import ProjectMapPanel from './projectmap/ProjectMapPanel.svelte';
  import ProjectsTable from './projects/ProjectsTable.svelte';
  import AddProjectModal from './projects/AddProjectModal.svelte';

  let activeTab = 'table'; // 'table' | 'map'
  let showAddProjectModal = false;
  let projectsTableComponent;

  function goHome() {
    goto('/');
  }

  function openAddProjectModal() {
    showAddProjectModal = true;
  }

  function closeAddProjectModal() {
    showAddProjectModal = false;
  }

  function handleProjectCreated(project) {
    console.log('Project created:', project);
    // Refresh the projects table
    if (projectsTableComponent?.refresh) {
      projectsTableComponent.refresh();
    }
  }
</script>

<div class="dashboard">
  <!-- Top navbar -->
  <nav class="navbar">
    <button
      class="home-button"
      on:click={goHome}
      title="Back to Home">
      <i class="las la-home"></i>
      <span>Home</span>
    </button>
    <div class="navbar-content">
      <h1 class="navbar-title">Project Information</h1>
    </div>
    <button
      class="create-project-btn"
      on:click={openAddProjectModal}
      title="Create New Project">
      <span class="plus-icon">+</span>
    </button>
  </nav>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-button"
      class:active={activeTab === 'table'}
      on:click={() => activeTab = 'table'}
    >
      <i class="las la-table"></i>
      Table
    </button>
    <button
      class="tab-button"
      class:active={activeTab === 'map'}
      on:click={() => activeTab = 'map'}
    >
      <i class="las la-map"></i>
      Map
    </button>
  </div>

  <!-- Tab Content -->
  <div class="content-area">
    {#if activeTab === 'table'}
      <div class="table-panel">
        <ProjectsTable bind:this={projectsTableComponent} />
      </div>
    {:else if activeTab === 'map'}
      <div class="map-panel">
        <ProjectMapPanel />
      </div>
    {/if}
  </div>
</div>

<!-- Add Project Modal -->
<AddProjectModal
  isOpen={showAddProjectModal}
  onClose={closeAddProjectModal}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    position: relative;
  }

  .navbar {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 1.5rem;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: relative;
  }

  .navbar-content {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 1400px;
    margin: 0 auto;
  }

  .home-button {
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #1e293b;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .home-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .home-button i {
    font-size: 1.125rem;
  }

  .create-project-btn {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    z-index: 10;
    width: 2.5rem;
    height: 2.5rem;
    background: #9333ea;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(147, 51, 234, 0.3);
    transition: all 0.2s;
  }

  .create-project-btn:hover {
    background: #7e22ce;
    transform: translateY(-50%) translateY(-2px);
    box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
  }

  .plus-icon {
    font-size: 1.5rem;
    color: white;
    line-height: 0;
    font-weight: 300;
    margin-top: -2px;
  }

  .navbar-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .tab-navigation {
    display: flex;
    gap: 1rem;
    padding: 1rem 1.5rem 0;
    background: white;
    border-bottom: 2px solid #e2e8f0;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    color: #64748b;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #1e293b;
  }

  .tab-button.active {
    color: #9333ea;
    border-bottom-color: #9333ea;
  }

  .tab-button i {
    font-size: 1.25rem;
  }

  .content-area {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #f8fafc;
  }

  .table-panel {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    box-sizing: border-box;
  }

  .map-panel {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
