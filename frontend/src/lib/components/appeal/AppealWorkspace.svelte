<script>
  import { onMount } from 'svelte';
  import { getKeyIssues, updateKeyIssueSummary, getIssueNotes, getDocumentLog, getArgumentPoints, uploadDraftExample, getDraftContext } from '$lib/api/appeal.js';
  import { issueNotes, noteStatus, initNotes, handleNoteInput, loadBriefingNotes, briefingNotes, selectedBriefingNoteId, briefingDropdownOpen, briefingUploadOpen, briefingUploadTab, briefingUploadFile, briefingUploadText, briefingUploadTitle, briefingUploadLoading, openBriefingUpload, submitBriefingUpload, selectBriefingNote, briefingDraftOpen, briefingDraftLoading, briefingDraftSuggestions, briefingDraftSkipped, briefingEvolveState, runDraftFromBriefing, runDraftFromIssueSummaries, startEvolveArgument, applyEvolvedArgument, acceptBriefingDraftSuggestion, skipBriefingDraftSuggestion, closeBriefingDraft, sendChatMessage, keyIssueDraftOpen, keyIssueDraftLoading, keyIssueDraftSuggestions, keyIssueDraftAccepted, keyIssueDraftSkipped, keyIssueDropdownOpen, keyIssueSelectedNoteId, runKeyIssueDraftFromBriefing, acceptKeyIssueSummary, skipKeyIssueSummary, closeKeyIssueDraft } from '$lib/stores/appeal-notes.js';
  import { documentLog, logModalOpen, logTitle, logCode, logSummary, logPoints, logSaving, initLog, openLogModal, removeLogPoint, saveLogEntry, editModalOpen, editTitle, editCode, editSummary, editPoints, editSaving, openEditModal, removeEditPoint, saveEditEntry, deleteEntry } from '$lib/stores/appeal-log.js';
  import { activeInputTab, selectedFile, documentType, documentDirection, userNotes, selectedTrackIds, dragOver, pasteText, analysisState, analysisError, analysisSummary, analysisCoverage, extractedPoints, acceptedPoints, activePoints, pointsByIssue, promptModalOpen, promptText, promptLoading, promptSaving, promptSaved, promptIsCustom, initAnalysis, onDrop, onFileInputChange, toggleTrack, dismissPoint, acceptPoint, openPromptModal, savePrompt, resetPromptToDefault, runAnalysis, runAnalysisWithPrompt, resetAnalysis } from '$lib/stores/appeal-analysis.js';
  import { suggestInputTab, suggestFile, suggestPasteText, suggestDocumentType, suggestDocumentTitle, suggestDirection, suggestUserNotes, suggestTrackIds, suggestState, conversation, suggestError, refinementInput, refinementLoading, acceptLoading, acceptedIssues, suggestPromptOpen, suggestPromptText, suggestPromptLoading, suggestPromptSaving, suggestPromptSaved, suggestPromptIsCustom, initSuggestion, onSuggestDrop, onSuggestFileChange, toggleSuggestTrack, runSuggestion, sendRefinement, acceptSuggestion, resetSuggestion, openSuggestPromptModal, saveSuggestPrompt, resetSuggestPromptToDefault, runSuggestionWithPrompt, openSuggestionLogModal } from '$lib/stores/appeal-suggestion.js';
  import { draftTypes, drafts, draftGenerating, activeDraftTypeId, draftEditorHtml, draftSaving, draftSaved, sectionsModalOpen, sectionsTypeName, sections, sectionsLoading, newSectionName, addingSectionLoading, sectionGenerating, sectionExpandedId, sectionPromptText, sectionPromptSaving, sectionPromptSaved, sectionExampleModalOpen, sectionExampleId, sectionExampleSaving, sectionExampleSaved, initDrafts, loadDraftTypes, setDraftEditor, setSectionExampleEditor, handleGenerate, openDraft, closeDraft, handleSaveDraft, openSectionsModal, handleAddSection, handleDeleteSection, moveSectionUp, moveSectionDown, toggleSectionExpand, handleSaveSectionPrompt, openSectionExampleModal, handleSaveSectionExample, handleGenerateSection } from '$lib/stores/appeal-drafts.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import AppealDocIncorporatePanel from '$lib/components/appeal/AppealDocIncorporatePanel.svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';

  const DOC_TYPES = [
    'Officer Report',
    'Refusal Notice',
    'Appeal Decision',
    'Planning Statement',
    'Proof of Evidence',
    'Expert Report',
    'Consultation Response',
    'Other'
  ];

  let fileInput;
  let suggestFileInput;
  let chatEndEl;

  $: if ($conversation.length && chatEndEl) setTimeout(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }), 50);

  let draftEditor;
  let sectionExampleEditor;

  $: setDraftEditor(draftEditor);
  $: setSectionExampleEditor(sectionExampleEditor);

  export let project;

  let activeTab = 'key-issues';

  let keyIssues = [];
  let loading = true;
  let loadError = null;
  let argumentPointsByTrack = {};
  let expandedPoints = {};

  function toggleExpanded(id) {
    expandedPoints = { ...expandedPoints, [id]: !expandedPoints[id] };
  }

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [issues, notes, log, points] = await Promise.all([
        getKeyIssues(project.id),
        getIssueNotes(project.id),
        getDocumentLog(project.id),
        getArgumentPoints(project.id).catch(() => [])
      ]);
      keyIssues = issues;
      initAnalysis(project.id);
      initSuggestion(project.id);
      initDrafts(project.id);
      initNotes(project.id, notes);
      initLog(log);
      const grouped = {};
      for (const pt of points) {
        if (!grouped[pt.track_id]) grouped[pt.track_id] = [];
        grouped[pt.track_id].push(pt);
      }
      argumentPointsByTrack = grouped;
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
    // Run independently — failures must not block the rest of the workspace
    await Promise.all([loadDraftTypes(), loadBriefingNotes(project.id)]);
  }

  function clickOutside(node, handler) {
    function onClick(e) { if (!node.contains(e.target)) handler(); }
    document.addEventListener('click', onClick, true);
    return { destroy() { document.removeEventListener('click', onClick, true); } };
  }


  function autoresize(node, _value) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      update() { resize(); },
      destroy() { node.removeEventListener('input', resize); }
    };
  }

  const riskColours = {
    showstopper:         { bg: '#fee2e2', colour: '#991b1b' },
    extremely_high_risk: { bg: '#fee2e2', colour: '#dc2626' },
    high_risk:           { bg: '#ffedd5', colour: '#c2410c' },
    medium_high_risk:    { bg: '#fef9c3', colour: '#a16207' },
    medium_risk:         { bg: '#fef9c3', colour: '#ca8a04' },
    medium_low_risk:     { bg: '#dcfce7', colour: '#15803d' },
    low_risk:            { bg: '#dcfce7', colour: '#16a34a' }
  };

  let exportingWord = false;
  let incorporateReviewMode = false;

  // Per-type example doc upload state — filenames seeded from loaded drafts
  let exampleUploading = {};
  let exampleFileInputs = {};
  let _exampleFilenameOverrides = {};
  $: exampleFilenames = {
    ...Object.fromEntries(
      Object.entries($drafts).filter(([,d]) => d?.example_doc_filename).map(([id, d]) => [id, d.example_doc_filename])
    ),
    ..._exampleFilenameOverrides
  };

  async function handleExampleUpload(typeId, file) {
    if (!file) return;
    exampleUploading = { ...exampleUploading, [typeId]: true };
    try {
      const result = await uploadDraftExample(project.id, typeId, file);
      _exampleFilenameOverrides = { ..._exampleFilenameOverrides, [typeId]: result.filename };
    } catch (err) {
      console.error('Example upload failed:', err);
    } finally {
      exampleUploading = { ...exampleUploading, [typeId]: false };
    }
  }
  $: if (!$activeDraftTypeId) { incorporateReviewMode = false; contextPanelOpen = false; contextData = null; }

  let contextPanelOpen = false;
  let contextData = null;
  let contextLoading = false;
  let contextExpanded = { guidingBrief: true, projectBrief: false, exampleDoc: true };

  async function toggleContextPanel() {
    if (contextPanelOpen) { contextPanelOpen = false; return; }
    incorporateReviewMode = false;
    contextPanelOpen = true;
    if (!contextData) {
      contextLoading = true;
      try { contextData = await getDraftContext(project.id, $activeDraftTypeId); }
      catch (err) { console.error('Failed to load context:', err); }
      finally { contextLoading = false; }
    }
  }

  async function handleExportToWord() {
    const html = draftEditor?.getHTML();
    if (!html) return;
    const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId);
    const filename = activeType?.name ?? 'appeal_document';
    exportingWord = true;
    try {
      await exportHtmlToWord(html, filename, '/basicdocument.docx');
    } finally {
      exportingWord = false;
    }
  }
</script>

<div class="workspace">

  <!-- Header -->
  <div class="workspace-header">
    <div class="header-info">
      <h1>{project.project_name}</h1>
      {#if project.project_id}<span class="project-ref">{project.project_id}</span>{/if}
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'key-issues'} on:click={() => activeTab = 'key-issues'}>
      Key Issues
    </button>
    <button class="tab" class:active={activeTab === 'argument'} on:click={() => activeTab = 'argument'}>
      Argument Structure
    </button>
    <button class="tab" class:active={activeTab === 'draft'} on:click={() => activeTab = 'draft'}>
      Draft Document
    </button>
    <button class="tab" class:active={activeTab === 'log'} on:click={() => activeTab = 'log'}>
      Document Log
    </button>
  </div>

  <!-- Body -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

  {:else if loadError}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{loadError}</p>
      <button on:click={load}>Retry</button>
    </div>

  {:else if activeTab === 'key-issues'}
    <!-- ── Tab 1: Key Issues ── -->
    <div class="tab-body">
      {#if keyIssues.length > 0}
        <div class="key-issues-toolbar">
          <div class="briefing-btn-group" use:clickOutside={() => $keyIssueDropdownOpen = false}>
            <button class="btn-draft-from-briefing" on:click={() => runKeyIssueDraftFromBriefing(project.id, $keyIssueSelectedNoteId)}>
              <i class="las la-lightbulb"></i> Draft issue notes from briefing
              {#if $keyIssueSelectedNoteId}
                {@const note = $briefingNotes.find(n => n.id === $keyIssueSelectedNoteId)}
                {#if note}<span class="briefing-note-pill">{note.title || note.file_name}</span>{/if}
              {/if}
            </button>
            <button class="btn-briefing-chevron" on:click={() => $keyIssueDropdownOpen = !$keyIssueDropdownOpen} title="Select briefing note">
              <i class="las la-angle-down"></i>
            </button>
            {#if $keyIssueDropdownOpen}
              <div class="briefing-dropdown">
                <button class="briefing-dropdown-item" class:active={$keyIssueSelectedNoteId === null} on:click={() => { $keyIssueSelectedNoteId = null; $keyIssueDropdownOpen = false; }}>
                  <span>Latest briefing note</span>
                </button>
                {#each $briefingNotes as note}
                  <button class="briefing-dropdown-item" class:active={$keyIssueSelectedNoteId === note.id} on:click={() => { $keyIssueSelectedNoteId = note.id; $keyIssueDropdownOpen = false; }}>
                    <span class="briefing-dropdown-title">{note.title || note.file_name}</span>
                    <span class="briefing-dropdown-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </button>
                {/each}
                <button class="briefing-dropdown-item briefing-dropdown-upload" on:click={openBriefingUpload}>
                  <i class="las la-plus"></i> Upload new briefing note
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      {#if keyIssues.length === 0}
        <div class="empty-state">
          <i class="las la-list-alt"></i>
          <p>No key issues have been added to this project yet. Add them via the project workflow.</p>
        </div>
      {:else}
        <div class="issues-list">
          {#each keyIssues as issue (issue.id)}
            {@const risk = riskColours[issue.last_known_risk_level]}
            <div class="issue-card">
              <div class="issue-top">
                <div class="issue-label">
                  {#if issue.discipline}
                    <span class="discipline-tag">{issue.discipline.replace(/_/g, ' ')}</span>
                  {/if}
                  <span class="issue-name">{issue.label}</span>
                </div>
                {#if issue.last_known_risk_level}
                  <span class="risk-chip" style="background:{risk?.bg ?? '#f1f5f9'}; color:{risk?.colour ?? '#64748b'}">
                    {issue.last_known_risk_level.replace(/_/g, ' ')}
                  </span>
                {/if}
              </div>
              <textarea
                class="summary-field"
                placeholder="Add notes on this issue — position, key evidence, approach..."
                value={issue.summary ?? ''}
                use:autoresize={issue.summary}
                on:blur={(e) => updateKeyIssueSummary(issue.id, e.target.value)}
              ></textarea>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'argument'}
    <!-- ── Tab 2: Argument Structure ── -->
    <div class="argument-body">

      <!-- Left: per-issue notes -->
      <div class="argument-panel">
        <div class="argument-panel-toolbar">
          <button class="btn-from-issue-notes" on:click={() => runDraftFromIssueSummaries(project.id)}>
            <i class="las la-file-alt"></i> Build from issue notes
          </button>
          <div class="briefing-btn-group" use:clickOutside={() => $briefingDropdownOpen = false}>
            <button class="btn-draft-from-briefing" on:click={() => runDraftFromBriefing(project.id, $selectedBriefingNoteId)}>
              <i class="las la-lightbulb"></i> Draft from briefing
              {#if $selectedBriefingNoteId}
                {@const note = $briefingNotes.find(n => n.id === $selectedBriefingNoteId)}
                {#if note}<span class="briefing-note-pill">{note.title || note.file_name}</span>{/if}
              {/if}
            </button>
            <button class="btn-briefing-chevron" on:click={() => $briefingDropdownOpen = !$briefingDropdownOpen} title="Select briefing note">
              <i class="las la-angle-down"></i>
            </button>
            {#if $briefingDropdownOpen}
              <div class="briefing-dropdown">
                <button class="briefing-dropdown-item" class:active={$selectedBriefingNoteId === null} on:click={() => selectBriefingNote(null)}>
                  <span>Latest briefing note</span>
                </button>
                {#each $briefingNotes as note}
                  <button class="briefing-dropdown-item" class:active={$selectedBriefingNoteId === note.id} on:click={() => selectBriefingNote(note.id)}>
                    <span class="briefing-dropdown-title">{note.title || note.file_name}</span>
                    <span class="briefing-dropdown-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </button>
                {/each}
                <button class="briefing-dropdown-item briefing-dropdown-upload" on:click={openBriefingUpload}>
                  <i class="las la-plus"></i> Upload new briefing note
                </button>
              </div>
            {/if}
          </div>
        </div>
        {#if keyIssues.length === 0}
          <div class="empty-state">
            <i class="las la-list-alt"></i>
            <p>No key issues found. Add them in the Key Issues tab first.</p>
          </div>
        {:else}
          <div class="argument-list">
            {#each keyIssues as issue (issue.id)}
              {@const risk = riskColours[issue.last_known_risk_level]}
              {@const issuePoints = argumentPointsByTrack[issue.id] ?? []}
              {@const againstPoints = issuePoints.filter(p => p.field === 'argument_against')}
              {@const forPoints = issuePoints.filter(p => p.field === 'argument_for')}
              <div class="argument-section">
                <div class="argument-heading">
                  <div class="argument-title-row">
                    {#if issue.discipline}
                      <span class="discipline-tag">{issue.discipline.replace(/_/g, ' ')}</span>
                    {/if}
                    <h2 class="argument-issue-title">{issue.label}</h2>
                    {#if issue.last_known_risk_level}
                      <span class="risk-chip" style="background:{risk?.bg ?? '#f1f5f9'}; color:{risk?.colour ?? '#64748b'}">
                        {issue.last_known_risk_level.replace(/_/g, ' ')}
                      </span>
                    {/if}
                  </div>
                  {#if $noteStatus[issue.id] === 'saving'}
                    <span class="note-status saving"><div class="mini-spinner"></div> Saving</span>
                  {:else if $noteStatus[issue.id] === 'saved'}
                    <span class="note-status saved"><i class="las la-check"></i> Saved</span>
                  {/if}
                </div>
                <div class="note-fields">
                  <div class="note-field-group against">
                    <label class="note-label against-label">Argument Against</label>
                    {#if againstPoints.length > 0}
                      <div class="arg-points-list">
                        {#each againstPoints as pt (pt.id)}
                          {@const ev = pt.evidence?.[0]}
                          <div class="arg-point-row">
                            <span class="arg-point-headline">{pt.headline}</span>
                            {#if pt.detailed_summary || ev?.relevance_note}
                              <button class="arg-point-info" title="View detail" on:click={() => toggleExpanded(pt.id)}>
                                <i class="las la-info-circle"></i>
                              </button>
                            {/if}
                          </div>
                          {#if expandedPoints[pt.id] && (pt.detailed_summary || ev?.relevance_note)}
                            <div class="arg-point-detail">
                              {#if pt.detailed_summary}<p>{pt.detailed_summary}</p>{/if}
                              {#if ev?.relevance_note}
                                <span class="citation-ref-strong">{ev.relevance_note}</span>
                              {/if}
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                    <textarea
                      class="notes-field against-field"
                      placeholder="Paste the refusal reason, inspector's objection, or opposing position..."
                      value={$issueNotes[issue.id]?.argument_against ?? ''}
                      use:autoresize={$issueNotes[issue.id]?.argument_against}
                      on:input={(e) => handleNoteInput(issue.id, 'argument_against', e.target.value)}
                    ></textarea>
                  </div>
                  <div class="note-field-group for">
                    <label class="note-label for-label">Argument For</label>
                    {#if forPoints.length > 0}
                      <div class="arg-points-list">
                        {#each forPoints as pt (pt.id)}
                          {@const ev = pt.evidence?.[0]}
                          <div class="arg-point-row">
                            <span class="arg-point-headline">{pt.headline}</span>
                            {#if pt.detailed_summary || ev?.relevance_note}
                              <button class="arg-point-info" title="View detail" on:click={() => toggleExpanded(pt.id)}>
                                <i class="las la-info-circle"></i>
                              </button>
                            {/if}
                          </div>
                          {#if expandedPoints[pt.id] && (pt.detailed_summary || ev?.relevance_note)}
                            <div class="arg-point-detail">
                              {#if pt.detailed_summary}<p>{pt.detailed_summary}</p>{/if}
                              {#if ev?.relevance_note}
                                <span class="citation-ref-strong">{ev.relevance_note}</span>
                              {/if}
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                    <textarea
                      class="notes-field for-field"
                      placeholder="Our response — evidence, policy hooks, expert position, how we address the objection..."
                      value={$issueNotes[issue.id]?.argument_for ?? ''}
                      use:autoresize={$issueNotes[issue.id]?.argument_for}
                      on:input={(e) => handleNoteInput(issue.id, 'argument_for', e.target.value)}
                    ></textarea>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right: argument suggestion panel -->
      <div class="input-panel">

        {#if $suggestState === 'loading'}
          <div class="analysis-loading">
            <div class="spinner"></div>
            <p>Reading document and building suggestion...</p>
          </div>

        {:else if $suggestState === 'chat'}
          <!-- Chat thread -->
          <div class="chat-header">
            <span class="results-title">Argument suggestion</span>
            <div class="results-header-actions">
              {#if Object.keys($acceptedIssues).length > 0}
                <button class="log-btn" on:click={openSuggestionLogModal}>
                  <i class="las la-save"></i> Log document
                </button>
              {/if}
              <button class="reset-btn" on:click={resetSuggestion}><i class="las la-arrow-left"></i> New document</button>
            </div>
          </div>

          <div class="chat-thread">
            {#each $conversation as msg, i}
              {#if msg.role === 'assistant'}
                {@const isLast = i === $conversation.length - 1 || $conversation.slice(i + 1).every(m => m.role === 'user')}
                {@const field = $suggestDirection === 'for' ? 'argument_for' : 'argument_against'}
                <div class="chat-msg assistant">
                  <div class="chat-prose">{msg.content}</div>
                  {#if isLast}
                    <div class="chat-msg-actions">
                      {#if $suggestTrackIds.length === 1}
                        {@const issue = keyIssues.find(i => i.id === $suggestTrackIds[0])}
                        <button
                          class="accept-btn"
                          class:accepted={$acceptedIssues[$suggestTrackIds[0]]}
                          on:click={() => acceptSuggestion($suggestTrackIds[0], field, msg.content, issue?.label ?? '')}
                        >
                          {#if $acceptedIssues[$suggestTrackIds[0]]}
                            <i class="las la-check"></i> Accepted into {issue?.label ?? 'issue'}
                          {:else}
                            <i class="las la-check"></i> Accept into {issue?.label ?? 'issue'} ({$suggestDirection === 'for' ? 'for' : 'against'})
                          {/if}
                        </button>
                      {:else}
                        <div class="accept-multi">
                          {#each ($suggestTrackIds.length > 0 ? keyIssues.filter(i => $suggestTrackIds.includes(i.id)) : keyIssues) as issue}
                            <button
                              class="accept-btn accept-btn-sm"
                              class:accepted={$acceptedIssues[issue.id]}
                              on:click={() => acceptSuggestion(issue.id, field, msg.content, issue.label)}
                            >
                              {#if $acceptedIssues[issue.id]}
                                <i class="las la-check"></i> {issue.label}
                              {:else}
                                Accept → {issue.label}
                              {/if}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="chat-msg user">
                  <p>{msg.content}</p>
                </div>
              {/if}
            {/each}
            {#if $refinementLoading}
              <div class="chat-msg assistant loading-msg">
                <div class="mini-spinner"></div><span>Revising...</span>
              </div>
            {/if}
            <div bind:this={chatEndEl}></div>
          </div>

          <div class="chat-input-row">
            <textarea
              class="chat-input"
              bind:value={$refinementInput}
              placeholder="Ask for changes — e.g. 'make the first paragraph more specific to heritage impact'..."
              rows="2"
              on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRefinement(); } }}
            ></textarea>
            <button class="chat-send-btn" disabled={!$refinementInput.trim() || $refinementLoading} on:click={sendRefinement}>
              <i class="las la-paper-plane"></i>
            </button>
          </div>

          {#if $suggestError}
            <p class="analysis-error">{$suggestError}</p>
          {/if}

        {:else}
          <!-- Idle: upload / paste form -->
          <div class="input-tabs">
            <button class="input-tab" class:active={$suggestInputTab === 'upload'} on:click={() => $suggestInputTab = 'upload'}>
              <i class="las la-file-upload"></i> Upload
            </button>
            <button class="input-tab" class:active={$suggestInputTab === 'paste'} on:click={() => $suggestInputTab = 'paste'}>
              <i class="las la-paste"></i> Paste Text
            </button>
          </div>

          <div class="idle-form">

            <div class="form-row">
              <label class="form-label">Document is</label>
              <div class="direction-toggle">
                <button class="direction-btn" class:active={$suggestDirection === 'for'} on:click={() => $suggestDirection = 'for'}>
                  In favour of appellant's case
                </button>
                <button class="direction-btn" class:active={$suggestDirection === 'against'} on:click={() => $suggestDirection = 'against'}>
                  Against appellant's case
                </button>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Document type</label>
              <select class="doc-type-select" bind:value={$suggestDocumentType}>
                {#each DOC_TYPES as t}<option>{t}</option>{/each}
              </select>
            </div>

            <div class="form-row">
              <label class="form-label">Document title <span class="form-label-hint">(used in prose references)</span></label>
              <input class="add-section-input" type="text" bind:value={$suggestDocumentTitle} placeholder="e.g. Officer's Report, Land at Station Road" />
            </div>

            {#if $suggestInputTab === 'upload'}
              <div
                class="upload-zone"
                class:has-file={$suggestFile}
                on:dragover|preventDefault
                on:drop={onSuggestDrop}
                on:click={() => suggestFileInput.click()}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && suggestFileInput.click()}
              >
                {#if $suggestFile}
                  <i class="las la-file-alt"></i>
                  <span>{$suggestFile.name}</span>
                  <span class="upload-sub">Click to change</span>
                {:else}
                  <i class="las la-cloud-upload-alt"></i>
                  <span>Drop a PDF or click to upload</span>
                  <span class="upload-sub">PDF, TXT or MD · max 20MB</span>
                {/if}
              </div>
              <input type="file" accept=".pdf,.txt,.md" bind:this={suggestFileInput} on:change={onSuggestFileChange} style="display:none" />
            {:else}
              <textarea
                class="paste-area"
                bind:value={$suggestPasteText}
                placeholder="Paste text from a document, report or meeting notes here..."
              ></textarea>
            {/if}

            <div class="form-row">
              <label class="form-label">Your guidance <span class="form-label-hint">(optional)</span></label>
              <textarea
                class="user-notes-field"
                bind:value={$suggestUserNotes}
                placeholder="e.g. Focus on paragraph 5.3, the officer accepts the heritage impact is less than substantial..."
              ></textarea>
            </div>

            {#if keyIssues.length > 0}
              <div class="form-row">
                <label class="form-label">Issues <span class="form-label-hint">(leave blank for all)</span></label>
                <div class="issue-checks">
                  {#each keyIssues as issue}
                    <label class="issue-check-label">
                      <input
                        type="checkbox"
                        checked={$suggestTrackIds.includes(issue.id)}
                        on:change={() => toggleSuggestTrack(issue.id)}
                      />
                      <span>{issue.label}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="analyse-row">
              <button
                class="analyse-btn"
                disabled={$suggestInputTab === 'upload' ? !$suggestFile : !$suggestPasteText.trim()}
                on:click={runSuggestion}
              >
                <i class="las la-magic"></i> Get suggestion
              </button>
              <button
                class="prompt-btn"
                on:click={openSuggestPromptModal}
                title="View and edit the prompt before running"
              >
                <i class="las la-code"></i> Edit prompt
              </button>
            </div>

            {#if $suggestError}
              <p class="analysis-error">{$suggestError}</p>
            {/if}

          </div>
        {/if}

      </div>

    </div>

  {:else if activeTab === 'log'}
    <!-- ── Tab 4: Document Log ── -->
    <div class="tab-body">
      {#if $documentLog.length === 0}
        <div class="empty-state">
          <i class="las la-file-alt"></i>
          <p>No documents logged yet. Analyse a document, tick the useful arguments, then click "Save to log".</p>
        </div>
      {:else}
        <div class="log-list">
          {#each $documentLog as entry (entry.id)}
            <div class="log-card">
              <div class="log-card-header">
                <div class="log-card-title-row">
                  <span class="log-card-title">{entry.title}</span>
                  {#if entry.code}<span class="log-card-code">{entry.code}</span>{/if}
                </div>
                <div class="log-card-header-right">
                  <span class="log-card-date">{new Date(entry.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <button class="log-action-btn" title="Edit" on:click={() => openEditModal(entry)}><i class="las la-pen"></i></button>
                  <button class="log-action-btn log-action-delete" title="Delete" on:click={() => { if (confirm('Delete this log entry?')) deleteEntry(entry.id); }}><i class="las la-trash"></i></button>
                </div>
              </div>
              {#if entry.document_summary}
                <p class="log-card-summary">{entry.document_summary}</p>
              {/if}
              {#if entry.argument_points?.length > 0}
                <div class="log-points">
                  {#each entry.argument_points as pt}
                    <div class="log-point">
                      <div class="log-point-meta">
                        <span class="result-field-tag" class:against={pt.field === 'argument_against'} class:for={pt.field === 'argument_for'}>
                          {pt.field === 'argument_against' ? 'Against' : 'For'}
                        </span>
                        <span class="log-point-issue">{pt.issue_label}</span>
                      </div>
                      <p class="log-point-text">{pt.point}</p>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'draft'}
    <!-- ── Tab 3: Draft Document ── -->
    {#if $activeDraftTypeId !== null}
      <!-- Two-panel editor view -->
      {@const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId)}
      <div class="draft-editor-bar">
        <button class="reset-btn" on:click={() => { incorporateReviewMode = false; closeDraft(); }}><i class="las la-arrow-left"></i> Documents</button>
        <span class="draft-editor-title">{activeType?.name ?? ''}</span>
        <div class="draft-editor-actions">
          <button class="draft-regen-btn" disabled={$draftGenerating === $activeDraftTypeId} on:click={() => handleGenerate($activeDraftTypeId)}>
            {#if $draftGenerating === $activeDraftTypeId}<div class="mini-spinner"></div> Generating...{:else}<i class="las la-sync"></i> Regenerate{/if}
          </button>
          <button class="draft-context-btn" class:active={contextPanelOpen} on:click={toggleContextPanel} title="View prompt context — guiding brief, project brief, example doc">
            <i class="las la-layer-group"></i> Context
          </button>
          <button class="draft-save-btn" disabled={$draftSaving} on:click={handleSaveDraft}>
            {#if $draftSaving}Saving...{:else if $draftSaved}<i class="las la-check"></i> Saved{:else}Save{/if}
          </button>
          <button class="draft-save-btn" disabled={exportingWord} on:click={handleExportToWord}>
            {#if exportingWord}<div class="mini-spinner"></div> Exporting...{:else}<i class="las la-file-word"></i> Export{/if}
          </button>
        </div>
      </div>

      <!-- Two-panel layout -->
      <div class="draft-two-panel">
        <div class="draft-left-panel" class:panel-hidden={incorporateReviewMode}>
          <RichTextEditor bind:this={draftEditor} content={$draftEditorHtml} on:change={() => { $draftSaved = false; }} />
        </div>
        <div class="draft-right-panel" class:draft-right-panel--full={incorporateReviewMode}>
          {#if contextPanelOpen}
            <div class="context-panel">
              <div class="context-panel-header">
                <span class="context-panel-title"><i class="las la-layer-group"></i> Prompt context</span>
                <button class="context-panel-close" on:click={() => contextPanelOpen = false}><i class="las la-times"></i></button>
              </div>
              {#if contextLoading}
                <div class="context-panel-loading"><div class="spinner"></div><span>Loading...</span></div>
              {:else}
                <div class="context-panel-body">

                  <!-- Guiding brief -->
                  <div class="context-block">
                    <button class="context-block-header" on:click={() => contextExpanded.guidingBrief = !contextExpanded.guidingBrief}>
                      <span class="context-block-label"><i class="las la-book"></i> Guiding brief</span>
                      <span class="context-block-status {contextData?.guidingBrief ? 'status-set' : 'status-missing'}">
                        {contextData?.guidingBrief ? contextData.guidingBrief.name : 'Not set'}
                      </span>
                      <i class="las la-angle-{contextExpanded.guidingBrief ? 'up' : 'down'} context-chevron"></i>
                    </button>
                    {#if contextExpanded.guidingBrief && contextData?.guidingBrief?.content}
                      <div class="context-block-body">{contextData.guidingBrief.content}</div>
                    {:else if contextExpanded.guidingBrief}
                      <p class="context-block-empty">No guiding brief set for this document type. Add one in Admin Console → Guiding Briefs.</p>
                    {/if}
                  </div>

                  <!-- Project brief -->
                  <div class="context-block">
                    <button class="context-block-header" on:click={() => contextExpanded.projectBrief = !contextExpanded.projectBrief}>
                      <span class="context-block-label"><i class="las la-file-alt"></i> Project brief</span>
                      <span class="context-block-status {contextData?.projectBrief ? 'status-set' : 'status-missing'}">
                        {contextData?.projectBrief ? 'Set' : 'Not set'}
                      </span>
                      <i class="las la-angle-{contextExpanded.projectBrief ? 'up' : 'down'} context-chevron"></i>
                    </button>
                    {#if contextExpanded.projectBrief && contextData?.projectBrief}
                      <div class="context-block-body">{@html contextData.projectBrief}</div>
                    {:else if contextExpanded.projectBrief}
                      <p class="context-block-empty">No project brief uploaded. Upload a briefing note via the planning application tool.</p>
                    {/if}
                  </div>

                  <!-- Example doc -->
                  <div class="context-block">
                    <button class="context-block-header" on:click={() => contextExpanded.exampleDoc = !contextExpanded.exampleDoc}>
                      <span class="context-block-label"><i class="las la-file-code"></i> Example document</span>
                      <span class="context-block-status {contextData?.exampleDoc ? 'status-set' : 'status-missing'}">
                        {contextData?.exampleDoc ? contextData.exampleDoc.filename : 'Not set'}
                      </span>
                      <i class="las la-angle-{contextExpanded.exampleDoc ? 'up' : 'down'} context-chevron"></i>
                    </button>
                    {#if contextExpanded.exampleDoc}
                      {#if contextData?.exampleDoc}
                        <div class="context-block-body">
                          <p class="context-example-filename"><i class="las la-check-circle" style="color:#16a34a"></i> {contextData.exampleDoc.filename}</p>
                          <p class="context-example-hint">This document's tone and structure are being used as a reference in all generation prompts.</p>
                          <button class="context-example-replace" on:click={() => exampleFileInputs[$activeDraftTypeId]?.click()}>
                            <i class="las la-exchange-alt"></i> Replace
                          </button>
                        </div>
                      {:else}
                        <div class="context-block-body">
                          <p class="context-block-empty">No example document uploaded. Upload one from the draft type list to guide tone and structure.</p>
                        </div>
                      {/if}
                    {/if}
                  </div>

                </div>
              {/if}
            </div>
          {:else}
          <AppealDocIncorporatePanel
            {project}
            typeId={$activeDraftTypeId}
            {keyIssues}
            currentDraftHtml={$draftEditorHtml}
            on:reviewchange={(e) => { incorporateReviewMode = e.detail.active; }}
            on:accepted={(e) => {
              $draftEditorHtml = e.detail.html;
              draftEditor?.setHTML(e.detail.html);
              $draftSaved = false;
              incorporateReviewMode = false;
            }}
          />
          {/if}
        </div>
      </div>
    {:else}
      <!-- Document type list -->
      <div class="tab-body">
        <div class="draft-types-list">
          {#each $draftTypes as type (type.id)}
            {@const draft = $drafts[type.id]}
            <div class="draft-type-card">
              <div class="draft-type-main">
                <div class="draft-type-info">
                  <span class="draft-type-name">{type.name}</span>
                  {#if type.description}<span class="draft-type-desc">{type.description}</span>{/if}
                  {#if draft?.generated_at}
                    <span class="draft-type-meta">Last generated {new Date(draft.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {/if}
                </div>
                <div class="draft-type-actions">
                  {#if draft}
                    <button class="draft-open-btn" on:click={() => openDraft(type.id)}>Open</button>
                  {/if}
                  <button class="draft-generate-btn" disabled={$draftGenerating === type.id} on:click={() => handleGenerate(type.id)}>
                    {#if $draftGenerating === type.id}
                      <div class="mini-spinner"></div> Generating...
                    {:else}
                      <i class="las la-magic"></i> {draft ? 'Regenerate' : 'Generate'}
                    {/if}
                  </button>
                </div>
              </div>
              <div class="draft-type-settings">
                <button class="draft-setting-btn" on:click={() => openSectionsModal(type.id)}>
                  <i class="las la-layer-group"></i> Configure sections
                </button>
                <button
                  class="draft-setting-btn"
                  disabled={exampleUploading[type.id]}
                  on:click={() => exampleFileInputs[type.id]?.click()}
                  title="Upload an example document — used as tone and structure reference in all prompts"
                >
                  {#if exampleUploading[type.id]}
                    <div class="mini-spinner"></div> Uploading...
                  {:else if exampleFilenames[type.id]}
                    <i class="las la-file-check"></i> Example: {exampleFilenames[type.id]}
                  {:else}
                    <i class="las la-file-upload"></i> Upload example doc
                  {/if}
                </button>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  style="display:none"
                  bind:this={exampleFileInputs[type.id]}
                  on:change={(e) => { handleExampleUpload(type.id, e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

</div>

<!-- Save to log modal -->
{#if $logModalOpen}
  <div class="modal-overlay" on:click|self={() => $logModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal modal-log">
      <div class="modal-header">
        <span class="modal-title">Save to Document Log</span>
        <button class="modal-close" on:click={() => $logModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body log-modal-body">
        <div class="log-form">
          <div class="log-form-row">
            <div class="log-form-field">
              <label class="section-field-label">Document title <span style="color:#ef4444">*</span></label>
              <input class="add-section-input" type="text" bind:value={$logTitle} placeholder="e.g. Officer Report — Land at Station Road" />
            </div>
            <div class="log-form-field log-form-field-sm">
              <label class="section-field-label">Reference / code</label>
              <input class="add-section-input" type="text" bind:value={$logCode} placeholder="e.g. CD/1.2" />
            </div>
          </div>

          {#if $logSummary}
            <div class="log-form-field">
              <label class="section-field-label">Document summary</label>
              <textarea class="prompt-editor" style="min-height:80px;resize:vertical" bind:value={$logSummary}></textarea>
            </div>
          {/if}

          <div class="log-form-field">
            <label class="section-field-label">Arguments used ({$logPoints.length})</label>
            {#if $logPoints.length === 0}
              <p class="sections-empty" style="padding:0.5rem 0;text-align:left">No arguments were ticked during analysis. You can add them manually after saving.</p>
            {:else}
              <div class="log-points-editor">
                {#each $logPoints as lp, i (lp.id)}
                  <div class="log-point-edit">
                    <div class="log-point-edit-header">
                      <span class="result-field-tag" class:against={lp.field === 'argument_against'} class:for={lp.field === 'argument_for'}>
                        {lp.field === 'argument_against' ? 'Against' : 'For'}
                      </span>
                      <span class="log-point-issue">{lp.issue_label}</span>
                      <button class="section-delete-btn" style="margin-left:auto" on:click={() => removeLogPoint(lp.id)} title="Remove"><i class="las la-times"></i></button>
                    </div>
                    <textarea class="notes-field" style="min-height:60px" bind:value={$logPoints[i].text} use:autoresize={$logPoints[i].text}></textarea>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $logModalOpen = false}>Cancel</button>
          <button class="modal-run" disabled={!$logTitle.trim() || $logSaving} on:click={() => saveLogEntry(project.id)}>
            {$logSaving ? 'Saving...' : 'Save to log'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit log entry modal -->
{#if $editModalOpen}
  <div class="modal-overlay" on:click|self={() => $editModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal modal-log">
      <div class="modal-header">
        <span class="modal-title">Edit Log Entry</span>
        <button class="modal-close" on:click={() => $editModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body log-modal-body">
        <div class="log-form">
          <div class="log-form-row">
            <div class="log-form-field">
              <label class="section-field-label">Document title <span style="color:#ef4444">*</span></label>
              <input class="add-section-input" type="text" bind:value={$editTitle} placeholder="e.g. Officer Report — Land at Station Road" />
            </div>
            <div class="log-form-field log-form-field-sm">
              <label class="section-field-label">Reference / code</label>
              <input class="add-section-input" type="text" bind:value={$editCode} placeholder="e.g. CD/1.2" />
            </div>
          </div>

          <div class="log-form-field">
            <label class="section-field-label">Document summary</label>
            <textarea class="prompt-editor" style="min-height:80px;resize:vertical" bind:value={$editSummary}></textarea>
          </div>

          {#if $editPoints.length > 0}
            <div class="log-form-field">
              <label class="section-field-label">Arguments ({$editPoints.length})</label>
              <div class="log-points-editor">
                {#each $editPoints as ep, i (ep.id)}
                  <div class="log-point-edit">
                    <div class="log-point-edit-header">
                      <span class="result-field-tag" class:against={ep.field === 'argument_against'} class:for={ep.field === 'argument_for'}>
                        {ep.field === 'argument_against' ? 'Against' : 'For'}
                      </span>
                      <span class="log-point-issue">{ep.issue_label}</span>
                      <button class="section-delete-btn" style="margin-left:auto" on:click={() => removeEditPoint(ep.id)} title="Remove"><i class="las la-times"></i></button>
                    </div>
                    <textarea class="notes-field" style="min-height:60px" bind:value={$editPoints[i].point} use:autoresize={$editPoints[i].point}></textarea>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $editModalOpen = false}>Cancel</button>
          <button class="modal-run" disabled={!$editTitle.trim() || $editSaving} on:click={saveEditEntry}>
            {$editSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Sections manager modal -->
{#if $sectionsModalOpen}
  <div class="modal-overlay" on:click|self={() => $sectionsModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal modal-sections">
      <div class="modal-header">
        <span class="modal-title">Sections — {$sectionsTypeName}</span>
        <button class="modal-close" on:click={() => $sectionsModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body sections-body">
        {#if $sectionsLoading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading...</span></div>
        {:else}
          {#if $sections.length === 0}
            <p class="sections-empty">No sections yet. Add one below to define the structure of this document.</p>
          {:else}
            <div class="sections-list">
              {#each $sections as section, idx (section.id)}
                <div class="section-row" class:expanded={$sectionExpandedId === section.id}>
                  <div class="section-row-header">
                    <div class="section-order-btns">
                      <button class="section-order-btn" disabled={idx === 0} on:click={() => moveSectionUp(idx)} title="Move up"><i class="las la-angle-up"></i></button>
                      <button class="section-order-btn" disabled={idx === $sections.length - 1} on:click={() => moveSectionDown(idx)} title="Move down"><i class="las la-angle-down"></i></button>
                    </div>
                    <span class="section-name">{section.name}</span>
                    <div class="section-row-actions">
                      <button class="section-generate-btn" disabled={$sectionGenerating === section.id} on:click={() => handleGenerateSection(section.id)} title="Generate this section">
                        {#if $sectionGenerating === section.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                      </button>
                      <button class="section-edit-btn" on:click={() => toggleSectionExpand(section.id)}>
                        {$sectionExpandedId === section.id ? 'Close' : 'Edit'}
                      </button>
                      <button class="section-delete-btn" on:click={() => handleDeleteSection(section.id)} title="Delete section">
                        <i class="las la-trash"></i>
                      </button>
                    </div>
                  </div>

                  {#if $sectionExpandedId === section.id}
                    <div class="section-expand">
                      <label class="section-field-label">Generation prompt <span class="form-label-hint">(leave blank for default)</span></label>
                      <textarea class="prompt-editor section-prompt" bind:value={$sectionPromptText} use:autoresize={$sectionPromptText}></textarea>
                      <div class="section-expand-actions">
                        <button class="section-example-btn" on:click={() => openSectionExampleModal(section.id)}>
                          <i class="las la-file-alt"></i> Edit style example
                        </button>
                        <button class="modal-save" disabled={$sectionPromptSaving} on:click={() => handleSaveSectionPrompt(section.id)}>
                          {#if $sectionPromptSaving}Saving...{:else if $sectionPromptSaved}<i class="las la-check"></i> Saved{:else}Save prompt{/if}
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="add-section-row">
            <input
              class="add-section-input"
              type="text"
              placeholder="New section name..."
              bind:value={$newSectionName}
              on:keydown={(e) => e.key === 'Enter' && handleAddSection()}
            />
            <button class="add-section-btn" disabled={!$newSectionName.trim() || $addingSectionLoading} on:click={handleAddSection}>
              {#if $addingSectionLoading}<div class="mini-spinner"></div>{:else}<i class="las la-plus"></i>{/if}
              Add
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Section example sub-modal -->
{#if $sectionExampleModalOpen}
  {@const exSection = $sections.find(s => s.id === $sectionExampleId)}
  <div class="modal-overlay" on:click|self={() => $sectionExampleModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal modal-wide">
      <div class="modal-header">
        <span class="modal-title">Style Example — {exSection?.name}</span>
        <button class="modal-close" on:click={() => $sectionExampleModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        <p class="prompt-hint">Paste an example of how this section should read. The AI will match its tone and format.</p>
        <div class="example-editor-wrap">
          <RichTextEditor bind:this={sectionExampleEditor} placeholder="Paste an example here..." />
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $sectionExampleModalOpen = false}>Cancel</button>
          <button class="modal-save" disabled={$sectionExampleSaving} on:click={handleSaveSectionExample}>
            {#if $sectionExampleSaving}Saving...{:else if $sectionExampleSaved}<i class="las la-check"></i> Saved{:else}Save example{/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Suggestion prompt modal -->
{#if $suggestPromptOpen}
  <div class="modal-overlay" on:click|self={() => $suggestPromptOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-header-left">
          <span class="modal-title">Argument Suggestion Prompt</span>
          {#if $suggestPromptIsCustom}
            <span class="prompt-custom-badge">Custom saved</span>
          {:else}
            <span class="prompt-default-badge">Default</span>
          {/if}
        </div>
        <button class="modal-close" on:click={() => $suggestPromptOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        {#if $suggestPromptLoading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
        {:else}
          <p class="prompt-hint"><code>&#123;&#123;DOCUMENT&#125;&#125;</code> is replaced with the full document text when running.</p>
          <textarea class="prompt-editor" bind:value={$suggestPromptText}></textarea>
        {/if}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left">
          {#if $suggestPromptIsCustom}
            <button class="modal-reset" on:click={resetSuggestPromptToDefault} disabled={$suggestPromptLoading}>
              Reset to default
            </button>
          {/if}
        </div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $suggestPromptOpen = false}>Cancel</button>
          <button class="modal-save" disabled={$suggestPromptLoading || $suggestPromptSaving || !$suggestPromptText} on:click={saveSuggestPrompt}>
            {#if $suggestPromptSaving}Saving...{:else if $suggestPromptSaved}<i class="las la-check"></i> Saved{:else}Save as default{/if}
          </button>
          <button class="modal-run" disabled={$suggestPromptLoading || !$suggestPromptText} on:click={runSuggestionWithPrompt}>
            Run with this prompt
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Briefing upload modal -->
{#if $briefingUploadOpen}
  <div class="modal-overlay" on:click|self={() => $briefingUploadOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Upload Briefing Note</span>
        <button class="modal-close" on:click={() => $briefingUploadOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="input-tabs" style="margin: -1rem -1.5rem 1rem; padding: 0 1.5rem;">
          <button class="input-tab" class:active={$briefingUploadTab === 'upload'} on:click={() => $briefingUploadTab = 'upload'}>
            <i class="las la-file-upload"></i> Upload file
          </button>
          <button class="input-tab" class:active={$briefingUploadTab === 'paste'} on:click={() => $briefingUploadTab = 'paste'}>
            <i class="las la-paste"></i> Paste text
          </button>
        </div>
        <div class="form-row" style="margin-bottom:0.75rem">
          <label class="section-field-label">Title <span class="form-label-hint">(optional)</span></label>
          <input class="add-section-input" type="text" bind:value={$briefingUploadTitle} placeholder="e.g. Pre-app meeting notes — Jan 2025" />
        </div>
        {#if $briefingUploadTab === 'upload'}
          <div
            class="upload-zone"
            class:has-file={$briefingUploadFile}
            on:dragover|preventDefault
            on:drop={(e) => { e.preventDefault(); $briefingUploadFile = e.dataTransfer?.files[0] ?? null; }}
            on:click={() => { const el = document.createElement('input'); el.type='file'; el.accept='.pdf,.txt,.md'; el.onchange = (e) => { $briefingUploadFile = e.target.files?.[0] ?? null; }; el.click(); }}
            role="button" tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && e.currentTarget.click()}
          >
            {#if $briefingUploadFile}
              <i class="las la-file-alt"></i>
              <span>{$briefingUploadFile.name}</span>
              <span class="upload-sub">Click to change</span>
            {:else}
              <i class="las la-cloud-upload-alt"></i>
              <span>Drop a PDF or click to upload</span>
              <span class="upload-sub">PDF, TXT or MD · max 20MB</span>
            {/if}
          </div>
        {:else}
          <textarea class="paste-area" style="min-height:180px" bind:value={$briefingUploadText} placeholder="Paste meeting notes, transcript, or briefing text here..."></textarea>
        {/if}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $briefingUploadOpen = false}>Cancel</button>
          <button class="modal-run" disabled={$briefingUploadLoading || ($briefingUploadTab === 'upload' ? !$briefingUploadFile : !$briefingUploadText.trim())} on:click={() => submitBriefingUpload(project.id)}>
            {$briefingUploadLoading ? 'Uploading...' : 'Upload & analyse'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Draft arguments from briefing modal -->
{#if $briefingDraftOpen}
  <div class="modal-overlay" on:click|self={closeBriefingDraft} role="dialog" aria-modal="true">
    <div class="modal modal-briefing-draft">
      <div class="modal-header">
        <span class="modal-title">Draft arguments from briefing</span>
        <button class="modal-close" on:click={closeBriefingDraft}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        {#if $briefingDraftLoading}
          <div class="briefing-draft-loading">
            <div class="mini-spinner"></div>
            <span>Analysing briefing and drafting arguments…</span>
          </div>
        {:else if $briefingDraftSuggestions.length === 0}
          <p class="briefing-draft-empty">No suggestions returned.</p>
        {:else}
          <p class="briefing-draft-intro">Review the suggested changes below. Click "Evolve argument" to see how the AI proposes to rework the existing argument, then refine or apply it.</p>
          <div class="briefing-draft-list">
            {#each $briefingDraftSuggestions as s (s.track_id)}
              {@const skipped = $briefingDraftSkipped.has(s.track_id)}
              {@const evolve = $briefingEvolveState[s.track_id]}
              <div class="briefing-draft-card" class:bd-skipped={skipped} class:bd-applied={evolve?.applied}>
                <div class="bd-card-header">
                  <span class="bd-issue-label">{s.label}</span>
                  {#if evolve?.applied}
                    <span class="bd-status bd-status-accepted"><i class="las la-check"></i> Applied</span>
                  {:else if skipped}
                    <span class="bd-status bd-status-skipped">Skipped</span>
                  {:else if !evolve}
                    <div class="bd-actions">
                      <button class="bd-btn-accept" on:click={() => acceptBriefingDraftSuggestion(s.track_id, s.argument_for)}>
                        <i class="las la-check"></i> Accept as is
                      </button>
                      <button class="bd-btn-evolve" on:click={() => startEvolveArgument(s.track_id)}>
                        <i class="las la-magic"></i> Evolve argument
                      </button>
                      <button class="bd-btn-skip" on:click={() => skipBriefingDraftSuggestion(s.track_id)}>Skip</button>
                    </div>
                  {/if}
                </div>
                <div class="bd-new-info">
                  <span class="bd-new-info-label">From briefing</span>
                  <p class="bd-argument-text">{s.argument_for}</p>
                </div>
                {#if evolve && !evolve.applied}
                  <div class="bd-evolve-panel">
                    {#if evolve.evolved}
                      <div class="bd-evolve-result">
                        <span class="bd-evolved-label">Proposed argument</span>
                        <p class="bd-evolved-text">{evolve.evolved}</p>
                      </div>
                    {/if}
                    <div class="bd-evolve-chat">
                      {#if evolve.loading}
                        <div class="bd-evolve-loading"><div class="mini-spinner"></div><span>Reworking argument…</span></div>
                      {:else}
                        <textarea
                          class="bd-chat-input"
                          placeholder={evolve.evolved ? 'Ask for further changes…' : 'What changes do you want? e.g. focus more on heritage impacts, make it more concise…'}
                          rows="2"
                          value={evolve.input}
                          on:input={(e) => briefingEvolveState.update(st => ({ ...st, [s.track_id]: { ...st[s.track_id], input: e.target.value } }))}
                          on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(project.id, s.track_id); } }}
                        ></textarea>
                      {/if}
                      <div class="bd-evolve-actions">
                        <button class="bd-chat-send" disabled={!evolve.input?.trim() || evolve.loading} on:click={() => sendChatMessage(project.id, s.track_id)}>
                          <i class="las la-paper-plane"></i>
                        </button>
                        {#if evolve.evolved}
                          <button class="bd-btn-apply" on:click={() => applyEvolvedArgument(s.track_id)}>
                            <i class="las la-check"></i> Apply
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Key issue draft modal -->
{#if $keyIssueDraftOpen}
  <div class="modal-overlay" on:click|self={closeKeyIssueDraft} role="dialog" aria-modal="true">
    <div class="modal modal-briefing-draft">
      <div class="modal-header">
        <span class="modal-title">Draft issue notes from briefing</span>
        <button class="modal-close" on:click={closeKeyIssueDraft}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        {#if $keyIssueDraftLoading}
          <div class="briefing-draft-loading"><div class="mini-spinner"></div><span>Analysing briefing and drafting notes…</span></div>
        {:else if $keyIssueDraftSuggestions.length === 0}
          <p class="briefing-draft-empty">No suggestions returned.</p>
        {:else}
          <p class="briefing-draft-intro">Review the suggested notes below. Accept the ones you want to apply to your key issues.</p>
          <div class="briefing-draft-list">
            {#each $keyIssueDraftSuggestions as s (s.track_id)}
              {@const accepted = $keyIssueDraftAccepted.has(s.track_id)}
              {@const skipped = $keyIssueDraftSkipped.has(s.track_id)}
              <div class="briefing-draft-card" class:bd-applied={accepted} class:bd-skipped={skipped}>
                <div class="bd-card-header">
                  <span class="bd-issue-label">{s.label}</span>
                  {#if accepted}
                    <span class="bd-status bd-status-accepted"><i class="las la-check"></i> Applied</span>
                  {:else if skipped}
                    <span class="bd-status bd-status-skipped">Skipped</span>
                  {:else}
                    <div class="bd-actions">
                      <button class="bd-btn-accept" on:click={() => acceptKeyIssueSummary(s.track_id, s.summary)}>
                        <i class="las la-check"></i> Accept
                      </button>
                      <button class="bd-btn-skip" on:click={() => skipKeyIssueSummary(s.track_id)}>Skip</button>
                    </div>
                  {/if}
                </div>
                <p class="bd-argument-text">{s.summary}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Prompt modal -->
{#if $promptModalOpen}
  <div class="modal-overlay" on:click|self={() => $promptModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-header-left">
          <span class="modal-title">Extraction Prompt</span>
          {#if $promptIsCustom}
            <span class="prompt-custom-badge">Custom saved</span>
          {:else}
            <span class="prompt-default-badge">Default</span>
          {/if}
        </div>
        <button class="modal-close" on:click={() => $promptModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        {#if $promptLoading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
        {:else}
          <p class="prompt-hint"><code>&#123;&#123;DOCUMENT&#125;&#125;</code> is replaced with your document text when running.</p>
          <textarea class="prompt-editor" bind:value={$promptText}></textarea>
        {/if}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left">
          {#if $promptIsCustom}
            <button class="modal-reset" on:click={resetPromptToDefault} disabled={$promptLoading}>
              Reset to default
            </button>
          {/if}
        </div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => $promptModalOpen = false}>Cancel</button>
          <button class="modal-save" disabled={$promptLoading || $promptSaving || !$promptText} on:click={savePrompt}>
            {#if $promptSaving}Saving...{:else if $promptSaved}<i class="las la-check"></i> Saved{:else}Save as default{/if}
          </button>
          <button class="modal-run" disabled={$promptLoading || !$promptText} on:click={runAnalysisWithPrompt}>
            Run analysis
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f8fafc;
  }

  .workspace-header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-info h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
  }

  .project-ref {
    font-size: 0.8rem;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  /* Tabs */
  .tabs {
    display: flex;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 1.5rem;
    flex-shrink: 0;
  }

  .tab {
    padding: 0.75rem 1.25rem;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
  .tab:hover:not(.active) { color: #374151; }

  /* Tab body */
  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* ── Key Issues ── */
  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 800px;
  }

  .issue-card {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.875rem 1.125rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .issue-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .issue-label {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .issue-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
  }

  /* ── Argument Structure two-panel ── */
  .argument-body {
    display: grid;
    grid-template-columns: 3fr 2fr;
    align-items: start;
    padding: 1.5rem;
    gap: 1.5rem;
    min-height: 600px;
  }

  .argument-panel {
    padding: 0;
    background: transparent;
  }

  .input-panel {
    display: flex;
    flex-direction: column;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    position: sticky;
    top: 1.5rem;
  }

  .input-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    flex-shrink: 0;
  }

  .input-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .input-tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
  .input-tab:hover:not(.active) { color: #374151; }

  .upload-zone {
    margin: 1.25rem;
    border: 2px dashed #cbd5e1;
    border-radius: 10px;
    padding: 2.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
    background: white;
    text-align: center;
  }

  .upload-zone:hover, .upload-zone.drag-over { border-color: #7c3aed; background: #faf5ff; }
  .upload-zone i { font-size: 2.25rem; color: #94a3b8; }
  .upload-zone span { font-size: 0.875rem; color: #475569; font-weight: 500; }
  .upload-sub { font-size: 0.8rem !important; color: #94a3b8 !important; font-weight: 400 !important; }

  .paste-area {
    flex: 1;
    margin: 1.25rem;
    padding: 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    min-height: 200px;
    transition: border-color 0.15s;
    background: white;
  }

  .paste-area:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.08); }

  .analyse-btn {
    padding: 0.625rem 1rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .analyse-btn:hover:not(:disabled) { background: #6d28d9; }
  .analyse-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .idle-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
  }

  .form-label-hint {
    font-weight: 400;
    color: #94a3b8;
  }

  .doc-type-select {
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    color: #1e293b;
  }

  .doc-type-select:focus { outline: none; border-color: #7c3aed; }

  .direction-toggle {
    display: flex;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .direction-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: none;
    background: white;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  .direction-btn:first-child { border-right: 1px solid #e2e8f0; }

  .direction-btn.active {
    background: #1e293b;
    color: white;
    font-weight: 600;
  }

  .user-notes-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }

  .user-notes-field:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.07); }
  .user-notes-field::placeholder { color: #94a3b8; }

  .issue-checks {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .issue-check-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;
  }

  .issue-check-label input[type="checkbox"] { cursor: pointer; accent-color: #7c3aed; }

  .upload-zone.has-file { border-color: #7c3aed; background: #faf5ff; }
  .upload-zone.has-file i { color: #7c3aed; }

  .analysis-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #64748b;
    padding: 2rem;
  }

  .analysis-loading p { margin: 0; font-size: 0.875rem; }

  .analysis-error {
    margin: 0.75rem 1rem 0;
    font-size: 0.8125rem;
    color: #ef4444;
  }

  .results-header, .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  /* Chat thread */
  .chat-thread {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chat-msg {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 100%;
  }

  .chat-msg.assistant .chat-prose {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    line-height: 1.65;
    color: #1e293b;
    white-space: pre-wrap;
  }

  .chat-msg.user {
    align-items: flex-end;
  }

  .chat-msg.user p {
    background: #7c3aed;
    color: white;
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    max-width: 85%;
    margin: 0;
    white-space: pre-wrap;
  }

  .chat-msg.loading-msg {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.8125rem;
    padding: 0.5rem 0;
  }

  .chat-msg-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }

  .accept-multi {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .accept-btn {
    padding: 0.4rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1.5px solid #16a34a;
    background: white;
    color: #16a34a;
    font-family: inherit;
    transition: all 0.15s;
  }

  .accept-btn:hover { background: #f0fdf4; }

  .accept-btn.accepted {
    background: #dcfce7;
    border-color: #16a34a;
    color: #15803d;
    cursor: default;
  }

  .accept-btn-sm {
    font-size: 0.75rem;
    padding: 0.3rem 0.625rem;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e2e8f0;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    resize: none;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-family: inherit;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s;
  }

  .chat-input:focus { border-color: #7c3aed; }

  .chat-send-btn {
    padding: 0.5rem 0.75rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .chat-send-btn:hover:not(:disabled) { background: #6d28d9; }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .results-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
  }

  .reset-btn:hover { background: #f1f5f9; }

  .results-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: #94a3b8;
    text-align: center;
  }

  .results-empty i { font-size: 2rem; color: #16a34a; }
  .results-empty p { margin: 0; font-size: 0.875rem; }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .result-summary {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 0.875rem 1rem;
  }

  .result-summary p {
    margin: 0;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.6;
  }

  .result-group { display: flex; flex-direction: column; gap: 0.625rem; }

  .result-group-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  .result-subgroup { display: flex; flex-direction: column; gap: 0.5rem; }

  .result-subgroup-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #1e293b;
    padding-top: 0.25rem;
  }

  .coverage-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .coverage-issue { font-size: 0.8rem; font-weight: 600; color: #1e293b; }
  .coverage-text  { font-size: 0.8rem; color: #64748b; line-height: 1.4; }

  .result-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .result-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .result-field-tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .result-field-tag.against { background: #fee2e2; color: #b91c1c; }
  .result-field-tag.for     { background: #ede9fe; color: #6d28d9; }

  .result-point-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
  }

  .result-point-row:disabled { cursor: default; }

  .result-expand-icon {
    font-size: 0.7rem;
    color: #94a3b8;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .result-point-detail {
    margin: 0.375rem 0 0;
    font-size: 0.8rem;
    color: #475569;
    line-height: 1.55;
    padding: 0.5rem 0.625rem;
    background: #f8fafc;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .result-point-detail p { margin: 0; }

  .arg-point-detail {
    padding: 0.5rem 0.75rem 0.625rem;
    background: white;
    border-top: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .arg-point-detail p { margin: 0; font-size: 0.8rem; color: #475569; line-height: 1.55; }

  .citation-block {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .citation-quote {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
    line-height: 1.4;
  }

  .citation-ref {
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    white-space: nowrap;
  }

  .citation-ref-strong {
    font-size: 0.78rem;
    font-weight: 700;
    font-style: italic;
    color: #475569;
  }

  .result-point {
    margin: 0;
    font-size: 0.8125rem;
    color: #374151;
    line-height: 1.5;
    flex: 1;
  }

  .result-actions { display: flex; gap: 0.4rem; }

  .result-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s;
  }

  .result-btn.info { color: #7c3aed; }
  .result-btn.info:hover { background: #f5f3ff; border-color: #c4b5fd; }
  .result-btn.accept { color: #16a34a; }
  .result-btn.accept:hover { background: #f0fdf4; border-color: #86efac; }
  .result-btn.dismiss { color: #94a3b8; }
  .result-btn.dismiss:hover { background: #f8fafc; border-color: #cbd5e1; }

  /* ── Argument Structure ── */
  .argument-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 800px;
  }

  .argument-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .argument-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .argument-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .argument-issue-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: #1e293b;
  }

  .note-status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .note-status.saving { color: #94a3b8; }
  .note-status.saved  { color: #16a34a; }

  /* Shared chips */
  .discipline-tag {
    font-size: 0.75rem;
    font-weight: 600;
    background: #f1f5f9;
    color: #64748b;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .risk-chip {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.625rem;
    border-radius: 999px;
    white-space: nowrap;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  /* Shared textarea styles */
  .summary-field,
  .notes-field {
    width: 100%;
    box-sizing: border-box;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #374151;
    background: #f8fafc;
    resize: none;
    overflow: hidden;
    line-height: 1.5;
    transition: border-color 0.15s, background 0.15s;
  }

  .summary-field { min-height: 72px; }
  .notes-field   { min-height: 100px; }

  .note-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .note-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
  }

  .summary-field:focus,
  .notes-field:focus {
    outline: none;
    border-color: #7c3aed;
    background: white;
    box-shadow: 0 0 0 3px rgba(124,58,237,0.07);
  }

  .summary-field::placeholder,
  .notes-field::placeholder { color: #94a3b8; }

  /* Structured argument points */
  .arg-points-list {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .arg-point-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }

  .arg-point-row:first-child { border-top: none; }

  .arg-point-headline {
    font-size: 0.8rem;
    font-weight: 500;
    color: #1e293b;
    line-height: 1.4;
    flex: 1;
  }

  .arg-point-info {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0.1rem 0.2rem;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.95rem;
    line-height: 1;
    transition: color 0.12s;
  }

  .arg-point-info:hover { color: #7c3aed; }


  /* Loading / error / empty */
  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
  }

  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    padding: 2rem;
  }

  .error-state i { font-size: 2.5rem; color: #ef4444; }

  .error-state button {
    padding: 0.5rem 1.25rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    color: #94a3b8;
    text-align: center;
  }

  .empty-state i { font-size: 3rem; }
  .empty-state p { margin: 0; font-size: 0.9rem; max-width: 360px; }

  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid #cbd5e1;
    border-top-color: #94a3b8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Draft Document tab ── */
  .draft-types-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 680px;
  }

  .draft-type-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .draft-type-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .draft-type-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .draft-type-name { font-size: 0.9375rem; font-weight: 600; color: #1e293b; }
  .draft-type-desc { font-size: 0.8125rem; color: #64748b; }
  .draft-type-meta { font-size: 0.75rem; color: #94a3b8; }

  .draft-type-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
    align-items: center;
  }

  .draft-open-btn {
    padding: 0.4rem 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-open-btn:hover { background: #f1f5f9; }

  .draft-generate-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-generate-btn:hover:not(:disabled) { background: #6d28d9; }
  .draft-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .draft-type-settings {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
  }

  .draft-setting-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    font-size: 0.75rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-setting-btn:hover { background: #f1f5f9; color: #374151; }

  /* Draft editor view */
  .draft-editor-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .draft-editor-title {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .draft-editor-actions { display: flex; gap: 0.5rem; }

  .draft-regen-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-regen-btn:hover:not(:disabled) { background: #f1f5f9; }
  .draft-regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .draft-save-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-save-btn:hover:not(:disabled) { background: #6d28d9; }
  .draft-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .draft-context-btn {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: #f5f3ff; color: #6d28d9;
    border: 1px solid #ddd6fe; border-radius: 6px;
    font-size: 0.8125rem; cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .draft-context-btn:hover { background: #ede9fe; }
  .draft-context-btn.active { background: #7c3aed; color: white; border-color: #7c3aed; }

  /* ── Context panel ── */
  .context-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: white;
  }

  .context-panel-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }

  .context-panel-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .context-panel-close {
    display: flex; align-items: center; justify-content: center;
    width: 1.5rem; height: 1.5rem;
    border: none; background: transparent; color: #94a3b8;
    cursor: pointer; border-radius: 4px; font-size: 1rem;
  }
  .context-panel-close:hover { background: #f1f5f9; color: #374151; }

  .context-panel-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .context-panel-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .context-block {
    border-bottom: 1px solid #f1f5f9;
  }

  .context-block-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background 0.12s;
  }
  .context-block-header:hover { background: #f8fafc; }

  .context-block-label {
    flex: 1;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .context-block-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
  }
  .status-set    { background: #f0fdf4; color: #15803d; }
  .status-missing { background: #f1f5f9; color: #94a3b8; }

  .context-chevron { font-size: 0.75rem; color: #94a3b8; flex-shrink: 0; }

  .context-block-body {
    padding: 0 1rem 0.875rem;
    font-size: 0.8rem;
    color: #475569;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .context-block-body :global(p) { margin: 0.25rem 0; }
  .context-block-body :global(h2),
  .context-block-body :global(h3) { font-size: 0.8rem; font-weight: 700; margin: 0.5rem 0 0.2rem; color: #1e293b; }

  .context-block-empty {
    margin: 0;
    padding: 0 1rem 0.875rem;
    font-size: 0.75rem;
    color: #94a3b8;
    font-style: italic;
  }

  .context-example-filename {
    margin: 0 0 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .context-example-hint {
    margin: 0 0 0.625rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  .context-example-replace {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.25rem 0.625rem;
    background: white; color: #64748b;
    border: 1px solid #e2e8f0; border-radius: 5px;
    font-size: 0.75rem; cursor: pointer; font-family: inherit;
    transition: all 0.12s;
  }
  .context-example-replace:hover { background: #f1f5f9; color: #374151; }

  .draft-editor-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: #f8fafc;
  }

  /* ── Two-panel draft layout ── */
  .draft-two-panel {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .draft-left-panel {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: #f8fafc;
    min-width: 0;
  }

  .draft-right-panel {
    width: 340px;
    flex-shrink: 0;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f8fafc;
  }

  .draft-right-panel--full {
    width: 100%;
    border-left: none;
  }

  .draft-left-panel.panel-hidden {
    display: none;
  }

  .modal-wide { max-width: 900px; }

  .example-editor-wrap {
    flex: 1;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    min-height: 400px;
  }

  /* Analyse row */
  .analyse-row {
    display: flex;
    gap: 0.5rem;
    margin: 0 1.25rem 1.25rem;
  }

  .analyse-row .analyse-btn {
    margin: 0;
    flex: 1;
  }

  .prompt-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.625rem 0.875rem;
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .prompt-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; color: #374151; }
  .prompt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: #1e293b; }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .modal-close:hover { background: #f1f5f9; color: #374151; }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .prompt-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .prompt-editor {
    flex: 1;
    width: 100%;
    min-height: 400px;
    box-sizing: border-box;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Menlo', 'Consolas', monospace;
    line-height: 1.6;
    color: #1e293b;
    background: #f8fafc;
    resize: vertical;
  }

  .prompt-editor:focus { outline: none; border-color: #7c3aed; background: white; }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .prompt-custom-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: #ede9fe;
    color: #6d28d9;
  }

  .prompt-default-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
  }

  .prompt-hint {
    margin: 0 0 0.625rem;
    font-size: 0.8rem;
    color: #64748b;
    flex-shrink: 0;
  }

  .prompt-hint code {
    background: #f1f5f9;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: 0.8rem;
    color: #7c3aed;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

  .modal-reset {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #94a3b8;
    cursor: pointer;
    font-family: inherit;
  }

  .modal-reset:hover:not(:disabled) { background: #f1f5f9; color: #64748b; }
  .modal-reset:disabled { opacity: 0.4; cursor: not-allowed; }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
  }

  .modal-cancel:hover { background: #f1f5f9; }

  .modal-save {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .modal-save:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
  .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .modal-run {
    padding: 0.5rem 1.25rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .modal-run:hover:not(:disabled) { background: #6d28d9; }
  .modal-run:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Sections manager modal ── */
  .modal-sections { max-width: 680px; }

  .sections-body {
    padding: 0;
    overflow-y: auto;
  }

  .sections-empty {
    margin: 0;
    padding: 2rem 1.25rem 1rem;
    font-size: 0.875rem;
    color: #94a3b8;
    text-align: center;
  }

  .sections-list {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid #f1f5f9;
  }

  .section-row {
    border-bottom: 1px solid #f1f5f9;
  }

  .section-row:last-child { border-bottom: none; }

  .section-row.expanded { background: #faf5ff; }

  .section-row-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
  }

  .section-order-btns {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex-shrink: 0;
  }

  .section-order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.125rem;
    border: none;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    transition: color 0.1s;
  }

  .section-order-btn:hover:not(:disabled) { color: #374151; }
  .section-order-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  .section-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    min-width: 0;
  }

  .section-row-actions {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
    align-items: center;
  }

  .section-generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: white;
    color: #7c3aed;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .section-generate-btn:hover:not(:disabled) { background: #faf5ff; border-color: #c4b5fd; }
  .section-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .section-edit-btn {
    padding: 0.3rem 0.625rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .section-edit-btn:hover { background: #f1f5f9; }

  .section-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: white;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .section-delete-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }

  .section-expand {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1.25rem 1rem 1.25rem;
  }

  .section-field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
  }

  .section-prompt {
    min-height: 80px;
    resize: none;
    overflow: hidden;
  }

  .section-expand-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .section-example-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .section-example-btn:hover { background: #f1f5f9; color: #374151; }

  .add-section-row {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
  }

  .add-section-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    transition: border-color 0.15s;
  }
  .add-section-input:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.07); }
  .add-section-input::placeholder { color: #94a3b8; }

  .add-section-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .add-section-btn:hover:not(:disabled) { background: #6d28d9; }
  .add-section-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Results header actions ── */
  .results-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .log-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.625rem;
    background: #ede9fe;
    border: 1px solid #c4b5fd;
    border-radius: 5px;
    font-size: 0.8rem;
    font-weight: 500;
    color: #6d28d9;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .log-btn:hover { background: #ddd6fe; }

  /* ── Document log tab ── */
  .log-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 800px;
  }

  .log-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .log-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .log-card-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .log-card-title { font-size: 0.9375rem; font-weight: 600; color: #1e293b; }
  .log-card-code {
    font-size: 0.75rem;
    font-weight: 600;
    background: #f1f5f9;
    color: #64748b;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .log-card-header-right {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .log-card-date { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; flex-shrink: 0; }

  .log-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem;
    height: 1.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: white;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .log-action-btn:hover { background: #f1f5f9; color: #374151; border-color: #cbd5e1; }
  .log-action-btn.log-action-delete:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }

  .log-card-summary {
    margin: 0;
    font-size: 0.8125rem;
    color: #475569;
    line-height: 1.5;
    padding: 0.625rem 0.75rem;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .log-points {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-point {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .log-point-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .log-point-issue { font-size: 0.8rem; font-weight: 500; color: #374151; }

  .log-point-text {
    margin: 0;
    font-size: 0.8125rem;
    color: #374151;
    line-height: 1.5;
  }

  /* ── Log modal ── */
  .modal-log { max-width: 680px; }

  .log-modal-body {
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .log-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .log-form-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .log-form-field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
  .log-form-field-sm { flex: 0 0 160px; }

  .log-points-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-point-edit {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.625rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .log-point-edit-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Key Issues toolbar ── */
  .key-issues-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    max-width: 800px;
  }

  /* ── Argument panel toolbar ── */
  .argument-panel-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .btn-from-issue-notes {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .btn-from-issue-notes:hover { background: #f8fafc; border-color: #cbd5e1; }

  /* ── Briefing button group ── */
  .briefing-btn-group {
    position: relative;
    display: flex;
  }

  .btn-draft-from-briefing {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-right: none;
    border-radius: 6px 0 0 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #5b21b6;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .btn-draft-from-briefing:hover { background: #ede9fe; }

  .btn-briefing-chevron {
    display: flex;
    align-items: center;
    padding: 0.4rem 0.5rem;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 0 6px 6px 0;
    color: #7c3aed;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .btn-briefing-chevron:hover { background: #ede9fe; }

  .briefing-note-pill {
    display: inline-block;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: #ddd6fe;
    color: #4c1d95;
    border-radius: 4px;
    padding: 0.05rem 0.4rem;
    font-size: 0.7rem;
    vertical-align: middle;
  }

  .briefing-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 240px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    z-index: 100;
    overflow: hidden;
  }

  .briefing-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    border-bottom: 1px solid #f1f5f9;
  }

  .briefing-dropdown-item:last-child { border-bottom: none; }
  .briefing-dropdown-item:hover, .briefing-dropdown-item.active { background: #f8fafc; }
  .briefing-dropdown-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .briefing-dropdown-date { font-size: 0.75rem; color: #94a3b8; flex-shrink: 0; }
  .briefing-dropdown-upload { color: #7c3aed; font-weight: 500; }

  /* ── Briefing draft modal ── */
  .modal-briefing-draft { width: 680px; }
  .modal-briefing-draft .modal-body { overflow-y: auto; }

  .briefing-draft-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .briefing-draft-intro {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .briefing-draft-empty {
    color: #94a3b8;
    font-size: 0.875rem;
    padding: 1rem 0;
  }

  .briefing-draft-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .briefing-draft-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: opacity 0.2s;
  }

  .briefing-draft-card.bd-skipped { opacity: 0.45; }
  .briefing-draft-card.bd-applied { border-color: #bbf7d0; background: #f0fdf4; }

  .bd-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .bd-issue-label { font-size: 0.875rem; font-weight: 600; color: #1e293b; }

  .bd-actions { display: flex; align-items: center; gap: 0.5rem; }

  .bd-btn-accept {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.75rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .bd-btn-accept:hover { background: #6d28d9; }

  .bd-btn-evolve {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.75rem;
    background: #1d4ed8;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .bd-btn-evolve:hover { background: #1e40af; }

  .bd-btn-skip {
    padding: 0.3rem 0.625rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
  }

  .bd-btn-skip:hover { background: #f1f5f9; }

  .bd-status {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.25rem 0.625rem;
    border-radius: 4px;
  }

  .bd-status-accepted { background: #dcfce7; color: #15803d; }
  .bd-status-skipped { background: #f1f5f9; color: #64748b; }

  .bd-new-info { padding: 0.625rem 0.875rem; }
  .bd-new-info-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .bd-argument-text { margin: 0.25rem 0 0; font-size: 0.875rem; color: #374151; line-height: 1.6; white-space: pre-wrap; }

  .bd-evolve-panel {
    border-top: 1px solid #e2e8f0;
    padding: 0.75rem 0.875rem;
    background: #fafafa;
  }

  .bd-evolve-loading { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: #64748b; }
  .bd-evolved-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7c3aed; }
  .bd-evolved-text { margin: 0.25rem 0 0.75rem; font-size: 0.875rem; color: #1e293b; line-height: 1.6; white-space: pre-wrap; }

  .bd-evolve-chat { display: flex; gap: 0.5rem; align-items: flex-end; }
  .bd-chat-input { flex: 1; resize: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.625rem; font-size: 0.8125rem; font-family: inherit; line-height: 1.4; }
  .bd-chat-input:focus { outline: none; border-color: #7c3aed; }

  .bd-evolve-actions { display: flex; gap: 0.5rem; align-items: center; }

  .bd-chat-send {
    padding: 0.45rem 0.625rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    color: #64748b;
    font-size: 0.9rem;
  }

  .bd-chat-send:hover:not(:disabled) { background: #e2e8f0; }
  .bd-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

  .bd-btn-apply {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.875rem;
    background: #16a34a;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .bd-btn-apply:hover { background: #15803d; }

  /* ── Misc ── */
  .add-section-input {
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .add-section-input:focus { outline: none; border-color: #7c3aed; }
  .section-field-label { font-size: 0.75rem; font-weight: 600; color: #374151; display: block; margin-bottom: 0.25rem; }
</style>
