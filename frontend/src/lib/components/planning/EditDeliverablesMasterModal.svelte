<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getTemplate, updateTemplate } from '$lib/services/planningDeliverablesApi.js';
  import RichTextEditor from './RichTextEditor.svelte';

  export let template;

  const dispatch = createEventDispatcher();

  let editor;
  let loading = true;
  let saving = false;
  let error = null;
  let currentHTML = '';
  let templateName = template.template_name;
  let templateDescription = template.description || '';
  let hasUnsavedChanges = false;
  let lastSaved = null;

  onMount(async () => {
    await loadContent();
  });

  /**
   * Convert template sections to HTML for editor
   */
  function templateContentToHTML(templateContent) {
    if (!templateContent?.sections) return '';

    let html = '';

    templateContent.sections.forEach(section => {
      switch (section.type) {
        case 'heading':
          const level = section.level || 2;
          html += `<h${level}>${section.content}</h${level}>`;
          break;

        case 'paragraph':
          html += `<p>${section.content}</p>`;
          break;

        case 'list':
          if (section.items && Array.isArray(section.items)) {
            html += '<ul>';
            section.items.forEach(item => {
              html += `<li>${item}</li>`;
            });
            html += '</ul>';
          }
          break;

        default:
          html += `<p>${section.content || ''}</p>`;
      }
    });

    return html;
  }

  /**
   * Convert HTML back to template sections
   */
  function htmlToTemplateContent(html) {
    const sections = [];

    const h1Regex = /<h1>(.*?)<\/h1>/gs;
    const h2Regex = /<h2>(.*?)<\/h2>/gs;
    const h3Regex = /<h3>(.*?)<\/h3>/gs;
    const pRegex = /<p>(.*?)<\/p>/gs;
    const ulRegex = /<ul>(.*?)<\/ul>/gs;

    let match;
    const elements = [];

    while ((match = h1Regex.exec(html)) !== null) {
      elements.push({ type: 'h1', content: match[1], index: match.index });
    }
    while ((match = h2Regex.exec(html)) !== null) {
      elements.push({ type: 'h2', content: match[1], index: match.index });
    }
    while ((match = h3Regex.exec(html)) !== null) {
      elements.push({ type: 'h3', content: match[1], index: match.index });
    }
    while ((match = pRegex.exec(html)) !== null) {
      elements.push({ type: 'p', content: match[1], index: match.index });
    }
    while ((match = ulRegex.exec(html)) !== null) {
      const liRegex = /<li>(.*?)<\/li>/g;
      const items = [];
      let liMatch;
      while ((liMatch = liRegex.exec(match[1])) !== null) {
        items.push(liMatch[1]);
      }
      elements.push({ type: 'ul', items, index: match.index });
    }

    elements.sort((a, b) => a.index - b.index);

    let sectionId = 0;
    elements.forEach(element => {
      if (element.type === 'h1') {
        sections.push({
          id: `section_${sectionId++}`,
          type: 'heading',
          level: 1,
          content: element.content
        });
      } else if (element.type === 'h2') {
        sections.push({
          id: `section_${sectionId++}`,
          type: 'heading',
          level: 2,
          content: element.content
        });
      } else if (element.type === 'h3') {
        sections.push({
          id: `section_${sectionId++}`,
          type: 'heading',
          level: 3,
          content: element.content
        });
      } else if (element.type === 'p') {
        sections.push({
          id: `section_${sectionId++}`,
          type: 'paragraph',
          content: element.content
        });
      } else if (element.type === 'ul') {
        sections.push({
          id: `section_${sectionId++}`,
          type: 'list',
          items: element.items
        });
      }
    });

    return { sections };
  }

  async function loadContent() {
    loading = true;
    error = null;

    try {
      const result = await getTemplate(template.id);

      // Convert template_content (JSONB with sections) to HTML for the editor
      const templateContent = typeof result.template_content === 'string'
        ? JSON.parse(result.template_content)
        : result.template_content;

      currentHTML = templateContentToHTML(templateContent);
      templateName = result.template_name;
      templateDescription = result.description || '';
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
      // Convert HTML back to structured template_content
      const templateContent = htmlToTemplateContent(currentHTML);

      await updateTemplate(template.id, {
        templateName,
        description: templateDescription,
        templateContent: JSON.stringify(templateContent)
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
        <i class="las la-file-invoice header-icon"></i>
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
            <span class="unsaved-badge">Unsaved changes</span>
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
            <strong>Master Template:</strong> {template.template_type || 'General'}
            <span class="info-hint">Changes here affect all new deliverables created from this template.</span>
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

        <!-- Placeholders Info -->
        <div class="placeholders-info">
          <label>Available Placeholders</label>
          <p class="placeholders-hint">
            Use <code>{'{{placeholder_name}}'}</code> format. Common placeholders:
            <code>project_name</code>, <code>client</code>, <code>address</code>,
            <code>local_planning_authority</code>, <code>current_date</code>
          </p>
        </div>

        <!-- Rich Text Editor -->
        <div class="editor-container">
          <label>Template Content</label>
          <RichTextEditor
            bind:this={editor}
            content={currentHTML}
            on:change={handleContentChange}
            placeholder="Enter template content here. Use placeholders like project_name, client, etc."
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
    background: rgba(0, 0, 0, 0.5);
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
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .header-icon {
    font-size: 1.5rem;
    color: #0d9488;
  }

  .name-input {
    width: 100%;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
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
    border-color: #0d9488;
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

  .unsaved-badge {
    background: #fef3c7;
    color: #92400e;
    padding: 0.25rem 0.625rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .saved-text {
    color: #64748b;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-btn {
    background: #0d9488;
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: #0f766e;
  }

  .save-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .close-btn {
    background: transparent;
    color: #64748b;
    padding: 0.5rem;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
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
    color: #64748b;
  }

  .loading-state i,
  .error-state i {
    font-size: 3rem;
  }

  .error-state {
    color: #ef4444;
  }

  .editor-info-banner {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #92400e;
  }

  .editor-info-banner i {
    font-size: 1.25rem;
    color: #f59e0b;
    margin-top: 0.125rem;
  }

  .info-hint {
    display: block;
    font-weight: normal;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
  }

  .form-field {
    margin-bottom: 1.5rem;
  }

  .form-field label {
    display: block;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .form-field input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
  }

  .form-field input:focus {
    outline: none;
    border-color: #0d9488;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .placeholders-info {
    margin-bottom: 1.5rem;
  }

  .placeholders-info label {
    display: block;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .placeholders-hint {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    line-height: 1.6;
  }

  .placeholders-hint code {
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.75rem;
    color: #0d9488;
  }

  .editor-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .editor-container label {
    font-weight: 600;
    color: #475569;
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
