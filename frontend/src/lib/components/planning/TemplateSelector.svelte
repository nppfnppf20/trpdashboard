<script>
  import { createEventDispatcher } from 'svelte';
  import { createDeliverable } from '$lib/services/planningDeliverablesApi.js';

  export let project;
  export let templates;

  const dispatch = createEventDispatcher();

  let selectedTemplateId = null;
  let customName = '';
  let creating = false;
  let error = null;

  $: selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  function handleClose() {
    dispatch('close');
  }

  async function handleCreate() {
    if (!selectedTemplateId) {
      error = 'Please select a template';
      return;
    }

    creating = true;
    error = null;

    try {
      const result = await createDeliverable(
        project.id,
        selectedTemplateId,
        customName || null
      );

      dispatch('templateSelected', { deliverable: result.deliverable });
    } catch (err) {
      console.error('Error creating deliverable:', err);
      error = err.message;
    } finally {
      creating = false;
    }
  }
</script>

<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>
        <i class="las la-file-invoice"></i>
        Select Template
      </h2>
      <button class="close-btn" on:click={handleClose} title="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <div class="project-info-banner">
        <i class="las la-project-diagram"></i>
        <div>
          <strong>{project.project_name}</strong>
          <span>Project ID: {project.project_id}</span>
        </div>
      </div>

      <div class="form-section">
        <label for="template-select" class="form-label">
          Choose a template *
        </label>
        <select 
          id="template-select"
          bind:value={selectedTemplateId}
          class="template-select"
        >
          <option value={null}>-- Select a template --</option>
          {#each templates as template}
            <option value={template.id}>
              {template.template_name}
            </option>
          {/each}
        </select>
      </div>

      {#if selectedTemplate}
        <div class="template-preview">
          <h3>Template Information</h3>
          <div class="preview-content">
            <div class="preview-item">
              <strong>Type:</strong>
              <span>{selectedTemplate.template_type}</span>
            </div>
            <div class="preview-item">
              <strong>Description:</strong>
              <span>{selectedTemplate.description || 'No description available'}</span>
            </div>
            <div class="preview-item">
              <strong>Version:</strong>
              <span>{selectedTemplate.version}</span>
            </div>
          </div>
        </div>
      {/if}

      <div class="form-section">
        <label for="custom-name" class="form-label">
          Custom name (optional)
        </label>
        <input
          id="custom-name"
          type="text"
          bind:value={customName}
          placeholder="Leave blank for auto-generated name"
          class="text-input"
        />
        <p class="help-text">
          Default: {selectedTemplate ? `${selectedTemplate.template_name} - ${project.project_name}` : 'Select a template to see default name'}
        </p>
      </div>

      {#if error}
        <div class="error-message">
          <i class="las la-exclamation-circle"></i>
          {error}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="cancel-btn" on:click={handleClose} disabled={creating}>
        Cancel
      </button>
      <button 
        class="create-btn" 
        on:click={handleCreate}
        disabled={!selectedTemplateId || creating}
      >
        {#if creating}
          <i class="las la-spinner la-spin"></i>
          Creating...
        {:else}
          <i class="las la-plus"></i>
          Create Deliverable
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-slate-800);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-header h2 i {
    font-size: 1.75rem;
    color: var(--color-teal-600);
  }

  .close-btn {
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: var(--color-slate-500);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
  }

  .close-btn i {
    font-size: 1.5rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .project-info-banner {
    background: var(--color-slate-100);
    border: 1px solid var(--color-sky-200);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .project-info-banner i {
    font-size: 2rem;
    color: var(--color-teal-600);
  }

  .project-info-banner div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .project-info-banner strong {
    color: var(--color-emerald-600);
    font-size: 1rem;
  }

  .project-info-banner span {
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .form-section {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    margin-bottom: 0.5rem;
  }

  .template-select, .text-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: var(--radius-md);
    font-size: 1rem;
    color: var(--color-slate-800);
    transition: all 0.2s;
  }

  .template-select:focus, .text-input:focus {
    outline: none;
    border-color: var(--color-teal-600);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .help-text {
    font-size: 0.75rem;
    color: var(--color-slate-500);
    margin: 0.5rem 0 0 0;
  }

  .template-preview {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .template-preview h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    margin: 0 0 0.75rem 0;
  }

  .preview-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .preview-item strong {
    color: var(--color-slate-600);
    min-width: 90px;
  }

  .preview-item span {
    color: var(--color-slate-500);
  }

  .error-message {
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    color: var(--color-red-600);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message i {
    font-size: 1.25rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .cancel-btn, .create-btn {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cancel-btn {
    background: white;
    border: 1px solid var(--color-slate-300);
    color: var(--color-slate-500);
  }

  .cancel-btn:hover:not(:disabled) {
    background: var(--color-slate-50);
    border-color: var(--color-slate-400);
  }

  .create-btn {
    background: var(--color-teal-600);
    color: white;
  }

  .create-btn:hover:not(:disabled) {
    background: var(--color-emerald-600);
    transform: translateY(-1px);
  }

  .create-btn:disabled, .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn i {
    font-size: 1.125rem;
  }

  @media (max-width: 640px) {
    .modal-content {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }
  }
</style>

