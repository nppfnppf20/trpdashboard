<script>
  import { onMount } from 'svelte';
  import { getKeyIssues, updateKeyIssueSummary, getIssueNotes, upsertIssueNote, analyseDocument, getPromptTemplate, savePromptTemplate, deletePromptTemplate } from '$lib/api/appeal.js';

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

  // Upload panel state
  let fileInput;
  let dragOver = false;
  let pasteText = '';
  let activeInputTab = 'upload';
  let selectedFile = null;
  let documentType = 'Officer Report';
  let documentDirection = 'against'; // 'for' | 'against'
  let userNotes = '';
  let selectedTrackIds = [];

  // Analysis state: 'idle' | 'loading' | 'results'
  let analysisState = 'idle';
  let analysisError = null;

  // Prompt modal
  let promptModalOpen = false;
  let promptText = '';
  let promptLoading = false;
  let promptSaving = false;
  let promptSaved = false;
  let promptIsCustom = false; // true if a saved template exists
  let analysisSummary = '';
  let analysisCoverage = []; // [{ issue_id, assessment }]
  let extractedPoints = []; // [{ track_id, field, point, dismissed }]

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) selectedFile = file;
  }

  function onFileInputChange(e) {
    selectedFile = e.target.files[0] ?? null;
    e.target.value = '';
  }

  function buildPayload(extras = {}) {
    return {
      documentType,
      documentDirection,
      userNotes: userNotes.trim() || null,
      relevantTrackIds: selectedTrackIds,
      ...(activeInputTab === 'upload' ? { file: selectedFile } : { text: pasteText }),
      ...extras
    };
  }

  async function openPromptModal() {
    promptLoading = true;
    promptModalOpen = true;
    promptText = '';
    promptSaved = false;
    try {
      // Try saved template first
      const saved = await getPromptTemplate(project.id);
      if (saved?.extract_points_template) {
        promptText = saved.extract_points_template;
        promptIsCustom = true;
      } else {
        // No saved template — generate default with current issue context
        const result = await analyseDocument(project.id, buildPayload({ preview: true }));
        promptText = result.template;
        promptIsCustom = false;
      }
    } catch (err) {
      promptText = `Error loading prompt: ${err.message}`;
    } finally {
      promptLoading = false;
    }
  }

  async function savePrompt() {
    promptSaving = true;
    try {
      await savePromptTemplate(project.id, promptText);
      promptIsCustom = true;
      promptSaved = true;
      setTimeout(() => { promptSaved = false; }, 2500);
    } catch (err) {
      console.error('Failed to save prompt:', err);
    } finally {
      promptSaving = false;
    }
  }

  async function resetPromptToDefault() {
    promptLoading = true;
    try {
      await deletePromptTemplate(project.id);
      const result = await analyseDocument(project.id, buildPayload({ preview: true }));
      promptText = result.template;
      promptIsCustom = false;
    } catch (err) {
      console.error('Failed to reset prompt:', err);
    } finally {
      promptLoading = false;
    }
  }

  async function runAnalysisWithPrompt() {
    promptModalOpen = false;
    // Replace {{DOCUMENT}} on the backend — send template as customPrompt
    await runAnalysis(promptText);
  }

  async function runAnalysis(customPrompt = null) {
    analysisState = 'loading';
    analysisError = null;
    try {
      const payload = buildPayload(customPrompt ? { customPrompt } : {});
      const raw = await analyseDocument(project.id, payload);
      // Handle both new object format and legacy array format
      const result = Array.isArray(raw) ? { summary: '', coverage: [], points: raw } : raw;
      analysisSummary = result.summary ?? '';
      analysisCoverage = result.coverage ?? [];
      extractedPoints = (result.points ?? []).map(p => ({ ...p, dismissed: false }));
      console.log('Analysis result:', result);
      analysisState = 'results';
    } catch (err) {
      analysisError = err.message;
      analysisState = 'idle';
    }
  }

  function resetAnalysis() {
    analysisState = 'idle';
    analysisSummary = '';
    analysisCoverage = [];
    extractedPoints = [];
    selectedFile = null;
    pasteText = '';
    userNotes = '';
    selectedTrackIds = [];
    documentDirection = 'against';
    analysisError = null;
  }

  function toggleTrack(id) {
    selectedTrackIds = selectedTrackIds.includes(id)
      ? selectedTrackIds.filter(t => t !== id)
      : [...selectedTrackIds, id];
  }

  function dismissPoint(idx) {
    extractedPoints = extractedPoints.map((p, i) => i === idx ? { ...p, dismissed: true } : p);
  }

  function acceptPoint(idx) {
    const point = extractedPoints[idx];
    const trackId = point.track_id;
    const field = point.field; // 'argument_against' | 'argument_for'

    if (trackId !== null) {
      const current = issueNotes[trackId]?.[field] ?? '';
      const updated = current ? `${current}\n\n${point.point}` : point.point;
      issueNotes = {
        ...issueNotes,
        [trackId]: { ...(issueNotes[trackId] ?? {}), [field]: updated }
      };
      saveNote(trackId);
    }
    // For general (null track_id) points we just dismiss — user copies manually
    extractedPoints = extractedPoints.map((p, i) => i === idx ? { ...p, dismissed: true } : p);
  }

  $: activePoints = extractedPoints.filter(p => !p.dismissed);
  $: pointsByIssue = (() => {
    const groups = {};
    for (const p of activePoints) {
      const key = p.track_id ?? '__general__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  })();

  export let project;

  let activeTab = 'key-issues';

  let keyIssues = [];
  let issueNotes = {};   // { [track_id]: notes string }
  let loading = true;
  let loadError = null;

  // Per-note save state: { [track_id]: 'saving' | 'saved' | null }
  let noteStatus = {};

  let saveTimers = {};

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      [keyIssues, issueNotes] = await Promise.all([
        getKeyIssues(project.id),
        getIssueNotes(project.id)
      ]);
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  function handleNoteInput(trackId, field, value) {
    issueNotes = {
      ...issueNotes,
      [trackId]: { ...(issueNotes[trackId] ?? {}), [field]: value }
    };
    const key = `${trackId}`;
    if (saveTimers[key]) clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(() => saveNote(trackId), 1500);
  }

  async function saveNote(trackId) {
    noteStatus = { ...noteStatus, [trackId]: 'saving' };
    try {
      const n = issueNotes[trackId] ?? {};
      await upsertIssueNote(project.id, trackId, n.argument_against ?? null, n.argument_for ?? null);
      noteStatus = { ...noteStatus, [trackId]: 'saved' };
      setTimeout(() => { noteStatus = { ...noteStatus, [trackId]: null }; }, 2000);
    } catch (err) {
      console.error('Failed to save note:', err);
      noteStatus = { ...noteStatus, [trackId]: null };
    }
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
    <button class="tab" class:active={activeTab === 'argument'} on:click={() => activeTab = 'argument'}>
      Argument Structure
    </button>
    <button class="tab" class:active={activeTab === 'draft'} on:click={() => activeTab = 'draft'}>
      Draft Document
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

  {:else if activeTab === 'argument'}
    <!-- ── Tab 2: Argument Structure ── -->
    <div class="argument-body">

      <!-- Left: per-issue notes -->
      <div class="argument-panel">
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
                  {#if noteStatus[issue.id] === 'saving'}
                    <span class="note-status saving"><div class="mini-spinner"></div> Saving</span>
                  {:else if noteStatus[issue.id] === 'saved'}
                    <span class="note-status saved"><i class="las la-check"></i> Saved</span>
                  {/if}
                </div>
                <div class="note-fields">
                  <div class="note-field-group against">
                    <label class="note-label against-label">Argument Against</label>
                    <textarea
                      class="notes-field against-field"
                      placeholder="Paste the refusal reason, inspector's objection, or opposing position..."
                      value={issueNotes[issue.id]?.argument_against ?? ''}
                      use:autoresize={issueNotes[issue.id]?.argument_against}
                      on:input={(e) => handleNoteInput(issue.id, 'argument_against', e.target.value)}
                    ></textarea>
                  </div>
                  <div class="note-field-group for">
                    <label class="note-label for-label">Argument For</label>
                    <textarea
                      class="notes-field for-field"
                      placeholder="Our response — evidence, policy hooks, expert position, how we address the objection..."
                      value={issueNotes[issue.id]?.argument_for ?? ''}
                      use:autoresize={issueNotes[issue.id]?.argument_for}
                      on:input={(e) => handleNoteInput(issue.id, 'argument_for', e.target.value)}
                    ></textarea>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right: document upload panel -->
      <div class="input-panel">

        {#if analysisState === 'loading'}
          <div class="analysis-loading">
            <div class="spinner"></div>
            <p>Analysing document...</p>
          </div>

        {:else if analysisState === 'results'}
          <div class="results-header">
            <span class="results-title">Analysis</span>
            <button class="reset-btn" on:click={resetAnalysis}><i class="las la-arrow-left"></i> New document</button>
          </div>

          <div class="results-list">

            {#if analysisSummary}
              <div class="result-summary">
                <p>{analysisSummary}</p>
              </div>
            {/if}

            {#if analysisCoverage.length > 0}
              <div class="result-group">
                <div class="result-group-label">Issue coverage</div>
                {#each analysisCoverage as cov}
                  {@const issue = keyIssues.find(i => i.id === cov.issue_id)}
                  {#if issue}
                    <div class="coverage-row">
                      <span class="coverage-issue">{issue.label}</span>
                      <span class="coverage-text">{cov.assessment}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}

            {#if activePoints.length === 0}
              <div class="results-empty">
                <i class="las la-check-circle"></i>
                <p>{extractedPoints.length > 0 ? 'All points reviewed.' : 'No specific points extracted — see summary above.'}</p>
              </div>
            {:else}
              <div class="result-group">
                <div class="result-group-label">Suggested points — tick to add, cross to dismiss</div>
                {#each Object.entries(pointsByIssue) as [groupKey, points]}
                  {@const issueLabel = groupKey === '__general__'
                    ? 'General'
                    : (keyIssues.find(i => String(i.id) === String(groupKey))?.label ?? 'Unknown')}
                  <div class="result-subgroup">
                    <div class="result-subgroup-label">{issueLabel}</div>
                    {#each points as point}
                      {@const globalIdx = extractedPoints.indexOf(point)}
                      <div class="result-card">
                        <div class="result-card-top">
                          <span class="result-field-tag" class:against={point.field === 'argument_against'} class:for={point.field === 'argument_for'}>
                            {point.field === 'argument_against' ? 'Against' : 'For'}
                          </span>
                          <div class="result-actions">
                            <button class="result-btn accept" title="Add to notes" on:click={() => acceptPoint(globalIdx)}>
                              <i class="las la-check"></i>
                            </button>
                            <button class="result-btn dismiss" title="Dismiss" on:click={() => dismissPoint(globalIdx)}>
                              <i class="las la-times"></i>
                            </button>
                          </div>
                        </div>
                        <p class="result-point">{point.point}</p>
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
            {/if}

          </div>

        {:else}
          <!-- Idle: upload / paste -->
          <div class="input-tabs">
            <button class="input-tab" class:active={activeInputTab === 'upload'} on:click={() => activeInputTab = 'upload'}>
              <i class="las la-file-upload"></i> Upload
            </button>
            <button class="input-tab" class:active={activeInputTab === 'paste'} on:click={() => activeInputTab = 'paste'}>
              <i class="las la-paste"></i> Paste Text
            </button>
          </div>

          <div class="idle-form">

            <div class="form-row">
              <label class="form-label">Document is</label>
              <div class="direction-toggle">
                <button
                  class="direction-btn"
                  class:active={documentDirection === 'against'}
                  on:click={() => documentDirection = 'against'}
                >
                  Against the proposal
                </button>
                <button
                  class="direction-btn"
                  class:active={documentDirection === 'for'}
                  on:click={() => documentDirection = 'for'}
                >
                  For the proposal
                </button>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Document type</label>
              <select class="doc-type-select" bind:value={documentType}>
                {#each DOC_TYPES as t}<option>{t}</option>{/each}
              </select>
            </div>

            {#if activeInputTab === 'upload'}
              <div
                class="upload-zone"
                class:drag-over={dragOver}
                class:has-file={selectedFile}
                on:dragover|preventDefault={() => dragOver = true}
                on:dragleave={() => dragOver = false}
                on:drop={onDrop}
                on:click={() => fileInput.click()}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
              >
                {#if selectedFile}
                  <i class="las la-file-alt"></i>
                  <span>{selectedFile.name}</span>
                  <span class="upload-sub">Click to change</span>
                {:else}
                  <i class="las la-cloud-upload-alt"></i>
                  <span>Drop a PDF or click to upload</span>
                  <span class="upload-sub">PDF, TXT or MD · max 20MB</span>
                {/if}
              </div>
              <input type="file" accept=".pdf,.txt,.md" bind:this={fileInput} on:change={onFileInputChange} style="display:none" />
            {:else}
              <textarea
                class="paste-area"
                bind:value={pasteText}
                placeholder="Paste text from a document, report or meeting notes here..."
              ></textarea>
            {/if}

            <div class="form-row">
              <label class="form-label">Your guidance <span class="form-label-hint">(optional — directs what the AI looks for)</span></label>
              <textarea
                class="user-notes-field"
                bind:value={userNotes}
                placeholder="e.g. Focus on paragraph 5.3 regarding noise, the officer concedes the heritage impact is minor..."
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
                        checked={selectedTrackIds.includes(issue.id)}
                        on:change={() => toggleTrack(issue.id)}
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
                disabled={activeInputTab === 'upload' ? !selectedFile : !pasteText.trim()}
                on:click={() => runAnalysis()}
              >
                Analyse document
              </button>
              <button
                class="prompt-btn"
                disabled={activeInputTab === 'upload' ? !selectedFile : !pasteText.trim()}
                on:click={openPromptModal}
                title="View and edit the prompt before running"
              >
                <i class="las la-code"></i> Edit prompt
              </button>
            </div>

            {#if analysisError}
              <p class="analysis-error">{analysisError}</p>
            {/if}

          </div>
        {/if}

      </div>

    </div>

  {:else if activeTab === 'draft'}
    <!-- ── Tab 3: Draft Document ── -->
    <div class="tab-body">
      <div class="empty-state">
        <i class="las la-file-alt"></i>
        <p>Draft document — coming soon.</p>
      </div>
    </div>
  {/if}

</div>

<!-- Prompt modal -->
{#if promptModalOpen}
  <div class="modal-overlay" on:click|self={() => promptModalOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-header-left">
          <span class="modal-title">Extraction Prompt</span>
          {#if promptIsCustom}
            <span class="prompt-custom-badge">Custom saved</span>
          {:else}
            <span class="prompt-default-badge">Default</span>
          {/if}
        </div>
        <button class="modal-close" on:click={() => promptModalOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        {#if promptLoading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
        {:else}
          <p class="prompt-hint"><code>&#123;&#123;DOCUMENT&#125;&#125;</code> is replaced with your document text when running.</p>
          <textarea class="prompt-editor" bind:value={promptText}></textarea>
        {/if}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left">
          {#if promptIsCustom}
            <button class="modal-reset" on:click={resetPromptToDefault} disabled={promptLoading}>
              Reset to default
            </button>
          {/if}
        </div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => promptModalOpen = false}>Cancel</button>
          <button class="modal-save" disabled={promptLoading || promptSaving || !promptText} on:click={savePrompt}>
            {#if promptSaving}Saving...{:else if promptSaved}<i class="las la-check"></i> Saved{:else}Save as default{/if}
          </button>
          <button class="modal-run" disabled={promptLoading || !promptText} on:click={runAnalysisWithPrompt}>
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
</style>
