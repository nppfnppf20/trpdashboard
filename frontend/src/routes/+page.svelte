<script>
  import { onMount } from 'svelte';
  import ProjectsTable from '$lib/components/projects/ProjectsTable.svelte';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';
  import { projects, loadProjects } from '$lib/stores/projectSelection.js';

  let projectsTable;
  let showAddProjectModal = false;

  onMount(() => {
    loadProjects();
  });

  $: statCounts = {
    total: $projects.length,
    prospective: $projects.filter(p => p.status === 'Prospective').length,
    instructed: $projects.filter(p => p.status === 'Instructed').length,
    submitted: $projects.filter(p => p.status === 'Submitted').length
  };

  function openAddProjectModal() {
    showAddProjectModal = true;
  }

  function closeAddProjectModal() {
    showAddProjectModal = false;
  }

  function handleProjectCreated() {
    projectsTable?.refresh();
    loadProjects();
  }
</script>

<div class="home-page">
  <div class="home-header">
    <div>
      <h1 class="page-title">Projects</h1>
      <p class="page-sub">{statCounts.total} project{statCounts.total !== 1 ? 's' : ''} across the firm</p>
    </div>
    <button class="btn btn-primary" on:click={openAddProjectModal}>
      <i class="las la-plus"></i>
      New Project
    </button>
  </div>

  <div class="stat-row home-stat-row">
    <div class="stat-tile">
      <div class="stat-label">Total Projects</div>
      <div class="stat-value">{statCounts.total}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">Prospective</div>
      <div class="stat-value">{statCounts.prospective}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">Instructed</div>
      <div class="stat-value">{statCounts.instructed}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">Submitted</div>
      <div class="stat-value">{statCounts.submitted}</div>
    </div>
  </div>

  <ProjectsTable bind:this={projectsTable} />
</div>

<AddProjectModal
  isOpen={showAddProjectModal}
  onClose={closeAddProjectModal}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .home-page {
    padding: var(--space-6);
  }

  .home-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-5);
  }

  .page-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.25rem;
    letter-spacing: -0.02em;
  }

  .page-sub {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    margin: 0;
  }

  /* Home wants an exact 4-up grid rather than the shared .stat-row's
     auto-fit; .stat-tile/.stat-label/.stat-value come from cards.css. */
  .home-stat-row {
    grid-template-columns: repeat(4, 1fr);
    margin-bottom: var(--space-5);
  }

  .btn i {
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    .home-stat-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
