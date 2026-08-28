<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { authFetch } from '$lib/api/client.js';

  const dispatch = createEventDispatcher();

  export let label = 'Select Project';
  export let showDivider = true;
  export let disabled = false;
  export let disabledMessage = '';
  export let selectedProjectId = ''; // Bindable from parent
  export let selectionMode = 'project'; // Bindable from parent - 'project' or 'oneoff'
  export let hideOneOffOption = false; // New prop to hide one-off option
  export let hideModeRow = false; // Hide the entire mode-selection row

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
      dispatch('projectSelected', null);
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
    dispatch('projectSelected', null);
  }

  function handleModeChange() {
    if (selectionMode === 'oneoff') {
      // Clear any project selection
      selectedProjectId = '';
      dispatch('oneOffSelected');
    } else {
      // If switching back to project mode and a project is selected, notify
      if (selectedProjectId) {
        handleProjectChange();
      } else {
        dispatch('projectSelected', null);
      }
    }
  }

  function handleCreateNewProject() {
    dispatch('createNewProject');
  }
</script>

<div class="card project-selector" class:disabled>
  <div class="selector-header">
    <h3>{label}</h3>
    {#if selectedProjectId && !disabled}
      <button class="clear-btn" on:click={clearSelection} title="Clear selection">
        <i class="las la-times"></i>
      </button>
    {/if}
  </div>

  <!-- Selection Mode Options (all in one row) -->
  {#if !disabled && !hideModeRow}
    <div class="mode-selection">
      <label class="mode-option {selectionMode === 'project' ? 'selected' : ''}">
        <input
          type="radio"
          name="selectionMode"
          value="project"
          bind:group={selectionMode}
          on:change={handleModeChange}
        />
        <span>Existing Project</span>
      </label>
      {#if !hideOneOffOption}
        <label class="mode-option {selectionMode === 'oneoff' ? 'selected' : ''}">
          <input
            type="radio"
            name="selectionMode"
            value="oneoff"
            bind:group={selectionMode}
            on:change={handleModeChange}
          />
          <span>One-Off Report</span>
        </label>
      {/if}
      <label class="mode-option" on:click={handleCreateNewProject}>
        <input type="radio" disabled class="radio-visual" />
        <span>Create new project</span>
      </label>
    </div>
  {/if}

  {#if disabled}
    <div class="disabled-state">
      <i class="las la-info-circle"></i>
      <span>{disabledMessage}</span>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading projects...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <span>Error loading projects: {error}</span>
      <button class="retry-btn" on:click={fetchProjects}>Retry</button>
    </div>
  {:else if selectionMode === 'oneoff'}
    <div class="oneoff-state">
      <i class="las la-file-alt"></i>
      <p>Analysis will be saved as a one-off report (not linked to a project).</p>
    </div>
  {:else if projects.length === 0}
    <div class="empty-state">
      <i class="las la-folder-open"></i>
      <p>No projects found. Create a project first.</p>
    </div>
  {:else}
    <div class="selector-wrapper">
      <select bind:value={selectedProjectId} on:change={handleProjectChange} class="project-select">
        <option value="">-- Select a project --</option>
        {#each projects as project}
          <option value={project.id}>
            {project.project_name} {project.project_id ? `(${project.project_id})` : ''}
          </option>
        {/each}
      </select>
    </div>
  {/if}

  {#if showDivider}
    <div class="divider">
      <span>OR</span>
    </div>
  {/if}
</div>

<style>
  .project-selector {
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    transition: opacity 0.2s, background-color 0.2s;
  }

  .project-selector.disabled {
    opacity: 0.6;
    background: var(--color-slate-50);
    pointer-events: none;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .selector-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  /* Mode Selection */
  .mode-selection {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .mode-option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.625rem 0.5rem;
    border: 2px solid var(--color-slate-200);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--color-white);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-800);
  }

  .mode-option:hover {
    border-color: var(--color-slate-300);
    background: var(--color-slate-50);
  }

  .mode-option.selected {
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
  }

  .mode-option input[type="radio"] {
    cursor: pointer;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .mode-option input[type="radio"].radio-visual {
    cursor: pointer;
    opacity: 0.6;
  }

  .mode-option span {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-800);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.25rem;
    transition: color 0.2s;
  }

  .clear-btn:hover {
    color: var(--color-red-500);
  }

  .loading-state,
  .error-state,
  .empty-state,
  .disabled-state,
  .oneoff-state {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 6px;
    background: var(--color-slate-50);
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .oneoff-state {
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-100);
  }

  .oneoff-state i {
    font-size: 1.25rem;
    color: var(--color-primary-500);
  }

  .oneoff-state p {
    margin: 0;
    color: var(--color-primary-600);
  }

  .disabled-state {
    background: var(--color-slate-100);
    border: 1px dashed var(--color-slate-300);
  }

  .disabled-state i {
    font-size: 1.25rem;
    color: var(--color-slate-400);
  }

  .loading-state {
    justify-content: center;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--color-slate-100);
    border-top: 2px solid var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-state i,
  .empty-state i {
    font-size: 1.5rem;
    color: var(--color-red-500);
  }

  .empty-state {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1rem;
  }

  .empty-state i {
    font-size: 2.5rem;
    color: var(--color-slate-300);
  }

  .empty-state p {
    margin: 0;
    color: var(--color-slate-500);
  }

  .retry-btn {
    margin-left: auto;
    padding: 0.375rem 0.75rem;
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: var(--color-primary-600);
  }

  .selector-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .project-select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--color-white);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .project-select:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .divider {
    margin-top: 1.5rem;
    text-align: center;
    position: relative;
  }

  .divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--color-slate-200);
  }

  .divider span {
    position: relative;
    display: inline-block;
    padding: 0 1rem;
    background: var(--color-white);
    color: var(--color-slate-500);
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
