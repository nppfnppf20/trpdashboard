<script>
  import { onMount } from 'svelte';
  import PopulateFromBriefingModal from '$lib/components/briefing-populate/PopulateFromBriefingModal.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
  import {
    getDocumentSummaries,
    generateDocumentSummary,
    saveDocumentSummary,
    replaceDocumentSummary,
    deleteDocumentSummary,
    suggestDocumentUpdates,
    getDocTypePrompt,
    saveDocTypePrompt,
    deleteDocTypePrompt
  } from '$lib/api/projectDocs.js';

  export let project;
  $: projectId = project?.id;

  const DOC_TYPES = [
    { value: 'about_applicant',      label: 'About the Applicant' },
    { value: 'proposed_development', label: 'Proposed Development' },
    { value: 'pre_app',              label: 'Pre-app Response' },
    { value: 'eia_response',         label: 'EIA Response' },
    { value: 'sci',                  label: 'SCI' },
    { value: 'site_surroundings',    label: 'Site and Surroundings' },
    { value: 'briefing_transcript',  label: 'Briefing Transcript' },
    { value: 'other',                label: 'Other' }
  ];

  const TYPE_COLOURS = {
    about_applicant:     '#0ea5e9',
    proposed_development: '#6366f1',
    pre_app:             '#3b82f6',
    eia_response:        '#10b981',
    sci:                 '#f59e0b',
    site_surroundings:   '#8b5cf6',
    briefing_transcript: '#f43f5e',
    other:               '#64748b'
  };

  // List state
  let summaries = [];
  let listLoading = true;
  let listError = null;

  // Panel mode: null | 'upload' | 'manual'
  let mode = null;

  // Upload form
  let docType = 'pre_app';
  let dragOver = false;
  let selectedFile = null;
  let pasteText = '';
  let inputTab = 'upload'; // 'upload' | 'paste'
  let summarising = false;
  let summariseError = null;

  // Result state
  let resultTitle = '';
  let resultRef = '';
  let resultSummaryHtml = '';
  let resultFileName = '';
  let saving = false;
  let saveError = null;
  let showResult = false;

  // Manual form
  let manualTitle = '';
  let manualRef = '';
  let manualDocType = 'other';
  let manualSummary = '';
  let manualSaving = false;
  let manualError = null;

  // Variable suggestions (briefing transcript only)
  let suggestions = [];
  let suggestionsLoading = false;
  let expandedSuggestions = new Set();
  let approvedSuggestions = new Set();
  let rejectedSuggestions = new Set();

  function toggleSuggestion(field) {
    expandedSuggestions = expandedSuggestions.has(field)
      ? new Set([...expandedSuggestions].filter(f => f !== field))
      : new Set([...expandedSuggestions, field]);
  }

  function rejectSuggestion(field) {
    rejectedSuggestions = new Set([...rejectedSuggestions, field]);
  }

  async function approveSuggestion(suggestion) {
    try {
      await replaceDocumentSummary(projectId, {
        title: `${suggestion.label} — from Briefing Transcript`,
        document_ref: null,
        file_name: null,
        doc_type: suggestion.field,
        summary_html: suggestion.suggested_content
      });
      approvedSuggestions = new Set([...approvedSuggestions, suggestion.field]);
      await load();
    } catch (err) {
      alert(`Failed to save suggestion: ${err.message}`);
    }
  }

  // Prompt modal
  let promptModalOpen = false;
  let promptText = '';
  let promptIsCustom = false;
  let promptLoading = false;
  let promptSaving = false;
  let promptSaved = false;
  let promptDocType = 'pre_app';

  // Expanded summaries
  let expandedIds = new Set();

  // Modal state
  let showPopulate = false;
  let showGuide = false;

  $: hasBriefing = summaries.some(s => s.doc_type === 'briefing_transcript');

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    listLoading = true;
    listError = null;
    try {
      summaries = await getDocumentSummaries(projectId);
    } catch (err) {
      listError = err.message;
    } finally {
      listLoading = false;
    }
  }

  function setMode(m) {
    mode = mode === m ? null : m;
    summariseError = null;
    saveError = null;
    showResult = false;
    selectedFile = null;
    pasteText = '';
    resultTitle = '';
    resultRef = '';
    resultSummaryHtml = '';
  }

  // Upload handlers
  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { selectedFile = file; showResult = false; }
  }
  function onFileChange(e) {
    selectedFile = e.target.files[0] ?? null;
    e.target.value = '';
    showResult = false;
  }

  async function runSummarise() {
    summariseError = null;
    summarising = true;
    showResult = false;
    suggestions = [];
    approvedSuggestions = new Set();
    rejectedSuggestions = new Set();
    expandedSuggestions = new Set();

    let rawText = '';
    try {
      const payload = { docType };
      if (inputTab === 'upload') {
        if (!selectedFile) { summariseError = 'Please select a file.'; summarising = false; return; }
        payload.file = selectedFile;
      } else {
        if (!pasteText.trim()) { summariseError = 'Please paste some text.'; summarising = false; return; }
        rawText = pasteText;
        payload.text = pasteText;
        payload.fileName = 'Pasted text';
      }

      const promises = [generateDocumentSummary(projectId, payload)];

      if (docType === 'briefing_transcript' && rawText) {
        suggestionsLoading = true;
        promises.push(suggestDocumentUpdates(projectId, { text: rawText }));
      }

      const [result, suggestResult] = await Promise.all(promises);
      resultSummaryHtml = result.summary_html;
      resultFileName = result.file_name || selectedFile?.name || '';
      showResult = true;

      if (suggestResult) {
        suggestions = suggestResult.suggestions ?? [];
        suggestionsLoading = false;
      }
    } catch (err) {
      summariseError = err.message;
      suggestionsLoading = false;
    } finally {
      summarising = false;
    }
  }

  async function saveSummary() {
    if (!resultTitle.trim()) { saveError = 'Please enter a title.'; return; }
    saving = true;
    saveError = null;
    try {
      const entry = await saveDocumentSummary(projectId, {
        title: resultTitle,
        document_ref: resultRef || null,
        file_name: resultFileName || null,
        doc_type: docType,
        summary_html: resultSummaryHtml
      });
      summaries = [entry, ...summaries];
      setMode(null);
    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
    }
  }

  async function saveManual() {
    if (!manualTitle.trim()) { manualError = 'Please enter a title.'; return; }
    if (!manualSummary.trim()) { manualError = 'Please enter a summary.'; return; }
    manualSaving = true;
    manualError = null;
    try {
      const entry = await saveDocumentSummary(projectId, {
        title: manualTitle,
        document_ref: manualRef || null,
        file_name: null,
        doc_type: manualDocType,
        summary_html: `<p>${manualSummary.replace(/\n/g, '</p><p>')}</p>`
      });
      summaries = [entry, ...summaries];
      manualTitle = '';
      manualRef = '';
      manualSummary = '';
      mode = null;
    } catch (err) {
      manualError = err.message;
    } finally {
      manualSaving = false;
    }
  }

  async function removeSummary(id) {
    if (!confirm('Delete this document summary?')) return;
    try {
      await deleteDocumentSummary(id);
      summaries = summaries.filter(s => s.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleExpand(id) {
    expandedIds = expandedIds.has(id)
      ? new Set([...expandedIds].filter(x => x !== id))
      : new Set([...expandedIds, id]);
  }

  // Prompt modal
  async function openPromptModal() {
    promptDocType = docType;
    promptLoading = true;
    promptModalOpen = true;
    promptSaved = false;
    try {
      const data = await getDocTypePrompt(docType);
      promptText = data.prompt;
      promptIsCustom = data.is_custom;
    } catch (err) {
      promptText = `Error loading prompt: ${err.message}`;
    } finally {
      promptLoading = false;
    }
  }

  async function savePrompt() {
    promptSaving = true;
    try {
      await saveDocTypePrompt(promptDocType, promptText);
      promptIsCustom = true;
      promptSaved = true;
      setTimeout(() => promptSaved = false, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      promptSaving = false;
    }
  }

  async function resetPrompt() {
    promptLoading = true;
    try {
      const data = await deleteDocTypePrompt(promptDocType);
      promptText = data.prompt;
      promptIsCustom = false;
    } catch (err) {
      console.error(err);
    } finally {
      promptLoading = false;
    }
  }

  function getTypeLabel(val) {
    return DOC_TYPES.find(t => t.value === val)?.label ?? val;
  }
</script>

<div class="project-docs">
  <div class="docs-header">
    <div>
      <h3>Project Documents</h3>
      <p>Upload and summarise documents or add entries manually. Saved summaries can be used to generate planning statement content.</p>
    </div>
    <div class="header-actions">
      <button class="btn-action tertiary" on:click={() => (showGuide = true)}>
        <i class="las la-clipboard-list"></i> Meeting Guide
      </button>
      {#if hasBriefing}
        <button class="btn-action tertiary" on:click={() => (showPopulate = true)}>
          <i class="las la-magic"></i> Populate from Briefing
        </button>
      {/if}
      <button class="btn-action" class:active={mode === 'upload'} on:click={() => setMode('upload')}>
        <i class="las la-cloud-upload-alt"></i> Upload & Summarise
      </button>
      <button class="btn-action secondary" class:active={mode === 'manual'} on:click={() => setMode('manual')}>
        <i class="las la-pen"></i> Add Manually
      </button>
    </div>
  </div>

  <!-- Upload & Summarise Panel -->
  {#if mode === 'upload'}
    <div class="panel">
      <div class="panel-row">
        <div class="field">
          <label>Document Type</label>
          <select bind:value={docType}>
            {#each DOC_TYPES as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </div>
        <button class="btn-prompt" on:click={openPromptModal}>
          <i class="las la-sliders-h"></i> Edit Prompt
        </button>
      </div>

      <div class="input-tabs">
        <button class="input-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>Upload File</button>
        <button class="input-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>Paste Text</button>
      </div>

      {#if inputTab === 'upload'}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="dropzone"
          class:dragover={dragOver}
          on:dragover|preventDefault={() => dragOver = true}
          on:dragleave={() => dragOver = false}
          on:drop={onDrop}
        >
          {#if selectedFile}
            <div class="file-selected">
              <i class="las la-file-pdf"></i>
              <span>{selectedFile.name}</span>
              <button class="remove-file" on:click={() => selectedFile = null}>&times;</button>
            </div>
          {:else}
            <i class="las la-cloud-upload-alt upload-icon"></i>
            <p>Drag and drop a PDF or text file here, or</p>
            <label class="file-label">
              Browse files
              <input type="file" accept=".pdf,.txt,.md" on:change={onFileChange} />
            </label>
          {/if}
        </div>
      {:else}
        <textarea
          class="paste-area"
          bind:value={pasteText}
          placeholder="Paste document text here…"
          rows="8"
        ></textarea>
      {/if}

      {#if summariseError}
        <div class="error-msg">{summariseError}</div>
      {/if}

      <button class="btn-summarise" on:click={runSummarise} disabled={summarising}>
        {#if summarising}
          <span class="spinner-sm"></span> Summarising…
        {:else}
          <i class="las la-magic"></i> Summarise
        {/if}
      </button>

      {#if showResult}
        <div class="result-panel">
          <div class="result-fields">
            <div class="field">
              <label>Title <span class="required">*</span></label>
              <input type="text" bind:value={resultTitle} placeholder="e.g. Pre-app Response – LPA Comments Jan 2025" />
            </div>
            <div class="field">
              <label>Document Reference</label>
              <input type="text" bind:value={resultRef} placeholder="e.g. PA/2025/001" />
            </div>
          </div>
          <div class="summary-preview">
            <div class="summary-label">Generated Summary <span class="editable-hint">(click to edit)</span></div>
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="summary-content"
              contenteditable="true"
              bind:innerHTML={resultSummaryHtml}
            ></div>
          </div>
          {#if saveError}
            <div class="error-msg">{saveError}</div>
          {/if}
          <div class="result-actions">
            <button class="btn-cancel-sm" on:click={() => showResult = false}>Discard</button>
            <button class="btn-save" on:click={saveSummary} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Project Docs'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Variable Suggestions (briefing transcript) -->
  {#if suggestionsLoading || suggestions.length > 0}
    <div class="suggestions-panel">
      <div class="suggestions-header">
        <i class="las la-lightbulb"></i>
        <span>Suggested field updates from transcript</span>
        {#if suggestionsLoading}
          <span class="spinner-sm suggestions-spinner"></span>
        {/if}
      </div>
      {#if suggestions.length === 0 && !suggestionsLoading}
        <p class="no-suggestions">No field updates were identified in this transcript.</p>
      {/if}
      {#each suggestions as s (s.field)}
        {#if !rejectedSuggestions.has(s.field)}
          {@const approved = approvedSuggestions.has(s.field)}
          {@const expanded = expandedSuggestions.has(s.field)}
          <div class="suggestion-card" class:approved>
            <div class="suggestion-top">
              <div class="suggestion-meta">
                <span class="suggestion-label">{s.label}</span>
                <span class="suggestion-reason">{s.reason}</span>
              </div>
              <div class="suggestion-actions">
                {#if approved}
                  <span class="approved-badge"><i class="las la-check-circle"></i> Saved</span>
                {:else}
                  <button class="btn-toggle-preview" on:click={() => toggleSuggestion(s.field)}>
                    {expanded ? 'Hide' : 'Preview'}
                  </button>
                  <button class="btn-reject" on:click={() => rejectSuggestion(s.field)}>Reject</button>
                  <button class="btn-approve" on:click={() => approveSuggestion(s)}>Approve</button>
                {/if}
              </div>
            </div>
            {#if expanded && !approved}
              <div class="suggestion-preview">
                {@html s.suggested_content}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Manual Entry Panel -->
  {#if mode === 'manual'}
    <div class="panel">
      <div class="panel-row">
        <div class="field flex-1">
          <label>Title <span class="required">*</span></label>
          <input type="text" bind:value={manualTitle} placeholder="e.g. Design and Access Statement" />
        </div>
        <div class="field">
          <label>Document Reference</label>
          <input type="text" bind:value={manualRef} placeholder="e.g. DAS-01" />
        </div>
        <div class="field">
          <label>Document Type</label>
          <select bind:value={manualDocType}>
            {#each DOC_TYPES as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Summary</label>
        <textarea bind:value={manualSummary} rows="6" placeholder="Enter a summary of this document…"></textarea>
      </div>
      {#if manualError}
        <div class="error-msg">{manualError}</div>
      {/if}
      <div class="result-actions">
        <button class="btn-cancel-sm" on:click={() => setMode(null)}>Cancel</button>
        <button class="btn-save" on:click={saveManual} disabled={manualSaving}>
          {manualSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Saved summaries list -->
  <div class="summary-list">
    {#if listLoading}
      <div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>
    {:else if listError}
      <div class="error-state"><i class="las la-exclamation-circle"></i><p>{listError}</p></div>
    {:else if summaries.length === 0}
      <div class="empty-state">
        <i class="las la-file-alt"></i>
        <p>No documents saved yet. Upload a document to generate a summary, or add one manually.</p>
      </div>
    {:else}
      {#each summaries as s (s.id)}
        {@const expanded = expandedIds.has(s.id)}
        <div class="summary-card">
          <div class="summary-card-header">
            <div class="summary-meta">
              {#if s.doc_type}
                <span class="type-badge" style="background:{TYPE_COLOURS[s.doc_type] ?? '#64748b'}22; color:{TYPE_COLOURS[s.doc_type] ?? '#64748b'}">
                  {getTypeLabel(s.doc_type)}
                </span>
              {/if}
              {#if s.document_ref}
                <span class="ref-chip">{s.document_ref}</span>
              {/if}
            </div>
            <div class="summary-actions">
              <button class="icon-btn" on:click={() => toggleExpand(s.id)} title={expanded ? 'Collapse' : 'Expand'}>
                <i class="las la-{expanded ? 'chevron-up' : 'chevron-down'}"></i>
              </button>
              <button class="icon-btn danger" on:click={() => removeSummary(s.id)} title="Delete">
                <i class="las la-trash"></i>
              </button>
            </div>
          </div>
          <div class="summary-title">{s.title}</div>
          {#if s.file_name}
            <div class="file-name-chip"><i class="las la-file"></i> {s.file_name}</div>
          {/if}
          {#if expanded}
            <div class="summary-body">
              {@html s.summary_html}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Prompt Modal -->
{#if promptModalOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={() => promptModalOpen = false}>
    <div class="prompt-modal">
      <div class="prompt-modal-header">
        <h3>Edit Prompt — {getTypeLabel(promptDocType)}</h3>
        <button class="close-btn" on:click={() => promptModalOpen = false}>&times;</button>
      </div>
      <div class="prompt-modal-body">
        {#if promptLoading}
          <div class="loading-state"><div class="spinner"></div><p>Loading prompt…</p></div>
        {:else}
          {#if promptIsCustom}
            <div class="custom-badge">Custom prompt saved</div>
          {:else}
            <div class="default-badge">Using default prompt</div>
          {/if}
          <textarea class="prompt-textarea" bind:value={promptText} rows="14"></textarea>
        {/if}
      </div>
      <div class="prompt-modal-footer">
        {#if promptIsCustom}
          <button class="btn-reset" on:click={resetPrompt} disabled={promptLoading}>Reset to default</button>
        {:else}
          <span></span>
        {/if}
        <div class="footer-right">
          {#if promptSaved}<span class="saved-msg"><i class="las la-check-circle"></i> Saved</span>{/if}
          <button class="btn-save" on:click={savePrompt} disabled={promptSaving || promptLoading}>
            {promptSaving ? 'Saving…' : 'Save Prompt'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<PopulateFromBriefingModal
  show={showPopulate}
  projectId={projectId}
  onClose={() => (showPopulate = false)}
  onComplete={() => { showPopulate = false; load(); }}
/>

<MeetingGuideModal
  show={showGuide}
  project={project}
  issueTracks={[]}
  onClose={() => (showGuide = false)}
/>

<style>
  .project-docs {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.25rem;
    gap: 1rem;
  }

  .docs-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .docs-header h3 { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: #1e293b; }
  .docs-header p { margin: 0; font-size: 0.8rem; color: #64748b; max-width: 500px; }

  .header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .btn-action {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #9333ea; color: white;
    border: none; border-radius: 6px;
    font-size: 0.85rem; font-weight: 500; cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-action:hover { background: #7e22ce; }
  .btn-action.secondary { background: white; color: #475569; border: 1px solid #cbd5e1; }
  .btn-action.secondary:hover { background: #f8fafc; }
  .btn-action.tertiary { background: #f3f0ff; color: #7c3aed; border: 1px solid #ddd6fe; }
  .btn-action.tertiary:hover { background: #ede9fe; }
  .btn-action.active { outline: 2px solid #9333ea; outline-offset: 2px; }

  .panel {
    background: #faf5ff;
    border: 1px solid #e9d5ff;
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .panel-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
  .flex-1 { flex: 1; }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label { font-size: 0.78rem; font-weight: 600; color: #475569; }
  .required { color: #ef4444; }

  input[type="text"], select, textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
  }
  input[type="text"]:focus, select:focus, textarea:focus {
    outline: none; border-color: #9333ea; box-shadow: 0 0 0 3px #f3e8ff;
  }
  textarea { resize: vertical; }

  .btn-prompt {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.45rem 0.9rem;
    background: white; border: 1px solid #d1d5db;
    border-radius: 6px; font-size: 0.8rem;
    font-family: inherit; color: #475569; cursor: pointer;
    white-space: nowrap; align-self: flex-end;
  }
  .btn-prompt:hover { border-color: #9333ea; color: #7e22ce; }

  .input-tabs { display: flex; gap: 0; border-bottom: 1px solid #e9d5ff; }
  .input-tab {
    padding: 0.4rem 1rem;
    border: none; background: none;
    font-size: 0.82rem; font-family: inherit;
    color: #64748b; cursor: pointer; border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .input-tab.active { color: #7e22ce; border-bottom-color: #9333ea; font-weight: 600; }

  .dropzone {
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 2rem;
    display: flex; flex-direction: column;
    align-items: center; gap: 0.75rem;
    background: white; color: #64748b; text-align: center;
    cursor: default; transition: border-color 0.15s;
  }
  .dropzone.dragover { border-color: #9333ea; background: #faf5ff; }
  .upload-icon { font-size: 2.5rem; color: #9333ea; }
  .dropzone p { margin: 0; font-size: 0.85rem; }

  .file-label {
    padding: 0.4rem 1rem;
    background: #9333ea; color: white;
    border-radius: 6px; font-size: 0.82rem;
    cursor: pointer; font-weight: 500;
  }
  .file-label input { display: none; }

  .file-selected {
    display: flex; align-items: center; gap: 0.75rem;
    font-size: 0.85rem; color: #1e293b; font-weight: 500;
  }
  .file-selected i { font-size: 1.25rem; color: #9333ea; }
  .remove-file {
    background: none; border: none; color: #94a3b8;
    font-size: 1.1rem; cursor: pointer; padding: 0; line-height: 1;
  }
  .remove-file:hover { color: #ef4444; }

  .paste-area { width: 100%; box-sizing: border-box; }

  .error-msg {
    font-size: 0.8rem; color: #dc2626;
    background: #fef2f2; border: 1px solid #fecaca;
    border-radius: 6px; padding: 0.5rem 0.75rem;
  }

  .btn-summarise {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.6rem 1.25rem;
    background: #9333ea; color: white;
    border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 500;
    cursor: pointer; font-family: inherit;
    align-self: flex-start;
  }
  .btn-summarise:hover:not(:disabled) { background: #7e22ce; }
  .btn-summarise:disabled { opacity: 0.6; cursor: not-allowed; }

  .spinner-sm {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .result-panel {
    background: white;
    border: 1px solid #e9d5ff;
    border-radius: 8px;
    padding: 1rem;
    display: flex; flex-direction: column; gap: 0.875rem;
  }
  .result-fields { display: flex; gap: 1rem; flex-wrap: wrap; }
  .result-fields .field { flex: 1; min-width: 200px; }

  .summary-label { font-size: 0.78rem; font-weight: 600; color: #475569; margin-bottom: 0.3rem; }
  .editable-hint { font-weight: 400; color: #94a3b8; font-size: 0.72rem; margin-left: 0.4rem; }

  .summary-content {
    border: 1px solid #d1d5db; border-radius: 6px;
    padding: 0.75rem; min-height: 120px;
    font-size: 0.85rem; line-height: 1.6; color: #1e293b;
    background: #fafafa;
  }
  .summary-content:focus { outline: none; border-color: #9333ea; box-shadow: 0 0 0 3px #f3e8ff; }
  .summary-content :global(h3) { font-size: 0.9rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .summary-content :global(p) { margin: 0 0 0.5rem; }
  .summary-content :global(ul) { margin: 0 0 0.5rem; padding-left: 1.25rem; }

  .result-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

  .btn-cancel-sm {
    padding: 0.45rem 1rem; border: 1px solid #d1d5db;
    background: white; border-radius: 6px;
    font-size: 0.85rem; font-family: inherit;
    cursor: pointer; color: #64748b;
  }
  .btn-cancel-sm:hover { background: #f8fafc; }

  .btn-save {
    padding: 0.45rem 1.1rem; background: #9333ea;
    color: white; border: none; border-radius: 6px;
    font-size: 0.85rem; font-weight: 500;
    font-family: inherit; cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: #7e22ce; }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

  /* List */
  .summary-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .loading-state, .error-state, .empty-state {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.5rem;
    padding: 3rem; color: #94a3b8; text-align: center;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p, .loading-state p { margin: 0; font-size: 0.875rem; }

  .spinner {
    width: 2rem; height: 2rem;
    border: 3px solid #f3f4f6; border-top-color: #9333ea;
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .summary-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem;
    display: flex; flex-direction: column; gap: 0.5rem;
  }

  .summary-card-header {
    display: flex; justify-content: space-between;
    align-items: flex-start; gap: 0.5rem;
  }
  .summary-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }

  .type-badge {
    font-size: 0.7rem; font-weight: 600;
    padding: 0.2rem 0.5rem; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .ref-chip {
    font-size: 0.75rem; font-weight: 600; color: #475569;
    background: #f1f5f9; padding: 0.2rem 0.5rem;
    border-radius: 4px; font-family: monospace;
  }

  .summary-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 6px; color: #64748b; font-size: 0.95rem;
  }
  .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
  .icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }

  .summary-title { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
  .file-name-chip { font-size: 0.75rem; color: #94a3b8; display: flex; gap: 0.3rem; align-items: center; }

  .summary-body {
    border-top: 1px solid #f1f5f9;
    padding-top: 0.75rem;
    font-size: 0.85rem; line-height: 1.6; color: #334155;
  }
  .summary-body :global(h3) { font-size: 0.875rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: #1e293b; }
  .summary-body :global(h3:first-child) { margin-top: 0; }
  .summary-body :global(p) { margin: 0 0 0.5rem; }
  .summary-body :global(ul) { margin: 0 0 0.5rem; padding-left: 1.25rem; }

  /* Prompt modal */
  .modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 2000; padding: 1rem;
  }
  .prompt-modal {
    background: white; border-radius: 12px;
    width: 100%; max-width: 680px;
    display: flex; flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    max-height: 90vh; overflow: hidden;
  }
  .prompt-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0;
  }
  .prompt-modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }
  .close-btn {
    background: none; border: none; font-size: 1.75rem;
    color: #64748b; cursor: pointer; padding: 0; line-height: 1;
  }
  .close-btn:hover { color: #1e293b; }

  .prompt-modal-body {
    padding: 1.25rem 1.5rem; flex: 1; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .prompt-textarea {
    width: 100%; box-sizing: border-box; resize: vertical;
    font-family: 'Courier New', monospace; font-size: 0.82rem;
    line-height: 1.5; color: #1e293b;
    border: 1px solid #d1d5db; border-radius: 6px; padding: 0.75rem;
  }
  .prompt-textarea:focus { outline: none; border-color: #9333ea; box-shadow: 0 0 0 3px #f3e8ff; }

  .custom-badge {
    font-size: 0.75rem; font-weight: 600;
    background: #f3e8ff; color: #7e22ce;
    padding: 0.25rem 0.6rem; border-radius: 20px;
    align-self: flex-start;
  }
  .default-badge {
    font-size: 0.75rem; font-weight: 600;
    background: #f1f5f9; color: #64748b;
    padding: 0.25rem 0.6rem; border-radius: 20px;
    align-self: flex-start;
  }

  .prompt-modal-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; gap: 0.75rem;
  }
  .footer-right { display: flex; align-items: center; gap: 0.75rem; }
  .saved-msg { font-size: 0.82rem; color: #10b981; display: flex; align-items: center; gap: 0.3rem; }

  .btn-reset {
    padding: 0.45rem 1rem; border: 1px solid #d1d5db;
    background: white; border-radius: 6px;
    font-size: 0.82rem; font-family: inherit;
    cursor: pointer; color: #64748b;
  }
  .btn-reset:hover:not(:disabled) { background: #f8fafc; }
  .btn-reset:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Suggestions */
  .suggestions-panel {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .suggestions-header {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.85rem; font-weight: 600; color: #92400e;
  }
  .suggestions-header i { font-size: 1rem; color: #f59e0b; }
  .suggestions-spinner { border-top-color: #f59e0b; border-color: rgba(245,158,11,0.3); }
  .no-suggestions { font-size: 0.82rem; color: #92400e; margin: 0; }

  .suggestion-card {
    background: white;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex; flex-direction: column; gap: 0.5rem;
    transition: border-color 0.15s;
  }
  .suggestion-card.approved { border-color: #6ee7b7; background: #f0fdf4; }

  .suggestion-top {
    display: flex; justify-content: space-between;
    align-items: flex-start; gap: 1rem; flex-wrap: wrap;
  }
  .suggestion-meta { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
  .suggestion-label { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
  .suggestion-reason { font-size: 0.78rem; color: #64748b; }

  .suggestion-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }

  .btn-toggle-preview {
    padding: 0.3rem 0.7rem;
    border: 1px solid #d1d5db; background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: #475569; cursor: pointer;
  }
  .btn-toggle-preview:hover { border-color: #9333ea; color: #7e22ce; }

  .btn-reject {
    padding: 0.3rem 0.7rem;
    border: 1px solid #fca5a5; background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: #dc2626; cursor: pointer;
  }
  .btn-reject:hover { background: #fef2f2; }

  .btn-approve {
    padding: 0.3rem 0.7rem;
    border: none; background: #9333ea;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: white; cursor: pointer; font-weight: 500;
  }
  .btn-approve:hover { background: #7e22ce; }

  .approved-badge {
    font-size: 0.78rem; font-weight: 600;
    color: #059669; display: flex; align-items: center; gap: 0.3rem;
  }

  .suggestion-preview {
    border-top: 1px solid #fde68a;
    padding-top: 0.625rem;
    font-size: 0.82rem; line-height: 1.6; color: #334155;
  }
  .suggestion-preview :global(h3) { font-size: 0.875rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
  .suggestion-preview :global(h3:first-child) { margin-top: 0; }
  .suggestion-preview :global(p) { margin: 0 0 0.4rem; }
  .suggestion-preview :global(ul) { margin: 0 0 0.4rem; padding-left: 1.25rem; }
</style>
