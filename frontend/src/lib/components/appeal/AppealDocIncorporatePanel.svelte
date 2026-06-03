<script>
  import { createEventDispatcher } from 'svelte';
  import { diffWords } from 'diff';
  import { getDocuments, uploadDocument, incorporateDocument } from '$lib/api/appeal.js';

  export let project;
  export let typeId;
  export let keyIssues = [];
  export let currentDraftHtml = '';

  const dispatch = createEventDispatcher();

  // ── State machine ──────────────────────────────────────────────────────────
  // idle | uploading | incorporating | review
  let panelState = 'idle';

  let inputTab = 'upload'; // 'upload' | 'paste'
  let pasteText = '';
  let pasteTitle = '';

  let documents = [];
  let docDragOver = false;
  let docFileInput;
  let uploadError = null;

  let incorporatingDoc = null;
  let incorporatingLabel = '';
  let userNotes = '';
  let incorporateError = null;

  let suggestedHtml = '';
  let diffParts = [];

  let conversation = [];
  let chatInput = '';
  let chatLoading = false;

  // ── Load documents on mount ────────────────────────────────────────────────
  import { onMount } from 'svelte';
  onMount(loadDocuments);

  async function loadDocuments() {
    try {
      documents = await getDocuments(project.id);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(file) {
    if (!file) return;
    panelState = 'uploading';
    uploadError = null;
    try {
      const doc = await uploadDocument(project.id, file);
      documents = [doc, ...documents];
      dispatch('uploaded', doc);
    } catch (err) {
      uploadError = err.message;
    } finally {
      panelState = 'idle';
    }
  }

  function onDrop(e) {
    e.preventDefault();
    docDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleUpload(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleUpload(file);
  }

  // ── Incorporate ────────────────────────────────────────────────────────────
  async function startIncorporate(doc) {
    incorporatingDoc = doc;
    incorporatingLabel = doc.filename;
    userNotes = '';
    conversation = [];
    suggestedHtml = '';
    diffParts = [];
    incorporateError = null;
    panelState = 'incorporating';
    await runIncorporate();
  }

  async function startIncorporateFromPaste() {
    if (!pasteText.trim()) return;
    incorporatingDoc = null;
    incorporatingLabel = pasteTitle.trim() || 'Pasted document';
    userNotes = '';
    conversation = [];
    suggestedHtml = '';
    diffParts = [];
    incorporateError = null;
    panelState = 'incorporating';
    await runIncorporate();
  }

  async function runIncorporate() {
    incorporateError = null;
    try {
      const payload = incorporatingDoc
        ? { documentId: incorporatingDoc.id, userNotes: userNotes || null, conversation }
        : { documentText: pasteText, documentTitle: incorporatingLabel, userNotes: userNotes || null, conversation };

      const result = await incorporateDocument(project.id, typeId, payload);
      suggestedHtml = result.content_html;
      diffParts = computeDiff(currentDraftHtml, suggestedHtml);
      panelState = 'review';
    } catch (err) {
      incorporateError = err.message;
      panelState = 'incorporating';
    }
  }

  // ── Chat refinement ────────────────────────────────────────────────────────
  async function sendChat() {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    chatInput = '';
    chatLoading = true;

    // Build conversation: original prompt result + chat turns
    // We re-run the incorporation with conversation history appended
    conversation = [
      ...conversation,
      { role: 'assistant', content: suggestedHtml },
      { role: 'user', content: userMessage }
    ];

    try {
      const result = await incorporateDocument(project.id, typeId, {
        documentId: incorporatingDoc.id,
        userNotes: userNotes || null,
        conversation
      });
      suggestedHtml = result.content_html;
      diffParts = computeDiff(currentDraftHtml, suggestedHtml);
    } catch (err) {
      incorporateError = err.message;
    } finally {
      chatLoading = false;
    }
  }

  // ── Accept / discard ───────────────────────────────────────────────────────
  function accept() {
    dispatch('accepted', { html: suggestedHtml, doc: incorporatingDoc });
    documents = documents.map(d => d.id === incorporatingDoc.id ? { ...d, review_status: 'reviewed' } : d);
    reset();
  }

  function discard() {
    reset();
  }

  function reset() {
    panelState = 'idle';
    incorporatingDoc = null;
    suggestedHtml = '';
    diffParts = [];
    conversation = [];
    incorporateError = null;
  }

  // ── Diff computation ───────────────────────────────────────────────────────
  function stripHtml(html) {
    return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function computeDiff(oldHtml, newHtml) {
    return diffWords(stripHtml(oldHtml), stripHtml(newHtml));
  }

  // ── Status labels ──────────────────────────────────────────────────────────
  const statusLabels = {
    reviewed: { label: 'Incorporated', colour: '#16a34a', bg: '#f0fdf4' },
    pending:  { label: 'Pending',      colour: '#d97706', bg: '#fffbeb' },
    skipped:  { label: 'Skipped',      colour: '#94a3b8', bg: '#f8fafc' }
  };
</script>

<div class="panel">

  {#if panelState === 'idle'}
    <!-- ── Tab switcher ── -->
    <div class="input-tabs">
      <button class="input-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>
        <i class="las la-upload"></i> Upload
      </button>
      <button class="input-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>
        <i class="las la-paste"></i> Paste text
      </button>
    </div>

    {#if inputTab === 'upload'}
      <!-- ── Upload zone ── -->
      <div
        class="upload-zone"
        class:drag-over={docDragOver}
        on:dragover|preventDefault={() => docDragOver = true}
        on:dragleave={() => docDragOver = false}
        on:drop={onDrop}
        on:click={() => docFileInput.click()}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && docFileInput.click()}
      >
        <i class="las la-cloud-upload-alt"></i>
        <span>Drop a document or click to upload</span>
        <span class="upload-sub">PDF, TXT or MD</span>
      </div>
      <input type="file" accept=".pdf,.txt,.md" bind:this={docFileInput} on:change={onFileChange} style="display:none" />

      {#if uploadError}
        <p class="error-msg">{uploadError}</p>
      {/if}

      <!-- ── Document list ── -->
      {#if documents.length === 0}
        <div class="empty-docs">
          <i class="las la-file-alt"></i>
          <p>No documents uploaded yet.</p>
        </div>
      {:else}
        <div class="doc-list">
          {#each documents as doc (doc.id)}
            {@const status = statusLabels[doc.review_status] ?? statusLabels.pending}
            <div class="doc-row">
              <div class="doc-row-info">
                <span class="doc-name">{doc.filename}</span>
                <div class="doc-row-meta">
                  <span class="doc-status" style="color:{status.colour};background:{status.bg}">{status.label}</span>
                  <span class="doc-date">{new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <button class="incorporate-btn" on:click={() => startIncorporate(doc)}>
                <i class="las la-file-import"></i> Incorporate
              </button>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <!-- ── Paste text ── -->
      <div class="paste-area">
        <input
          class="paste-title-input"
          type="text"
          placeholder="Document title (optional)"
          bind:value={pasteTitle}
        />
        <textarea
          class="paste-textarea"
          placeholder="Paste the document text here..."
          bind:value={pasteText}
        ></textarea>
        <button
          class="incorporate-btn incorporate-btn--full"
          disabled={!pasteText.trim()}
          on:click={startIncorporateFromPaste}
        >
          <i class="las la-file-import"></i> Incorporate
        </button>
      </div>
    {/if}

  {:else if panelState === 'uploading'}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Uploading document...</span>
    </div>

  {:else if panelState === 'incorporating' && !incorporateError}
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">
        <span>Reading document and updating draft...</span>
        <span class="loading-sub">This may take 20–40 seconds</span>
      </div>
    </div>

  {:else if panelState === 'incorporating' && incorporateError}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{incorporateError}</p>
      <div class="error-actions">
        <button class="btn-secondary" on:click={discard}>Cancel</button>
        <button class="btn-primary" on:click={runIncorporate}>Retry</button>
      </div>
    </div>

  {:else if panelState === 'review'}
    <!-- ── Review panel ── -->
    <div class="review-header">
      <div class="review-header-left">
        <span class="review-title">Suggested changes</span>
        <span class="review-doc-name">{incorporatingLabel}</span>
      </div>
      <div class="review-header-actions">
        <button class="btn-discard" on:click={discard}>Discard</button>
        <button class="btn-accept" on:click={accept}>
          <i class="las la-check"></i> Accept
        </button>
      </div>
    </div>

    <!-- ── Diff view ── -->
    <div class="diff-view">
      {#if diffParts.length === 0}
        <p class="diff-no-changes">No changes suggested for this document.</p>
      {:else}
        <div class="diff-content">
          {#each diffParts as part}
            {#if part.added}
              <ins class="diff-add">{part.value}</ins>
            {:else if part.removed}
              <del class="diff-del">{part.value}</del>
            {:else}
              <span>{part.value}</span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Chat ── -->
    <div class="chat-area">
      <div class="chat-input-row">
        <input
          class="chat-input"
          type="text"
          placeholder="Refine the suggestions... e.g. 'focus more on heritage' or 'remove the transport paragraph'"
          bind:value={chatInput}
          disabled={chatLoading}
          on:keydown={(e) => e.key === 'Enter' && !chatLoading && sendChat()}
        />
        <button class="chat-send-btn" disabled={chatLoading || !chatInput.trim()} on:click={sendChat}>
          {#if chatLoading}<div class="mini-spinner"></div>{:else}<i class="las la-paper-plane"></i>{/if}
        </button>
      </div>
      {#if incorporateError}
        <p class="error-msg" style="margin-top:0.5rem">{incorporateError}</p>
      {/if}
    </div>
  {/if}

</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #f8fafc;
  }

  /* ── Tab switcher ── */
  .input-tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }

  .input-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.625rem;
    border: none;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-family: inherit;
    transition: all 0.15s;
  }
  .input-tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
  .input-tab:hover:not(.active) { color: #374151; }

  /* ── Paste area ── */
  .paste-area {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }

  .paste-title-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    flex-shrink: 0;
  }
  .paste-title-input:focus { outline: none; border-color: #7c3aed; }
  .paste-title-input::placeholder { color: #94a3b8; }

  .paste-textarea {
    flex: 1;
    min-height: 200px;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: none;
    line-height: 1.5;
  }
  .paste-textarea:focus { outline: none; border-color: #7c3aed; }
  .paste-textarea::placeholder { color: #94a3b8; }

  .incorporate-btn--full {
    width: 100%;
    justify-content: center;
  }
  .incorporate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Upload zone ── */
  .upload-zone {
    flex-shrink: 0;
    margin: 1rem;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    transition: all 0.15s;
    background: white;
    text-align: center;
  }
  .upload-zone:hover, .upload-zone.drag-over { border-color: #7c3aed; background: #faf5ff; }
  .upload-zone i { font-size: 1.5rem; color: #94a3b8; }
  .upload-zone span { font-size: 0.8125rem; color: #475569; font-weight: 500; }
  .upload-sub { font-size: 0.75rem !important; color: #94a3b8 !important; font-weight: 400 !important; }

  .error-msg { font-size: 0.8rem; color: #ef4444; margin: 0 1rem 0.5rem; }

  /* ── Doc list ── */
  .doc-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-docs {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #94a3b8;
    text-align: center;
  }
  .empty-docs i { font-size: 2rem; }
  .empty-docs p { margin: 0; font-size: 0.8125rem; max-width: 220px; }

  .doc-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
  }

  .doc-row-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .doc-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-row-meta { display: flex; align-items: center; gap: 0.5rem; }

  .doc-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .doc-date { font-size: 0.7rem; color: #94a3b8; }

  .incorporate-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.625rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .incorporate-btn:hover { background: #6d28d9; }

  /* ── Loading / error states ── */
  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .loading-text { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
  .loading-sub { font-size: 0.75rem; color: #94a3b8; }

  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: #64748b;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .error-state p { margin: 0; font-size: 0.875rem; }
  .error-actions { display: flex; gap: 0.5rem; }

  /* ── Review panel ── */
  .review-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  .review-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .review-title { font-size: 0.8125rem; font-weight: 700; color: #1e293b; }
  .review-doc-name { font-size: 0.75rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .review-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .btn-accept {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.4rem 0.875rem;
    background: #16a34a; color: white;
    border: none; border-radius: 6px;
    font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  .btn-accept:hover { background: #15803d; }

  .btn-discard {
    padding: 0.4rem 0.75rem;
    background: white; color: #64748b;
    border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.8125rem; cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .btn-discard:hover { background: #f1f5f9; }

  .btn-primary {
    padding: 0.4rem 0.875rem;
    background: #7c3aed; color: white;
    border: none; border-radius: 6px;
    font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .btn-secondary {
    padding: 0.4rem 0.75rem;
    background: white; color: #64748b;
    border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.8125rem; cursor: pointer; font-family: inherit;
  }

  /* ── Diff view ── */
  .diff-view {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  .diff-no-changes { font-size: 0.875rem; color: #94a3b8; text-align: center; padding: 2rem 0; margin: 0; }

  .diff-content {
    font-size: 0.8125rem;
    line-height: 1.7;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .diff-add {
    background: #dcfce7;
    color: #15803d;
    text-decoration: none;
    border-radius: 2px;
    padding: 0 1px;
  }

  .diff-del {
    background: #fee2e2;
    color: #b91c1c;
    text-decoration: line-through;
    border-radius: 2px;
    padding: 0 1px;
  }

  /* ── Chat ── */
  .chat-area {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    background: white;
    border-top: 1px solid #e2e8f0;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .chat-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #1e293b;
    background: #f8fafc;
    transition: border-color 0.15s;
  }
  .chat-input:focus { outline: none; border-color: #7c3aed; background: white; }
  .chat-input::placeholder { color: #94a3b8; }
  .chat-input:disabled { opacity: 0.6; }

  .chat-send-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2.25rem; height: 2.25rem;
    background: #7c3aed; color: white;
    border: none; border-radius: 6px;
    cursor: pointer; flex-shrink: 0;
    transition: background 0.15s;
  }
  .chat-send-btn:hover:not(:disabled) { background: #6d28d9; }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Spinners ── */
  .spinner {
    width: 1.5rem; height: 1.5rem;
    border: 2px solid #e2e8f0; border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mini-spinner {
    width: 0.875rem; height: 0.875rem;
    border: 1.5px solid rgba(255,255,255,0.4); border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
