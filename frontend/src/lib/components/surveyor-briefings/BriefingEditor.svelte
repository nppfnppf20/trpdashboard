<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import SelectSurveyorModal from './SelectSurveyorModal.svelte';
  import { getTemplates, mergeTemplate, saveSentRequest, sendBriefingEmails } from '$lib/api/quoteRequests.js';

  export let show = false;
  export let projectId;
  export let preSelectedTemplate = null;
  export let preSelectedSurveyors = []; // [{ surveyorId, surveyorOrganisation, discipline, contactId, contactName, contactEmail }]
  export let sources = [];
  export let precomputedCheck = null; // { status: 'loading'|'ready'|'error', apiResult, error? }
  export let stepCurrent = 0;
  export let stepTotal = 0;

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
  let selectedSurveyors = [];
  let showSurveyorModal = false;
  let richTextEditor;
  let loading = false;
  let saving = false;
  let sending = false;
  let merging = false;
  let error = null;
  let sendResult = null;
  let currentSubject = '';
  let mergeDone = false;   // true once first merge has populated the editor
  let briefingApplied = false; // prevent double-apply of precomputedCheck

  // Apply precomputedCheck once merge is done and result is ready
  $: if (precomputedCheck?.status === 'ready' && mergeDone && !briefingApplied) {
    briefingApplied = true;
    const html = richTextEditor?.getHTML();
    if (html) applyPrecomputedCheck(html);
  }

  $: selectedSurveyorIds = selectedSurveyors.map(s => s.surveyorId);

  $: filteredTemplates = selectedDiscipline && selectedDiscipline !== 'Any'
    ? templates.filter(t => t.discipline === selectedDiscipline || t.discipline === null)
    : templates;

  $: if (selectedDiscipline && !preSelectedTemplate) {
    const matchingTemplate = templates.find(t => t.discipline === selectedDiscipline);
    if (matchingTemplate) {
      selectedTemplateId = matchingTemplate.id;
    } else {
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
      // Setting selectedSurveyors triggers the reactive merge statement above — don't call it again here
    }
  });

  async function loadTemplates() {
    try {
      templates = await getTemplates();
    } catch (err) {
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
      if (richTextEditor) richTextEditor.setHTML(merged.content);
      mergeDone = true;
      // If check already resolved, apply immediately; reactive block handles the other case
      if (precomputedCheck?.status === 'ready' && !briefingApplied) {
        briefingApplied = true;
        applyPrecomputedCheck(merged.content);
      }
    } catch (err) {
      error = err.message;
    } finally {
      merging = false;
    }
  }

  // Inserts sectionHtml before <h3>Key Requirements</h3> if present, otherwise
  // before the closing lines ("If you require any additional information…" /
  // "Best regards"), falling back to the end of the email.
  function appendAdditionalSection(fullHtml, sectionHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, 'text/html');
    const body = doc.body;
    const children = Array.from(body.childNodes);
    const insertBeforeNode =
      children.find(n => n.nodeName === 'H3' && n.textContent.trim().toLowerCase() === 'key requirements')
      ?? children.find(n => /^(if you require|best regards|kind regards|many thanks|yours\b)/i.test(n.textContent?.trim() ?? ''))
      ?? null;
    const tempDiv = doc.createElement('div');
    tempDiv.innerHTML = sectionHtml;
    while (tempDiv.firstChild) body.insertBefore(tempDiv.firstChild, insertBeforeNode);
    return body.innerHTML;
  }

  function applyPrecomputedCheck(currentHtml) {
    const result = precomputedCheck?.apiResult;
    console.log('[BriefingEditor] applyPrecomputedCheck', { hasChanges: result?.hasChanges, hasSuggestedContent: !!result?.suggestedContent });
    if (!result?.hasChanges || !result?.suggestedContent) return;
    const newHtml = appendAdditionalSection(currentHtml, result.suggestedContent);
    richTextEditor?.setHTML(newHtml);
  }

  function handleSurveyorSelect(event) {
    selectedSurveyors = [event.detail];
    showSurveyorModal = false;
  }

  function removeSurveyor() {
    selectedSurveyors = [];
  }

  $: hasSurveyorSelected = selectedSurveyors.length > 0;

  // Unwrap <strong>/<b> and bold inline styles so only headings paste as bold
  function stripInlineBold(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('strong, b').forEach(el => {
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    tmp.querySelectorAll('[style*="font-weight"]').forEach(el => {
      if (!/^h[1-6]$/i.test(el.tagName)) el.style.fontWeight = '';
    });
    return tmp.innerHTML;
  }

  async function handleCopyToClipboard() {
    if (!richTextEditor) return;
    try {
      const htmlContent = stripInlineBold(richTextEditor.getHTML());
      const plainText = stripHtml(htmlContent);
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
        alert('Email content copied to clipboard!');
      } else {
        fallbackCopyRichText(htmlContent);
      }
    } catch (err) {
      fallbackCopyRichText(stripInlineBold(richTextEditor.getHTML()));
    }
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  }

  function fallbackCopyRichText(html) {
    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.innerHTML = html;
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(container);
    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      document.execCommand('copy');
      alert('Email content copied to clipboard!');
    } catch {
      alert('Failed to copy to clipboard');
    }
    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  function handleOpenInEmail() {
    if (!richTextEditor) return;
    const plainText = stripHtml(richTextEditor.getHTML());
    const to = selectedSurveyors[0]?.contactEmail || '';
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(currentSubject || '')}&body=${encodeURIComponent(plainText)}`;
  }

  async function handleSaveAsSent() {
    if (!richTextEditor || !projectId) return;
    if (selectedSurveyors.length === 0) { alert('Please select at least one surveyor'); return; }
    saving = true;
    error = null;
    try {
      await saveSentRequest(projectId, {
        templateId: selectedTemplateId || null,
        emailContent: richTextEditor.getHTML(),
        recipients: selectedSurveyors.map(s => ({ surveyorId: s.surveyorId, contactId: s.contactId })),
        notes: null
      });
      dispatch('saved');
    } catch (err) {
      error = err.message;
      alert('Failed to save: ' + err.message);
    } finally {
      saving = false;
    }
  }

  async function handleSendEmail() {
    if (!richTextEditor || !projectId) return;
    if (selectedSurveyors.length === 0) { alert('Please select at least one surveyor'); return; }
    if (!currentSubject) { alert('No subject line, select a template first'); return; }
    const surveyor = selectedSurveyors[0];
    if (!surveyor.contactEmail) { alert(`No email address on record for ${surveyor.contactName || surveyor.surveyorOrganisation}`); return; }
    if (!confirm(`Send email to ${surveyor.contactEmail}?`)) return;
    sending = true;
    sendResult = null;
    error = null;
    try {
      const result = await sendBriefingEmails(projectId, {
        templateId: selectedTemplateId || null,
        emailContent: richTextEditor.getHTML(),
        subject: currentSubject,
        recipients: selectedSurveyors.map(s => ({
          surveyorId: s.surveyorId, contactId: s.contactId,
          contactEmail: s.contactEmail, contactName: s.contactName,
          surveyorOrganisation: s.surveyorOrganisation
        })),
        notes: null
      });
      sendResult = result;
      dispatch('saved');
    } catch (err) {
      error = err.message;
    } finally {
      sending = false;
    }
  }

  function handleClose() {
    if (confirm('Close without saving?')) dispatch('close');
  }

  function handlePrev() { dispatch('prev'); }
  function handleNext() { dispatch('next'); }
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

      {#if stepTotal > 1}
        <div class="step-bar">
          <button class="step-nav-btn" on:click={handlePrev} disabled={stepCurrent === 1} title="Previous email">
            <i class="las la-angle-left"></i>
          </button>
          <div class="step-bar-center">
            <span class="step-count">Email {stepCurrent} of {stepTotal}</span>
            {#if preSelectedSurveyors[0]}
              <span class="step-label">{preSelectedSurveyors[0].discipline} · {preSelectedSurveyors[0].surveyorOrganisation}</span>
            {/if}
          </div>
          <button class="step-nav-btn" on:click={handleNext} disabled={stepCurrent === stepTotal} title="Next email">
            <i class="las la-angle-right"></i>
          </button>
        </div>
      {/if}

      <div class="modal-body">
        {#if error}
          <div class="error-banner">
            <i class="las la-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        {/if}

        <div class="form-group">
          <label for="discipline-select">Discipline:</label>
          <select id="discipline-select" bind:value={selectedDiscipline} disabled={loading}>
            <option value={null}>Select a discipline...</option>
            {#each disciplines as discipline}
              <option value={discipline}>{discipline}</option>
            {/each}
          </select>
        </div>

        {#if selectedDiscipline}
          <div class="form-group">
            <label for="template-select">Template:</label>
            <select id="template-select" bind:value={selectedTemplateId} disabled={loading}>
              <option value={null}>Select a template...</option>
              {#each filteredTemplates as template}
                <option value={template.id}>{template.template_name}</option>
              {/each}
            </select>
          </div>

          {#if currentSubject}
            <div class="subject-preview">
              <strong>Subject:</strong> {currentSubject}
            </div>
          {/if}

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
                  <button class="chip-remove" on:click={removeSurveyor} title="Remove">
                    <i class="las la-times"></i>
                  </button>
                </div>
                <button type="button" class="btn btn-change-surveyor" on:click={() => showSurveyorModal = true}>
                  <i class="las la-exchange-alt"></i> Change Surveyor
                </button>
              {:else}
                <p class="no-surveyors-selected">No surveyor selected yet</p>
                <button type="button" class="btn btn-add-surveyor" on:click={() => showSurveyorModal = true}>
                  <i class="las la-plus"></i> Select Surveyor
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <div class="form-group">
          <label>Email Content:</label>
          {#if precomputedCheck}
            {#if precomputedCheck.status === 'loading'}
              <div class="check-status check-loading">
                <i class="las la-circle-notch la-spin"></i>
                Checking briefing note for additional scope items…
              </div>
            {:else if precomputedCheck.status === 'error'}
              <div class="check-status check-error">
                <i class="las la-exclamation-triangle"></i>
                Briefing note check failed: {precomputedCheck.error}
              </div>
            {:else if precomputedCheck.status === 'ready' && !precomputedCheck.apiResult}
              <div class="check-status check-skipped">
                <i class="las la-info-circle"></i>
                Briefing note check skipped - no "Scope of Work" section found in this template
              </div>
            {:else if precomputedCheck.status === 'ready' && precomputedCheck.apiResult.hasChanges}
              <div class="check-status check-applied">
                <i class="las la-magic"></i>
                "Additional Information" section added from the briefing note
              </div>
            {:else if precomputedCheck.status === 'ready'}
              <div class="check-status check-none">
                <i class="las la-check"></i>
                Briefing note checked - nothing to add beyond the standard scope
              </div>
            {/if}
          {/if}
          {#if merging}
            <div class="merging-indicator">
              <div class="spinner"></div>
              <p>Merging template…</p>
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
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-secondary" on:click={handleCopyToClipboard}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}>
          <i class="las la-copy"></i> Copy to Clipboard
        </button>
        <button class="btn btn-secondary" on:click={handleOpenInEmail}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}>
          <i class="las la-envelope"></i> Open in Email
        </button>
        <button class="btn btn-secondary" on:click={handleSaveAsSent}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}>
          {#if saving}
            <div class="btn-spinner"></div> Saving...
          {:else}
            <i class="las la-save"></i> Save as Sent
          {/if}
        </button>
        <button class="btn btn-send" on:click={handleSendEmail}
          disabled={saving || sending || !richTextEditor || !hasSurveyorSelected}>
          {#if sending}
            <div class="btn-spinner"></div> Sending...
          {:else}
            <i class="las la-paper-plane"></i> Send Email
          {/if}
        </button>
        {#if stepTotal > 1}
          <button class="btn btn-send-all" disabled title="Coming soon - send every drafted email in one go">
            <i class="las la-paper-plane"></i> Send All
            <span class="soon-badge">Coming soon</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<SelectSurveyorModal
  show={showSurveyorModal}
  selectedSurveyors={selectedSurveyors.map(s => ({ surveyorId: s.surveyorId, contactId: s.contactId }))}
  on:select={handleSurveyorSelect}
  on:close={() => showSurveyorModal = false}
/>

<style>
  .modal-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
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
    width: 32px; height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .close-btn:hover { background: #f1f5f9; color: #1e293b; }

  .step-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: #faf5ff;
    border-bottom: 2px solid #d8b4fe;
  }

  .step-bar-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    min-width: 0;
  }

  .step-count {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7c3aed;
    white-space: nowrap;
  }

  .step-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .step-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    background: white;
    border: 1.5px solid #d8b4fe;
    border-radius: 6px;
    color: #7c3aed;
    font-size: 1rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .step-nav-btn:hover:not(:disabled) { background: #f3e8ff; border-color: #a855f7; }
  .step-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

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
  .form-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .subject-preview {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
  }
  .subject-preview strong { color: #475569; }

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

  .check-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 6px;
    font-size: 0.8125rem;
  }
  .check-status i { font-size: 1rem; }
  .check-loading { background: #f8fafc; color: #64748b; }
  .check-error { background: #fef2f2; color: #b91c1c; }
  .check-skipped { background: #fffbeb; color: #b45309; }
  .check-applied { background: #faf5ff; color: #7c3aed; }
  .check-none { background: #f0fdf4; color: #15803d; }

  .spinner {
    width: 20px; height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

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
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }
  .btn-secondary:hover:not(:disabled) { background: #f8fafc; }

  .btn-send {
    background: #059669;
    color: white;
  }
  .btn-send:hover:not(:disabled) { background: #047857; }

  .btn-send-all {
    background: #059669;
    color: white;
    opacity: 0.5;
    cursor: not-allowed;
    position: relative;
  }

  .soon-badge {
    padding: 0.1rem 0.4rem;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .btn-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .surveyors-selection {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  .chip-name { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
  .chip-org  { font-size: 0.8125rem; color: #475569; }
  .chip-email { font-size: 0.75rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px; height: 28px;
    padding: 0;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .chip-remove:hover { background: #fee2e2; border-color: #fecaca; color: #dc2626; }

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
  .btn-add-surveyor:hover { background: #eff6ff; }

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
  .btn-change-surveyor:hover { background: #f8fafc; color: #475569; border-color: #94a3b8; }

  .send-result-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    border-top: 1px solid #e2e8f0;
  }
  .result-success { background: #f0fdf4; color: #166534; }
  .result-partial { background: #fef3c7; color: #92400e; }

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
