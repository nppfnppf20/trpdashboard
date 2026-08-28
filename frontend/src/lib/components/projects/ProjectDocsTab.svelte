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
  import { processMeetingNote } from '$lib/api/meetingNotes.js';

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
    { value: 'meeting_notes',        label: 'Meeting Notes' },
    { value: 'other',                label: 'Other' }
  ];

  const KEY_DOC_TYPES = [
    { value: 'briefing_transcript',  label: 'Briefing Transcript' },
    { value: 'about_applicant',      label: 'About the Applicant' },
    { value: 'proposed_development', label: 'Proposed Development' },
    { value: 'site_surroundings',    label: 'Site and Surroundings' },
    { value: 'pre_app',              label: 'Pre-app Response' },
    { value: 'eia_response',         label: 'EIA Response' },
    { value: 'sci',                  label: 'SCI' },
  ];

  $: missingDocTypes = KEY_DOC_TYPES.filter(t => !summaries.some(s => s.doc_type === t.value));

  const TYPE_COLOURS = {
    about_applicant:     '#0ea5e9',
    proposed_development: '#6366f1',
    pre_app:             '#3b82f6',
    eia_response:        '#10b981',
    sci:                 '#f59e0b',
    site_surroundings:   '#8b5cf6',
    briefing_transcript: '#f43f5e',
    meeting_notes:       '#14b8a6',
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
        title: `${suggestion.label}: from Briefing Transcript`,
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

  // Meeting notes extra fields
  let meetingTitle = '';
  let meetingDate = '';
  let meetingAttendeesText = '';
  let meetingAgenda = '';
  let meetingUserNotes = '';
  let meetingProcessing = false;
  let meetingError = null;
  let meetingResult = null; // { transcript, summary, actions }

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
      expandedIds = new Set(summaries.map(s => s.id));
    } catch (err) {
      listError = err.message;
    } finally {
      listLoading = false;
    }
  }

  function uploadMissingType(typeValue) {
    docType = typeValue;
    mode = 'upload';
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
    meetingTitle = '';
    meetingDate = '';
    meetingAttendeesText = '';
    meetingAgenda = '';
    meetingUserNotes = '';
    meetingError = null;
    meetingResult = null;
  }

  async function runMeetingNote() {
    if (!meetingTitle.trim()) { meetingError = 'Please enter a title.'; return; }
    if (inputTab === 'upload' && !selectedFile) { meetingError = 'Please select a file.'; return; }
    if (inputTab === 'paste' && !pasteText.trim()) { meetingError = 'Please paste some text.'; return; }

    meetingProcessing = true;
    meetingError = null;
    meetingResult = null;
    try {
      const payload = {
        title: meetingTitle,
        meetingDate: meetingDate || null,
        attendeesText: meetingAttendeesText || null,
        agenda: meetingAgenda || null,
        userNotes: meetingUserNotes || null
      };
      if (inputTab === 'upload') {
        payload.file = selectedFile;
      } else {
        payload.text = pasteText;
        payload.fileName = 'Pasted text';
      }
      meetingResult = await processMeetingNote(projectId, payload);
    } catch (err) {
      meetingError = err.message;
    } finally {
      meetingProcessing = false;
    }
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
      expandedIds = new Set([entry.id, ...expandedIds]);
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
    const next = new Set(expandedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    expandedIds = next;
  }

  function isExpanded(id) {
    return expandedIds.has(id);
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

  <!-- Missing docs indicator -->
  {#if !listLoading && missingDocTypes.length > 0}
    <div class="missing-docs">
      <span class="missing-label"><i class="las la-exclamation-circle"></i> Missing:</span>
      {#each missingDocTypes as t}
        <button class="missing-pill" on:click={() => uploadMissingType(t.value)}>{t.label}</button>
      {/each}
    </div>
  {/if}

  <!-- Upload & Summarise Panel -->
  {#if mode === 'upload'}
    <div class="panel">
      <div class="panel-row">
        <div class="field">
          <label>Document Type</label>
          <select bind:value={docType} on:change={() => { showResult = false; meetingResult = null; meetingError = null; }}>
            {#each DOC_TYPES as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </div>
        {#if docType !== 'meeting_notes'}
          <button class="btn-prompt" on:click={openPromptModal}>
            <i class="las la-sliders-h"></i> Edit Prompt
          </button>
        {/if}
      </div>

      {#if docType === 'meeting_notes'}
        <!-- Meeting Notes extra fields -->
        <div class="meeting-fields">
          <div class="field">
            <label>Title <span class="required">*</span></label>
            <input type="text" bind:value={meetingTitle} placeholder="e.g. Project kick-off meeting" />
          </div>
          <div class="field">
            <label>Meeting Date</label>
            <input type="date" bind:value={meetingDate} />
          </div>
          <div class="field meeting-field-full">
            <label>Attendees</label>
            <input type="text" bind:value={meetingAttendeesText} placeholder="e.g. Josh Rogers, Sarah Jones, Client team" />
          </div>
          <div class="field meeting-field-full">
            <label>Agenda <span class="notes-hint">(optional, if provided summary will be structured under each item)</span></label>
            <textarea
              class="meeting-notes-area"
              bind:value={meetingAgenda}
              placeholder="e.g.&#10;1. Project programme update&#10;2. Design review feedback&#10;3. Planning strategy&#10;4. AOB"
              rows="4"
            ></textarea>
          </div>
          <div class="field meeting-field-full">
            <label>Your Notes <span class="notes-hint">(key points, actions or headlines, always featured prominently)</span></label>
            <textarea
              class="meeting-notes-area"
              bind:value={meetingUserNotes}
              placeholder="e.g. Main outcome: planning permission unlikely without heritage consultant. Actions: instruct heritage consultant by end of month, revisit design to reduce height…"
              rows="4"
            ></textarea>
          </div>
        </div>
      {/if}

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

      {#if docType === 'meeting_notes'}
        {#if meetingError}
          <div class="error-msg">{meetingError}</div>
        {/if}
        {#if meetingResult}
          <div class="meeting-saved-notice">
            <i class="las la-check-circle"></i>
            <div>
              <strong>Saved to Meeting Notes.</strong>
              {meetingResult.actions.length} action{meetingResult.actions.length !== 1 ? 's' : ''} extracted.
              View them in the <strong>Meeting Notes</strong> tab.
            </div>
            <button class="btn-cancel-sm" on:click={() => setMode(null)}>Done</button>
          </div>
        {:else}
          <button class="btn-summarise" on:click={runMeetingNote} disabled={meetingProcessing}>
            {#if meetingProcessing}
              <span class="spinner-sm"></span> Processing…
            {:else}
              <i class="las la-magic"></i> Process & Save
            {/if}
          </button>
        {/if}
      {:else}
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
        <div class="summary-card">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="summary-card-header" on:click={() => toggleExpand(s.id)}>
            <div class="summary-meta">
              {#if s.doc_type}
                <span class="type-badge" style="background:{TYPE_COLOURS[s.doc_type] ?? '#64748b'}22; color:{TYPE_COLOURS[s.doc_type] ?? '#64748b'}">
                  {getTypeLabel(s.doc_type)}
                </span>
              {/if}
              {#if s.document_ref}
                <span class="ref-chip">{s.document_ref}</span>
              {/if}
              <span class="summary-title-inline">{s.title}</span>
            </div>
            <div class="summary-actions">
              <span class="expand-hint">{isExpanded(s.id) ? 'Hide' : 'View'}</span>
              <i class="las la-{isExpanded(s.id) ? 'chevron-up' : 'chevron-down'} expand-chevron"></i>
              <button class="icon-btn danger" on:click|stopPropagation={() => removeSummary(s.id)} title="Delete">
                <i class="las la-trash"></i>
              </button>
            </div>
          </div>
          {#if s.file_name}
            <div class="file-name-chip"><i class="las la-file"></i> {s.file_name}</div>
          {/if}
          {#if isExpanded(s.id)}
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
        <h3>Edit Prompt: {getTypeLabel(promptDocType)}</h3>
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
  .docs-header h3 { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--color-slate-800); }
  .docs-header p { margin: 0; font-size: 0.8rem; color: var(--color-slate-500); max-width: 500px; }

  .header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .btn-action {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: var(--color-purple-600); color: white;
    border: none; border-radius: 6px;
    font-size: 0.85rem; font-weight: 500; cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-action:hover { background: var(--color-purple-700); }
  .btn-action.secondary { background: white; color: var(--color-slate-600); border: 1px solid var(--color-slate-300); }
  .btn-action.secondary:hover { background: var(--color-slate-50); }
  .btn-action.tertiary { background: var(--color-violet-50); color: var(--color-violet-600); border: 1px solid var(--color-violet-200); }
  .btn-action.tertiary:hover { background: var(--color-violet-100); }
  .btn-action.active { outline: 2px solid var(--color-purple-600); outline-offset: 2px; }

  .missing-docs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.6rem 0.875rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 8px;
    font-size: 0.8rem;
  }

  .missing-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-amber-800);
    font-weight: 600;
    flex-shrink: 0;
  }

  .missing-label i { color: var(--color-amber-500); }

  .missing-pill {
    padding: 0.2rem 0.55rem;
    background: white;
    border: 1px solid var(--color-yellow-300);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-amber-800);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s, border-color 0.1s;
  }

  .missing-pill:hover {
    background: var(--color-amber-100);
    border-color: var(--color-amber-500);
  }

  .panel {
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .panel-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
  .flex-1 { flex: 1; }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); }
  .required { color: var(--color-red-500); }

  input[type="text"], select, textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
  }
  input[type="text"]:focus, select:focus, textarea:focus {
    outline: none; border-color: var(--color-purple-600); box-shadow: 0 0 0 3px var(--color-violet-100);
  }
  textarea { resize: vertical; }

  .btn-prompt {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.45rem 0.9rem;
    background: white; border: 1px solid var(--color-slate-300);
    border-radius: 6px; font-size: 0.8rem;
    font-family: inherit; color: var(--color-slate-600); cursor: pointer;
    white-space: nowrap; align-self: flex-end;
  }
  .btn-prompt:hover { border-color: var(--color-purple-600); color: var(--color-purple-700); }

  .input-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--color-violet-200); }
  .input-tab {
    padding: 0.4rem 1rem;
    border: none; background: none;
    font-size: 0.82rem; font-family: inherit;
    color: var(--color-slate-500); cursor: pointer; border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .input-tab.active { color: var(--color-purple-700); border-bottom-color: var(--color-purple-600); font-weight: 600; }

  .dropzone {
    border: 2px dashed var(--color-slate-300);
    border-radius: 8px;
    padding: 2rem;
    display: flex; flex-direction: column;
    align-items: center; gap: 0.75rem;
    background: white; color: var(--color-slate-500); text-align: center;
    cursor: default; transition: border-color 0.15s;
  }
  .dropzone.dragover { border-color: var(--color-purple-600); background: var(--color-purple-50); }
  .upload-icon { font-size: 2.5rem; color: var(--color-purple-600); }
  .dropzone p { margin: 0; font-size: 0.85rem; }

  .file-label {
    padding: 0.4rem 1rem;
    background: var(--color-purple-600); color: white;
    border-radius: 6px; font-size: 0.82rem;
    cursor: pointer; font-weight: 500;
  }
  .file-label input { display: none; }

  .file-selected {
    display: flex; align-items: center; gap: 0.75rem;
    font-size: 0.85rem; color: var(--color-slate-800); font-weight: 500;
  }
  .file-selected i { font-size: 1.25rem; color: var(--color-purple-600); }
  .remove-file {
    background: none; border: none; color: var(--color-slate-400);
    font-size: 1.1rem; cursor: pointer; padding: 0; line-height: 1;
  }
  .remove-file:hover { color: var(--color-red-500); }

  .paste-area { width: 100%; box-sizing: border-box; }

  .error-msg {
    font-size: 0.8rem; color: var(--color-red-600);
    background: var(--color-red-50); border: 1px solid var(--color-red-200);
    border-radius: 6px; padding: 0.5rem 0.75rem;
  }

  .btn-summarise {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.6rem 1.25rem;
    background: var(--color-purple-600); color: white;
    border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 500;
    cursor: pointer; font-family: inherit;
    align-self: flex-start;
  }
  .btn-summarise:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-summarise:disabled { opacity: 0.6; cursor: not-allowed; }

  .spinner-sm {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .result-panel {
    background: white;
    border: 1px solid var(--color-violet-200);
    border-radius: 8px;
    padding: 1rem;
    display: flex; flex-direction: column; gap: 0.875rem;
  }
  .result-fields { display: flex; gap: 1rem; flex-wrap: wrap; }
  .result-fields .field { flex: 1; min-width: 200px; }

  .summary-label { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); margin-bottom: 0.3rem; }
  .editable-hint { font-weight: 400; color: var(--color-slate-400); font-size: 0.72rem; margin-left: 0.4rem; }

  .summary-content {
    border: 1px solid var(--color-slate-300); border-radius: 6px;
    padding: 0.75rem; min-height: 120px;
    font-size: 0.85rem; line-height: 1.6; color: var(--color-slate-800);
    background: var(--color-slate-50);
  }
  .summary-content:focus { outline: none; border-color: var(--color-purple-600); box-shadow: 0 0 0 3px var(--color-violet-100); }
  .summary-content :global(h3) { font-size: 0.9rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .summary-content :global(p) { margin: 0 0 0.5rem; }
  .summary-content :global(ul) { margin: 0 0 0.5rem; padding-left: 1.25rem; }

  .result-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

  .btn-cancel-sm {
    padding: 0.45rem 1rem; border: 1px solid var(--color-slate-300);
    background: white; border-radius: 6px;
    font-size: 0.85rem; font-family: inherit;
    cursor: pointer; color: var(--color-slate-500);
  }
  .btn-cancel-sm:hover { background: var(--color-slate-50); }

  .btn-save {
    padding: 0.45rem 1.1rem; background: var(--color-purple-600);
    color: white; border: none; border-radius: 6px;
    font-size: 0.85rem; font-weight: 500;
    font-family: inherit; cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

  /* List */
  .summary-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .loading-state, .error-state, .empty-state {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.5rem;
    padding: 3rem; color: var(--color-slate-400); text-align: center;
  }
  .error-state i { font-size: 2rem; color: var(--color-red-500); }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p, .loading-state p { margin: 0; font-size: 0.875rem; }

  .spinner {
    width: 2rem; height: 2rem;
    border: 3px solid var(--color-slate-100); border-top-color: var(--color-purple-600);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .summary-card {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 10px;
    padding: 1rem;
    display: flex; flex-direction: column; gap: 0.5rem;
  }

  .summary-card-header {
    display: flex; justify-content: space-between;
    align-items: center; gap: 0.5rem;
    cursor: pointer; border-radius: 6px;
    padding: 0.25rem 0.25rem;
    margin: -0.25rem -0.25rem;
    transition: background 0.1s;
  }
  .summary-card-header:hover { background: var(--color-slate-50); }
  .summary-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; flex: 1; min-width: 0; }
  .summary-title-inline {
    font-size: 0.9rem; font-weight: 600; color: var(--color-slate-800);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .expand-hint { font-size: 0.75rem; color: var(--color-purple-600); font-weight: 500; white-space: nowrap; }
  .expand-chevron { font-size: 0.9rem; color: var(--color-purple-600); }

  .type-badge {
    font-size: 0.7rem; font-weight: 600;
    padding: 0.2rem 0.5rem; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .ref-chip {
    font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600);
    background: var(--color-slate-100); padding: 0.2rem 0.5rem;
    border-radius: 4px; font-family: monospace;
  }

  .summary-actions { display: flex; gap: 0.375rem; flex-shrink: 0; align-items: center; }
  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 6px; color: var(--color-slate-500); font-size: 0.95rem;
  }
  .icon-btn:hover { background: var(--color-slate-100); color: var(--color-slate-800); }
  .icon-btn.danger:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .summary-title { font-size: 0.9rem; font-weight: 600; color: var(--color-slate-800); }
  .file-name-chip { font-size: 0.75rem; color: var(--color-slate-400); display: flex; gap: 0.3rem; align-items: center; }

  .summary-body {
    border-top: 1px solid var(--color-slate-100);
    padding-top: 0.75rem;
    font-size: 0.85rem; line-height: 1.6; color: var(--color-slate-700);
  }
  .summary-body :global(h3) { font-size: 0.875rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: var(--color-slate-800); }
  .summary-body :global(h3:first-child) { margin-top: 0; }
  .summary-body :global(p) { margin: 0 0 0.5rem; }
  .summary-body :global(ul) { margin: 0 0 0.5rem; padding-left: 1.25rem; }

  /* Prompt modal */
  .modal-backdrop {
    position: fixed; inset: 0;
    background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 2000; padding: 1rem;
  }
  .prompt-modal {
    background: white; border-radius: 12px;
    width: 100%; max-width: 680px;
    display: flex; flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
    max-height: 90vh; overflow: hidden;
  }
  .prompt-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200);
  }
  .prompt-modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--color-slate-800); }
  .close-btn {
    background: none; border: none; font-size: 1.75rem;
    color: var(--color-slate-500); cursor: pointer; padding: 0; line-height: 1;
  }
  .close-btn:hover { color: var(--color-slate-800); }

  .prompt-modal-body {
    padding: 1.25rem 1.5rem; flex: 1; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .prompt-textarea {
    width: 100%; box-sizing: border-box; resize: vertical;
    font-family: 'Courier New', monospace; font-size: 0.82rem;
    line-height: 1.5; color: var(--color-slate-800);
    border: 1px solid var(--color-slate-300); border-radius: 6px; padding: 0.75rem;
  }
  .prompt-textarea:focus { outline: none; border-color: var(--color-purple-600); box-shadow: 0 0 0 3px var(--color-violet-100); }

  .custom-badge {
    font-size: 0.75rem; font-weight: 600;
    background: var(--color-violet-100); color: var(--color-purple-700);
    padding: 0.25rem 0.6rem; border-radius: 20px;
    align-self: flex-start;
  }
  .default-badge {
    font-size: 0.75rem; font-weight: 600;
    background: var(--color-slate-100); color: var(--color-slate-500);
    padding: 0.25rem 0.6rem; border-radius: 20px;
    align-self: flex-start;
  }

  .prompt-modal-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.5rem; border-top: 1px solid var(--color-slate-200); gap: 0.75rem;
  }
  .footer-right { display: flex; align-items: center; gap: 0.75rem; }
  .saved-msg { font-size: 0.82rem; color: var(--color-emerald-500); display: flex; align-items: center; gap: 0.3rem; }

  .btn-reset {
    padding: 0.45rem 1rem; border: 1px solid var(--color-slate-300);
    background: white; border-radius: 6px;
    font-size: 0.82rem; font-family: inherit;
    cursor: pointer; color: var(--color-slate-500);
  }
  .btn-reset:hover:not(:disabled) { background: var(--color-slate-50); }
  .btn-reset:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Suggestions */
  .suggestions-panel {
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .suggestions-header {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.85rem; font-weight: 600; color: var(--color-amber-800);
  }
  .suggestions-header i { font-size: 1rem; color: var(--color-amber-500); }
  .suggestions-spinner { border-top-color: var(--color-amber-500); border-color: rgba(245, 158, 11, 0.3); }
  .no-suggestions { font-size: 0.82rem; color: var(--color-amber-800); margin: 0; }

  .suggestion-card {
    background: white;
    border: 1px solid var(--color-amber-200);
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex; flex-direction: column; gap: 0.5rem;
    transition: border-color 0.15s;
  }
  .suggestion-card.approved { border-color: var(--color-slate-400); background: var(--color-slate-100); }

  .suggestion-top {
    display: flex; justify-content: space-between;
    align-items: flex-start; gap: 1rem; flex-wrap: wrap;
  }
  .suggestion-meta { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
  .suggestion-label { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }
  .suggestion-reason { font-size: 0.78rem; color: var(--color-slate-500); }

  .suggestion-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }

  .btn-toggle-preview {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-slate-300); background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: var(--color-slate-600); cursor: pointer;
  }
  .btn-toggle-preview:hover { border-color: var(--color-purple-600); color: var(--color-purple-700); }

  .btn-reject {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-red-200); background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: var(--color-red-600); cursor: pointer;
  }
  .btn-reject:hover { background: var(--color-red-50); }

  .btn-approve {
    padding: 0.3rem 0.7rem;
    border: none; background: var(--color-purple-600);
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: white; cursor: pointer; font-weight: 500;
  }
  .btn-approve:hover { background: var(--color-purple-700); }

  .approved-badge {
    font-size: 0.78rem; font-weight: 600;
    color: var(--color-emerald-600); display: flex; align-items: center; gap: 0.3rem;
  }

  .suggestion-preview {
    border-top: 1px solid var(--color-amber-200);
    padding-top: 0.625rem;
    font-size: 0.82rem; line-height: 1.6; color: var(--color-slate-700);
  }
  .suggestion-preview :global(h3) { font-size: 0.875rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
  .suggestion-preview :global(h3:first-child) { margin-top: 0; }
  .suggestion-preview :global(p) { margin: 0 0 0.4rem; }
  .suggestion-preview :global(ul) { margin: 0 0 0.4rem; padding-left: 1.25rem; }

  .meeting-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .meeting-field-full { grid-column: 1 / -1; }
  input[type="date"] {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    background: var(--color-white);
    color: var(--color-slate-800);
  }
  .notes-hint { font-weight: 400; color: var(--color-slate-400); font-style: italic; }
  .meeting-notes-area {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    background: var(--color-white);
    color: var(--color-slate-800);
    resize: vertical;
    line-height: 1.5;
  }
  .meeting-notes-area:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.125); }

  .meeting-saved-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    border-radius: 8px;
    padding: 0.9rem 1rem;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: var(--color-green-800);
  }
  .meeting-saved-notice i { font-size: 1.2rem; flex-shrink: 0; margin-top: 0.1rem; }
  .meeting-saved-notice div { flex: 1; line-height: 1.5; }
</style>
