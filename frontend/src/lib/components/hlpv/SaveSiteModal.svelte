<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { authFetch } from '$lib/api/client.js';

  const dispatch = createEventDispatcher();

  /** @type {boolean} */
  export let show = false;

  /** @type {any | null} */
  export let selectedProject = null;

  /** @type {any} */
  export let currentPolygon = null;

  /** @type {string} */
  let saveOption = 'project'; // 'project', 'new', 'oneoff'

  /** @type {number | null} */
  let selectedProjectId = null;

  /** @type {string} */
  let siteName = '';

  /** @type {boolean} */
  let saving = false;

  /** @type {string} */
  let errorMessage = '';

  /** @type {any[]} */
  let allProjects = [];

  /** @type {boolean} */
  let loadingProjects = false;

  // Set default option and selected project when modal opens
  $: if (show && selectedProject) {
    saveOption = 'project';
    selectedProjectId = selectedProject.id;
  } else if (show && !selectedProject) {
    saveOption = 'oneoff';
    selectedProjectId = null;
    siteName = '';
  }

  // Fetch all projects when modal opens
  $: if (show && allProjects.length === 0) {
    fetchProjects();
  }

  async function fetchProjects() {
    loadingProjects = true;
    try {
      const response = await authFetch('/api/projects');
      if (response.ok) {
        allProjects = await response.json();
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      loadingProjects = false;
    }
  }

  function closeModal() {
    show = false;
    siteName = '';
    errorMessage = '';
    saveOption = 'project';
    selectedProjectId = null;
    dispatch('close');
  }

  function saveSite() {
    if (saveOption === 'project') {
      if (!selectedProjectId) {
        errorMessage = 'Please select a project';
        return;
      }
    } else if (saveOption === 'oneoff') {
      if (!siteName.trim()) {
        errorMessage = 'Please enter a site name';
        return;
      }
    }

    saving = true;
    errorMessage = '';

    if (saveOption === 'new') {
      // Dispatch event to open CreateProjectWithAnalysisModal
      dispatch('createNewProject', { polygon: currentPolygon });
      closeModal();
    } else {
      // Get site name based on save option
      let finalSiteName = siteName.trim();
      if (saveOption === 'project') {
        const project = allProjects.find(p => p.id === selectedProjectId);
        if (project) {
          finalSiteName = project.project_name;
        }
      }

      // Dispatch save event with appropriate data
      dispatch('save', {
        siteName: finalSiteName,
        projectId: saveOption === 'project' ? selectedProjectId : null
      });
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeModal} on:keydown={handleKeydown}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Save Analysis and Edit Full Report</h3>
        <button class="close-button" on:click={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-description">
          Choose how you want to save this analysis:
        </p>

        <!-- Option Selection -->
        <div class="options-container">
          <!-- Option A: Save to Project -->
          <label class="option-card {saveOption === 'project' ? 'selected' : ''}">
            <input
              type="radio"
              name="saveOption"
              value="project"
              bind:group={saveOption}
              disabled={saving}
            />
            <div class="option-content">
              <div class="option-header">
                <span class="option-title">Save to Project</span>
                <span class="option-badge">Recommended</span>
              </div>
              <p class="option-description">Link this analysis to an existing project</p>
            </div>
          </label>

          <!-- Option B: Create New Project -->
          <label class="option-card {saveOption === 'new' ? 'selected' : ''}">
            <input
              type="radio"
              name="saveOption"
              value="new"
              bind:group={saveOption}
              disabled={saving}
            />
            <div class="option-content">
              <div class="option-header">
                <span class="option-title">Create New Project</span>
              </div>
              <p class="option-description">Create a new project with this analysis</p>
            </div>
          </label>

          <!-- Option C: One-Off Report -->
          <label class="option-card {saveOption === 'oneoff' ? 'selected' : ''}">
            <input
              type="radio"
              name="saveOption"
              value="oneoff"
              bind:group={saveOption}
              disabled={saving}
            />
            <div class="option-content">
              <div class="option-header">
                <span class="option-title">One-Off Report</span>
              </div>
              <p class="option-description">Standalone report not linked to a project</p>
            </div>
          </label>
        </div>

        <!-- Conditional Fields Based on Selection -->
        {#if saveOption === 'project'}
          <div class="form-group">
            <label for="projectSelect">Select Project</label>
            {#if loadingProjects}
              <div class="loading-text">Loading projects...</div>
            {:else}
              <select
                id="projectSelect"
                bind:value={selectedProjectId}
                disabled={saving}
                class="project-select"
              >
                <option value={null}>-- Select a project --</option>
                {#each allProjects as project}
                  <option value={project.id}>
                    {project.project_name} {project.project_id ? `(${project.project_id})` : ''}
                  </option>
                {/each}
              </select>
            {/if}
          </div>
        {:else if saveOption === 'new'}
          <div class="info-box">
            <i class="las la-info-circle"></i>
            <p>This will open a form to create a new project. The analysis will be automatically saved to the new project.</p>
          </div>
        {:else if saveOption === 'oneoff'}
          <div class="form-group">
            <label for="siteName">Site Name</label>
            <input
              id="siteName"
              class="site-name-input"
              type="text"
              bind:value={siteName}
              placeholder="Enter site name..."
              disabled={saving}
              on:keydown={handleKeydown}
            />
          </div>
        {/if}

        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal} disabled={saving}>
          Cancel
        </button>
        <button class="btn-primary" on:click={saveSite} disabled={saving}>
          {#if saving}
            Saving...
          {:else if saveOption === 'new'}
            Continue to Create Project
          {:else}
            Save Analysis
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalSlideIn 0.2s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .modal-description {
    color: #6b7280;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .site-name-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .site-name-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .site-name-input:disabled {
    background: #f9fafb;
    color: #6b7280;
  }

  .error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
    font-size: 0.875rem;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border-color: #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    border-color: #2563eb;
  }

  .btn-primary:disabled {
    background: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }

  /* Option Cards */
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .option-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
  }

  .option-card:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .option-card.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .option-card input[type="radio"] {
    margin-top: 0.125rem;
    cursor: pointer;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .option-content {
    flex: 1;
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .option-title {
    font-weight: 600;
    color: #1f2937;
    font-size: 0.9375rem;
  }

  .option-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #3b82f6;
    background: #dbeafe;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .option-description {
    margin: 0;
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* Project Select */
  .project-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-sizing: border-box;
    background: white;
  }

  .project-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .project-select:disabled {
    background: #f9fafb;
    color: #6b7280;
  }

  /* Info Box */
  .info-box {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    margin-top: 1rem;
  }

  .info-box i {
    font-size: 1.25rem;
    color: #3b82f6;
    flex-shrink: 0;
  }

  .info-box p {
    margin: 0;
    color: #1e40af;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  /* Field Hint */
  .field-hint {
    margin: 0.375rem 0 0 0;
    font-size: 0.75rem;
    color: #6b7280;
    font-style: italic;
  }

  /* Loading Text */
  .loading-text {
    padding: 0.75rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    background: #f9fafb;
    border-radius: 6px;
  }
</style>