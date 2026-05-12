<script>
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';
  import AppealWorkspace from '$lib/components/appeal/AppealWorkspace.svelte';

  let selectedProject = null;
  let selectedProjectIdBinding = '';
  let projectSelectorComponent = null;
  let showCreateProjectModal = false;

  function handleProjectSelected(event) {
    selectedProject = event.detail?.project ?? null;
  }

  async function handleProjectCreated(project) {
    showCreateProjectModal = false;
    if (projectSelectorComponent) await projectSelectorComponent.refreshProjects();
    setTimeout(() => {
      selectedProjectIdBinding = String(project.id);
      selectedProject = project;
    }, 100);
  }
</script>

<div class="appeal-page">
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <div class="page-header">
    <h1 class="page-title">
      <i class="las la-balance-scale"></i>
      Appeal Drafting
    </h1>
    <p class="page-description">Structure and develop your appeal argument, issue by issue.</p>
  </div>

  <div class="selector-container">
    <ProjectSelector
      bind:this={projectSelectorComponent}
      bind:selectedProjectId={selectedProjectIdBinding}
      label="Select Project"
      hideOneOffOption={true}
      on:projectSelected={handleProjectSelected}
      on:createNewProject={() => showCreateProjectModal = true}
    />
  </div>

  {#if selectedProject}
    {#key selectedProject.id}
      <div class="workspace-container">
        <AppealWorkspace project={selectedProject} />
      </div>
    {/key}
  {:else}
    <div class="empty-panel">
      <i class="las la-balance-scale"></i>
      <p>Select a project above to open the appeal drafting workspace.</p>
    </div>
  {/if}
</div>

<AddProjectModal
  isOpen={showCreateProjectModal}
  onClose={() => showCreateProjectModal = false}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .appeal-page {
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
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    z-index: 10;
  }

  .home-button:hover { background: #f1f5f9; border-color: #cbd5e1; }
  .home-button i { font-size: 1.125rem; }

  .page-header { margin-bottom: 2rem; padding-left: 8rem; }

  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .page-title i { font-size: 2.5rem; color: #7c3aed; }

  .page-description { font-size: 1.125rem; color: #64748b; margin: 0; }

  .selector-container { max-width: 1400px; margin: 0 auto 2rem; }

  .workspace-container {
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    min-height: 600px;
    display: flex;
    flex-direction: column;
  }

  .workspace-container :global(.workspace) {
    height: auto;
    min-height: 600px;
  }

  .empty-panel {
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #94a3b8;
    text-align: center;
  }

  .empty-panel i { font-size: 4rem; }
  .empty-panel p { margin: 0; font-size: 1rem; }
</style>
