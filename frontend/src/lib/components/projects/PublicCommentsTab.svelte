<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
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
  let comments = [];
  let analysis = { bullet_summary: null, themes: null, last_analysed_at: null };
  let loading = true;
  let error = null;

  // ── Position options ──────────────────────────────────────────────────────
  const POSITION_OPTIONS = ['Support', 'Object', 'Neutral', 'Mixed'];

  function positionColor(pos) {
    if (!pos) return '#94a3b8';
    const p = pos.toLowerCase();
    if (p === 'support')  return '#16a34a';
    if (p === 'object')   return '#dc2626';
    if (p === 'neutral')  return '#64748b';
    if (p === 'mixed')    return '#d97706';
    return '#64748b';
  }

  function positionBg(pos) {
    if (!pos) return '#f1f5f9';
    const p = pos.toLowerCase();
    if (p === 'support')  return '#dcfce7';
    if (p === 'object')   return '#fee2e2';
    if (p === 'neutral')  return '#f1f5f9';
    if (p === 'mixed')    return '#fef3c7';
    return '#f1f5f9';
  }

  function sentimentColor(s) {
    if (!s) return '#64748b';
    if (s === 'positive') return '#16a34a';
    if (s === 'negative') return '#dc2626';
    if (s === 'mixed')    return '#d97706';
    return '#64748b';
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  onMount(async () => { await loadData(); });

  async function loadData() {
    if (!projectId) return;
    loading = true;
    error = null;
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

  // ── Expand/collapse long text ─────────────────────────────────────────────
  let expandedIds = new Set();
  function toggleExpand(id) {
    const s = new Set(expandedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    expandedIds = s;
  }

  // ── Upload panel ──────────────────────────────────────────────────────────
  let showUpload = false;
  let uploadMode = 'file';   // 'file' | 'paste'
  let pasteText = '';
  let userNotes = '';
  let dragOver = false;
  let uploadFile = null;
  let uploadProcessing = false;
  let uploadError = null;
  let suggestion = null;
  let sourceFileName = null;

  function handleDragOver(e) { e.preventDefault(); dragOver = true; }
  function handleDragLeave()  { dragOver = false; }
  function handleDrop(e) {
    e.preventDefault(); dragOver = false;
    if (e.dataTransfer.files[0]) { uploadFile = e.dataTransfer.files[0]; processUpload(); }
  }
  function handleFileChange(e) {
    if (e.target.files[0]) { uploadFile = e.target.files[0]; processUpload(); }
  }

  async function processUpload() {
    uploadProcessing = true;
    uploadError = null;
    suggestion = null;
    try {
      const result = await processPublicCommentDoc(projectId, {
        file:      uploadMode === 'file' ? uploadFile : null,
        text:      uploadMode === 'paste' ? pasteText : null,
        fileName:  uploadMode === 'paste' ? 'pasted-comment.txt' : null,
        userNotes: userNotes || null,
      });
      suggestion      = result.suggestion;
      sourceFileName  = result.source_file_name;
      reviewForm      = {
        commenter_name: suggestion.commenter_name || '',
        date_received:  suggestion.date_received  || '',
        position:       suggestion.position        || '',
        comment:        suggestion.comment         || '',
        further_info:   suggestion.further_info    || '',
      };
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  // ── Review / save form ────────────────────────────────────────────────────
  let reviewForm = { commenter_name: '', date_received: '', position: '', comment: '', further_info: '' };
  let saving = false;
  let saveError = null;

  async function saveComment() {
    saving = true;
    saveError = null;
    try {
      const row = await createPublicComment(projectId, { ...reviewForm, source_file_name: sourceFileName });
      comments = [...comments, row];
      resetUploadPanel();
    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
    }
  }

  function resetUploadPanel() {
    showUpload = false;
    uploadFile = null;
    pasteText = '';
    userNotes = '';
    suggestion = null;
    sourceFileName = null;
    uploadError = null;
    saveError = null;
    reviewForm = { commenter_name: '', date_received: '', position: '', comment: '', further_info: '' };
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  function startEdit(r) {
    editingId = r.id;
    editForm = {
      commenter_name: r.commenter_name || '',
      date_received:  r.date_received  ? r.date_received.substring(0, 10) : '',
      position:       r.position       || '',
      comment:        r.comment        || '',
      further_info:   r.further_info   || '',
    };
  }

  async function saveEdit() {
    try {
      const updated = await updatePublicComment(editingId, editForm);
      comments = comments.map(c => c.id === editingId ? updated : c);
      editingId = null;
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }

  function cancelEdit() { editingId = null; }

  async function removeComment(id) {
    if (!confirm('Delete this comment?')) return;
    try {
      await deletePublicComment(id);
      comments = comments.filter(c => c.id !== id);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  // ── Add blank row manually ────────────────────────────────────────────────
  async function addBlankRow() {
    const row = await createPublicComment(projectId, {
      commenter_name: '', date_received: null, position: '', comment: '', further_info: '',
    });
    comments = [...comments, row];
    startEdit(row);
  }

  // ── Analysis ──────────────────────────────────────────────────────────────
  let analysisRunning = false;
  let analysisError = null;

  async function runAnalysis() {
    analysisRunning = true;
    analysisError = null;
    try {
      const result = await runPublicCommentAnalysis(projectId);
      analysis = result;
    } catch (err) {
      analysisError = err.message;
    } finally {
      analysisRunning = false;
    }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatAnalysedAt(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  $: positionCounts = (() => {
    const counts = { Support: 0, Object: 0, Neutral: 0, Mixed: 0 };
    for (const c of comments) {
      if (c.position && counts[c.position] !== undefined) counts[c.position]++;
    }
    return counts;
  })();
</script>

<!-- ── Upload/process panel ───────────────────────────────────────────────── -->
{#if showUpload}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="pc-overlay" on:click|self={resetUploadPanel}>
    <div class="pc-panel">
      <div class="pc-panel-header">
        <h3 class="pc-panel-title"><i class="las la-file-upload"></i> Add Public Comment</h3>
        <button class="btn btn-icon btn-ghost" on:click={resetUploadPanel}><i class="las la-times"></i></button>
      </div>

      {#if !suggestion}
        <div class="pc-upload-tabs">
          <button class="pc-upload-tab" class:active={uploadMode === 'file'} on:click={() => uploadMode = 'file'}>Upload file</button>
          <button class="pc-upload-tab" class:active={uploadMode === 'paste'} on:click={() => uploadMode = 'paste'}>Paste text</button>
        </div>

        {#if uploadMode === 'file'}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="pc-dropzone"
            class:pc-dragover={dragOver}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            on:click={() => document.getElementById('pc-file-input').click()}
          >
            {#if uploadProcessing}
              <span class="pc-spinner"></span>
              <span>Processing…</span>
            {:else if uploadFile}
              <i class="las la-file-alt"></i>
              <span>{uploadFile.name}</span>
            {:else}
              <i class="las la-cloud-upload-alt"></i>
              <span>Drag and drop or click to upload</span>
              <span class="pc-drop-hint">PDF, DOCX, TXT</span>
            {/if}
          </div>
          <input id="pc-file-input" type="file" accept=".pdf,.docx,.txt,.doc" style="display:none" on:change={handleFileChange} />
        {:else}
          <textarea class="pc-paste-area" bind:value={pasteText} placeholder="Paste the comment text here…" rows="8"></textarea>
          <button class="btn btn-primary" disabled={!pasteText.trim() || uploadProcessing} on:click={processUpload}>
            {#if uploadProcessing}<span class="pc-spinner pc-spinner-sm"></span> Processing…{:else}<i class="las la-magic"></i> Extract{/if}
          </button>
        {/if}

        <div class="pc-field">
          <label class="pc-label">Notes for AI <span class="pc-label-hint">— optional context</span></label>
          <input type="text" class="form-input" bind:value={userNotes} placeholder="e.g. This is from a local resident near the entrance" />
        </div>

        {#if uploadError}<div class="pc-error">{uploadError}</div>{/if}

      {:else}
        <!-- Review extracted suggestion -->
        <p class="pc-review-intro"><i class="las la-robot"></i> Review the extracted details before saving.</p>
        <div class="pc-review-grid">
          <div class="pc-field">
            <label class="pc-label">Name</label>
            <input type="text" class="form-input" bind:value={reviewForm.commenter_name} placeholder="Anonymous" />
          </div>
          <div class="pc-field">
            <label class="pc-label">Date</label>
            <input type="date" class="form-input" bind:value={reviewForm.date_received} />
          </div>
          <div class="pc-field">
            <label class="pc-label">Position</label>
            <select class="form-input" bind:value={reviewForm.position}>
              <option value="">— select —</option>
              {#each POSITION_OPTIONS as p}<option value={p}>{p}</option>{/each}
            </select>
          </div>
          <div class="pc-field pc-field-full">
            <label class="pc-label">Comment</label>
            <textarea class="form-input pc-comments-area" bind:value={reviewForm.comment} rows="4"></textarea>
          </div>
          <div class="pc-field pc-field-full">
            <label class="pc-label">Further info</label>
            <textarea class="form-input pc-comments-area" bind:value={reviewForm.further_info} rows="3" placeholder="Additional details, concerns, requests…"></textarea>
          </div>
        </div>

        {#if saveError}<div class="pc-error">{saveError}</div>{/if}

        <div class="pc-review-footer">
          <button class="btn btn-secondary btn-sm" on:click={() => suggestion = null}>Back</button>
          <button class="btn btn-primary" on:click={saveComment} disabled={saving}>
            {#if saving}<span class="pc-spinner pc-spinner-sm"></span> Saving…{:else}<i class="las la-save"></i> Save Comment{/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Main content ───────────────────────────────────────────────────────── -->
<div class="pc-root">

  {#if loading}
    <div class="pc-loading"><span class="pc-spinner"></span> Loading…</div>
  {:else if error}
    <div class="pc-error-banner"><i class="las la-exclamation-triangle"></i> {error}</div>
  {:else}

    <!-- Header bar -->
    <div class="pc-header">
      <div class="pc-header-left">
        <h3 class="pc-title">Public Comments</h3>
        <span class="pc-count-badge">{comments.length}</span>
        {#if comments.length}
          <div class="pc-position-pills">
            {#each Object.entries(positionCounts).filter(([, n]) => n > 0) as [pos, n]}
              <span class="pc-pos-pill" style="color:{positionColor(pos)};background:{positionBg(pos)}">{pos}: {n}</span>
            {/each}
          </div>
        {/if}
      </div>
      <div class="pc-header-right">
        <button class="btn btn-secondary btn-sm" on:click={addBlankRow}><i class="las la-plus"></i> Add</button>
        <button class="btn btn-primary btn-sm" on:click={() => showUpload = true}><i class="las la-file-upload"></i> Upload</button>
      </div>
    </div>

    <!-- Comments table -->
    {#if comments.length}
      <div class="pc-table-wrap">
        <table class="pc-table">
          <thead>
            <tr>
              <th class="pc-th">Name</th>
              <th class="pc-th">Date</th>
              <th class="pc-th pc-th-pos">Position</th>
              <th class="pc-th">Comment</th>
              <th class="pc-th">Further Info</th>
              <th class="pc-th pc-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each comments as c (c.id)}
              {#if editingId === c.id}
                <tr class="pc-row-editing">
                  <td class="pc-td"><input class="pc-cell-input" type="text" bind:value={editForm.commenter_name} placeholder="Anonymous" /></td>
                  <td class="pc-td"><input class="pc-cell-input" type="date" bind:value={editForm.date_received} /></td>
                  <td class="pc-td">
                    <select class="pc-cell-input" bind:value={editForm.position}>
                      <option value="">—</option>
                      {#each POSITION_OPTIONS as p}<option value={p}>{p}</option>{/each}
                    </select>
                  </td>
                  <td class="pc-td"><textarea class="pc-cell-input pc-cell-ta" bind:value={editForm.comment} rows="4"></textarea></td>
                  <td class="pc-td"><textarea class="pc-cell-input pc-cell-ta" bind:value={editForm.further_info} rows="3"></textarea></td>
                  <td class="pc-td">
                    <div class="pc-row-btns">
                      <button class="btn btn-primary btn-sm" on:click={saveEdit}>Save</button>
                      <button class="btn btn-secondary btn-sm" on:click={cancelEdit}>Cancel</button>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr class="pc-row">
                  <td class="pc-td pc-name">{c.commenter_name || 'Anonymous'}</td>
                  <td class="pc-td pc-date">{formatDate(c.date_received)}</td>
                  <td class="pc-td">
                    {#if c.position}
                      <span class="pc-pos-badge" style="color:{positionColor(c.position)};background:{positionBg(c.position)}">{c.position}</span>
                    {:else}
                      <span class="pc-empty">—</span>
                    {/if}
                  </td>
                  <td class="pc-td pc-td-comment">
                    {#if c.comment}
                      {@const expanded = expandedIds.has(c.id)}
                      <span class:pc-truncate={!expanded}>{c.comment}</span>
                      {#if c.comment.length > 160}
                        <button class="pc-expand-btn" on:click={() => toggleExpand(c.id)}>
                          {expanded ? 'less' : 'more'}
                        </button>
                      {/if}
                    {:else}
                      <span class="pc-empty">—</span>
                    {/if}
                  </td>
                  <td class="pc-td pc-td-comment">
                    {#if c.further_info}
                      {@const fexp = expandedIds.has('f' + c.id)}
                      <span class:pc-truncate={!fexp}>{c.further_info}</span>
                      {#if c.further_info.length > 120}
                        <button class="pc-expand-btn" on:click={() => toggleExpand('f' + c.id)}>
                          {fexp ? 'less' : 'more'}
                        </button>
                      {/if}
                    {:else}
                      <span class="pc-empty">—</span>
                    {/if}
                  </td>
                  <td class="pc-td">
                    <div class="pc-row-btns">
                      <button class="btn btn-icon btn-ghost" on:click={() => startEdit(c)} title="Edit"><i class="las la-pen"></i></button>
                      <button class="btn btn-icon btn-danger-ghost" on:click={() => removeComment(c.id)} title="Delete"><i class="las la-trash"></i></button>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="pc-empty-state">
        <i class="las la-comments"></i>
        <p>No public comments yet. Upload a comment or add one manually.</p>
        <button class="btn btn-primary" on:click={() => showUpload = true}><i class="las la-file-upload"></i> Upload Comment</button>
      </div>
    {/if}

    <!-- ── Analysis section ──────────────────────────────────────────────── -->
    <div class="pc-analysis-section">
      <div class="pc-analysis-header">
        <div class="pc-analysis-title-row">
          <h4 class="pc-analysis-title"><i class="las la-chart-bar"></i> Analysis</h4>
          {#if analysis.last_analysed_at}
            <span class="pc-analysed-at">Last run {formatAnalysedAt(analysis.last_analysed_at)}</span>
          {/if}
        </div>
        <button
          class="btn btn-secondary btn-sm"
          on:click={runAnalysis}
          disabled={analysisRunning || comments.length === 0}
          title={comments.length === 0 ? 'Add comments first' : 'Run LLM analysis on all comments'}
        >
          {#if analysisRunning}
            <span class="pc-spinner pc-spinner-sm"></span> Analysing…
          {:else}
            <i class="las la-magic"></i> {analysis.last_analysed_at ? 'Re-run Analysis' : 'Run Analysis'}
          {/if}
        </button>
      </div>

      {#if analysisError}
        <div class="pc-error">{analysisError}</div>
      {/if}

      {#if analysis.bullet_summary?.length || analysis.themes?.length}
        <div class="pc-analysis-body">

          <!-- Bullet summary -->
          {#if analysis.bullet_summary?.length}
            <div class="pc-analysis-card">
              <div class="pc-analysis-card-title"><i class="las la-list"></i> Summary</div>
              <ul class="pc-bullet-list">
                {#each analysis.bullet_summary as bullet}
                  <li>{bullet}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Themes -->
          {#if analysis.themes?.length}
            <div class="pc-analysis-card">
              <div class="pc-analysis-card-title"><i class="las la-tags"></i> Recurring Themes</div>
              <div class="pc-themes-grid">
                {#each analysis.themes as theme}
                  <div class="pc-theme-card">
                    <div class="pc-theme-top">
                      <span class="pc-theme-name">{theme.theme}</span>
                      <span class="pc-theme-count">{theme.count} comment{theme.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="pc-theme-sentiment" style="color:{sentimentColor(theme.sentiment)}">
                      <i class="las la-circle" style="font-size:0.55rem;vertical-align:middle;margin-right:3px"></i>
                      {theme.sentiment || 'unspecified'}
                    </div>
                    <p class="pc-theme-summary">{theme.summary}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

        </div>
      {:else if !analysisRunning && comments.length > 0}
        <div class="pc-analysis-empty">
          <i class="las la-chart-pie"></i>
          <p>Run analysis to generate a summary and identify recurring themes across all {comments.length} comment{comments.length !== 1 ? 's' : ''}.</p>
        </div>
      {/if}
    </div>

  {/if}
</div>

<style>
  /* ── Root ────────────────────────────────────────────────────────────────── */
  .pc-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1.25rem;
    min-height: 200px;
  }

  /* ── Loading / error ─────────────────────────────────────────────────────── */
  .pc-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.875rem;
    padding: 2rem 0;
  }
  .pc-error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
  }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .pc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .pc-header-left  { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }
  .pc-header-right { display: flex; align-items: center; gap: 0.5rem; }
  .pc-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
  }
  .pc-count-badge {
    background: #e2e8f0;
    color: #475569;
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .pc-position-pills { display: flex; gap: 0.375rem; flex-wrap: wrap; }
  .pc-pos-pill {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
  }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  .pc-table-wrap {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .pc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .pc-th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.5rem 0.625rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .pc-th-pos     { width: 90px; }
  .pc-th-actions { width: 80px; }
  .pc-td {
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
    color: #1e293b;
  }
  .pc-row:last-child .pc-td,
  .pc-row-editing:last-child .pc-td { border-bottom: none; }
  .pc-row-editing { background: #f8fafc; }
  .pc-row:hover   { background: #fafafa; }

  .pc-name   { font-weight: 500; white-space: nowrap; }
  .pc-date   { white-space: nowrap; color: #64748b; font-size: 0.78rem; }
  .pc-empty  { color: #cbd5e1; }

  .pc-pos-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }

  .pc-td-comment { max-width: 260px; }
  .pc-truncate {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pc-expand-btn {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.72rem;
    padding: 0;
    margin-top: 2px;
    display: block;
  }

  .pc-row-btns { display: flex; gap: 0.25rem; }

  /* inline edit inputs */
  .pc-cell-input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 4px 6px;
    font-size: 0.78rem;
    font-family: inherit;
    color: #1e293b;
    background: #fff;
    box-sizing: border-box;
  }
  .pc-cell-ta { resize: vertical; min-height: 60px; line-height: 1.5; }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .pc-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2.5rem 1rem;
    color: #94a3b8;
    text-align: center;
    border: 1.5px dashed #e2e8f0;
    border-radius: 8px;
  }
  .pc-empty-state i   { font-size: 2rem; }
  .pc-empty-state p   { margin: 0; font-size: 0.85rem; }

  /* ── Analysis section ────────────────────────────────────────────────────── */
  .pc-analysis-section {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .pc-analysis-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    gap: 0.75rem;
  }
  .pc-analysis-title-row { display: flex; align-items: center; gap: 0.625rem; }
  .pc-analysis-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .pc-analysed-at {
    font-size: 0.72rem;
    color: #94a3b8;
  }
  .pc-analysis-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .pc-analysis-empty {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1rem;
    color: #94a3b8;
    font-size: 0.82rem;
  }
  .pc-analysis-empty i  { font-size: 1.25rem; flex-shrink: 0; }
  .pc-analysis-empty p  { margin: 0; }

  .pc-analysis-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.875rem 1rem;
  }
  .pc-analysis-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .pc-bullet-list {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .pc-bullet-list li { font-size: 0.82rem; color: #334155; line-height: 1.5; }

  /* ── Themes grid ─────────────────────────────────────────────────────────── */
  .pc-themes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.625rem;
  }
  .pc-theme-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .pc-theme-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .pc-theme-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.3;
  }
  .pc-theme-count {
    font-size: 0.68rem;
    font-weight: 700;
    background: #e2e8f0;
    color: #475569;
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .pc-theme-sentiment {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  .pc-theme-summary {
    margin: 0;
    font-size: 0.76rem;
    color: #475569;
    line-height: 1.45;
  }

  /* ── Upload overlay ──────────────────────────────────────────────────────── */
  .pc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 600;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  .pc-panel {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 620px;
    max-height: 92vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    overflow-y: auto;
  }
  .pc-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pc-panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }

  .pc-upload-tabs { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .pc-upload-tab {
    flex: 1;
    padding: 0.375rem 0.75rem;
    border: none;
    background: #fff;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pc-upload-tab.active { background: #6366f1; color: #fff; font-weight: 600; }

  .pc-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem 1rem;
    cursor: pointer;
    color: #64748b;
    font-size: 0.85rem;
    transition: all 0.15s;
  }
  .pc-dropzone:hover, .pc-dropzone.pc-dragover { border-color: #6366f1; background: #f5f3ff; }
  .pc-dropzone i { font-size: 1.75rem; color: #94a3b8; }
  .pc-drop-hint  { font-size: 0.72rem; color: #94a3b8; }

  .pc-paste-area {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.625rem;
    font-size: 0.82rem;
    font-family: inherit;
    line-height: 1.55;
    resize: vertical;
    box-sizing: border-box;
  }

  .pc-review-intro {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .pc-review-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
  }
  .pc-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .pc-field-full { grid-column: 1 / -1; }
  .pc-label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .pc-label-hint { font-weight: 400; color: #94a3b8; }
  .pc-comments-area { font-size: 0.8rem; font-family: inherit; line-height: 1.6; resize: vertical; }

  .pc-review-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.875rem;
  }

  .pc-error {
    font-size: 0.78rem;
    color: #dc2626;
    background: #fee2e2;
    border-radius: 4px;
    padding: 0.375rem 0.625rem;
  }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .pc-spinner {
    display: inline-block;
    width: 22px;
    height: 22px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: pc-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .pc-spinner-sm { width: 14px; height: 14px; border-width: 2px; }
  @keyframes pc-spin { to { transform: rotate(360deg); } }
</style>
