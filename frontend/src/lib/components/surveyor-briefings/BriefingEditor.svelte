<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import SelectSurveyorModal from './SelectSurveyorModal.svelte';
  import { getTemplates, mergeTemplate, saveSentRequest, sendBriefingEmails, suggestEmailEditsForDiscipline } from '$lib/api/quoteRequests.js';

  export let show = false;
  export let projectId;
  export let preSelectedTemplate = null;
  export let preSelectedSurveyors = []; // [{ surveyorId, surveyorOrganisation, discipline, contactId, contactName, contactEmail }]

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
  let sending = false;
  let merging = false;
  let error = null;
  let sendResult = null; // { sent, failed, results }
  let currentSubject = '';

  // Flow 1: inline email edit suggestion
  let editSuggestionLoading = false;
  let editSuggestion = null; // { hasChanges, reasoning, suggestedContent }
  let editSuggestionDismissed = false;

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
    }
    if (preSelectedSurveyors?.length > 0) {
      selectedSurveyors = [...preSelectedSurveyors];
    }
    if (selectedTemplateId && selectedSurveyorIds.length > 0) {
      await mergeTemplateContent();
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

  async function checkAgainstBriefing() {
    if (!richTextEditor || !selectedDiscipline || !projectId) return;
    editSuggestion = null;
    editSuggestionDismissed = false;
    editSuggestionLoading = true;
    try {
      const currentContent = richTextEditor.getHTML();
      const result = await suggestEmailEditsForDiscipline(projectId, {
        discipline: selectedDiscipline,
        templateContent: currentContent
      });
      editSuggestion = result;
    } catch (err) {
      console.error('checkAgainstBriefing failed:', err);
      alert(err.message);
    } finally {
      editSuggestionLoading = false;
    }
  }

  function applySuggestion() {
    if (!editSuggestion?.suggestedContent || !richTextEditor) return;
    richTextEditor.setHTML(editSuggestion.suggestedContent);
    editSuggestion = null;
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

  function handleOpenInEmail() {
    if (!richTextEditor) return;
    const plainText = stripHtml(richTextEditor.getHTML());
    const to = selectedSurveyors[0]?.contactEmail || '';
    const subject = encodeURIComponent(currentSubject || '');
    const body = encodeURIComponent(plainText);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
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

  async function handleSendEmail() {
    if (!richTextEditor || !projectId) return;
    if (selectedSurveyors.length === 0) { alert('Please select at least one surveyor'); return; }
    if (!currentSubject) { alert('No subject line — select a template first'); return; }

    const surveyor = selectedSurveyors[0];
    if (!surveyor.contactEmail) {
      alert(`No email address on record for ${surveyor.contactName || surveyor.surveyorOrganisation}`);
      return;
    }

    if (!confirm(`Send email to ${surveyor.contactEmail}?`)) return;

    sending = true;
    sendResult = null;
    error = null;
    try {
      const emailContent = richTextEditor.getHTML();
      const data = {
        templateId: selectedTemplateId || null,
        emailContent,
        subject: currentSubject,
        recipients: selectedSurveyors.map(s => ({
          surveyorId: s.surveyorId,
          contactId: s.contactId,
          contactEmail: s.contactEmail,
          contactName: s.contactName,
          surveyorOrganisation: s.surveyorOrganisation
        })),
        notes: null
      };
      const result = await sendBriefingEmails(projectId, data);
      sendResult = result;
      dispatch('saved');
    } catch (err) {
      console.error('Error sending email:', err);
      error = err.message;
    } finally {
      sending = false;
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
          <div class="editor-label-row">
            <label>Email Content:</label>
            {#if selectedDiscipline && selectedDiscipline !== 'Any' && projectId}
              <button
                class="btn-check-briefing"
                on:click={checkAgainstBriefing}
                disabled={editSuggestionLoading || merging}
                title="Check scope against project briefing note"
              >
                {#if editSuggestionLoading}
                  <span class="btn-micro-spinner"></span>
                  Checking…
                {:else}
                  <i class="las la-magic"></i>
                  Check against briefing
                {/if}
              </button>
            {/if}
          </div>

          {#if editSuggestion && !editSuggestionDismissed}
            {#if editSuggestion.hasChanges}
              <div class="suggestion-banner suggestion-changes">
                <div class="suggestion-header">
                  <i class="las la-lightbulb"></i>
                  <span class="suggestion-title">Suggested changes from briefing note</span>
                  <button class="suggestion-dismiss" on:click={() => editSuggestionDismissed = true}>
                    <i class="las la-times"></i>
                  </button>
                </div>
                <p class="suggestion-reasoning">{editSuggestion.reasoning}</p>
                <button class="btn btn-apply-suggestion" on:click={applySuggestion}>
                  <i class="las la-check"></i>
                  Apply suggestion
                </button>
              </div>
            {:else}
              <div class="suggestion-banner suggestion-nochange">
                <i class="las la-check-circle"></i>
                <span>No changes needed — the standard scope covers this project's requirements.</span>
                <button class="suggestion-dismiss" on:click={() => editSuggestionDismissed = true}>
                  <i class="las la-times"></i>
                </button>
              </div>
            {/if}
          {/if}

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

      {#if sendResult}
        <div class="send-result-banner" class:result-success={sendResult.failed === 0} class:result-partial={sendResult.failed > 0}>
          <i class="las {sendResult.failed === 0 ? 'la-check-circle' : 'la-exclamation-triangle'}"></i>
          {#if sendResult.failed === 0}
            Email sent successfully to {sendResult.sent} recipient{sendResult.sent !== 1 ? 's' : ''}.
          {:else}
            Sent {sendResult.sent}, failed {sendResult.failed}. Check email log for details.
          {/if}
          <button class="dismiss-result" on:click={() => sendResult = null}><i class="las la-times"></i></button>
        </div>
      {/if}

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleCopyToClipboard}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}
        >
          <i class="las la-copy"></i>
          Copy to Clipboard
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleOpenInEmail}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}
        >
          <i class="las la-envelope"></i>
          Open in Email
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleSaveAsSent}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}
        >
          {#if saving}
            <div class="btn-spinner"></div>
            Saving...
          {:else}
            <i class="las la-save"></i>
            Save as Sent
          {/if}
        </button>
        <button
          class="btn btn-send"
          on:click={handleSendEmail}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}
        >
          {#if sending}
            <div class="btn-spinner"></div>
            Sending...
          {:else}
            <i class="las la-paper-plane"></i>
            Send Email
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

  /* ── Check-against-briefing button & suggestion banner ───────────────────── */
  .editor-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .editor-label-row label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
    margin: 0;
  }

  .btn-check-briefing {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3rem 0.75rem;
    background: white;
    color: #7c3aed;
    border: 1px solid #7c3aed;
    border-radius: 5px;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-check-briefing:hover:not(:disabled) {
    background: #f5f3ff;
  }

  .btn-check-briefing:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-micro-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(124, 58, 237, 0.25);
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .suggestion-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .suggestion-changes {
    background: #faf5ff;
    border: 1px solid #ddd6fe;
    flex-direction: column;
  }

  .suggestion-nochange {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    align-items: center;
  }

  .suggestion-nochange i {
    font-size: 1rem;
    color: #16a34a;
  }

  .suggestion-nochange .suggestion-dismiss {
    margin-left: auto;
  }

  .suggestion-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .suggestion-header i {
    color: #7c3aed;
    font-size: 1rem;
  }

  .suggestion-title {
    font-weight: 600;
    color: #5b21b6;
    flex: 1;
  }

  .suggestion-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    padding: 0.125rem;
    font-size: 0.875rem;
    border-radius: 3px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }

  .suggestion-dismiss:hover {
    color: #475569;
  }

  .suggestion-reasoning {
    margin: 0;
    color: #6b21a8;
    line-height: 1.5;
    font-size: 0.8rem;
  }

  .btn-apply-suggestion {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    align-self: flex-start;
  }

  .btn-apply-suggestion:hover {
    background: #6d28d9;
  }

  .btn-send {
    background: #059669;
    color: white;
  }

  .btn-send:hover:not(:disabled) {
    background: #047857;
  }

  .send-result-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    border-top: 1px solid #e2e8f0;
  }

  .result-success {
    background: #f0fdf4;
    color: #166534;
  }

  .result-partial {
    background: #fef3c7;
    color: #92400e;
  }

  .dismiss-result {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    font-size: 0.875rem;
    padding: 0.125rem;
    border-radius: 3px;
    display: flex;
    align-items: center;
  }

  .dismiss-result:hover { opacity: 1; }
</style>
