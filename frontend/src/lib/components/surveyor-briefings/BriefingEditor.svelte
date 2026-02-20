<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import SelectSurveyorModal from './SelectSurveyorModal.svelte';
  import { getTemplates, mergeTemplate, saveSentRequest } from '$lib/api/quoteRequests.js';

  export let show = false;
  export let projectId;
  export let preSelectedTemplate = null;

  const dispatch = createEventDispatcher();

  const disciplines = [
    'Heritage',
    'Landscape and Visual',
    'Ecology',
    'Flood and Drainage',
    'Transport',
    'Arboriculture',
    'Noise',
    'Glint & Glare',
    'Any'
  ];

  let templates = [];
  let selectedDiscipline = null;
  let selectedTemplateId = null;
  let selectedSurveyors = []; // Array of { surveyorId, surveyorOrganisation, discipline, contactId, contactName, contactEmail }
  let showSurveyorModal = false;
  let richTextEditor;
  let loading = false;
  let saving = false;
  let merging = false;
  let error = null;
  let currentSubject = '';

  // For backwards compatibility with merge API - extract surveyor IDs
  $: selectedSurveyorIds = selectedSurveyors.map(s => s.surveyorId);

  // Filtered templates based on selected discipline
  $: filteredTemplates = selectedDiscipline && selectedDiscipline !== 'Any'
    ? templates.filter(t => t.discipline === selectedDiscipline || t.discipline === null)
    : templates;

  // Auto-select template when discipline changes
  $: if (selectedDiscipline && !preSelectedTemplate) {
    const matchingTemplate = templates.find(t => t.discipline === selectedDiscipline);
    if (matchingTemplate) {
      selectedTemplateId = matchingTemplate.id;
    } else {
      // Fall back to general template
      const generalTemplate = templates.find(t => t.discipline === null);
      selectedTemplateId = generalTemplate?.id || null;
    }
  }

  $: if (preSelectedTemplate) {
    selectedTemplateId = preSelectedTemplate.id;
    selectedDiscipline = preSelectedTemplate.discipline || 'Any';
  }

  $: if (selectedTemplateId && selectedSurveyorIds.length > 0 && projectId) {
    mergeTemplateContent();
  }

  onMount(async () => {
    await loadTemplates();
    if (preSelectedTemplate) {
      selectedTemplateId = preSelectedTemplate.id;
      if (selectedSurveyorIds.length > 0) {
        await mergeTemplateContent();
      }
    }
  });

  async function loadTemplates() {
    try {
      templates = await getTemplates();
    } catch (err) {
      console.error('Error loading templates:', err);
      error = err.message;
    }
  }

  async function mergeTemplateContent() {
    if (!selectedTemplateId || !projectId) return;

    merging = true;
    error = null;
    try {
      const merged = await mergeTemplate(selectedTemplateId, projectId, selectedSurveyorIds);
      currentSubject = merged.subjectLine;

      // Set the merged content in the editor
      if (richTextEditor) {
        richTextEditor.setHTML(merged.content);
      }
    } catch (err) {
      console.error('Error merging template:', err);
      error = err.message;
    } finally {
      merging = false;
    }
  }

  function handleSurveyorSelect(event) {
    const newSurveyor = event.detail;
    // Replace any existing selection with the new one (only allow one surveyor)
    selectedSurveyors = [newSurveyor];
    // Close the modal after selection
    showSurveyorModal = false;
  }

  function removeSurveyor() {
    selectedSurveyors = [];
  }

  // Helper to check if a surveyor is selected
  $: hasSurveyorSelected = selectedSurveyors.length > 0;

  async function handleCopyToClipboard() {
    if (!richTextEditor) return;

    try {
      const htmlContent = richTextEditor.getHTML();
      const plainText = stripHtml(htmlContent);

      // Try modern Clipboard API with HTML support
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([clipboardItem]);
        alert('Email content copied to clipboard!');
      } else {
        // Fallback for browsers that don't support ClipboardItem
        fallbackCopyRichText(htmlContent);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      fallbackCopyRichText(richTextEditor.getHTML());
    }
  }

  function stripHtml(html) {
    // Create a temporary div to parse HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Get text content and clean up whitespace
    let text = tmp.textContent || tmp.innerText || '';

    // Replace multiple newlines with double newline
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

    return text.trim();
  }

  function fallbackCopyRichText(html) {
    // Create a temporary contenteditable div with the HTML content
    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    // Select the content
    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Copy
    try {
      document.execCommand('copy');
      alert('Email content copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard');
    }

    // Cleanup
    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  async function handleSaveAsSent() {
    if (!richTextEditor || !projectId) return;

    if (selectedSurveyors.length === 0) {
      alert('Please select at least one surveyor');
      return;
    }

    saving = true;
    error = null;
    try {
      const emailContent = richTextEditor.getHTML();

      // Build recipients array with contact info
      const recipients = selectedSurveyors.map(s => ({
        surveyorId: s.surveyorId,
        contactId: s.contactId
      }));

      const data = {
        templateId: selectedTemplateId || null,
        emailContent,
        recipients,
        notes: null
      };

      await saveSentRequest(projectId, data);
      dispatch('saved');
    } catch (err) {
      console.error('Error saving sent request:', err);
      error = err.message;
      alert('Failed to save: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    if (confirm('Close without saving?')) {
      dispatch('close');
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Quote Request</h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if error}
          <div class="error-banner">
            <i class="las la-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        {/if}

        <!-- Discipline Selection -->
        <div class="form-group">
          <label for="discipline-select">Discipline:</label>
          <select
            id="discipline-select"
            bind:value={selectedDiscipline}
            disabled={loading}
          >
            <option value={null}>Select a discipline...</option>
            {#each disciplines as discipline}
              <option value={discipline}>{discipline}</option>
            {/each}
          </select>
        </div>

        {#if selectedDiscipline}
          <!-- Template Selection (auto-selected but can be changed) -->
          <div class="form-group">
            <label for="template-select">Template:</label>
            <select
              id="template-select"
              bind:value={selectedTemplateId}
              disabled={loading}
            >
              <option value={null}>Select a template...</option>
              {#each filteredTemplates as template}
                <option value={template.id}>
                  {template.template_name}
                </option>
              {/each}
            </select>
          </div>

          <!-- Subject Line Preview -->
          {#if currentSubject}
            <div class="subject-preview">
              <strong>Subject:</strong> {currentSubject}
            </div>
          {/if}

          <!-- Surveyor Selection -->
          <div class="form-group">
            <label>Selected Surveyor:</label>
            <div class="surveyors-selection">
              {#if hasSurveyorSelected}
                {@const surveyor = selectedSurveyors[0]}
                <div class="surveyor-chip">
                  <div class="chip-content">
                    <span class="chip-name">{surveyor.contactName}</span>
                    <span class="chip-org">{surveyor.surveyorOrganisation}</span>
                    {#if surveyor.contactEmail}
                      <span class="chip-email">{surveyor.contactEmail}</span>
                    {/if}
                  </div>
                  <button
                    class="chip-remove"
                    on:click={removeSurveyor}
                    title="Remove"
                  >
                    <i class="las la-times"></i>
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-change-surveyor"
                  on:click={() => showSurveyorModal = true}
                >
                  <i class="las la-exchange-alt"></i>
                  Change Surveyor
                </button>
              {:else}
                <p class="no-surveyors-selected">No surveyor selected yet</p>
                <button
                  type="button"
                  class="btn btn-add-surveyor"
                  on:click={() => showSurveyorModal = true}
                >
                  <i class="las la-plus"></i>
                  Select Surveyor
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Rich Text Editor -->
        <div class="form-group">
          <label>Email Content:</label>
          {#if merging}
            <div class="merging-indicator">
              <div class="spinner"></div>
              <p>Merging template...</p>
            </div>
          {/if}
          <RichTextEditor
            bind:this={richTextEditor}
            placeholder="Select a template and surveyors to generate content, or write your own message..."
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleCopyToClipboard}
          disabled={saving || !richTextEditor || !hasSurveyorSelected}
        >
          <i class="las la-copy"></i>
          Copy to Clipboard
        </button>
        <button
          class="btn btn-primary"
          on:click={handleSaveAsSent}
          disabled={saving || !richTextEditor || !hasSurveyorSelected}
        >
          {#if saving}
            <div class="btn-spinner"></div>
            Saving...
          {:else}
            <i class="las la-save"></i>
            Save as Sent
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Surveyor Selection Modal -->
<SelectSurveyorModal
  show={showSurveyorModal}
  selectedSurveyors={selectedSurveyors.map(s => ({ surveyorId: s.surveyorId, contactId: s.contactId }))}
  on:select={handleSurveyorSelect}
  on:close={() => showSurveyorModal = false}
/>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .form-group select {
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    cursor: pointer;
  }

  .form-group select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .subject-preview {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
  }

  .subject-preview strong {
    color: #475569;
  }

  .no-surveyors {
    padding: 1rem;
    background: #fef3c7;
    color: #92400e;
    border-radius: 6px;
    text-align: center;
    font-size: 0.875rem;
    margin: 0;
  }

  .merging-indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 6px;
    color: #64748b;
    font-size: 0.875rem;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }

  .btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Surveyor Selection Styles */
  .surveyors-selection {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .selected-surveyors {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .surveyor-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    gap: 1rem;
  }

  .chip-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    flex: 1;
  }

  .chip-name {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.875rem;
  }

  .chip-org {
    font-size: 0.8125rem;
    color: #475569;
  }

  .chip-email {
    font-size: 0.75rem;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .chip-remove:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .no-surveyors-selected {
    margin: 0;
    padding: 1rem;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    color: #64748b;
    text-align: center;
    font-size: 0.875rem;
  }

  .btn-add-surveyor {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .btn-add-surveyor:hover {
    background: #eff6ff;
  }

  .btn-change-surveyor {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .btn-change-surveyor:hover {
    background: #f8fafc;
    color: #475569;
    border-color: #94a3b8;
  }
</style>
