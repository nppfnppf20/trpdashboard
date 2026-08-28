<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getTemplateById, updateTemplate } from '$lib/api/quoteRequests.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';

  export let template;

  const dispatch = createEventDispatcher();

  let editor;
  let loading = true;
  let saving = false;
  let error = null;
  let currentHTML = '';
  let templateName = template.template_name;
  let templateDescription = template.description || '';
  let subjectLine = template.subject_line || '';
  let hasUnsavedChanges = false;
  let lastSaved = null;

  onMount(async () => {
    await loadContent();
  });

  async function loadContent() {
    loading = true;
    error = null;

    try {
      const result = await getTemplateById(template.id);

      currentHTML = result.template_content;
      templateName = result.template_name;
      templateDescription = result.description || '';
      subjectLine = result.subject_line || '';
    } catch (err) {
      console.error('Error loading content:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleContentChange(event) {
    currentHTML = event.detail.html;
    hasUnsavedChanges = true;
  }

  async function handleSave() {
    saving = true;
    error = null;

    try {
      await updateTemplate(template.id, {
        templateName,
        description: templateDescription,
        subjectLine,
        templateContent: currentHTML
      });

      hasUnsavedChanges = false;
      lastSaved = new Date();
      alert('Template saved successfully!');
    } catch (err) {
      console.error('Error saving template:', err);
      error = err.message;
      alert('Failed to save: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    dispatch('close');
  }

  function formatLastSaved() {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);

    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
    return `Saved ${Math.floor(diff / 3600)} hours ago`;
  }
</script>

<div class="editor-modal-overlay" on:click|self={handleClose}>
  <div class="editor-modal-content">
    <!-- Header -->
    <div class="editor-header">
      <div class="header-left">
        <i class="las la-envelope header-icon"></i>
        <input
          type="text"
          class="name-input"
          bind:value={templateName}
          on:input={() => hasUnsavedChanges = true}
          placeholder="Template Name"
        />
      </div>
      <div class="header-right">
        <div class="save-status">
          {#if hasUnsavedChanges}
            <span class="badge badge-warning">Unsaved changes</span>
          {:else if lastSaved}
            <span class="saved-text">{formatLastSaved()}</span>
          {/if}
        </div>
        <button class="btn save-btn" on:click={handleSave} disabled={saving || !hasUnsavedChanges}>
          {#if saving}
            <i class="las la-circle-notch la-spin"></i>
          {:else}
            <i class="las la-save"></i>
          {/if}
          Save
        </button>
        <button class="btn close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="editor-body">
      {#if loading}
        <div class="loading-state">
          <i class="las la-circle-notch la-spin"></i>
          <p>Loading template...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <i class="las la-exclamation-triangle"></i>
          <p>{error}</p>
        </div>
      {:else}
        <!-- Info Banner -->
        <div class="editor-info-banner">
          <i class="las la-info-circle"></i>
          <div>
            <strong>Template:</strong> {template.discipline || 'General'}
          </div>
        </div>

        <!-- Description Field -->
        <div class="form-field">
          <label for="description">Description</label>
          <input
            type="text"
            id="description"
            bind:value={templateDescription}
            on:input={() => hasUnsavedChanges = true}
            placeholder="Brief description of this template"
          />
        </div>

        <!-- Subject Line Field -->
        <div class="form-field">
          <label for="subject">Subject Line</label>
          <input
            type="text"
            id="subject"
            bind:value={subjectLine}
            on:input={() => hasUnsavedChanges = true}
            placeholder="Email subject line (supports placeholders)"
          />
        </div>

        <!-- Rich Text Editor -->
        <div class="editor-container">
          <label>Email Template Content</label>
          <RichTextEditor
            bind:this={editor}
            content={currentHTML}
            on:change={handleContentChange}
            placeholder="Enter template content here. Use placeholders like [PROJECT_NAME], [DISCIPLINE], etc."
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .editor-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .editor-modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px var(--overlay-bg);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .header-icon {
    font-size: 1.5rem;
    color: var(--color-teal-600);
  }

  .name-input {
    width: 100%;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
    border: 1px solid transparent;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: transparent;
    transition: all 0.2s;
  }

  .name-input:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  .name-input:focus {
    outline: none;
    background: white;
    border-color: var(--color-teal-600);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .save-status {
    font-size: 0.875rem;
  }

  .saved-text {
    color: var(--color-slate-500);
  }

  .save-btn {
    background: var(--color-teal-600);
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--color-emerald-600);
  }

  .save-btn:disabled {
    background: var(--color-slate-400);
    cursor: not-allowed;
  }

  .close-btn {
    background: transparent;
    color: var(--color-slate-500);
    padding: 0.5rem;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
  }

  .editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: var(--color-slate-500);
  }

  .loading-state i,
  .error-state i {
    font-size: 3rem;
  }

  .error-state {
    color: var(--color-red-500);
  }

  .editor-info-banner {
    background: var(--color-slate-100);
    border: 1px solid var(--color-sky-200);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-emerald-800);
  }

  .editor-info-banner i {
    font-size: 1.25rem;
    color: var(--color-teal-600);
  }

  .form-field {
    margin-bottom: 1.5rem;
  }

  .form-field label {
    display: block;
    font-weight: 600;
    color: var(--color-slate-600);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .form-field input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-800);
    background: white;
  }

  .form-field input:focus {
    outline: none;
    border-color: var(--color-teal-600);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .editor-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .editor-container label {
    font-weight: 600;
    color: var(--color-slate-600);
    font-size: 0.875rem;
  }

  .la-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
