<script>
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/api/client.js';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';
  import PlanningWorkspace from '$lib/components/planning-application/PlanningWorkspace.svelte';

  let projects = [];
  let loadingProjects = false;
  let selectedProjectId = '';
  let selectedProject = null;
  let showCreateProjectModal = false;

  onMount(fetchProjects);

  async function fetchProjects() {
    loadingProjects = true;
    try {
      const res = await authFetch('/api/projects');
      if (res.ok) projects = await res.json();
    } finally {
      loadingProjects = false;
    }
  }

  async function handleProjectChange() {
    if (!selectedProjectId) { selectedProject = null; return; }
    try {
      const res = await authFetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) selectedProject = await res.json();
    } catch { selectedProject = null; }
  }

  async function handleProjectCreated(project) {
    showCreateProjectModal = false;
    await fetchProjects();
    setTimeout(() => {
      selectedProjectId = String(project.id);
      selectedProject = project;
    }, 100);
  }
</script>

<div class="page">
  <header class="topbar">
    <a href="/" class="home-btn" title="Back to Home">
      <i class="las la-home"></i>
    </a>
    <span class="topbar-title">Planning Application Tool</span>
    <div class="project-picker">
      <label class="picker-label">Project</label>
      {#if loadingProjects}
        <span class="picker-loading">Loading…</span>
      {:else}
        <select class="picker-select" bind:value={selectedProjectId} on:change={handleProjectChange}>
          <option value="">— Select project —</option>
          {#each projects as p}
            <option value={p.id}>{p.project_name}{p.project_id ? ` (${p.project_id})` : ''}</option>
          {/each}
        </select>
      {/if}
      <button class="new-project-btn" on:click={() => showCreateProjectModal = true} title="Create new project">
        <i class="las la-plus"></i> New
      </button>
    </div>
  </header>

  <div class="main">
    {#if selectedProject}
      {#key selectedProject.id}
        <PlanningWorkspace project={selectedProject} />
      {/key}
    {:else}
      <div class="empty">
        <i class="las la-clipboard-list"></i>
        <p>Select a project above to open the workspace.</p>
      </div>
    {/if}
  </div>
</div>

<AddProjectModal
  isOpen={showCreateProjectModal}
  onClose={() => showCreateProjectModal = false}
  onProjectCreated={handleProjectCreated}
/>

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
    flex-shrink: 0;
  }

  .project-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 1rem;
    border-left: 1px solid #e2e8f0;
    margin-left: 1rem;
  }

  .picker-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    white-space: nowrap;
  }

  .picker-loading {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .picker-select {
    height: 32px;
    padding: 0 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    background: white;
    color: #1e293b;
    cursor: pointer;
    min-width: 240px;
    max-width: 380px;
    transition: border-color 0.15s;
  }
  .picker-select:focus {
    outline: none;
    border-color: #0369a1;
    box-shadow: 0 0 0 2px rgba(3,105,161,0.12);
  }

  .new-project-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    height: 32px;
    padding: 0 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .new-project-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

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

  .main :global(.draft-two-panel) {
    height: calc(100vh - 182px);
    min-height: 400px;
  }

  .main :global(.draft-right-panel) {
    height: calc(100vh - 182px);
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #94a3b8;
    text-align: center;
  }

  .empty i { font-size: 3.5rem; }
  .empty p { margin: 0; font-size: 0.95rem; }
</style>
