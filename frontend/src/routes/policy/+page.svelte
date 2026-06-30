<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import {
    listPolicyItems,
    uploadPolicyDocument,
    updatePolicyDocument,
    deletePolicyDocument,
    updatePolicyInsight,
    deletePolicyInsight,
  } from '$lib/api/policy.js';

  // ── State ─────────────────────────────────────────────────────────────────
  let items = [];
  let loading = true;
  let loadError = null;

  // Upload panel
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadFile = null;
  let uploadPasteText = '';
  let uploadUserNotes = '';
  let uploadProcessing = false;
  let uploadError = null;
  let uploadDragOver = false;
  let fileInput;

  // Editing "Our Take" — { sourceType, id, value }
  let editingOurTake = null;
  let ourTakeSaving = false;

  // Confirm delete — { sourceType, id }
  let confirmDelete = null;

  // ── Load ──────────────────────────────────────────────────────────────────
  onMount(load);

  async function load() {
    loading = true; loadError = null;
    try {
      items = await listPolicyItems();
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    uploadDragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { uploadFile = file; uploadInputTab = 'upload'; }
  }

  function handleFileChange(e) {
    uploadFile = e.target.files[0] || null;
  }

  function resetUpload() {
    uploadFile = null;
    uploadPasteText = '';
    uploadUserNotes = '';
    uploadError = null;
    uploadProcessing = false;
  }

  async function submitUpload() {
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the document text.'; return; }

    uploadProcessing = true;
    uploadError = null;
    try {
      const doc = await uploadPolicyDocument({
        file:      uploadInputTab === 'upload' ? uploadFile : null,
        text:      uploadInputTab === 'paste'  ? uploadPasteText : null,
        userNotes: uploadUserNotes.trim() || null,
      });
      items = [{ ...doc, source_type: 'document' }, ...items];
      resetUpload();
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  // ── Our Take edit ─────────────────────────────────────────────────────────
  function startEditOurTake(item) {
    editingOurTake = { sourceType: item.source_type, id: item.id, value: item.our_take ?? '' };
  }

  async function saveOurTake() {
    if (!editingOurTake) return;
    ourTakeSaving = true;
    try {
      if (editingOurTake.sourceType === 'document') {
        await updatePolicyDocument(editingOurTake.id, { our_take: editingOurTake.value });
      } else {
        await updatePolicyInsight(editingOurTake.id, { our_take: editingOurTake.value });
      }
      items = items.map(it =>
        it.source_type === editingOurTake.sourceType && it.id === editingOurTake.id
          ? { ...it, our_take: editingOurTake.value }
          : it
      );
      editingOurTake = null;
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      ourTakeSaving = false;
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function doDelete() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.sourceType === 'document') {
        await deletePolicyDocument(confirmDelete.id);
      } else {
        await deletePolicyInsight(confirmDelete.id);
      }
      items = items.filter(it => !(it.source_type === confirmDelete.sourceType && it.id === confirmDelete.id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      confirmDelete = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function sourceLabel(item) {
    if (item.source_type === 'document') return 'Uploaded';
    if (item.meeting_type === 'cpd') return `CPD${item.meeting_date ? ' · ' + formatDate(item.meeting_date) : ''}`;
    return `Internal Meeting${item.meeting_date ? ' · ' + formatDate(item.meeting_date) : ''}`;
  }

  function sourceBadgeClass(item) {
    if (item.source_type === 'document') return 'badge-upload';
    if (item.meeting_type === 'cpd') return 'badge-cpd';
    return 'badge-internal';
  }
</script>

<div class="pol-page">
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <div class="page-header">
    <h1 class="page-title">
      <i class="las la-newspaper"></i>
      Policy &amp; Industry Updates
    </h1>
    <p class="page-description">
      Upload policy documents and guidance notes. Policy updates from internal meetings and CPDs also appear here automatically.
    </p>
  </div>

  <!-- Top row: upload + latest -->
  <div class="top-row">

    <!-- Upload card -->
    <div class="upload-card">
      <h3 class="card-title">Add Policy / Update</h3>

      <div class="input-tabs">
        <button class="btn btn-sm" class:btn-secondary={uploadInputTab === 'upload'} class:btn-ghost={uploadInputTab !== 'upload'} on:click={() => uploadInputTab = 'upload'}>
          <i class="las la-upload"></i> Upload File
        </button>
        <button class="btn btn-sm" class:btn-secondary={uploadInputTab === 'paste'} class:btn-ghost={uploadInputTab !== 'paste'} on:click={() => uploadInputTab = 'paste'}>
          <i class="las la-clipboard"></i> Paste Text
        </button>
      </div>

      {#if uploadInputTab === 'upload'}
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
          class="drop-zone"
          class:drag-over={uploadDragOver}
          role="button"
          tabindex="0"
          on:dragover|preventDefault={() => uploadDragOver = true}
          on:dragleave={() => uploadDragOver = false}
          on:drop={handleDrop}
          on:click={() => fileInput.click()}
          on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
        >
          {#if uploadFile}
            <i class="las la-file-alt drop-icon"></i>
            <span class="drop-filename">{uploadFile.name}</span>
            <span class="drop-hint">Click to change file</span>
          {:else}
            <i class="las la-cloud-upload-alt drop-icon"></i>
            <span>Drop a file here or click to browse</span>
            <span class="drop-hint">PDF, DOCX or TXT</span>
          {/if}
        </div>
        <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
      {:else}
        <textarea class="form-input paste-area" bind:value={uploadPasteText} placeholder="Paste the policy text here…" rows="4"></textarea>
      {/if}

      <div class="form-group">
        <label class="form-label">Context notes <span class="optional">— why is this relevant?</span></label>
        <textarea
          class="form-input"
          bind:value={uploadUserNotes}
          rows="3"
          placeholder="e.g. Critical for solar farm cumulative impact assessments — replaces previous NPPF guidance on energy. Flag implications for ongoing Wiltshire projects."
        ></textarea>
      </div>

      {#if uploadError}<div class="upload-error">{uploadError}</div>{/if}

      <button class="btn btn-primary process-btn" on:click={submitUpload} disabled={uploadProcessing}>
        {#if uploadProcessing}
          <span class="spinner"></span> Processing…
        {:else}
          <i class="las la-magic"></i> Process &amp; Save
        {/if}
      </button>
    </div>

    <!-- Latest item quick view -->
    <div class="latest-card">
      {#if loading}
        <div class="latest-loading"><span class="spinner-blue"></span></div>
      {:else if items[0]}
        {@const latest = items[0]}
        <div class="latest-inner">
          <span class="card-meta-label">Latest Update</span>
          <span class="source-badge {sourceBadgeClass(latest)}">{sourceLabel(latest)}</span>
          <div class="latest-title">{latest.title}</div>
          <div class="latest-date">{formatDate(latest.created_at)}</div>
          {#if latest.summary_html}
            <div class="latest-summary">{@html latest.summary_html}</div>
          {/if}
        </div>
      {:else}
        <div class="latest-empty">
          <i class="las la-newspaper"></i>
          <p>No updates yet.<br>Upload a document above to get started.</p>
        </div>
      {/if}
    </div>

  </div>

  <!-- All items list -->
  <div class="items-section">
    <h2 class="section-title">All Updates ({items.length})</h2>

    {#if loading}
      <div class="state-loading"><span class="spinner-blue"></span> Loading…</div>
    {:else if loadError}
      <div class="state-error">{loadError}</div>
    {:else if items.length === 0}
      <div class="state-empty">
        <i class="las la-newspaper"></i>
        <p>No policy updates yet. Upload a document or process an internal/CPD meeting to get started.</p>
      </div>
    {:else}
      <div class="items-list">
        {#each items as item (item.source_type + '-' + item.id)}
          <div class="policy-card">

            <!-- Card header -->
            <div class="policy-card-header">
              <div class="policy-card-header-left">
                <span class="source-badge {sourceBadgeClass(item)}">{sourceLabel(item)}</span>
                <h3 class="policy-title">{item.title}</h3>
                <span class="policy-date">{formatDate(item.created_at)}</span>
              </div>
              <div class="policy-card-header-right">
                {#if confirmDelete?.sourceType === item.source_type && confirmDelete?.id === item.id}
                  <span class="confirm-del">
                    Delete?
                    <button class="btn-danger-sm" on:click={doDelete}>Yes</button>
                    <button class="btn-cancel-sm" on:click={() => confirmDelete = null}>No</button>
                  </span>
                {:else}
                  <button class="icon-btn" title="Delete" on:click={() => confirmDelete = { sourceType: item.source_type, id: item.id }}>
                    <i class="las la-trash"></i>
                  </button>
                {/if}
              </div>
            </div>

            <!-- Summary -->
            {#if item.summary_html}
              <div class="policy-summary md-body">{@html item.summary_html}</div>
            {/if}

            <!-- Key points (documents only) -->
            {#if item.key_points}
              <div class="policy-section">
                <div class="policy-section-label">Key Points</div>
                <div class="policy-key-points md-body">{@html item.key_points}</div>
              </div>
            {/if}

            <!-- Implications (documents only) -->
            {#if item.implications}
              <div class="policy-section">
                <div class="policy-section-label">Implications for our work</div>
                <div class="policy-implications md-body">{@html item.implications}</div>
              </div>
            {/if}

            <!-- Raised by (insights only) -->
            {#if item.raised_by}
              <div class="policy-raised">Raised by {item.raised_by}</div>
            {/if}

            <!-- Our Take -->
            <div class="our-take-section">
              <div class="our-take-header">
                <span class="our-take-label">Our Take</span>
                {#if !(editingOurTake?.sourceType === item.source_type && editingOurTake?.id === item.id)}
                  <button class="icon-btn" title="Edit our take" on:click={() => startEditOurTake(item)}>
                    <i class="las la-pen"></i>
                  </button>
                {/if}
              </div>

              {#if editingOurTake?.sourceType === item.source_type && editingOurTake?.id === item.id}
                <textarea
                  class="form-input our-take-input"
                  bind:value={editingOurTake.value}
                  rows="4"
                  placeholder="Write your firm's commentary and position on this update…"
                  autofocus
                ></textarea>
                <div class="our-take-footer">
                  <button class="btn btn-secondary btn-sm" on:click={() => editingOurTake = null} disabled={ourTakeSaving}>Cancel</button>
                  <button class="btn btn-primary btn-sm" on:click={saveOurTake} disabled={ourTakeSaving}>
                    {ourTakeSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              {:else if item.our_take?.trim()}
                <p class="our-take-text">{item.our_take}</p>
              {:else}
                <button class="our-take-empty" on:click={() => startEditOurTake(item)}>
                  <i class="las la-plus-circle"></i> Add our take…
                </button>
              {/if}
            </div>

          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Page ── */
  .pol-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 2rem;
    position: relative;
  }

  .home-button {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #1e293b;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    z-index: 10;
  }
  .home-button:hover { background: #f1f5f9; border-color: #cbd5e1; }
  .home-button i { font-size: 1.125rem; }

  .page-header { margin-bottom: 1.75rem; padding-top: 0.25rem; max-width: 1400px; margin-left: auto; margin-right: auto; }
  .page-title {
    font-size: 2rem; font-weight: 700; color: #1e293b; margin: 0 0 0.4rem;
    display: flex; align-items: center; gap: 0.75rem;
  }
  .page-title i { color: #0369a1; }
  .page-description { font-size: 0.9375rem; color: #64748b; margin: 0; }

  /* ── Top row ── */
  .top-row {
    max-width: 1400px;
    margin: 0 auto 1.5rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: stretch;
  }

  .upload-card, .latest-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .card-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin: 0; }

  /* Input tabs */
  .input-tabs { display: flex; gap: 0.35rem; }

  /* Drop zone — same CSS as meeting notes */
  .drop-zone {
    border: 2px dashed #ddd6fe; border-radius: 6px; padding: 0.85rem 1rem;
    text-align: center; cursor: pointer; color: #64748b; font-size: 0.875rem;
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .drop-zone:hover, .drop-zone.drag-over { background: #f5f3ff; border-color: #7c3aed; }
  .drop-icon { font-size: 1.4rem; color: #c4b5fd; }
  .drop-filename { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
  .drop-hint { font-size: 0.75rem; color: #94a3b8; }
  .paste-area { min-height: 72px; resize: vertical; }

  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-label { font-size: 0.8rem; font-weight: 500; color: #374151; }
  .optional { font-weight: 400; color: #94a3b8; }
  .form-input {
    width: 100%; padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 0.875rem; font-family: inherit; color: #1e293b; background: #fff;
    box-sizing: border-box; transition: border-color 0.15s;
  }
  .form-input:focus { outline: none; border-color: #0369a1; box-shadow: 0 0 0 3px rgba(3,105,161,0.1); }
  textarea.form-input { resize: vertical; line-height: 1.5; }

  .upload-error {
    background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
    padding: 0.5rem 0.75rem; color: #991b1b; font-size: 0.8125rem;
  }

  .process-btn { width: 100%; }

  /* Latest card */
  .latest-inner { display: flex; flex-direction: column; gap: 0.35rem; }
  .card-meta-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .latest-title { font-size: 0.9375rem; font-weight: 600; color: #1e293b; line-height: 1.3; }
  .latest-date { font-size: 0.78rem; color: #94a3b8; }
  .latest-summary { font-size: 0.8rem; color: #475569; line-height: 1.5; max-height: 120px; overflow: hidden; }
  .latest-summary :global(p) { margin: 0 0 0.4rem; }
  .latest-loading { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 80px; }
  .latest-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; flex: 1; min-height: 80px; color: #94a3b8; text-align: center; }
  .latest-empty i { font-size: 1.5rem; }
  .latest-empty p { font-size: 0.8rem; margin: 0; line-height: 1.4; }

  /* ── Items section ── */
  .items-section {
    max-width: 1400px;
    margin: 0 auto;
  }

  .section-title {
    font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 0.875rem;
  }

  .state-loading { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.875rem; padding: 2rem; }
  .state-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; color: #991b1b; font-size: 0.875rem; }
  .state-empty { text-align: center; padding: 4rem 2rem; color: #94a3b8; }
  .state-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .state-empty p { margin: 0; font-size: 0.9375rem; }

  .items-list { display: flex; flex-direction: column; gap: 1rem; }

  /* ── Policy card ── */
  .policy-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1.25rem 1.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .policy-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .policy-card-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .policy-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.3; }
  .policy-date { font-size: 0.75rem; color: #94a3b8; }

  .policy-card-header-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  /* Source badges */
  .source-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    width: fit-content;
  }
  .badge-upload   { background: #f0fdf4; color: #15803d; }
  .badge-internal { background: #eff6ff; color: #1d4ed8; }
  .badge-cpd      { background: #f5f3ff; color: #6d28d9; }

  /* Content sections */
  .policy-summary { font-size: 0.875rem; color: #374151; line-height: 1.65; }
  .policy-summary :global(p) { margin: 0 0 0.6rem; }
  .policy-summary :global(p:last-child) { margin-bottom: 0; }

  .policy-section { display: flex; flex-direction: column; gap: 0.3rem; }
  .policy-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }

  .policy-key-points { font-size: 0.875rem; color: #374151; }
  .policy-key-points :global(ul) { margin: 0; padding-left: 1.25rem; }
  .policy-key-points :global(li) { margin-bottom: 0.3rem; line-height: 1.55; }

  .policy-implications { font-size: 0.875rem; color: #374151; line-height: 1.65; }
  .policy-implications :global(p) { margin: 0 0 0.4rem; }

  .policy-raised { font-size: 0.78rem; color: #6d28d9; font-weight: 500; }

  /* Our Take */
  .our-take-section {
    border-top: 1px solid #f1f5f9;
    padding-top: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .our-take-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .our-take-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #0369a1;
  }

  .our-take-text {
    font-size: 0.875rem;
    color: #1e293b;
    line-height: 1.65;
    margin: 0;
    white-space: pre-wrap;
  }

  .our-take-empty {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    color: #94a3b8;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: color 0.15s;
    text-align: left;
  }
  .our-take-empty:hover { color: #0369a1; }

  .our-take-input { width: 100%; box-sizing: border-box; }

  .our-take-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  /* Icon buttons */
  .icon-btn {
    background: none; border: none; cursor: pointer;
    color: #94a3b8; font-size: 0.9rem; padding: 0.2rem 0.35rem;
    border-radius: 4px; transition: color 0.15s, background 0.15s;
    font-family: inherit;
  }
  .icon-btn:hover { color: #475569; background: #f1f5f9; }

  /* Confirm delete inline */
  .confirm-del { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: #dc2626; }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  /* Spinners */
  .spinner {
    display: inline-block; width: 0.85rem; height: 0.85rem;
    border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
    border-radius: 50%; animation: pol-spin 0.7s linear infinite;
  }
  .spinner-blue {
    display: inline-block; width: 0.9rem; height: 0.9rem;
    border: 2px solid #e2e8f0; border-top-color: #0369a1;
    border-radius: 50%; animation: pol-spin 0.7s linear infinite;
  }
  @keyframes pol-spin { to { transform: rotate(360deg); } }

  /* Shared button classes (fallback if buttons.css doesn't cover everything) */
  .btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.45rem 0.875rem; border-radius: 6px; font-size: 0.8125rem;
    font-weight: 500; cursor: pointer; font-family: inherit; border: none;
    transition: all 0.15s;
  }
  .btn-sm { padding: 0.3rem 0.625rem; font-size: 0.775rem; }
  .btn-primary { background: #0369a1; color: white; }
  .btn-primary:hover:not(:disabled) { background: #0284c7; }
  .btn-primary:disabled { opacity: 0.6; cursor: default; }
  .btn-secondary { background: white; color: #374151; border: 1px solid #e2e8f0; }
  .btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
  .btn-ghost { background: transparent; color: #64748b; border: 1px solid transparent; }
  .btn-ghost:hover { background: #f1f5f9; color: #374151; }

  /* Responsive */
  @media (max-width: 768px) {
    .pol-page { padding: 1rem; }
    .top-row { grid-template-columns: 1fr; }
    .page-title { font-size: 1.5rem; }
  }
</style>
