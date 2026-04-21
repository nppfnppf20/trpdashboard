<script>
  import { onMount } from 'svelte';
  import { getKeyIssues, updateKeyIssueSummary, getIssueNotes, upsertIssueNote } from '$lib/api/appeal.js';

  // Document upload
  let fileInput;
  let dragOver = false;
  let pasteText = '';
  let activeInputTab = 'upload';

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileInputChange(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleFile(file) {
    console.log('File selected:', file.name);
  }

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
                      on:input={(e) => handleNoteInput(issue.id, 'argument_against', e.target.value)}
                    ></textarea>
                  </div>
                  <div class="note-field-group for">
                    <label class="note-label for-label">Argument For</label>
                    <textarea
                      class="notes-field for-field"
                      placeholder="Our response — evidence, policy hooks, expert position, how we address the objection..."
                      value={issueNotes[issue.id]?.argument_for ?? ''}
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
        <div class="input-tabs">
          <button class="input-tab" class:active={activeInputTab === 'upload'} on:click={() => activeInputTab = 'upload'}>
            <i class="las la-file-upload"></i> Upload PDF
          </button>
          <button class="input-tab" class:active={activeInputTab === 'paste'} on:click={() => activeInputTab = 'paste'}>
            <i class="las la-paste"></i> Paste Text
          </button>
        </div>

        {#if activeInputTab === 'upload'}
          <div
            class="upload-zone"
            class:drag-over={dragOver}
            on:dragover|preventDefault={() => dragOver = true}
            on:dragleave={() => dragOver = false}
            on:drop={onDrop}
            on:click={() => fileInput.click()}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
          >
            <i class="las la-cloud-upload-alt"></i>
            <span>Drop a PDF here or click to upload</span>
            <span class="upload-sub">PDF, TXT or MD · max 20MB</span>
          </div>
          <input type="file" accept=".pdf,.txt,.md" bind:this={fileInput} on:change={onFileInputChange} style="display:none" />
        {:else}
          <textarea
            class="paste-area"
            bind:value={pasteText}
            placeholder="Paste text from a document, report or meeting notes here..."
          ></textarea>
          <button class="analyse-btn" disabled={!pasteText.trim()}>Analyse text</button>
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
    margin: 0 1.25rem 1.25rem;
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
    resize: vertical;
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
</style>
