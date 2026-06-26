<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import {
    getConsultationData,
    processConsultationDoc,
    createConsultationResponse,
    updateConsultationResponse,
    deleteConsultationResponse,
    markConsultationExported,
    markConsultationIssuedToClient,
  } from '$lib/api/consultation.js';

  export let project;
  $: projectId = project?.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  let responses = [];
  let meta = { last_exported_at: null, last_issued_to_client_at: null };
  let loading = true;
  let error = null;

  // ── Upload panel state ────────────────────────────────────────────────────
  let showPanel = false;
  let panelStep = 'input';   // 'input' | 'processing' | 'review'
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadFile = null;
  let uploadPasteText = '';
  let uploadDragOver = false;
  let uploadError = null;
  let fileInput;

  // ── Review form (post-LLM, pre-save) ─────────────────────────────────────
  let reviewForm = { consultee_name: '', date_received: '', position: '', comments: '' };
  let reviewSaving = false;
  let reviewSourceFile = null;

  // ── Inline editing ────────────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  // ── Expand/collapse comments ──────────────────────────────────────────────
  let expandedIds = new Set();

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    loading = true; error = null;
    try {
      const data = await getConsultationData(projectId);
      responses = data.responses;
      meta = data.meta;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function positionClass(pos) {
    if (!pos) return 'ct-pos-none';
    const p = pos.toLowerCase();
    if (p.includes('objection')) return 'ct-pos-objection';
    if (p.includes('conditional')) return 'ct-pos-conditional';
    if (p.includes('support')) return 'ct-pos-support';
    if (p.includes('no comment') || p.includes('no objection')) return 'ct-pos-no-comment';
    return 'ct-pos-other';
  }

  // ── Upload panel ──────────────────────────────────────────────────────────

  function openPanel() {
    showPanel = true;
    panelStep = 'input';
    uploadInputTab = 'upload';
    uploadFile = null;
    uploadPasteText = '';
    uploadError = null;
    uploadDragOver = false;
  }

  function closePanel() {
    if (panelStep === 'processing') return;
    showPanel = false;
    uploadError = null;
  }

  function handleDrop(e) {
    e.preventDefault();
    uploadDragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { uploadFile = file; uploadInputTab = 'upload'; }
  }

  function handleFileChange(e) {
    uploadFile = e.target.files[0] || null;
  }

  async function submitProcess() {
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file to upload.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the consultation response text.'; return; }

    panelStep = 'processing';
    uploadError = null;
    try {
      const result = await processConsultationDoc(projectId, {
        file: uploadInputTab === 'upload' ? uploadFile : null,
        text: uploadInputTab === 'paste' ? uploadPasteText : null,
      });
      reviewSourceFile = result.source_file_name || null;
      reviewForm = {
        consultee_name: result.suggestion.consultee_name || '',
        date_received:  result.suggestion.date_received  || '',
        position:       result.suggestion.position       || '',
        comments:       result.suggestion.comments       || '',
      };
      panelStep = 'review';
    } catch (err) {
      uploadError = err.message;
      panelStep = 'input';
    }
  }

  async function acceptReview() {
    if (!reviewForm.consultee_name?.trim()) { uploadError = 'Consultee name is required.'; return; }
    reviewSaving = true;
    uploadError = null;
    try {
      const created = await createConsultationResponse(projectId, {
        consultee_name:   reviewForm.consultee_name.trim(),
        date_received:    reviewForm.date_received   || null,
        position:         reviewForm.position?.trim()  || null,
        comments:         reviewForm.comments?.trim()  || null,
        source_file_name: reviewSourceFile,
      });
      responses = [...responses, created];
      showPanel = false;
    } catch (err) {
      uploadError = err.message;
    } finally {
      reviewSaving = false;
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  function startEdit(r) {
    editingId = r.id;
    editForm = {
      consultee_name:      r.consultee_name ?? '',
      date_received:       r.date_received ? r.date_received.split('T')[0] : '',
      position:            r.position ?? '',
      comments:            r.comments ?? '',
      consultant_response: r.consultant_response ?? '',
      response_issued:     r.response_issued ?? false,
      follow_up:           r.follow_up ?? '',
    };
  }

  async function saveEdit(id) {
    try {
      const updated = await updateConsultationResponse(id, {
        consultee_name:      editForm.consultee_name || null,
        date_received:       editForm.date_received  || null,
        position:            editForm.position       || null,
        comments:            editForm.comments       || null,
        consultant_response: editForm.consultant_response || null,
        response_issued:     editForm.response_issued,
        follow_up:           editForm.follow_up      || null,
      });
      responses = responses.map(r => r.id === id ? updated : r);
      editingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleResponseIssued(r) {
    try {
      const updated = await updateConsultationResponse(r.id, { response_issued: !r.response_issued });
      responses = responses.map(x => x.id === r.id ? updated : x);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeResponse(id) {
    if (!confirm('Delete this consultation response?')) return;
    try {
      await deleteConsultationResponse(id);
      responses = responses.filter(r => r.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleExpand(id) {
    const next = new Set(expandedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    expandedIds = next;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!responses.length) { alert('No responses to export.'); return; }
    const html = buildExportHtml();
    const projectRef = project?.project_reference || project?.site_name || 'Project';
    await exportHtmlToWord(html, `${projectRef} Consultation Tracker.docx`);
    try {
      const updated = await markConsultationExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  function buildExportHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const rows = responses.map(r => `<tr>
      ${td(r.consultee_name)}
      ${td(r.date_received ? formatDate(r.date_received) : '')}
      ${td(r.position || '')}
      ${td((r.comments || '').replace(/\n/g, '<br>'))}
      ${td((r.consultant_response || '').replace(/\n/g, '<br>'))}
      ${td(r.response_issued ? 'Yes' : 'No')}
      ${td((r.follow_up || '').replace(/\n/g, '<br>'))}
    </tr>`).join('');

    return `<h2>Consultation Tracker</h2>
<p>Project: ${project?.site_name || ''} | Exported: ${formatDate(new Date().toISOString())}</p>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Consultee')}${th('Date Received')}${th('Position')}${th('Comments')}${th('Consultant Response')}${th('Response Issued')}${th('Follow Up')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  async function handleIssueToClient() {
    try {
      const updated = await markConsultationIssuedToClient(projectId);
      meta = { ...meta, ...updated };
      alert('Marked as issued to client. (Email integration coming soon.)');
    } catch (err) {
      alert(err.message);
    }
  }
</script>

<!-- ── Panel overlay ──────────────────────────────────────────────────────── -->
{#if showPanel}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="ct-overlay" on:click|self={closePanel}>
    <div class="ct-panel">

      {#if panelStep === 'input'}
        <div class="ct-panel-header">
          <h3 class="ct-panel-title">Process Consultation Response</h3>
          <button class="btn btn-icon btn-ghost" on:click={closePanel}><i class="las la-times"></i></button>
        </div>

        <div class="ct-input-tabs">
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
            class="ct-drop-zone"
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
              <i class="las la-file-alt ct-drop-icon"></i>
              <span class="ct-drop-filename">{uploadFile.name}</span>
              <span class="ct-drop-hint">Click to change file</span>
            {:else}
              <i class="las la-cloud-upload-alt ct-drop-icon"></i>
              <span>Drop a file here or click to browse</span>
              <span class="ct-drop-hint">PDF, DOCX or TXT</span>
            {/if}
          </div>
          <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
        {:else}
          <textarea class="form-input ct-paste" bind:value={uploadPasteText} placeholder="Paste the consultation response text here…" rows="8"></textarea>
        {/if}

        {#if uploadError}<div class="ct-error">{uploadError}</div>{/if}

        <button class="btn btn-primary ct-process-btn" on:click={submitProcess}>
          <i class="las la-magic"></i> Extract Consultation Details
        </button>

      {:else if panelStep === 'processing'}
        <div class="ct-processing">
          <span class="ct-spinner"></span>
          <p>Extracting consultation details…</p>
          <p class="ct-processing-hint">Reading the response and capturing every issue.</p>
        </div>

      {:else if panelStep === 'review'}
        <div class="ct-panel-header">
          <h3 class="ct-panel-title">Review Extracted Details</h3>
          <button class="btn btn-icon btn-ghost" on:click={closePanel}><i class="las la-times"></i></button>
        </div>
        <p class="ct-review-hint">Check the extracted details below. Edit anything that needs correcting before adding to the tracker.</p>

        <div class="ct-review-form">
          <div class="form-row">
            <div class="form-group form-group-wide">
              <label>Consultee <span class="required">*</span></label>
              <input type="text" class="form-input" bind:value={reviewForm.consultee_name} placeholder="e.g. Natural England" />
            </div>
            <div class="form-group">
              <label>Date Received</label>
              <input type="date" class="form-input" bind:value={reviewForm.date_received} />
            </div>
          </div>
          <div class="form-group">
            <label>Position</label>
            <select class="form-input" bind:value={reviewForm.position}>
              <option value="">— select —</option>
              <option>Objection</option>
              <option>Conditional Support</option>
              <option>Support</option>
              <option>No Comment</option>
            </select>
          </div>
          <div class="form-group">
            <label>Comments <span class="ct-label-hint">(all issues — one bullet per issue)</span></label>
            <textarea class="form-input ct-comments-textarea" bind:value={reviewForm.comments} rows="12"></textarea>
          </div>
        </div>

        {#if uploadError}<div class="ct-error">{uploadError}</div>{/if}

        <div class="ct-review-footer">
          <button class="btn btn-secondary btn-sm" on:click={() => panelStep = 'input'}>
            <i class="las la-arrow-left"></i> Back
          </button>
          <button class="btn btn-primary" on:click={acceptReview} disabled={reviewSaving}>
            {#if reviewSaving}<span class="ct-spinner ct-spinner-sm"></span> Saving…{:else}<i class="las la-check"></i> Accept & Add to Tracker{/if}
          </button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<!-- ── Main tab content ───────────────────────────────────────────────────── -->
<div class="ct-tab">

  <!-- Top bar -->
  <div class="ct-topbar">
    <div class="ct-topbar-left">
      <button class="btn btn-primary" on:click={openPanel}>
        <i class="las la-plus"></i> Process Consultation Response
      </button>
    </div>
    <div class="ct-topbar-right">
      <div class="ct-meta-badges">
        {#if meta.last_exported_at}
          <span class="ct-meta-badge"><i class="las la-download"></i> Exported {formatDateTime(meta.last_exported_at)}</span>
        {/if}
        {#if meta.last_issued_to_client_at}
          <span class="ct-meta-badge ct-meta-badge-issued"><i class="las la-paper-plane"></i> Issued {formatDateTime(meta.last_issued_to_client_at)}</span>
        {/if}
      </div>
      <button class="btn btn-secondary btn-sm" on:click={handleExport} disabled={!responses.length}>
        <i class="las la-file-word"></i> Export
      </button>
      <button class="btn btn-ghost btn-sm ct-issue-btn" title="Email integration coming soon" on:click={handleIssueToClient} disabled={!responses.length}>
        <i class="las la-paper-plane"></i> Send to Client
      </button>
    </div>
  </div>

  <!-- Loading / error / empty -->
  {#if loading}
    <div class="ct-state"><span class="ct-spinner"></span><p>Loading…</p></div>
  {:else if error}
    <div class="ct-state ct-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if responses.length === 0}
    <div class="ct-empty">
      <i class="las la-inbox ct-empty-icon"></i>
      <p class="ct-empty-title">No consultation responses yet</p>
      <p class="ct-empty-hint">Upload or paste a consultation response to extract and track the issues.</p>
      <button class="btn btn-primary btn-sm" on:click={openPanel}><i class="las la-plus"></i> Process First Response</button>
    </div>
  {:else}

    <!-- Table -->
    <div class="ct-table-wrapper">
      <table class="ct-table">
        <thead>
          <tr>
            <th class="ct-th ct-th-consultee">Consultee</th>
            <th class="ct-th ct-th-date">Date</th>
            <th class="ct-th ct-th-pos">Position</th>
            <th class="ct-th ct-th-comments">Comments</th>
            <th class="ct-th ct-th-response">Consultant Response</th>
            <th class="ct-th ct-th-issued">Issued</th>
            <th class="ct-th ct-th-followup">Follow Up</th>
            <th class="ct-th ct-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each responses as r (r.id)}
            {#if editingId === r.id}
              <tr class="ct-edit-row">
                <td colspan="8" class="ct-edit-cell">
                  <div class="ct-edit-form">
                    <div class="form-row">
                      <div class="form-group form-group-wide">
                        <label>Consultee</label>
                        <input type="text" class="form-input" bind:value={editForm.consultee_name} />
                      </div>
                      <div class="form-group">
                        <label>Date Received</label>
                        <input type="date" class="form-input" bind:value={editForm.date_received} />
                      </div>
                      <div class="form-group">
                        <label>Position</label>
                        <select class="form-input" bind:value={editForm.position}>
                          <option value="">— select —</option>
                          <option>Objection</option>
                          <option>Conditional Support</option>
                          <option>Support</option>
                          <option>No Comment</option>
                        </select>
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Comments <span class="ct-label-hint">(one bullet per issue)</span></label>
                      <textarea class="form-input ct-edit-comments" bind:value={editForm.comments} rows="8"></textarea>
                    </div>
                    <div class="form-row">
                      <div class="form-group form-group-wide">
                        <label>Consultant Response</label>
                        <textarea class="form-input" bind:value={editForm.consultant_response} rows="3" placeholder="Response to this consultee…"></textarea>
                      </div>
                      <div class="form-group">
                        <label>Follow Up</label>
                        <textarea class="form-input" bind:value={editForm.follow_up} rows="3" placeholder="Any follow-up required…"></textarea>
                      </div>
                    </div>
                    <div class="form-group ct-issued-check">
                      <label class="ct-check-label">
                        <input type="checkbox" bind:checked={editForm.response_issued} />
                        Response Issued
                      </label>
                    </div>
                    <div class="ct-edit-footer">
                      <button class="btn btn-secondary btn-sm" on:click={() => editingId = null}>Cancel</button>
                      <button class="btn btn-primary btn-sm" on:click={() => saveEdit(r.id)}>Save</button>
                    </div>
                  </div>
                </td>
              </tr>
            {:else}
              <tr class="ct-row">
                <td class="ct-td ct-td-consultee">
                  <span class="ct-consultee-name">{r.consultee_name}</span>
                  {#if r.source_file_name}
                    <span class="ct-source-file" title={r.source_file_name}><i class="las la-file-alt"></i></span>
                  {/if}
                </td>
                <td class="ct-td ct-td-date">{r.date_received ? formatDate(r.date_received) : '—'}</td>
                <td class="ct-td ct-td-pos">
                  {#if r.position}
                    <span class="ct-pos-badge {positionClass(r.position)}">{r.position}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                </td>
                <td class="ct-td ct-td-comments">
                  {#if r.comments}
                    {@const lines = r.comments.split('\n').filter(l => l.trim())}
                    {@const showAll = expandedIds.has(r.id)}
                    {@const visible = showAll ? lines : lines.slice(0, 3)}
                    <ul class="ct-bullet-list">
                      {#each visible as line}
                        <li>{line.replace(/^[•\-*]\s*/, '')}</li>
                      {/each}
                    </ul>
                    {#if lines.length > 3}
                      <button class="btn btn-ghost btn-sm ct-expand-btn" on:click={() => toggleExpand(r.id)}>
                        {showAll ? 'Show less' : `+${lines.length - 3} more`}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                </td>
                <td class="ct-td ct-td-response">
                  {#if r.consultant_response}
                    <span class="ct-response-text">{r.consultant_response}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                </td>
                <td class="ct-td ct-td-issued">
                  <button
                    class="ct-issued-toggle"
                    class:ct-issued-yes={r.response_issued}
                    on:click={() => toggleResponseIssued(r)}
                    title={r.response_issued ? 'Click to mark not issued' : 'Click to mark issued'}
                  >
                    {#if r.response_issued}
                      <i class="las la-check-circle"></i> Yes
                    {:else}
                      <i class="las la-circle"></i> No
                    {/if}
                  </button>
                </td>
                <td class="ct-td ct-td-followup">
                  {#if r.follow_up}
                    <span class="ct-followup-text">{r.follow_up}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                </td>
                <td class="ct-td ct-td-actions">
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-ghost" on:click={() => startEdit(r)} title="Edit">
                      <i class="las la-pen"></i>
                    </button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeResponse(r.id)} title="Delete">
                      <i class="las la-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <p class="ct-count">{responses.length} consultee response{responses.length !== 1 ? 's' : ''}</p>
  {/if}

</div>

<style>
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
  .ct-meta-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .ct-meta-badge {
    font-size: 0.72rem;
    color: #64748b;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ct-meta-badge-issued {
    color: #16a34a;
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .ct-issue-btn {
    opacity: 0.7;
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
  .ct-empty-icon { font-size: 2.5rem; color: #cbd5e1; }
  .ct-empty-title { font-size: 1rem; font-weight: 600; color: #475569; margin: 0; }
  .ct-empty-hint { font-size: 0.8rem; color: #94a3b8; margin: 0 0 0.5rem; }
  .ct-count {
    font-size: 0.75rem;
    color: #94a3b8;
    text-align: right;
    margin: 0;
  }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  .ct-table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .ct-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
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
  .ct-th-consultee  { min-width: 140px; }
  .ct-th-date       { min-width: 100px; }
  .ct-th-pos        { min-width: 120px; }
  .ct-th-comments   { min-width: 220px; max-width: 340px; }
  .ct-th-response   { min-width: 160px; }
  .ct-th-issued     { min-width: 80px; text-align: center; }
  .ct-th-followup   { min-width: 140px; }
  .ct-th-actions    { width: 72px; }

  .ct-row:hover { background: #f8fafc; }
  .ct-row:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }

  .ct-td {
    padding: 0.65rem 0.75rem;
    vertical-align: top;
    color: #334155;
  }
  .ct-td-issued { text-align: center; }

  .ct-consultee-name { font-weight: 500; color: #1e293b; }
  .ct-source-file {
    margin-left: 4px;
    color: #94a3b8;
    font-size: 0.75rem;
  }
  .ct-cell-muted { color: #94a3b8; font-size: 0.78rem; }
  .ct-response-text, .ct-followup-text { font-size: 0.78rem; white-space: pre-wrap; }

  /* ── Position badges ────────────────────────────────────────────────────── */
  .ct-pos-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .ct-pos-objection    { background: #fee2e2; color: #b91c1c; }
  .ct-pos-conditional  { background: #fef9c3; color: #854d0e; }
  .ct-pos-support      { background: #dcfce7; color: #15803d; }
  .ct-pos-no-comment   { background: #f1f5f9; color: #64748b; }
  .ct-pos-other        { background: #ede9fe; color: #6d28d9; }
  .ct-pos-none         {}

  /* ── Bullet list ─────────────────────────────────────────────────────────── */
  .ct-bullet-list {
    margin: 0;
    padding-left: 1.1em;
    font-size: 0.78rem;
    line-height: 1.55;
    color: #334155;
  }
  .ct-bullet-list li { margin-bottom: 2px; }
  .ct-expand-btn {
    font-size: 0.72rem;
    color: #3b82f6;
    padding: 0;
    margin-top: 4px;
  }

  /* ── Response issued toggle ──────────────────────────────────────────────── */
  .ct-issued-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ct-issued-toggle:hover { border-color: #94a3b8; }
  .ct-issued-yes {
    color: #16a34a;
    background: #f0fdf4;
    border-color: #86efac;
  }

  /* ── Row action buttons ──────────────────────────────────────────────────── */
  .ct-row-btns {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  /* ── Inline edit row ────────────────────────────────────────────────────── */
  .ct-edit-cell { padding: 0; }
  .ct-edit-form {
    padding: 1rem;
    background: #f8fafc;
    border-top: 2px solid #3b82f6;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ct-edit-comments { font-family: inherit; font-size: 0.8rem; }
  .ct-edit-footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .ct-issued-check { margin-top: 0; }
  .ct-check-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }

  /* ── Panel overlay ───────────────────────────────────────────────────────── */
  .ct-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  .ct-panel {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }
  .ct-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ct-panel-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  /* ── Input tabs ──────────────────────────────────────────────────────────── */
  .ct-input-tabs {
    display: flex;
    gap: 0.5rem;
  }

  /* ── Drop zone ───────────────────────────────────────────────────────────── */
  .ct-drop-zone {
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    text-align: center;
    font-size: 0.875rem;
    color: #64748b;
    transition: border-color 0.15s, background 0.15s;
  }
  .ct-drop-zone:hover, .ct-drop-zone.drag-over {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .ct-drop-icon { font-size: 2rem; color: #94a3b8; }
  .ct-drop-filename { font-weight: 500; color: #334155; }
  .ct-drop-hint { font-size: 0.75rem; color: #94a3b8; }

  /* ── Paste ───────────────────────────────────────────────────────────────── */
  .ct-paste { font-size: 0.8rem; font-family: inherit; }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  .ct-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }

  /* ── Process button ──────────────────────────────────────────────────────── */
  .ct-process-btn { align-self: flex-end; }

  /* ── Processing state ────────────────────────────────────────────────────── */
  .ct-processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2.5rem 1rem;
    color: #475569;
    text-align: center;
  }
  .ct-processing p { margin: 0; }
  .ct-processing-hint { font-size: 0.78rem; color: #94a3b8; }

  /* ── Review form ─────────────────────────────────────────────────────────── */
  .ct-review-hint { font-size: 0.8rem; color: #64748b; margin: 0; }
  .ct-review-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .ct-comments-textarea { font-size: 0.8rem; font-family: inherit; line-height: 1.6; }
  .ct-label-hint { font-size: 0.72rem; font-weight: 400; color: #94a3b8; }
  .ct-review-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .ct-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ct-spin 0.7s linear infinite;
  }
  .ct-spinner-sm {
    width: 14px;
    height: 14px;
  }
  @keyframes ct-spin { to { transform: rotate(360deg); } }
</style>
