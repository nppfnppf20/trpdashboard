<script>
  import { onMount } from 'svelte';
  import { getKeyIssues, updateKeyIssueSummary, getIssueNotes, getDocumentLog, getPolicyTrackRelevance, getArgumentPoints, setProjectDevelopmentType } from '$lib/api/planningApplication.js';
  import { getPolicies } from '$lib/api/lpaAnalysis.js';
  import { initNotes, briefingDraftOpen, briefingDraftLoading, briefingDraftSuggestions, briefingDraftAccepted, briefingDraftSkipped, runDraftFromBriefing, acceptBriefingDraftSuggestion, skipBriefingDraftSuggestion, closeBriefingDraft } from '$lib/stores/planning-notes.js';
  import { documentLog, logModalOpen, logTitle, logCode, logItemType, logPreparedBy, logSummary, logPoints, logSaving, initLog, removeLogPoint, saveLogEntry, editModalOpen, editTitle, editCode, editItemType, editPreparedBy, editSummary, editPoints, editSaving, openEditModal, removeEditPoint, saveEditEntry, deleteEntry } from '$lib/stores/planning-log.js';
  import { argumentPointsByTrack, initArgumentPoints } from '$lib/stores/planning-analysis.js';
  import { suggestState, conversation, suggestError, refinementInput, refinementLoading, suggestInputTab, suggestFile, suggestPasteText, suggestDocumentType, suggestDocumentTitle, suggestUserNotes, suggestTrackIds, acceptedIssues, suggestPromptOpen, suggestPromptText, suggestPromptLoading, suggestPromptSaving, suggestPromptSaved, suggestPromptIsCustom, initSuggestion, runSuggestion, sendRefinement, acceptSuggestion, openSuggestionLogModal, resetSuggestion, onSuggestDrop, onSuggestFileChange, toggleSuggestTrack, openSuggestPromptModal, saveSuggestPrompt, resetSuggestPromptToDefault, runSuggestionWithPrompt } from '$lib/stores/planning-suggestion.js';
  import { draftTypes, drafts, draftGenerating, activeDraftTypeId, draftEditorHtml, draftSaving, draftSaved, sectionsModalOpen, sectionsTypeName, sections, sectionsLoading, newSectionName, addingSectionLoading, sectionGenerating, sectionExpandedId, sectionPromptText, sectionPromptIsCustom, sectionPromptSaving, sectionPromptSaved, sectionPromptResetting, sectionTemplateText, sectionTemplateSaving, sectionTemplateSaved, sectionExampleModalOpen, sectionExampleId, sectionExampleSaving, sectionExampleSaved, cardExpandedTypeId, cardSections, cardSectionsLoading, assessmentIssues, assessmentIssuesLoading, issueGenerating, initDrafts, loadDraftTypes, setDraftEditor, setSectionExampleEditor, handleGenerate, openDraft, closeDraft, handleSaveDraft, openSectionsModal, handleAddSection, handleDeleteSection, moveSectionUp, moveSectionDown, toggleSectionExpand, handleSaveSectionPrompt, handleSaveSectionTemplate, openSectionExampleModal, handleSaveSectionExample, handleGenerateSection, handleResetSectionPrompt, toggleCardExpand, loadAssessmentIssues, handleGenerateAssessmentIssue } from '$lib/stores/planning-drafts.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import PolicyTierNotes from '$lib/components/planning-application/PolicyTierNotes.svelte';
  import ArgumentStructurePanel from '$lib/components/planning-application/ArgumentStructurePanel.svelte';

  const SUGGEST_DOC_TYPES = [
    'Officer Report',
    'Design & Access Statement',
    'Planning Statement',
    'Heritage Statement',
    'Transport Assessment',
    'Ecology Report',
    'Noise Assessment',
    'Surveyor Report',
    'Pre-application Response',
    'Other'
  ];

  const POLICY_TIERS = [
    { key: 'policy_national',      label: 'National Policy',      placeholder: 'Key NPPF provisions and national guidance relevant to this issue...' },
    { key: 'policy_local',         label: 'Local Policy',         placeholder: 'Local plan policies and their requirements...' },
    { key: 'policy_neighbourhood', label: 'Neighbourhood Policy', placeholder: 'Neighbourhood plan policies (if applicable)...' },
    { key: 'policy_supplementary', label: 'Supplementary',        placeholder: 'SPDs, design guides or other supplementary guidance...' },
  ];

  let openTiers = {};

  function toggleTier(issueId, tierKey) {
    const current = openTiers[issueId] ?? {};
    openTiers = {
      ...openTiers,
      [issueId]: { ...current, [tierKey]: !current[tierKey] }
    };
  }

  // programmatic: true = substituted AFTER generation (never seen by LLM — hallucination-safe)
  // programmatic: false = substituted into prompt before sending (LLM synthesises from this content)
  const VARIABLE_SOURCES = {
    PROJECT_NAME:            { label: 'Project name',               source: 'projects.project_name',                                programmatic: true },
    APPLICANT_NAME:          { label: 'Applicant name',             source: 'projects.client',                                      programmatic: true },
    LPA_NAME:                { label: 'LPA name',                   source: 'projects.local_planning_authority',                    programmatic: true },
    SITE_ADDRESS:            { label: 'Site address',               source: 'projects.address',                                     programmatic: true },
    DEVELOPMENT_DESCRIPTION: { label: 'Description of development', source: 'projects.development_description',                    programmatic: true },
    ABOUT_APPLICANT:         { label: 'About the applicant',        source: 'document_summaries — doc_type: about_applicant',       programmatic: true },
    PROPOSED_DEVELOPMENT:    { label: 'Proposed development',       source: 'document_summaries — doc_type: proposed_development',  programmatic: false },
    DOCUMENT_LIST:           { label: 'Document list',              source: 'document_log (all entries)',                           programmatic: false },
    SITE_SURROUNDINGS:       { label: 'Site & surroundings',        source: 'document_summaries — doc_type: site_surroundings',     programmatic: false },
    PLANNING_HISTORY:        { label: 'Planning history',           source: 'planning_history table',                               programmatic: false },
    PRE_APP_SUMMARY:         { label: 'Pre-app summary',            source: 'document_summaries — doc_type: pre_app',               programmatic: true },
    EIA_SUMMARY:             { label: 'EIA summary',                source: 'document_summaries — doc_type: eia_response',          programmatic: true },
    SCI_SUMMARY:             { label: 'SCI summary',                source: 'document_summaries — doc_type: sci',                   programmatic: true },
    LOCAL_POLICIES:             { label: 'Local policies (HTML)',       source: 'project_policies — local, verbatim listing',           programmatic: true },
    NATIONAL_POLICIES:          { label: 'National policies (HTML)',   source: 'project_policies — national, verbatim listing',        programmatic: true },
    OTHER_POLICIES:             { label: 'Other policies (HTML)',      source: 'project_policies — other types, verbatim listing',     programmatic: true },
    LOCAL_POLICY_NAMES:         { label: 'Local policy names',         source: 'project_policies — local, ref + name list only',       programmatic: true },
    SUPPLEMENTARY_POLICY_NAMES: { label: 'Supplementary policy names', source: 'project_policies — supplementary, ref + name list',    programmatic: true },
    SITE_SURROUNDINGS_HTML:     { label: 'Site & surroundings (HTML)', source: 'document_summaries — doc_type: site_surroundings, raw HTML', programmatic: true },
    PLANNING_HISTORY_TABLE:     { label: 'Planning history table',     source: 'planning_history table, rendered as HTML table',       programmatic: true },
    PROPOSED_DEVELOPMENT_HTML:  { label: 'Proposed development (HTML)', source: 'document_summaries — doc_type: proposed_development, raw HTML', programmatic: true },
    DOCUMENT_LIST_DOCS:         { label: 'Document list',              source: 'document_log — item_type: document, as bullet list',   programmatic: true },
    DOCUMENT_LIST_DRAWINGS:     { label: 'Drawings list',              source: 'document_log — item_type: drawing, as bullet list',    programmatic: true },
    LOCAL_POLICIES_CONTEXT:  { label: 'Local policies (context)',   source: 'project_policies — local, refs + notes for LLM',       programmatic: false },
    NATIONAL_POLICIES_CONTEXT: { label: 'National policies (context)', source: 'project_policies — national, refs + notes for LLM', programmatic: false },
    OTHER_POLICIES_CONTEXT:  { label: 'Other policies (context)',   source: 'project_policies — other, refs + notes for LLM',       programmatic: false },
    FULL_STATEMENT:          { label: 'Full statement',             source: 'Assembled HTML of all sections (runs_last only)',       programmatic: false },
  };

  $: detectedVars = [...new Set(($sectionPromptText || '').match(/\{\{([A-Z_]+)\}\}/g) || [])]
    .map(match => {
      const key = match.slice(2, -2);
      const info = VARIABLE_SOURCES[key];
      return { key, label: info?.label ?? key, source: info?.source ?? 'unknown source', programmatic: info?.programmatic ?? false };
    });

  let suggestFileInput;
  let chatEndEl;

  $: if ($conversation.length && chatEndEl) setTimeout(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }), 50);

  let draftEditor;
  let sectionExampleEditor;

  $: setDraftEditor(draftEditor);
  $: setSectionExampleEditor(sectionExampleEditor);

  export let project;

  const DEV_TYPES = [
    'Residential', 'Commercial', 'Solar', 'Wind', 'Mixed Use',
    'Industrial', 'Change of Use', 'Agricultural', 'Other'
  ];

  let developmentType = project.development_type ?? '';
  let devTypeSaving = false;

  async function handleDevTypeChange(e) {
    const value = e.target.value;
    developmentType = value;
    devTypeSaving = true;
    try {
      await setProjectDevelopmentType(project.id, value || null);
    } catch (err) {
      console.error('Failed to save development type:', err);
    } finally {
      devTypeSaving = false;
    }
  }

  let activeTab = 'key-issues';

  let keyIssues = [];
  let projectPolicies = [];
  let policyTrackRelevance = {};
  let loading = true;
  let loadError = null;

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [issues, notes, log, policies, relevance, argPoints] = await Promise.all([
        getKeyIssues(project.id),
        getIssueNotes(project.id),
        getDocumentLog(project.id),
        getPolicies(project.id),
        getPolicyTrackRelevance(project.id),
        getArgumentPoints(project.id)
      ]);
      keyIssues = issues;
      projectPolicies = policies;
      policyTrackRelevance = relevance;
      initArgumentPoints(argPoints);
      initSuggestion(project.id);
      initDrafts(project.id);
      initNotes(project.id, notes);
      initLog(log);
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
    // Run independently — draft failures must not block the rest of the workspace
    await Promise.all([loadDraftTypes(), loadAssessmentIssues()]);
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
    <button class="tab" class:active={activeTab === 'policy'} on:click={() => activeTab = 'policy'}>
      Policy
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

  {:else if activeTab === 'policy'}
    <!-- ── Tab 2: Policy ── -->
    <div class="tab-body">
      {#if keyIssues.length === 0}
        <div class="empty-state">
          <i class="las la-list-alt"></i>
          <p>No key issues found. Add them in the Key Issues tab first.</p>
        </div>
      {:else}
        <div class="argument-list">
          {#each keyIssues as issue (issue.id)}
            {@const risk = riskColours[issue.last_known_risk_level]}
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
              </div>
              <PolicyTierNotes
                {issue}
                projectId={project.id}
                policies={projectPolicies}
                relevantPolicyIds={policyTrackRelevance[issue.id] ?? []}
                on:relevancechange={(e) => {
                  const { policyId, linked } = e.detail;
                  policyTrackRelevance = {
                    ...policyTrackRelevance,
                    [issue.id]: linked
                      ? [...(policyTrackRelevance[issue.id] ?? []), policyId]
                      : (policyTrackRelevance[issue.id] ?? []).filter(id => id !== policyId)
                  };
                }}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'argument'}
    <!-- ── Tab 3: Argument Structure ── -->
    <div class="argument-body">
      <div class="argument-panel">
        <div class="argument-panel-toolbar">
          <button class="btn-draft-from-briefing" on:click={() => runDraftFromBriefing(project.id)}>
            <i class="las la-lightbulb"></i> Draft arguments from briefing
          </button>
        </div>
        <ArgumentStructurePanel {keyIssues} {projectPolicies} {policyTrackRelevance} argumentPointsByTrack={$argumentPointsByTrack} />
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
                <div class="chat-msg assistant">
                  <div class="chat-prose">{msg.content}</div>
                  {#if isLast}
                    <div class="chat-msg-actions">
                      {#if $suggestTrackIds.length === 1}
                        {@const issue = keyIssues.find(iss => iss.id === $suggestTrackIds[0])}
                        <button
                          class="accept-btn"
                          class:accepted={$acceptedIssues[$suggestTrackIds[0]]}
                          on:click={() => acceptSuggestion($suggestTrackIds[0], msg.content, issue?.label ?? '')}
                        >
                          {#if $acceptedIssues[$suggestTrackIds[0]]}
                            <i class="las la-check"></i> Accepted into {issue?.label ?? 'issue'}
                          {:else}
                            <i class="las la-check"></i> Accept into {issue?.label ?? 'issue'}
                          {/if}
                        </button>
                      {:else}
                        <div class="accept-multi">
                          {#each ($suggestTrackIds.length > 0 ? keyIssues.filter(iss => $suggestTrackIds.includes(iss.id)) : keyIssues) as issue}
                            <button
                              class="accept-btn accept-btn-sm"
                              class:accepted={$acceptedIssues[issue.id]}
                              on:click={() => acceptSuggestion(issue.id, msg.content, issue.label)}
                            >
                              {#if $acceptedIssues[issue.id]}
                                <i class="las la-check"></i> {issue.label}
                              {:else}
                                Accept into {issue.label}
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
              placeholder="Ask for changes — e.g. 'focus more on the transport assessment conclusions'..."
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
              <label class="form-label">Document type</label>
              <select class="doc-type-select" bind:value={$suggestDocumentType}>
                {#each SUGGEST_DOC_TYPES as t}<option>{t}</option>{/each}
              </select>
            </div>

            <div class="form-row">
              <label class="form-label">Document title <span class="form-label-hint">(used for inline references)</span></label>
              <input class="doc-title-input" type="text" bind:value={$suggestDocumentTitle} placeholder="e.g. Transport Assessment — Land at Station Road" />
            </div>

            {#if $suggestInputTab === 'upload'}
              <div
                class="upload-zone"
                class:has-file={$suggestFile}
                on:dragover|preventDefault={() => {}}
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
                placeholder="e.g. Focus on section 5 regarding heritage — the consultant's conclusions support our case..."
              ></textarea>
            </div>

            {#if keyIssues.length > 0}
              <div class="form-row">
                <label class="form-label">Relevant to <span class="form-label-hint">(leave blank for all issues)</span></label>
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
                Suggest additions
              </button>
              <button
                class="prompt-btn"
                disabled={$suggestInputTab === 'upload' ? !$suggestFile : !$suggestPasteText.trim()}
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
      <!-- Editor view -->
      {@const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId)}
      <div class="draft-editor-bar">
        <button class="reset-btn" on:click={closeDraft}><i class="las la-arrow-left"></i> Documents</button>
        <span class="draft-editor-title">{activeType?.name ?? ''}</span>
        <div class="draft-editor-actions">
          <button class="draft-regen-btn" disabled={$draftGenerating === $activeDraftTypeId} on:click={() => handleGenerate($activeDraftTypeId)}>
            {#if $draftGenerating === $activeDraftTypeId}<div class="mini-spinner"></div> Generating...{:else}<i class="las la-sync"></i> Regenerate{/if}
          </button>
          <button class="draft-save-btn" disabled={$draftSaving} on:click={handleSaveDraft}>
            {#if $draftSaving}Saving...{:else if $draftSaved}<i class="las la-check"></i> Saved{:else}Save{/if}
          </button>
        </div>
      </div>
      <div class="draft-editor-wrap">
        <RichTextEditor bind:this={draftEditor} content={$draftEditorHtml} on:change={() => { $draftSaved = false; }} />
      </div>
    {:else}
      <!-- Document type list -->
      <div class="tab-body">
        <div class="draft-types-list">
          {#each $draftTypes as type (type.id)}
            {@const draft = $drafts[type.id]}
            {@const isExpanded = $cardExpandedTypeId === type.id}
            {@const typeSections = $cardSections[type.id] ?? []}
            {@const typeLoading = $cardSectionsLoading[type.id] ?? false}
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
                  <select class="card-dev-type-select" value={developmentType} on:change={handleDevTypeChange} disabled={devTypeSaving} title="Development type">
                    <option value="">Dev type...</option>
                    {#each DEV_TYPES as dt}
                      <option value={dt}>{dt}</option>
                    {/each}
                  </select>
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

              <!-- Sections toggle row -->
              <button class="draft-sections-toggle" on:click={() => toggleCardExpand(type.id)}>
                <i class="las la-layer-group"></i>
                Sections
                <i class="las {isExpanded ? 'la-angle-up' : 'la-angle-down'} toggle-chevron"></i>
              </button>

              {#if isExpanded}
                <div class="draft-inline-sections">
                  {#if typeLoading}
                    <div class="draft-inline-loading"><div class="mini-spinner"></div><span>Loading...</span></div>
                  {:else if typeSections.length === 0}
                    <p class="draft-inline-empty">No sections yet. <button class="inline-link" on:click={() => openSectionsModal(type.id)}>Add one</button></p>
                  {:else}
                    {#each typeSections as section (section.id)}
                      <div class="draft-inline-section">
                        <span class="draft-inline-section-name">{section.name}</span>
                        <div class="draft-inline-section-actions">
                          <button
                            class="section-generate-btn"
                            disabled={$sectionGenerating === section.id}
                            title="Generate entire section"
                            on:click={() => handleGenerateSection(section.id, type.id)}
                          >
                            {#if $sectionGenerating === section.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                          </button>
                        </div>
                      </div>
                      {#if section.slug === 'planning_assessment' && $assessmentIssues.length > 0}
                        <div class="assessment-issues-list">
                          {#if $assessmentIssuesLoading}
                            <div class="draft-inline-loading"><div class="mini-spinner"></div><span>Loading issues...</span></div>
                          {:else}
                            {#each $assessmentIssues as issue (issue.id)}
                              <div class="assessment-issue-row">
                                <span class="assessment-issue-label">{issue.label}{issue.discipline ? ` — ${issue.discipline}` : ''}</span>
                                <button
                                  class="issue-generate-btn"
                                  disabled={$issueGenerating === issue.id}
                                  title="Regenerate this issue only"
                                  on:click={() => handleGenerateAssessmentIssue(type.id, section.id, issue.id, issue.label)}
                                >
                                  {#if $issueGenerating === issue.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                                </button>
                              </div>
                            {/each}
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  {/if}
                  <button class="draft-setting-btn draft-configure-btn" on:click={() => openSectionsModal(type.id)}>
                    <i class="las la-cog"></i> Configure sections
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

</div>

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
            <span>Analysing briefing transcript and drafting arguments…</span>
          </div>
        {:else if $briefingDraftSuggestions.length === 0}
          <p class="briefing-draft-empty">No suggestions returned.</p>
        {:else}
          <p class="briefing-draft-intro">Review the suggested argument starters below. Accept to append to the issue's argument notes, or skip to ignore.</p>
          <div class="briefing-draft-list">
            {#each $briefingDraftSuggestions as s (s.track_id)}
              {@const accepted = $briefingDraftAccepted.has(s.track_id)}
              {@const skipped = $briefingDraftSkipped.has(s.track_id)}
              <div class="briefing-draft-card" class:bd-accepted={accepted} class:bd-skipped={skipped}>
                <div class="bd-card-header">
                  <span class="bd-issue-label">{s.label}</span>
                  {#if accepted}
                    <span class="bd-status bd-status-accepted"><i class="las la-check"></i> Added</span>
                  {:else if skipped}
                    <span class="bd-status bd-status-skipped">Skipped</span>
                  {:else}
                    <div class="bd-actions">
                      <button class="bd-btn-accept" on:click={() => acceptBriefingDraftSuggestion(s.track_id, s.argument_for)}>
                        <i class="las la-check"></i> Accept
                      </button>
                      <button class="bd-btn-skip" on:click={() => skipBriefingDraftSuggestion(s.track_id)}>Skip</button>
                    </div>
                  {/if}
                </div>
                <p class="bd-argument-text">{s.argument_for}</p>
              </div>
            {/each}
          </div>
          <div class="briefing-draft-footer">
            <button class="btn-primary" on:click={closeBriefingDraft}>Done</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

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
          <div class="log-form-row">
            <div class="log-form-field log-form-field-sm">
              <label class="section-field-label">Type</label>
              <select class="template-select" bind:value={$logItemType}>
                <option value="document">Document</option>
                <option value="drawing">Drawing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="log-form-field">
              <label class="section-field-label">Prepared by</label>
              <input class="add-section-input" type="text" bind:value={$logPreparedBy} placeholder="e.g. Third Revolution Projects Ltd" />
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
          <div class="log-form-row">
            <div class="log-form-field log-form-field-sm">
              <label class="section-field-label">Type</label>
              <select class="template-select" bind:value={$editItemType}>
                <option value="document">Document</option>
                <option value="drawing">Drawing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="log-form-field">
              <label class="section-field-label">Prepared by</label>
              <input class="add-section-input" type="text" bind:value={$editPreparedBy} placeholder="e.g. Third Revolution Projects Ltd" />
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

                      <!-- Template block -->
                      <div class="section-block">
                        <div class="section-block-header">
                          <label class="section-field-label">Template
                            <span class="form-label-hint">— fixed structure with <code>{'{{VARIABLE}}'}</code>, <code>{'{{LLM:slug}}'}</code>…<code>{'{{/LLM}}'}</code> and <code>[Placeholder]</code> markers</span>
                          </label>
                          {#if $sectionTemplateText}
                            <span class="section-mode-badge section-mode-badge--template">Template active</span>
                          {/if}
                        </div>
                        <textarea class="prompt-editor section-prompt section-template" bind:value={$sectionTemplateText} use:autoresize={$sectionTemplateText} placeholder="Paste template HTML here..."></textarea>
                        <div class="section-expand-actions">
                          <button class="modal-save" disabled={$sectionTemplateSaving} on:click={() => handleSaveSectionTemplate(section.id)}>
                            {#if $sectionTemplateSaving}Saving...{:else if $sectionTemplateSaved}<i class="las la-check"></i> Saved{:else}Save template{/if}
                          </button>
                        </div>
                      </div>

                      <!-- Prompt block (used when no template) -->
                      <div class="section-block" class:section-block--dimmed={!!$sectionTemplateText}>
                        <label class="section-field-label">Generation prompt
                          <span class="form-label-hint">
                            {#if section.slug === 'planning_assessment'}
                              — replaces the default assessment prompt when set
                            {:else if $sectionTemplateText}
                              — ignored when template is set
                            {:else}
                              — used when no template
                            {/if}
                          </span>
                        </label>

                        {#if section.slug === 'planning_assessment'}
                          <div class="assessment-vars-hint">
                            <span class="assessment-vars-title">Available variables (substituted per issue)</span>
                            <div class="assessment-vars-list">
                              <code>{'{{ISSUE_LABEL}}'}</code>
                              <code>{'{{ISSUE_DISCIPLINE}}'}</code>
                              <code>{'{{POLICY_STRUCTURE}}'}</code>
                              <code>{'{{ISSUE_CONTEXT}}'}</code>
                              <code>{'{{PROJECT_NAME}}'}</code>
                              <code>{'{{SECTION_NAME}}'}</code>
                              <code>{'{{EXAMPLE_BLOCK}}'}</code>
                            </div>
                            <p class="assessment-vars-note">If left blank, the default structured prompt is used.</p>
                          </div>
                        {/if}

                        <textarea class="prompt-editor section-prompt" bind:value={$sectionPromptText} use:autoresize={$sectionPromptText}></textarea>

                        {#if detectedVars.length > 0}
                          <div class="section-vars-panel">
                            <span class="section-vars-title">Variables in this prompt</span>
                            <div class="section-vars-list">
                              {#each detectedVars as v}
                                <div class="section-var-row">
                                  <div class="section-var-key-cell">
                                    <code class="section-var-key">{'{{'}{v.key}{'}}'}</code>
                                    <span class="section-var-badge" class:section-var-badge--safe={v.programmatic}>
                                      {v.programmatic ? 'prog.' : 'llm'}
                                    </span>
                                  </div>
                                  <span class="section-var-label">{v.label}</span>
                                  <span class="section-var-source">{v.source}</span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}

                        <div class="section-expand-actions">
                          {#if section.slug === 'planning_assessment'}
                            {#if $sectionPromptIsCustom}
                              <span class="prompt-custom-badge">Custom prompt</span>
                              <button class="btn-reset-prompt" disabled={$sectionPromptResetting} on:click={() => handleResetSectionPrompt(section.id)}>
                                {$sectionPromptResetting ? 'Resetting…' : 'Reset to default'}
                              </button>
                            {:else}
                              <span class="prompt-default-badge">Default prompt</span>
                            {/if}
                          {/if}
                          <button class="section-example-btn" on:click={() => openSectionExampleModal(section.id)}>
                            <i class="las la-file-alt"></i> Edit style example
                          </button>
                          <button class="modal-save" disabled={$sectionPromptSaving} on:click={() => handleSaveSectionPrompt(section.id)}>
                            {#if $sectionPromptSaving}Saving...{:else if $sectionPromptSaved}<i class="las la-check"></i> Saved{:else}Save prompt{/if}
                          </button>
                        </div>
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
          <span class="modal-title">Suggestion Prompt</span>
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
          <p class="prompt-hint"><code>&#123;&#123;DOCUMENT&#125;&#125;</code> is replaced with your document text when running.</p>
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
            Run suggestion
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
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    gap: 1rem;
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

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

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

  .result-point {
    margin: 0;
    font-size: 0.8125rem;
    color: #374151;
    line-height: 1.5;
  }

  .result-citation {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.375rem 0.5rem;
    background: #f8fafc;
    border-radius: 4px;
    border-left: 2px solid #e2e8f0;
  }

  .result-citation-quote {
    font-size: 0.75rem;
    color: #475569;
    font-style: italic;
    line-height: 1.4;
  }

  .result-citation-ref {
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
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

  .card-dev-type-select {
    padding: 0.35rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    cursor: pointer;
    max-width: 130px;
  }
  .card-dev-type-select:focus { outline: none; border-color: #7c3aed; }

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

  .draft-sections-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0;
    border: none;
    border-top: 1px solid #f1f5f9;
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: color 0.15s;
  }
  .draft-sections-toggle:hover { color: #374151; }
  .toggle-chevron { margin-left: auto; font-size: 0.75rem; }

  .draft-inline-sections {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.375rem;
  }

  .draft-inline-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .draft-inline-empty {
    margin: 0;
    padding: 0.5rem 0;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .inline-link {
    background: none;
    border: none;
    color: #7c3aed;
    font-size: inherit;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    text-decoration: underline;
  }

  .draft-inline-section {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0.625rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .draft-inline-section-name {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #1e293b;
    min-width: 0;
  }

  .draft-inline-section-actions { display: flex; gap: 0.375rem; align-items: center; }

  .assessment-issues-list {
    margin: 0.125rem 0 0.25rem 1rem;
    border-left: 2px solid #e9d5ff;
    padding-left: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .assessment-issue-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: #faf5ff;
  }

  .assessment-issue-label {
    flex: 1;
    font-size: 0.75rem;
    color: #6b21a8;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .issue-generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid #d8b4fe;
    border-radius: 4px;
    background: white;
    color: #7c3aed;
    cursor: pointer;
    font-size: 0.8125rem;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .issue-generate-btn:hover:not(:disabled) { background: #f5f3ff; border-color: #a855f7; }
  .issue-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .draft-configure-btn {
    margin-top: 0.25rem;
    align-self: flex-start;
  }

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

  .draft-editor-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: #f8fafc;
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

  .prompt-custom-badge {
    font-size: 0.72rem; font-weight: 600;
    background: #f3e8ff; color: #7e22ce;
    padding: 0.2rem 0.5rem; border-radius: 20px;
  }
  .prompt-default-badge {
    font-size: 0.72rem; font-weight: 600;
    background: #f1f5f9; color: #64748b;
    padding: 0.2rem 0.5rem; border-radius: 20px;
  }
  .btn-reset-prompt {
    padding: 0.3rem 0.75rem;
    border: 1px solid #d1d5db; background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: #64748b; cursor: pointer;
  }
  .btn-reset-prompt:hover:not(:disabled) { background: #f8fafc; border-color: #9333ea; color: #7e22ce; }
  .btn-reset-prompt:disabled { opacity: 0.5; cursor: not-allowed; }

  .assessment-vars-hint {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 0.375rem;
  }
  .assessment-vars-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #16a34a;
    margin-bottom: 0.5rem;
  }
  .assessment-vars-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .assessment-vars-list code {
    font-size: 0.72rem;
    background: white;
    border: 1px solid #bbf7d0;
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    color: #15803d;
    font-family: monospace;
  }
  .assessment-vars-note {
    margin: 0;
    font-size: 0.72rem;
    color: #64748b;
  }

  /* ── Draft from briefing ── */
  .argument-panel-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
  }

  .btn-draft-from-briefing {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
    background: #faf5ff;
    border: 1px solid #d8b4fe;
    border-radius: 6px;
    color: #7c3aed;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-draft-from-briefing:hover { background: #f3e8ff; border-color: #a855f7; }

  .modal-briefing-draft { max-width: 680px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; }
  .modal-briefing-draft .modal-body { overflow-y: auto; flex: 1; }

  .briefing-draft-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .briefing-draft-intro {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0 0 1rem;
  }

  .briefing-draft-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .briefing-draft-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.875rem;
    transition: border-color 0.15s;
  }
  .briefing-draft-card.bd-accepted { border-color: #86efac; background: #f0fdf4; }
  .briefing-draft-card.bd-skipped { opacity: 0.45; }

  .bd-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .bd-issue-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  .bd-actions { display: flex; gap: 0.375rem; }

  .bd-btn-accept {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    background: #7c3aed;
    border: none;
    border-radius: 5px;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }
  .bd-btn-accept:hover { background: #6d28d9; }

  .bd-btn-skip {
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    color: #6b7280;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .bd-btn-skip:hover { background: #f9fafb; }

  .bd-status {
    font-size: 0.75rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .bd-status-accepted { color: #16a34a; }
  .bd-status-skipped { color: #9ca3af; }

  .bd-argument-text {
    font-size: 0.8125rem;
    color: #374151;
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .briefing-draft-footer {
    margin-top: 1.25rem;
    display: flex;
    justify-content: flex-end;
  }

  .briefing-draft-empty { color: #6b7280; font-size: 0.875rem; }

  .section-vars-panel {
    margin: 0.75rem 0 0;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
  }

  .section-vars-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .section-vars-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .section-var-row {
    display: grid;
    grid-template-columns: minmax(0, 16rem) minmax(0, 10rem) minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .section-var-key-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .section-var-key {
    font-family: monospace;
    font-size: 0.7rem;
    color: #7c3aed;
    background: #ede9fe;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .section-var-label {
    color: #1e293b;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-var-source {
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-var-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    background: #fef9c3;
    color: #92400e;
  }

  .section-var-badge--safe {
    background: #dcfce7;
    color: #166534;
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .section-block--dimmed {
    opacity: 0.5;
  }

  .section-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .section-mode-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .section-mode-badge--template {
    background: #dcfce7;
    color: #166534;
  }

  .section-template {
    font-family: monospace;
    font-size: 0.72rem;
    min-height: 6rem;
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

  /* ── Chat / suggestion UI ── */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .chat-thread {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .chat-msg {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 100%;
  }

  .chat-msg.assistant {
    align-self: flex-start;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .chat-msg.user {
    align-self: flex-end;
    background: #ede9fe;
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    max-width: 85%;
  }

  .chat-msg.user p {
    margin: 0;
    font-size: 0.875rem;
    color: #3730a3;
    white-space: pre-wrap;
  }

  .chat-msg.loading-msg {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: #94a3b8;
    font-size: 0.85rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
  }

  .chat-prose {
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .chat-msg-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }

  .accept-multi {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .accept-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid #7c3aed;
    background: white;
    color: #7c3aed;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    align-self: flex-start;
  }

  .accept-btn:hover:not(.accepted) { background: #ede9fe; }

  .accept-btn.accepted {
    background: #f0fdf4;
    border-color: #16a34a;
    color: #16a34a;
    cursor: default;
  }

  .accept-btn-sm {
    font-size: 0.75rem;
    padding: 0.25rem 0.6rem;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    align-items: flex-end;
  }

  .chat-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    line-height: 1.4;
    color: #374151;
  }

  .chat-input:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.07); }

  .chat-send-btn {
    padding: 0.5rem 0.75rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .chat-send-btn:hover:not(:disabled) { background: #6d28d9; }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .doc-title-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.45rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #374151;
    background: #f8fafc;
  }

  .doc-title-input:focus { outline: none; border-color: #7c3aed; background: white; box-shadow: 0 0 0 3px rgba(124,58,237,0.07); }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

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
</style>
