<script>
  import { onMount } from 'svelte';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import PlanningDeliverablesPanel from '$lib/components/planning/PlanningDeliverablesPanel.svelte';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';

  let selectedProject = null;
  let showCreateProjectModal = false;
  let projectSelectorComponent = null;
  let selectedProjectIdBinding = '';

  function handleProjectSelected(event) {
    if (event.detail?.project) {
      selectedProject = event.detail.project;
      console.log('Project selected:', selectedProject);
    } else {
      selectedProject = null;
    }
  }

  function handleOneOffSelected() {
    // Not applicable for planning deliverables
    console.log('One-off mode not applicable for planning deliverables');
  }

  function handleCreateNewProjectClick() {
    console.log('🎯 Create new project button clicked');
    showCreateProjectModal = true;
  }

  async function handleProjectCreated(project) {
    console.log('✅ Project created:', project);
    showCreateProjectModal = false;

    // Refresh the projects list in ProjectSelector
    if (projectSelectorComponent) {
      await projectSelectorComponent.refreshProjects();
    }

    // Auto-select the newly created project
    setTimeout(() => {
      selectedProjectIdBinding = String(project.id);
      selectedProject = project;
      console.log('🎯 Auto-selected new project:', project.project_name);
    }, 100);
  }

  function handleCreateProjectModalClose() {
    showCreateProjectModal = false;
  }
</script>

<div class="planning-deliverables-page">
  <!-- Home button in top-left corner -->
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <i class="las la-file-alt"></i>
        Planning Deliverables
      </h1>
      <p class="page-description">
        Create professional planning documents from templates with automatic project data integration
      </p>
    </div>
  </div>

  <!-- Project Selector -->
  <div class="selector-container">
    <ProjectSelector
      bind:this={projectSelectorComponent}
      bind:selectedProjectId={selectedProjectIdBinding}
      label="Select Project to Create Deliverables"
      hideOneOffOption={true}
      on:projectSelected={handleProjectSelected}
      on:oneOffSelected={handleOneOffSelected}
      on:createNewProject={handleCreateNewProjectClick}
    />
  </div>

  <!-- Main Content -->
  {#if selectedProject}
    <PlanningDeliverablesPanel project={selectedProject} />
  {:else}
    <div class="no-project-selected">
      <div class="empty-state">
        <i class="las la-folder-open"></i>
        <h2>No Project Selected</h2>
        <p>Please select a project from the dropdown above to view and create planning deliverables.</p>
      </div>
    </div>
  {/if}
</div>

<!-- Create Project Modal -->
<AddProjectModal
  isOpen={showCreateProjectModal}
  onClose={handleCreateProjectModalClose}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .planning-deliverables-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 2rem;
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

  .page-header {
    margin-bottom: 2rem;
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .page-title i {
    font-size: 2.5rem;
    color: #0d9488;
  }

  .page-description {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0;
  }

  .selector-container {
    max-width: 1400px;
    margin: 0 auto 2rem;
  }

  .no-project-selected {
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 4rem 2rem;
  }

  .empty-state {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .empty-state i {
    font-size: 5rem;
    color: #cbd5e1;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #475569;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    font-size: 1rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .planning-deliverables-page {
      padding: 1rem;
    }

    .page-title {
      font-size: 2rem;
    }

    .page-title i {
      font-size: 2rem;
    }

    .page-description {
      font-size: 1rem;
    }

    .no-project-selected {
      padding: 3rem 1.5rem;
    }
  }
</style>

