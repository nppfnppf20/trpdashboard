<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { authFetch } from '$lib/api/client.js';

  const dispatch = createEventDispatcher();

  export let selectedProjectId = ''; // Bindable from parent

  let projects = [];
  let loading = false;
  let error = null;

  onMount(async () => {
    await fetchProjects();
  });

  async function fetchProjects() {
    loading = true;
    error = null;
    try {
      const response = await authFetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      projects = await response.json();
    } catch (err) {
      console.error('Error fetching projects:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Expose refresh function for parent component
  export async function refreshProjects() {
    await fetchProjects();
  }

  async function handleProjectChange() {
    if (!selectedProjectId) {
      dispatch('projectSelected', { project: null });
      return;
    }

    try {
      const response = await authFetch(`/api/projects/${selectedProjectId}`);
      if (!response.ok) throw new Error('Failed to load project');
      const project = await response.json();

      // Dispatch event with project data
      dispatch('projectSelected', { project });
    } catch (err) {
      console.error('Error loading project:', err);
      error = err.message;
    }
  }

  function clearSelection() {
    selectedProjectId = '';
    dispatch('projectSelected', { project: null });
  }
</script>

<div class="surveyor-project-selector">
  {#if loading}
    <div class="inline-loading">
      <div class="spinner"></div>
      <span>Loading projects...</span>
    </div>
  {:else if error}
    <div class="inline-error">
      <i class="las la-exclamation-circle"></i>
      <span>Error: {error}</span>
      <button class="retry-btn" on:click={fetchProjects}>
        <i class="las la-redo"></i>
      </button>
    </div>
  {:else if projects.length === 0}
    <div class="inline-empty">
      <i class="las la-folder-open"></i>
      <span>No projects found</span>
    </div>
  {:else}
    <div class="select-wrapper">
      <select 
        bind:value={selectedProjectId} 
        on:change={handleProjectChange} 
        class="project-select"
      >
        <option value="">Select a project...</option>
        {#each projects as project}
          <option value={project.id}>
            {project.project_name} {project.project_id ? `(${project.project_id})` : ''}
          </option>
        {/each}
      </select>
      {#if selectedProjectId}
        <button class="clear-btn" on:click={clearSelection} title="Clear selection">
          <i class="las la-times"></i>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .surveyor-project-selector {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .select-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    position: relative;
  }

  .project-select {
    flex: 1;
    padding: 0.625rem 1rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-slate-800);
  }

  .project-select:hover {
    border-color: var(--color-slate-400);
  }

  .project-select:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .clear-btn {
    padding: 0.5rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    color: var(--color-slate-500);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }

  .clear-btn:hover {
    background: var(--color-red-100);
    border-color: var(--color-red-200);
    color: var(--color-red-500);
  }

  .inline-loading,
  .inline-error,
  .inline-empty {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    width: 100%;
  }

  .inline-loading {
    background: var(--color-slate-50);
    color: var(--color-slate-500);
  }

  .inline-error {
    background: var(--color-red-50);
    color: var(--color-red-500);
    border: 1px solid var(--color-red-200);
  }

  .inline-empty {
    background: var(--color-slate-50);
    color: var(--color-slate-400);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-slate-200);
    border-top: 2px solid var(--color-primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .retry-btn {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: white;
    border: 1px solid var(--color-slate-300);
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-slate-500);
    display: flex;
    align-items: center;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: var(--color-primary-500);
    border-color: var(--color-primary-500);
    color: white;
  }

  .inline-error i,
  .inline-empty i {
    font-size: 1.125rem;
  }
</style>

