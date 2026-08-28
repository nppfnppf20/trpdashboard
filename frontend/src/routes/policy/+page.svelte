<script>
  import { onMount } from 'svelte';
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

  // Editing card content — { sourceType, id, title, summary_html, key_points, implications }
  let editingItem = null;
  let itemSaving = false;

  // Confirm delete — { sourceType, id }
  let confirmDelete = null;

  // ── Summary strip ────────────────────────────────────────────────────────
  $: thisMonthCount = items.filter(it => {
    if (!it.created_at) return false;
    const d = new Date(it.created_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  $: supersededCount = items.filter(it => it.superseded).length;
  $: missingTakeCount = items.filter(it => !it.our_take?.trim()).length;

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

  // ── Edit card content ────────────────────────────────────────────────────
  function isEditingItem(item) {
    return editingItem?.sourceType === item.source_type && editingItem?.id === item.id;
  }

  function startEditItem(item) {
    editingOurTake = null;
    editingItem = {
      sourceType: item.source_type,
      id: item.id,
      title: item.title ?? '',
      summary_html: item.summary_html ?? '',
      key_points: item.key_points ?? '',
      implications: item.implications ?? '',
    };
  }

  async function saveItem() {
    if (!editingItem) return;
    itemSaving = true;
    try {
      const fields = { title: editingItem.title.trim(), summary_html: editingItem.summary_html };
      if (editingItem.sourceType === 'document') {
        fields.key_points = editingItem.key_points;
        fields.implications = editingItem.implications;
        await updatePolicyDocument(editingItem.id, fields);
      } else {
        await updatePolicyInsight(editingItem.id, fields);
      }
      items = items.map(it =>
        it.source_type === editingItem.sourceType && it.id === editingItem.id
          ? { ...it, ...fields }
          : it
      );
      editingItem = null;
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      itemSaving = false;
    }
  }

  // ── Superseded ───────────────────────────────────────────────────────────
  async function toggleSuperseded(item) {
    const next = !item.superseded;
    items = items.map(it =>
      it.source_type === item.source_type && it.id === item.id
        ? { ...it, superseded: next }
        : it
    );
    try {
      if (item.source_type === 'document') {
        await updatePolicyDocument(item.id, { superseded: next });
      } else {
        await updatePolicyInsight(item.id, { superseded: next });
      }
    } catch (err) {
      // Revert on failure
      items = items.map(it =>
        it.source_type === item.source_type && it.id === item.id
          ? { ...it, superseded: item.superseded }
          : it
      );
      alert('Failed to update: ' + err.message);
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
  <div class="page-header">
    <h1 class="page-title">
      <i class="las la-newspaper"></i>
      Policy &amp; Industry Updates
    </h1>
    <p class="page-description">
      Upload policy documents and guidance notes. Policy updates from internal meetings and CPDs also appear here automatically.
    </p>
  </div>

  <div class="card stat-strip">
    <div class="stat-chip">
      <span class="stat-chip-n">{items.length}</span>
      <span class="stat-chip-l">Total Updates</span>
    </div>
    <div class="stat-chip-divider"></div>
    <div class="stat-chip">
      <span class="stat-chip-n">{thisMonthCount}</span>
      <span class="stat-chip-l">This Month</span>
    </div>
    <div class="stat-chip-divider"></div>
    <div class="stat-chip">
      <span class="stat-chip-n">{supersededCount}</span>
      <span class="stat-chip-l">Superseded</span>
    </div>
    <div class="stat-chip-divider"></div>
    <div class="stat-chip">
      <span class="stat-chip-n">{missingTakeCount}</span>
      <span class="stat-chip-l">Missing "Our Take"</span>
    </div>
  </div>

  <div class="content-grid">
  <!-- Upload panel -->
  <div class="upload-panel">
    <div class="card upload-card">
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
        <label class="form-label">Context notes <span class="optional">(why is this relevant?)</span></label>
        <textarea
          class="form-input"
          bind:value={uploadUserNotes}
          rows="3"
          placeholder="e.g. Critical for solar farm cumulative impact assessments, replaces previous NPPF guidance on energy. Flag implications for ongoing Wiltshire projects."
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
          <div class="card policy-card" class:policy-card--superseded={item.superseded}>

            <!-- Card header -->
            <div class="policy-card-header">
              <div class="policy-card-header-left">
                <span class="source-badge {sourceBadgeClass(item)}">{sourceLabel(item)}</span>
                {#if item.superseded}<span class="superseded-badge">Superseded</span>{/if}
                {#if isEditingItem(item)}
                  <input class="form-input title-edit-input" bind:value={editingItem.title} placeholder="Title" />
                {:else}
                  <h3 class="policy-title">{item.title}</h3>
                {/if}
                <span class="policy-date">{formatDate(item.created_at)}</span>
              </div>
              <div class="policy-card-header-right">
                {#if isEditingItem(item)}
                  <button class="btn btn-secondary btn-sm" on:click={() => editingItem = null} disabled={itemSaving}>Cancel</button>
                  <button class="btn btn-primary btn-sm" on:click={saveItem} disabled={itemSaving}>
                    {itemSaving ? 'Saving…' : 'Save'}
                  </button>
                {:else}
                  <label class="superseded-toggle" title="Mark as superseded">
                    <input
                      type="checkbox"
                      checked={item.superseded}
                      on:change={() => toggleSuperseded(item)}
                    />
                    <span>Superseded</span>
                  </label>
                  <button class="icon-btn" title="Edit" on:click={() => startEditItem(item)}>
                    <i class="las la-pen"></i>
                  </button>
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
                {/if}
              </div>
            </div>

            {#if isEditingItem(item)}
              <!-- Edit mode: raw HTML source for summary/key points/implications -->
              <div class="policy-section">
                <div class="policy-section-label">Summary <span class="optional">(HTML)</span></div>
                <textarea class="form-input" bind:value={editingItem.summary_html} rows="4"></textarea>
              </div>
              {#if editingItem.sourceType === 'document'}
                <div class="policy-section">
                  <div class="policy-section-label">Key Points <span class="optional">(HTML)</span></div>
                  <textarea class="form-input" bind:value={editingItem.key_points} rows="4"></textarea>
                </div>
                <div class="policy-section">
                  <div class="policy-section-label">Implications for our work <span class="optional">(HTML)</span></div>
                  <textarea class="form-input" bind:value={editingItem.implications} rows="4"></textarea>
                </div>
              {/if}
            {:else}
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
</div>

<style>
  /* ── Page ── */
  .pol-page {
    background: var(--color-slate-50);
    padding: 1.5rem 2rem;
  }

  .page-header { margin-bottom: 1.25rem; padding-top: 0.25rem; }
  .page-title {
    font-size: 1.375rem; font-weight: 700; color: var(--color-slate-900); margin: 0 0 0.25rem;
    display: flex; align-items: center; gap: 0.625rem; letter-spacing: -0.02em;
  }
  .page-title i { color: var(--color-teal-600); font-size: 1.125rem; }
  .page-description { font-size: 0.8125rem; color: var(--color-slate-500); margin: 0; max-width: 560px; line-height: 1.5; }

  /* ── Summary strip — .card supplies background/border/radius/shadow ── */
  .stat-strip {
    display: flex;
    gap: 1.25rem;
    padding: 0.75rem 1.125rem;
    margin-bottom: 1.25rem;
  }
  .stat-chip { display: flex; flex-direction: column; gap: 0.125rem; }
  .stat-chip-n { font-size: 1.0625rem; font-weight: 700; color: var(--color-slate-900); }
  .stat-chip-l { font-size: 0.65625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-400); }
  .stat-chip-divider { width: 1px; background: var(--color-slate-200); }

  /* ── Content grid ── */
  .content-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.25rem;
    align-items: start;
  }

  /* ── Upload panel ── */
  .upload-panel {
    /* sized by the .content-grid column, no local max-width needed */
  }

  .upload-card {
    padding: 1rem 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .card-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); margin: 0; }

  /* Input tabs */
  .input-tabs { display: flex; gap: 0.35rem; }

  /* Drop zone — same CSS as meeting notes */
  .drop-zone {
    border: 2px dashed var(--color-violet-200); border-radius: 6px; padding: 0.85rem 1rem;
    text-align: center; cursor: pointer; color: var(--color-slate-500); font-size: 0.875rem;
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .drop-zone:hover, .drop-zone.drag-over { background: var(--color-violet-50); border-color: var(--color-violet-600); }
  .drop-icon { font-size: 1.4rem; color: var(--color-violet-300); }
  .drop-filename { font-weight: 600; color: var(--color-slate-800); font-size: 0.875rem; }
  .drop-hint { font-size: 0.75rem; color: var(--color-slate-400); }
  .paste-area { min-height: 72px; resize: vertical; }

  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .optional { font-weight: 400; color: var(--color-slate-400); }
  /* Base .form-input/.form-label come from the shared inputs.css;
     only the teal-tinted focus state (matching this page's accent) stays local. */
  .form-input:focus { outline: none; border-color: var(--color-teal-600); box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1); }

  .upload-error {
    background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: 6px;
    padding: 0.5rem 0.75rem; color: var(--color-red-800); font-size: 0.8125rem;
  }

  .process-btn { width: 100%; }

  /* ── Items section — sized by the .content-grid column ── */

  .section-title {
    font-size: 1rem; font-weight: 700; color: var(--color-slate-800); margin: 0 0 0.875rem;
  }

  .state-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); font-size: 0.875rem; padding: 2rem; }
  .state-error { background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: 8px; padding: 1rem; color: var(--color-red-800); font-size: 0.875rem; }
  .state-empty { text-align: center; padding: 4rem 2rem; color: var(--color-slate-400); }
  .state-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .state-empty p { margin: 0; font-size: 0.9375rem; }

  .items-list { display: flex; flex-direction: column; gap: 1rem; }

  /* ── Policy card ── */
  .policy-card {
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

  .policy-title { font-size: 1rem; font-weight: 700; color: var(--color-slate-800); margin: 0; line-height: 1.3; }
  .title-edit-input { font-size: 0.9rem; font-weight: 600; max-width: 420px; }
  .policy-date { font-size: 0.75rem; color: var(--color-slate-400); }

  .policy-card-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Superseded */
  .policy-card--superseded {
    opacity: 0.55;
  }
  .policy-card--superseded .policy-title {
    text-decoration: line-through;
    color: var(--color-slate-400);
  }

  .superseded-badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .superseded-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--color-slate-400);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .superseded-toggle input { accent-color: var(--color-red-600); cursor: pointer; }
  .superseded-toggle:hover { color: var(--color-slate-500); }

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
  .badge-upload   { background: var(--color-slate-100); color: var(--color-green-800); }
  .badge-internal { background: var(--color-primary-50); color: var(--color-primary-700); }
  .badge-cpd      { background: var(--color-violet-50); color: var(--color-violet-700); }

  /* Content sections */
  .policy-summary { font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.65; }
  .policy-summary :global(p) { margin: 0 0 0.6rem; }
  .policy-summary :global(p:last-child) { margin-bottom: 0; }

  .policy-section { display: flex; flex-direction: column; gap: 0.3rem; }
  .policy-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-slate-400); }

  .policy-key-points { font-size: 0.875rem; color: var(--color-slate-700); }
  .policy-key-points :global(ul) { margin: 0; padding-left: 1.25rem; }
  .policy-key-points :global(li) { margin-bottom: 0.3rem; line-height: 1.55; }

  .policy-implications { font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.65; }
  .policy-implications :global(p) { margin: 0 0 0.4rem; }

  .policy-raised { font-size: 0.78rem; color: var(--color-violet-700); font-weight: 500; }

  /* Our Take */
  .our-take-section {
    border-top: 1px solid var(--color-slate-100);
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
    color: var(--color-teal-600);
  }

  .our-take-text {
    font-size: 0.875rem;
    color: var(--color-slate-800);
    line-height: 1.65;
    margin: 0;
    white-space: pre-wrap;
  }

  .our-take-empty {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    color: var(--color-slate-400);
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: color 0.15s;
    text-align: left;
  }
  .our-take-empty:hover { color: var(--color-teal-600); }

  .our-take-input { width: 100%; box-sizing: border-box; }

  .our-take-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  /* Icon buttons */
  .icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--color-slate-400); font-size: 0.9rem; padding: 0.2rem 0.35rem;
    border-radius: 4px; transition: color 0.15s, background 0.15s;
    font-family: inherit;
  }
  .icon-btn:hover { color: var(--color-slate-600); background: var(--color-slate-100); }

  /* Confirm delete inline */
  .confirm-del { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--color-red-600); }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: var(--color-red-600); color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: var(--color-slate-100); color: var(--color-slate-700); border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  /* Spinners */
  .spinner {
    display: inline-block; width: 0.85rem; height: 0.85rem;
    border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: var(--color-white);
    border-radius: 50%; animation: pol-spin 0.7s linear infinite;
  }
  .spinner-blue {
    display: inline-block; width: 0.9rem; height: 0.9rem;
    border: 2px solid var(--color-slate-200); border-top-color: var(--color-teal-600);
    border-radius: 50%; animation: pol-spin 0.7s linear infinite;
  }
  @keyframes pol-spin { to { transform: rotate(360deg); } }

  /* Policy uses teal as its category accent (matches the page icon and
     "Our Take" label) instead of the app's default primary blue —
     everything else about .btn/.btn-secondary/.btn-ghost/.btn-sm now
     comes from the shared buttons.css. */
  .btn-primary { background: var(--color-teal-600); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }

  /* Responsive */
  @media (max-width: 768px) {
    .pol-page { padding: 1rem; }
    .content-grid { grid-template-columns: 1fr; }
    .stat-strip { flex-wrap: wrap; gap: 0.75rem 1.25rem; }
    .page-title { font-size: 1.5rem; }
  }
</style>
