<script>
  import { onMount } from 'svelte';
  import ProjectsTable from '$lib/components/projects/ProjectsTable.svelte';
  import { loadProjects } from '$lib/stores/projectSelection.js';

  let projectsTable;

  onMount(() => {
    loadProjects();
  });
</script>

<div class="home-page">
  <ProjectsTable bind:this={projectsTable} />
</div>

<style>
  .home-page {
    padding: var(--space-6);
  }
</style>
