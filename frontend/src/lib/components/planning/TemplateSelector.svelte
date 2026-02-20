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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-header h2 i {
    font-size: 1.75rem;
    color: #0d9488;
  }

  .close-btn {
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .close-btn i {
    font-size: 1.5rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .project-info-banner {
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .project-info-banner i {
    font-size: 2rem;
    color: #0d9488;
  }

  .project-info-banner div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .project-info-banner strong {
    color: #0f766e;
    font-size: 1rem;
  }

  .project-info-banner span {
    color: #64748b;
    font-size: 0.875rem;
  }

  .form-section {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .template-select, .text-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 1rem;
    color: #1e293b;
    transition: all 0.2s;
  }

  .template-select:focus, .text-input:focus {
    outline: none;
    border-color: #0d9488;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .help-text {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0.5rem 0 0 0;
  }

  .template-preview {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .template-preview h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
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
    color: #475569;
    min-width: 90px;
  }

  .preview-item span {
    color: #64748b;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.75rem;
    color: #dc2626;
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
    border-top: 1px solid #e2e8f0;
  }

  .cancel-btn, .create-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
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
    border: 1px solid #cbd5e1;
    color: #64748b;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .create-btn {
    background: #0d9488;
    color: white;
  }

  .create-btn:hover:not(:disabled) {
    background: #0f766e;
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

