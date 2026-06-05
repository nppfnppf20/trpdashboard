<script>
  import { createEventDispatcher } from 'svelte';
  import { uploadBriefingNote, amendDraftFromBriefing } from '$lib/api/appeal.js';

  export let project;
  export let typeId;           // 'appeal_N'
  export let briefingNotes = [];
  export let currentDraftHtml = '';

  const dispatch = createEventDispatcher();

  const rawTypeId = parseInt(typeId.replace('appeal_', ''), 10);

  const DOC_TYPES = [
    { value: 'project_briefing',  label: 'Project Briefing' },
    { value: 'specialist_report', label: 'Specialist Report' },
    { value: 'expert_evidence',   label: 'Expert Evidence / Proof' },
    { value: 'revised_document',  label: 'Revised Document' },
    { value: 'other',             label: 'Other Document' },
  ];

  // 'idle' | 'uploading' | 'amending' | 'review'
  let state = 'idle';
  let docType = 'project_briefing';
  let inputTab = 'select';   // 'select' | 'paste' | 'upload'
  let selectedNoteId = null;
  let pasteText = '';
  let pasteTitle = '';
  let uploadFile = null;
  let fileInput;
  let amendedHtml = '';
  let error = '';
  let localNotes = briefingNotes;

  $: localNotes = briefingNotes;
  // 'select' tab only makes sense for project_briefing (existing notes are briefing transcripts)
  $: if (docType !== 'project_briefing' && inputTab === 'select') inputTab = 'paste';

  async function run() {
    error = '';
    let briefingNoteId = null;
    let docText = null;

    if (inputTab === 'select') {
      if (!selectedNoteId) { error = 'Select a briefing note first.'; return; }
      briefingNoteId = selectedNoteId;
    } else if (inputTab === 'paste') {
      if (!pasteText.trim()) { error = 'Paste some text first.'; return; }
      docText = pasteText.trim();
    } else {
      if (!uploadFile) { error = 'Choose a file first.'; return; }
      state = 'uploading';
      try {
        const note = await uploadBriefingNote(project.id, {
          file: uploadFile,
          title: uploadFile.name.replace(/\.[^.]+$/, ''),
        });
        localNotes = [...localNotes, note];
        briefingNoteId = note.id;
      } catch (err) {
        error = err.message;
        state = 'idle';
        return;
      } finally {
        if (fileInput) fileInput.value = '';
        uploadFile = null;
      }
    }

    state = 'amending';
    try {
      const result = await amendDraftFromBriefing(project.id, rawTypeId, {
        currentHtml: currentDraftHtml,
        briefingNoteId,
        docText,
        docType,
      });
      amendedHtml = result.html;
      state = 'review';
      dispatch('reviewchange', { active: true });
    } catch (err) {
      error = err.message;
      state = 'idle';
    }
  }

  function apply() {
    dispatch('accepted', { html: amendedHtml });
    reset();
  }

  function reset() {
    state = 'idle';
    amendedHtml = '';
    error = '';
    dispatch('reviewchange', { active: false });
  }
</script>

{#if state === 'review'}
  <div class="amend-review">
    <div class="amend-review-bar">
      <span class="amend-review-title"><i class="las la-magic"></i> Proposed amendments</span>
      <div class="amend-review-actions">
        <button class="amend-btn-apply" on:click={apply}><i class="las la-check"></i> Apply to draft</button>
        <button class="amend-btn-dismiss" on:click={reset}>Dismiss</button>
      </div>
    </div>
    <div class="amend-review-body">
      {@html amendedHtml}
    </div>
  </div>
{:else}
  <div class="amend-panel">
    <div class="amend-panel-header">
      <span class="amend-panel-title"><i class="las la-file-import"></i> Incorporate document</span>
    </div>

    <!-- Doc type selector -->
    <div class="amend-field">
      <label class="amend-label">Document type</label>
      <select class="amend-select" bind:value={docType}>
        {#each DOC_TYPES as dt}
          <option value={dt.value}>{dt.label}</option>
        {/each}
      </select>
    </div>

    <!-- Input method tabs -->
    <div class="amend-tabs">
      {#if docType === 'project_briefing'}
        <button class="amend-tab" class:active={inputTab === 'select'} on:click={() => inputTab = 'select'}>Select existing</button>
      {/if}
      <button class="amend-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>Paste</button>
      <button class="amend-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>Upload</button>
    </div>

    {#if inputTab === 'select'}
      {#if localNotes.length === 0}
        <p class="amend-empty">No briefing notes for this project yet — use Paste or Upload to add one.</p>
      {:else}
        <div class="amend-note-list">
          {#each localNotes as note (note.id)}
            <label class="amend-note-item" class:amend-note-item--selected={selectedNoteId === note.id}>
              <input type="radio" name="briefing-note" value={note.id} bind:group={selectedNoteId} />
              <span class="amend-note-name">{note.title || note.file_name || `Note ${note.id}`}</span>
              <span class="amend-note-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </label>
          {/each}
        </div>
      {/if}
    {:else if inputTab === 'paste'}
      <input class="amend-input" type="text" placeholder="Title (optional)" bind:value={pasteTitle} />
      <textarea class="amend-textarea" placeholder="Paste document text here..." bind:value={pasteText}></textarea>
    {:else}
      <div
        class="amend-upload-zone"
        class:has-file={uploadFile}
        on:dragover|preventDefault={() => {}}
        on:drop={(e) => { e.preventDefault(); uploadFile = e.dataTransfer?.files[0] ?? null; }}
        on:click={() => fileInput.click()}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
      >
        {#if uploadFile}
          <i class="las la-file-alt"></i>
          <span>{uploadFile.name}</span>
          <span class="amend-upload-sub">Click to change</span>
        {:else}
          <i class="las la-cloud-upload-alt"></i>
          <span>Drop a file or click to upload</span>
          <span class="amend-upload-sub">PDF, TXT or MD</span>
        {/if}
      </div>
      <input type="file" accept=".pdf,.txt,.md" style="display:none" bind:this={fileInput}
        on:change={(e) => { uploadFile = e.target.files?.[0] ?? null; }} />
    {/if}

    {#if error}
      <p class="amend-error"><i class="las la-exclamation-circle"></i> {error}</p>
    {/if}

    <button
      class="amend-run-btn"
      disabled={state === 'uploading' || state === 'amending'}
      on:click={run}
    >
      {#if state === 'uploading'}
        <div class="mini-spinner"></div> Uploading...
      {:else if state === 'amending'}
        <div class="mini-spinner"></div> Suggesting amendments...
      {:else}
        <i class="las la-magic"></i> Suggest amendments
      {/if}
    </button>
  </div>
{/if}

<style>
  .amend-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .amend-panel-header { display: flex; align-items: center; }

  .amend-panel-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .amend-field { display: flex; flex-direction: column; gap: 0.25rem; }

  .amend-label { font-size: 0.75rem; font-weight: 600; color: #475569; }

  .amend-select {
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #374151;
    background: white;
    cursor: pointer;
  }
  .amend-select:focus { outline: none; border-color: #7c3aed; }

  .amend-tabs {
    display: flex;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .amend-tab {
    flex: 1;
    padding: 0.375rem 0.5rem;
    background: white;
    border: none;
    font-size: 0.775rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }
  .amend-tab + .amend-tab { border-left: 1px solid #e2e8f0; }
  .amend-tab.active { background: #7c3aed; color: white; }
  .amend-tab:hover:not(.active) { background: #f8fafc; }

  .amend-empty { margin: 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }

  .amend-note-list { display: flex; flex-direction: column; gap: 0.25rem; }

  .amend-note-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 0.8125rem;
    color: #374151;
    transition: border-color 0.15s, background 0.15s;
  }
  .amend-note-item:hover { background: #f8fafc; }
  .amend-note-item--selected { border-color: #a78bfa; background: #f5f3ff; }
  .amend-note-item input { flex-shrink: 0; accent-color: #7c3aed; cursor: pointer; }
  .amend-note-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .amend-note-date { flex-shrink: 0; font-size: 0.75rem; color: #94a3b8; }

  .amend-input {
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #374151;
    width: 100%;
    box-sizing: border-box;
  }
  .amend-input:focus { outline: none; border-color: #7c3aed; }

  .amend-textarea {
    min-height: 140px;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: vertical;
    line-height: 1.5;
    width: 100%;
    box-sizing: border-box;
  }
  .amend-textarea:focus { outline: none; border-color: #7c3aed; }

  .amend-upload-zone {
    border: 2px dashed #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
    text-align: center;
    font-size: 0.8125rem;
    color: #64748b;
    transition: border-color 0.15s, background 0.15s;
  }
  .amend-upload-zone:hover, .amend-upload-zone.has-file { border-color: #a78bfa; background: #faf5ff; }
  .amend-upload-zone i { font-size: 1.5rem; color: #7c3aed; }
  .amend-upload-sub { font-size: 0.75rem; color: #94a3b8; }

  .amend-error { margin: 0; font-size: 0.8rem; color: #ef4444; display: flex; align-items: center; gap: 0.35rem; }

  .amend-run-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s;
    margin-top: auto;
  }
  .amend-run-btn:hover:not(:disabled) { background: #6d28d9; }
  .amend-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Review mode ── */
  .amend-review { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .amend-review-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
    flex-shrink: 0;
  }

  .amend-review-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .amend-review-actions { display: flex; gap: 0.5rem; align-items: center; }

  .amend-btn-apply {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s;
  }
  .amend-btn-apply:hover { background: #6d28d9; }

  .amend-btn-dismiss {
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #64748b;
    cursor: pointer;
  }
  .amend-btn-dismiss:hover { background: #f1f5f9; }

  .amend-review-body {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 3rem;
    font-size: 0.9rem;
    line-height: 1.75;
    color: #1e293b;
  }
  .amend-review-body :global(h2) { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
  .amend-review-body :global(h3) { font-size: 0.95rem; font-weight: 600; margin: 1.25rem 0 0.4rem; }
  .amend-review-body :global(p)  { margin: 0 0 0.875rem; }
  .amend-review-body :global(ul), .amend-review-body :global(ol) { margin: 0 0 0.875rem; padding-left: 1.5rem; }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
