<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import BatchImportModal from '$lib/components/projects/BatchImportModal.svelte';
  import {
    getPublicCommentsData,
    processPublicCommentDoc,
    createPublicComment,
    updatePublicComment,
    deletePublicComment,
    runPublicCommentAnalysis,
  } from '$lib/api/publicComments.js';

  export let project;
  $: projectId = project?.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  let comments  = [];
  let analysis  = { bullet_summary: null, themes: null, last_analysed_at: null };
  let loading   = true;
  let error     = null;

  onMount(async () => { await loadData(); });

  async function loadData() {
    if (!projectId) return;
    loading = true; error = null;
    try {
      const data = await getPublicCommentsData(projectId);
      comments = data.comments || [];
      analysis = data.analysis || { bullet_summary: null, themes: null, last_analysed_at: null };
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Position helpers ──────────────────────────────────────────────────────
  const POSITION_OPTIONS = ['Support', 'Object', 'Neutral', 'Mixed'];

  function positionClass(pos) {
    if (!pos) return '';
    const p = pos.toLowerCase();
    if (p === 'support')  return 'pct-pos-support';
    if (p === 'object')   return 'pct-pos-object';
    if (p === 'neutral')  return 'pct-pos-neutral';
    if (p === 'mixed')    return 'pct-pos-mixed';
    return '';
  }

  function sentimentColor(s) {
    if (s === 'positive') return '#16a34a';
    if (s === 'negative') return '#dc2626';
    if (s === 'mixed')    return '#d97706';
    return '#64748b';
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Expand / collapse ─────────────────────────────────────────────────────
  let expandedIds = new Set();
  function toggleExpand(id) {
    const s = new Set(expandedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    expandedIds = s;
  }

  // ── Upload panel ──────────────────────────────────────────────────────────
  let panelOpen       = false;
  let uploadMode      = 'file';
  let pasteText       = '';
  let userNotes       = '';
  let dragOver        = false;
  let uploadFile      = null;
  let processing      = false;
  let uploadError     = null;
  let suggestion      = null;
  let sourceFileName  = null;
  let reviewForm      = { commenter_name: '', date_received: '', position: '', comment: '', further_info: '' };
  let saving          = false;
  let saveError       = null;

  function openPanel()  { panelOpen = true; }
  function closePanel() {
    panelOpen = false; uploadFile = null; pasteText = ''; userNotes = '';
    suggestion = null; sourceFileName = null; uploadError = null; saveError = null;
    reviewForm = { commenter_name: '', date_received: '', position: '', comment: '', further_info: '' };
  }

  function handleDragOver(e) { e.preventDefault(); dragOver = true; }
  function handleDragLeave()  { dragOver = false; }
  function handleDrop(e) {
    e.preventDefault(); dragOver = false;
    if (e.dataTransfer.files[0]) { uploadFile = e.dataTransfer.files[0]; processDoc(); }
  }
  function handleFileChange(e) {
    if (e.target.files[0]) { uploadFile = e.target.files[0]; processDoc(); }
  }

  async function processDoc() {
    processing = true; uploadError = null; suggestion = null;
    try {
      const result = await processPublicCommentDoc(projectId, {
        file:      uploadMode === 'file'  ? uploadFile : null,
        text:      uploadMode === 'paste' ? pasteText  : null,
        fileName:  uploadMode === 'paste' ? 'pasted-comment.txt' : null,
        userNotes: userNotes || null,
      });
      suggestion     = result.suggestion;
      sourceFileName = result.source_file_name;
      reviewForm = {
        commenter_name: suggestion.commenter_name || '',
        date_received:  suggestion.date_received  || '',
        position:       suggestion.position       || '',
        comment:        suggestion.comment        || '',
        further_info:   suggestion.further_info   || '',
      };
    } catch (err) {
      uploadError = err.message;
    } finally {
      processing = false;
    }
  }

  async function saveComment() {
    saving = true; saveError = null;
    try {
      const row = await createPublicComment(projectId, { ...reviewForm, source_file_name: sourceFileName });
      comments = [...comments, row];
      closePanel();
    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  let editingId = null;
  let editForm  = {};

  function startEdit(c) {
    editingId = c.id;
    editForm  = {
      commenter_name: c.commenter_name || '',
      date_received:  c.date_received ? c.date_received.substring(0, 10) : '',
      position:       c.position      || '',
      comment:        c.comment       || '',
      further_info:   c.further_info  || '',
    };
  }

  async function saveEdit(id) {
    try {
      const updated = await updatePublicComment(id, editForm);
      comments = comments.map(c => c.id === id ? updated : c);
      editingId = null;
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }

  async function removeComment(id) {
    if (!confirm('Delete this comment?')) return;
    try {
      await deletePublicComment(id);
      comments = comments.filter(c => c.id !== id);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  // ── Batch import ─────────────────────────────────────────────────────────
  let showBatchImport = false;

  function handleBatchDone(e) {
    comments = [...comments, ...e.detail.rows];
  }

  // ── Analysis ──────────────────────────────────────────────────────────────
  let analysisRunning = false;
  let analysisError   = null;

  async function doAnalysis() {
    analysisRunning = true; analysisError = null;
    try {
      analysis = await runPublicCommentAnalysis(projectId);
    } catch (err) {
      analysisError = err.message;
    } finally {
      analysisRunning = false;
    }
  }
</script>

<!-- ── Upload / process panel ─────────────────────────────────────────────── -->
{#if panelOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="ct-overlay" on:click|self={closePanel}>
    <div class="ct-panel">

      <div class="ct-panel-hd">
        <h3 class="ct-panel-title"><i class="las la-comment-alt"></i> Add Public Comment</h3>
        <button class="btn btn-icon btn-ghost" on:click={closePanel}><i class="las la-times"></i></button>
      </div>

      {#if !suggestion}
        <div class="ct-upload-tabs">
          <button class="ct-upload-tab" class:active={uploadMode === 'file'}  on:click={() => uploadMode = 'file'}>Upload file</button>
          <button class="ct-upload-tab" class:active={uploadMode === 'paste'} on:click={() => uploadMode = 'paste'}>Paste text</button>
        </div>

        {#if uploadMode === 'file'}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="ct-dropzone" class:ct-dragover={dragOver}
            on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}
            on:click={() => document.getElementById('pc-file-input').click()}
          >
            {#if processing}
              <span class="ct-spinner"></span><span>Processing…</span>
            {:else if uploadFile}
              <i class="las la-file-alt"></i><span>{uploadFile.name}</span>
            {:else}
              <i class="las la-cloud-upload-alt"></i>
              <span>Drag and drop or click to upload</span>
              <span class="ct-drop-hint">PDF, DOCX, TXT</span>
            {/if}
          </div>
          <input id="pc-file-input" type="file" accept=".pdf,.docx,.txt,.doc" style="display:none" on:change={handleFileChange} />
        {:else}
          <textarea class="ct-paste-area" bind:value={pasteText} placeholder="Paste the comment text here…" rows="8"></textarea>
          <button class="btn btn-primary" disabled={!pasteText.trim() || processing} on:click={processDoc}>
            {#if processing}<span class="ct-spinner ct-spinner-sm"></span> Processing…{:else}<i class="las la-magic"></i> Extract{/if}
          </button>
        {/if}

        <div class="ct-field">
          <label class="ct-label">Notes for AI <span class="ct-label-opt">— optional</span></label>
          <input type="text" class="form-input" bind:value={userNotes} placeholder="e.g. Local resident near the site entrance" />
        </div>

        {#if uploadError}<div class="ct-upload-error">{uploadError}</div>{/if}

      {:else}
        <p class="ct-review-hint"><i class="las la-robot"></i> Review the extracted details before saving.</p>

        <div class="ct-review-grid">
          <div class="ct-field">
            <label class="ct-label">Name</label>
            <input type="text" class="form-input" bind:value={reviewForm.commenter_name} placeholder="Anonymous" />
          </div>
          <div class="ct-field">
            <label class="ct-label">Date</label>
            <input type="date" class="form-input" bind:value={reviewForm.date_received} />
          </div>
          <div class="ct-field">
            <label class="ct-label">Position</label>
            <select class="form-input" bind:value={reviewForm.position}>
              <option value="">— select —</option>
              {#each POSITION_OPTIONS as p}<option value={p}>{p}</option>{/each}
            </select>
          </div>
          <div class="ct-field ct-field-full">
            <label class="ct-label">Comment</label>
            <textarea class="form-input ct-review-ta" bind:value={reviewForm.comment} rows="4"></textarea>
          </div>
          <div class="ct-field ct-field-full">
            <label class="ct-label">Further info</label>
            <textarea class="form-input ct-review-ta" bind:value={reviewForm.further_info} rows="3" placeholder="Additional details, concerns, requests…"></textarea>
          </div>
        </div>

        {#if saveError}<div class="ct-upload-error">{saveError}</div>{/if}

        <div class="ct-review-footer">
          <button class="btn btn-secondary btn-sm" on:click={() => suggestion = null}>Back</button>
          <button class="btn btn-primary" on:click={saveComment} disabled={saving}>
            {#if saving}<span class="ct-spinner ct-spinner-sm"></span> Saving…{:else}<i class="las la-save"></i> Save Comment{/if}
          </button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<!-- ── Main content ───────────────────────────────────────────────────────── -->
<div class="ct-tab">

  <!-- Top bar -->
  <div class="ct-topbar">
    <div class="ct-topbar-left">
      <button class="btn btn-primary" on:click={openPanel}>
        <i class="las la-plus"></i> Add Comment
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => showBatchImport = true}>
        <i class="las la-layer-group"></i> Batch Import
      </button>
    </div>
    <div class="ct-topbar-right">
      <button
        class="btn btn-secondary btn-sm"
        on:click={doAnalysis}
        disabled={analysisRunning || comments.length === 0}
        title={comments.length === 0 ? 'Add comments first' : 'Run AI analysis on all comments'}
      >
        {#if analysisRunning}
          <span class="ct-spinner ct-spinner-sm"></span> Analysing…
        {:else}
          <i class="las la-magic"></i> {analysis.last_analysed_at ? 'Re-run Analysis' : 'Analyse Comments'}
        {/if}
      </button>
    </div>
  </div>

  {#if analysisError}
    <div class="ct-upload-error">{analysisError}</div>
  {/if}

  <!-- Loading / error / empty -->
  {#if loading}
    <div class="ct-state"><span class="ct-spinner"></span><p>Loading…</p></div>
  {:else if error}
    <div class="ct-state ct-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if comments.length === 0}
    <div class="ct-empty">
      <i class="las la-comments ct-empty-icon"></i>
      <p class="ct-empty-title">No public comments yet</p>
      <p class="ct-empty-hint">Upload or paste a comment to extract and track responses.</p>
      <button class="btn btn-primary btn-sm" on:click={openPanel}><i class="las la-plus"></i> Add First Comment</button>
    </div>
  {:else}

    <!-- Table -->
    <div class="ct-table-wrapper">
      <table class="ct-table">
        <thead>
          <tr>
            <th class="ct-th pct-th-name">Name</th>
            <th class="ct-th pct-th-date">Date</th>
            <th class="ct-th pct-th-pos">Position</th>
            <th class="ct-th pct-th-comment">Comment</th>
            <th class="ct-th pct-th-further">Further Info</th>
            <th class="ct-th ct-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each comments as c (c.id)}
            {@const editing = editingId === c.id}
            <tr class="ct-row" class:ct-row-editing={editing}>

              <!-- Name -->
              <td class="ct-td">
                {#if editing}
                  <input type="text" class="form-input ct-cell-input" bind:value={editForm.commenter_name} placeholder="Anonymous" />
                {:else}
                  <span class="ct-consultee-name">{c.commenter_name || 'Anonymous'}</span>
                  {#if c.source_file_name}
                    <span class="ct-source-file" title={c.source_file_name}><i class="las la-file-alt"></i></span>
                  {/if}
                {/if}
              </td>

              <!-- Date -->
              <td class="ct-td ct-td-date">
                {#if editing}
                  <input type="date" class="form-input ct-cell-input" bind:value={editForm.date_received} />
                {:else}
                  {c.date_received ? formatDate(c.date_received) : '—'}
                {/if}
              </td>

              <!-- Position -->
              <td class="ct-td ct-td-pos">
                {#if editing}
                  <select class="form-input ct-cell-input" bind:value={editForm.position}>
                    <option value="">— select —</option>
                    {#each POSITION_OPTIONS as p}<option value={p}>{p}</option>{/each}
                  </select>
                {:else}
                  {#if c.position}
                    <span class="ct-pos-badge {positionClass(c.position)}">{c.position}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Comment -->
              <td class="ct-td ct-td-comments">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.comment} rows="4"></textarea>
                {:else}
                  {#if c.comment}
                    {@const expanded = expandedIds.has(c.id)}
                    {@const needsTrunc = c.comment.length > 280}
                    <p class="ct-comments-text">
                      {expanded || !needsTrunc ? c.comment : c.comment.slice(0, 280) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand(c.id)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Further info -->
              <td class="ct-td ct-td-comments">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.further_info} rows="3" placeholder="Additional details…"></textarea>
                {:else}
                  {#if c.further_info}
                    {@const fexp = expandedIds.has('f' + c.id)}
                    {@const ftrunc = c.further_info.length > 200}
                    <p class="ct-comments-text">
                      {fexp || !ftrunc ? c.further_info : c.further_info.slice(0, 200) + '…'}
                    </p>
                    {#if ftrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand('f' + c.id)}>
                        {fexp ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Actions -->
              <td class="ct-td ct-td-actions">
                {#if editing}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-primary" on:click={() => saveEdit(c.id)} title="Save"><i class="las la-check"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => editingId = null} title="Cancel"><i class="las la-times"></i></button>
                  </div>
                {:else}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-ghost" on:click={() => startEdit(c)} title="Edit"><i class="las la-pen"></i></button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeComment(c.id)} title="Delete"><i class="las la-trash"></i></button>
                  </div>
                {/if}
              </td>

            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="ct-count">{comments.length} public comment{comments.length !== 1 ? 's' : ''}</p>

    <!-- ── Analysis panel ──────────────────────────────────────────────────── -->
    {#if analysis.bullet_summary?.length || analysis.themes?.length}
      <div class="pct-analysis">

        <div class="pct-analysis-hd">
          <span class="pct-analysis-label"><i class="las la-chart-bar"></i> Analysis</span>
          {#if analysis.last_analysed_at}
            <span class="ct-meta-badge"><i class="las la-clock"></i> {formatDateTime(analysis.last_analysed_at)}</span>
          {/if}
        </div>

        <div class="pct-analysis-body">

          {#if analysis.bullet_summary?.length}
            <div class="pct-card">
              <div class="pct-card-title"><i class="las la-list-ul"></i> Summary</div>
              <ul class="pct-bullets">
                {#each analysis.bullet_summary as b}<li>{b}</li>{/each}
              </ul>
            </div>
          {/if}

          {#if analysis.themes?.length}
            <div class="pct-card">
              <div class="pct-card-title"><i class="las la-tags"></i> Recurring Themes</div>
              <div class="pct-themes">
                {#each analysis.themes as t}
                  <div class="pct-theme">
                    <div class="pct-theme-top">
                      <span class="pct-theme-name">{t.theme}</span>
                      <span class="pct-theme-count">{t.count} comment{t.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="pct-theme-sentiment" style="color:{sentimentColor(t.sentiment)}">{t.sentiment || ''}</div>
                    <p class="pct-theme-summary">{t.summary}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}


        </div>
      </div>
    {/if}

  {/if}

</div>

<BatchImportModal
  bind:show={showBatchImport}
  {projectId}
  mode="public"
  on:done={handleBatchDone}
  on:close={() => showBatchImport = false}
/>

<style>
  /* ── Reuse ct- variables from parent scope via inheritance ────────────────
     We use the same ct- class names where they exist in buttons.css / parent,
     and add pct- prefixed classes for things unique to this component.      */

  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .ct-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
    min-height: 200px;
  }

  /* ── Top bar ─────────────────────────────────────────────────────────────── */
  .ct-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .ct-topbar-left, .ct-topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  /* ── States ─────────────────────────────────────────────────────────────── */
  .ct-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }
  .ct-state-error { color: #dc2626; }
  .ct-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    text-align: center;
  }
  .ct-empty-icon  { font-size: 2.5rem; color: #cbd5e1; }
  .ct-empty-title { font-size: 1rem; font-weight: 600; color: #475569; margin: 0; }
  .ct-empty-hint  { font-size: 0.8rem; color: #94a3b8; margin: 0 0 0.5rem; }
  .ct-count { font-size: 0.75rem; color: #94a3b8; text-align: right; margin: 0; }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  .ct-table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .ct-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .ct-th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .pct-th-name    { min-width: 130px; }
  .pct-th-date    { min-width: 100px; }
  .pct-th-pos     { min-width: 100px; }
  .pct-th-comment { min-width: 220px; max-width: 300px; }
  .pct-th-further { min-width: 180px; max-width: 260px; }
  .ct-th-actions  { width: 72px; }

  .ct-row:hover { background: #f8fafc; }
  .ct-row:not(:last-child) .ct-td { border-bottom: 1px solid #f1f5f9; }
  .ct-row-editing { background: #f8fafc; }

  .ct-td { padding: 0.65rem 0.75rem; vertical-align: top; }
  .ct-td-date    { white-space: nowrap; color: #64748b; font-size: 0.78rem; }
  .ct-td-pos     { white-space: nowrap; }
  .ct-td-comments { }
  .ct-td-actions  { width: 72px; }

  .ct-consultee-name { font-weight: 500; font-size: 0.82rem; }
  .ct-source-file    { color: #94a3b8; margin-left: 4px; font-size: 0.75rem; }
  .ct-cell-muted     { color: #cbd5e1; font-size: 0.78rem; }

  .ct-pos-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }
  .pct-pos-support { background: #dcfce7; color: #16a34a; }
  .pct-pos-object  { background: #fee2e2; color: #dc2626; }
  .pct-pos-neutral { background: #f1f5f9; color: #64748b; }
  .pct-pos-mixed   { background: #fef3c7; color: #d97706; }

  .ct-comments-text { margin: 0; font-size: 0.8rem; line-height: 1.5; color: #334155; }
  .ct-expand-btn {
    background: none; border: none; color: #3b82f6; cursor: pointer;
    font-size: 0.72rem; padding: 0; margin-top: 2px; display: block;
  }

  .ct-row-btns    { display: flex; gap: 0.25rem; }
  .ct-cell-input  {
    width: 100%; border: 1px solid #cbd5e1; border-radius: 5px;
    padding: 4px 6px; font-size: 0.78rem; font-family: inherit;
    color: #1e293b; background: #fff; box-sizing: border-box;
  }

  /* ── Panel overlay ───────────────────────────────────────────────────────── */
  .ct-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 600;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  .ct-panel {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 620px;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    overflow-y: auto;
  }
  .ct-panel-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ct-panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }

  .ct-upload-tabs { display: flex; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .ct-upload-tab {
    flex: 1; padding: 0.375rem 0.75rem; border: none;
    background: #fff; font-size: 0.8rem; color: #64748b; cursor: pointer; transition: all 0.15s;
  }
  .ct-upload-tab.active { background: #6366f1; color: #fff; font-weight: 600; }

  .ct-dropzone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.5rem; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 2rem 1rem;
    cursor: pointer; color: #64748b; font-size: 0.85rem; transition: all 0.15s;
  }
  .ct-dropzone:hover, .ct-dragover { border-color: #6366f1; background: #f5f3ff; }
  .ct-dropzone i { font-size: 1.75rem; color: #94a3b8; }
  .ct-drop-hint  { font-size: 0.72rem; color: #94a3b8; }

  .ct-paste-area {
    width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.625rem;
    font-size: 0.82rem; font-family: inherit; line-height: 1.55; resize: vertical; box-sizing: border-box;
  }

  .ct-field      { display: flex; flex-direction: column; gap: 0.25rem; }
  .ct-label      { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .ct-label-opt  { font-weight: 400; color: #94a3b8; }

  .ct-review-hint {
    margin: 0; font-size: 0.8rem; color: #64748b;
    display: flex; align-items: center; gap: 0.375rem;
  }
  .ct-review-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
  }
  .ct-field-full { grid-column: 1 / -1; }
  .ct-review-ta  { font-size: 0.8rem; font-family: inherit; line-height: 1.6; resize: vertical; }

  .ct-review-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    border-top: 1px solid #e2e8f0; padding-top: 0.875rem;
  }

  .ct-upload-error {
    font-size: 0.78rem; color: #dc2626;
    background: #fee2e2; border-radius: 4px; padding: 0.375rem 0.625rem;
  }

  /* ── Meta badge ──────────────────────────────────────────────────────────── */
  .ct-meta-badge {
    font-size: 0.72rem; color: #64748b;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    border-radius: 4px; padding: 2px 8px;
    display: flex; align-items: center; gap: 4px;
  }

  /* ── Analysis panel ──────────────────────────────────────────────────────── */
  .pct-analysis {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .pct-analysis-hd {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .pct-analysis-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
  }
  .pct-analysis-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .pct-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem 1rem;
  }
  .pct-card-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .pct-bullets {
    margin: 0; padding-left: 1.125rem;
    display: flex; flex-direction: column; gap: 0.3rem;
  }
  .pct-bullets li { font-size: 0.8rem; color: #334155; line-height: 1.5; }

  .pct-themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
  }
  .pct-theme {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .pct-theme-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .pct-theme-name  { font-size: 0.8rem; font-weight: 600; color: #1e293b; }
  .pct-theme-count {
    font-size: 0.67rem; font-weight: 700;
    background: #e2e8f0; color: #475569;
    border-radius: 999px; padding: 0.1rem 0.4rem;
    white-space: nowrap; flex-shrink: 0;
  }
  .pct-theme-sentiment { font-size: 0.7rem; font-weight: 600; text-transform: capitalize; }
  .pct-theme-summary   { margin: 0; font-size: 0.76rem; color: #475569; line-height: 1.4; }


  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .ct-spinner {
    display: inline-block;
    width: 22px; height: 22px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: pct-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .ct-spinner-sm { width: 14px; height: 14px; border-width: 2px; }
  @keyframes pct-spin { to { transform: rotate(360deg); } }
</style>
