<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { getKeyIssues, getArgument, saveArgument } from '$lib/api/appeal.js';

  export let project;

  const dispatch = createEventDispatcher();

  let activeTab = 'key-issues';

  // Data
  let keyIssues = [];
  let argument = null;
  let loading = true;
  let loadError = null;

  // Argument editor
  let editorComponent;
  let saving = false;
  let lastSaved = null;
  let saveTimer = null;

  // Document upload
  let fileInput;
  let dragOver = false;
  let pasteText = '';
  let activeInputTab = 'upload'; // 'upload' | 'paste'

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      [keyIssues, argument] = await Promise.all([
        getKeyIssues(project.id),
        getArgument(project.id)
      ]);
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  // Build initial HTML skeleton from key issues (headings only, no generate call yet)
  function buildArgumentSkeleton() {
    if (!keyIssues.length) return '<p>No key issues found for this project.</p>';
    return keyIssues.map(issue =>
      `<h2>${issue.label}</h2><p></p>`
    ).join('\n');
  }

  $: argumentContent = argument?.argument_html || buildArgumentSkeleton();

  function handleEditorChange(event) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => autoSave(event.detail.html), 2000);
  }

  async function autoSave(html) {
    saving = true;
    try {
      argument = await saveArgument(project.id, html);
      lastSaved = new Date();
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      saving = false;
    }
  }

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
    // Wiring up later — just log for now
    console.log('File selected:', file.name);
  }

  const riskColours = {
    showstopper:        { bg: '#fee2e2', colour: '#991b1b' },
    extremely_high_risk:{ bg: '#fee2e2', colour: '#dc2626' },
    high_risk:          { bg: '#ffedd5', colour: '#c2410c' },
    medium_high_risk:   { bg: '#fef9c3', colour: '#a16207' },
    medium_risk:        { bg: '#fef9c3', colour: '#ca8a04' },
    medium_low_risk:    { bg: '#dcfce7', colour: '#15803d' },
    low_risk:           { bg: '#dcfce7', colour: '#16a34a' }
  };
</script>

<div class="workspace">

  <!-- Header -->
  <div class="workspace-header">
    <div class="header-left">
      <div class="header-info">
        <h1>{project.project_name}</h1>
        {#if project.project_id}<span class="project-ref">{project.project_id}</span>{/if}
      </div>
    </div>

    {#if activeTab === 'argument'}
      <div class="save-status">
        {#if saving}
          <span class="saving"><div class="mini-spinner"></div> Saving...</span>
        {:else if lastSaved}
          <span class="saved"><i class="las la-check"></i> Saved {lastSaved.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
        {/if}
      </div>
    {/if}
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
          {#each keyIssues as issue}
            {@const risk = riskColours[issue.last_known_risk_level]}
            <div class="issue-row">
              <div class="issue-label">
                {#if issue.discipline_group}
                  <span class="discipline-tag">{issue.discipline_group}</span>
                {/if}
                <span class="issue-name">{issue.label}</span>
              </div>
              {#if issue.last_known_risk_level}
                <span
                  class="risk-chip"
                  style="background:{risk?.bg ?? '#f1f5f9'}; color:{risk?.colour ?? '#64748b'}"
                >
                  {issue.last_known_risk_level.replace(/_/g, ' ')}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'argument'}
    <!-- ── Tab 2: Argument Structure ── -->
    <div class="argument-body">

      <!-- Left: editor -->
      <div class="editor-panel">
        <RichTextEditor
          bind:this={editorComponent}
          content={argumentContent}
          placeholder="Your argument will appear here, structured by key issue..."
          on:change={handleEditorChange}
        />
      </div>

      <!-- Right: input panel -->
      <div class="input-panel">
        <div class="input-tabs">
          <button
            class="input-tab"
            class:active={activeInputTab === 'upload'}
            on:click={() => activeInputTab = 'upload'}
          >
            <i class="las la-file-upload"></i> Upload PDF
          </button>
          <button
            class="input-tab"
            class:active={activeInputTab === 'paste'}
            on:click={() => activeInputTab = 'paste'}
          >
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
          <input
            type="file"
            accept=".pdf,.txt,.md"
            bind:this={fileInput}
            on:change={onFileInputChange}
            style="display:none"
          />
        {:else}
          <textarea
            class="paste-area"
            bind:value={pasteText}
            placeholder="Paste text from a document, report or meeting notes here..."
          ></textarea>
          <button class="analyse-btn" disabled={!pasteText.trim()}>
            Analyse text
          </button>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'draft'}
    <!-- ── Tab 3: Draft Document (placeholder) ── -->
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

  /* Header */
  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  .save-status { font-size: 0.8rem; }
  .saving { color: #94a3b8; display: flex; align-items: center; gap: 0.375rem; }
  .saved  { color: #16a34a; display: flex; align-items: center; gap: 0.375rem; }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
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

  /* Generic tab body (key issues + draft) */
  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* Key issues list */
  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 720px;
  }

  .issue-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.125rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    gap: 1rem;
  }

  .issue-label {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .discipline-tag {
    font-size: 0.75rem;
    font-weight: 600;
    background: #f1f5f9;
    color: #64748b;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .issue-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
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

  /* Argument tab — two panels */
  .argument-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 0;
    min-height: 0;
    overflow: hidden;
  }

  .editor-panel {
    padding: 1.5rem;
    overflow-y: auto;
    border-right: 1px solid #e2e8f0;
    background: white;
  }

  .editor-panel :global(.rich-text-editor) {
    border: none;
    height: 100%;
  }

  .editor-panel :global(.editor-content) {
    min-height: 400px;
    max-height: none;
  }

  /* Right input panel */
  .input-panel {
    display: flex;
    flex-direction: column;
    background: #f8fafc;
    overflow-y: auto;
  }

  .input-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: white;
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

  .upload-zone:hover, .upload-zone.drag-over {
    border-color: #7c3aed;
    background: #faf5ff;
  }

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
    min-height: 240px;
    transition: border-color 0.15s;
    background: white;
  }

  .paste-area:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124,58,237,0.08);
  }

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

  /* Spinners */
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
