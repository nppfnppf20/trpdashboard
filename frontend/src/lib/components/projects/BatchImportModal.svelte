<script>
  import { createEventDispatcher } from 'svelte';
  import '$lib/styles/buttons.css';
  import { processConsultationDoc, createConsultationResponse } from '$lib/api/consultation.js';
  import { processPublicCommentDoc, createPublicComment } from '$lib/api/publicComments.js';

  export let show = false;
  export let projectId;
  export let mode = 'statutory'; // 'statutory' | 'public'

  const dispatch = createEventDispatcher();

  // ── Mode config ───────────────────────────────────────────────────────────
  $: cfg = mode === 'statutory' ? {
    title:           'Batch Import — Statutory Consultees',
    addLabel:        'Process Consultation Response',
    processDoc:      (file) => processConsultationDoc(projectId, { file }),
    saveRow:         (fields) => createConsultationResponse(projectId, fields),
    positionOptions: ['Objection', 'Conditional Support', 'Support', 'No Comment'],
    nameKey:         'consultee_name',
    nameLabel:       'Consultee',
    commentKey:      'comments',
    commentLabel:    'Comments',
    extraFields:     [],
  } : {
    title:           'Batch Import — Public Comments',
    addLabel:        'Add Public Comment',
    processDoc:      (file) => processPublicCommentDoc(projectId, { file }),
    saveRow:         (fields) => createPublicComment(projectId, fields),
    positionOptions: ['Support', 'Object', 'Neutral', 'Mixed'],
    nameKey:         'commenter_name',
    nameLabel:       'Name',
    commentKey:      'comment',
    commentLabel:    'Comment',
    extraFields:     [{ key: 'further_info', label: 'Further Info' }],
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let phase = 'upload';   // 'upload' | 'processing' | 'review'
  let queue = [];          // { id, file, status, fields, error, accepted }
  let dragOver = false;
  let saving = false;
  let expandedIds = new Set();

  $: totalCount    = queue.length;
  $: doneCount     = queue.filter(q => q.status === 'done').length;
  $: errorCount    = queue.filter(q => q.status === 'error').length;
  $: pendingCount  = queue.filter(q => q.status === 'pending').length;
  $: acceptedCount = queue.filter(q => q.status === 'done' && q.accepted).length;
  $: allDone       = totalCount > 0 && pendingCount === 0 && queue.every(q => q.status !== 'processing');

  // ── Upload ────────────────────────────────────────────────────────────────
  function addFiles(files) {
    const items = Array.from(files).map((file, i) => ({
      id:       Date.now() + i,
      file,
      status:   'pending',
      fields:   {},
      error:    null,
      accepted: true,
    }));
    queue = [...queue, ...items];
  }

  function handleDrop(e) {
    e.preventDefault(); dragOver = false;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }
  function handleDragOver(e) { e.preventDefault(); dragOver = true; }
  function handleDragLeave()  { dragOver = false; }
  function handleFileInput(e) { if (e.target.files.length) addFiles(e.target.files); }
  function removeItem(id)     { queue = queue.filter(q => q.id !== id); }

  // ── Processing ────────────────────────────────────────────────────────────
  async function processAll() {
    phase = 'processing';
    for (const item of queue) {
      setStatus(item.id, 'processing');
      try {
        const { suggestion } = await cfg.processDoc(item.file);
        setFields(item.id, suggestion);
      } catch (err) {
        setError(item.id, err.message || 'Failed to process');
      }
    }
    phase = 'review';
  }

  function setStatus(id, status) {
    queue = queue.map(q => q.id === id ? { ...q, status } : q);
  }
  function setFields(id, suggestion) {
    queue = queue.map(q => q.id === id ? { ...q, status: 'done', fields: { ...suggestion } } : q);
  }
  function setError(id, error) {
    queue = queue.map(q => q.id === id ? { ...q, status: 'error', error } : q);
  }

  function retryItem(item) {
    setStatus(item.id, 'pending');
    // Re-process just this one
    (async () => {
      setStatus(item.id, 'processing');
      try {
        const { suggestion } = await cfg.processDoc(item.file);
        setFields(item.id, suggestion);
      } catch (err) {
        setError(item.id, err.message || 'Failed to process');
      }
    })();
  }

  // ── Review ────────────────────────────────────────────────────────────────
  function toggleAccepted(id) {
    queue = queue.map(q => q.id === id ? { ...q, accepted: !q.accepted } : q);
  }

  function toggleExpand(id) {
    const s = new Set(expandedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    expandedIds = s;
  }

  function updateField(id, key, value) {
    queue = queue.map(q => q.id === id ? { ...q, fields: { ...q.fields, [key]: value } } : q);
  }

  function acceptAll()  { queue = queue.map(q => q.status === 'done' ? { ...q, accepted: true }  : q); }
  function skipAll()    { queue = queue.map(q => q.status === 'done' ? { ...q, accepted: false } : q); }

  async function saveAccepted() {
    saving = true;
    const toSave = queue.filter(q => q.status === 'done' && q.accepted);
    const saved = [];

    for (const item of toSave) {
      try {
        const row = await cfg.saveRow({ ...item.fields, source_file_name: item.file.name });
        saved.push(row);
        setStatus(item.id, 'saved');
      } catch (err) {
        setError(item.id, 'Save failed: ' + (err.message || 'unknown error'));
      }
    }

    saving = false;
    if (saved.length) dispatch('done', { rows: saved });
    if (queue.every(q => q.status === 'saved' || q.status === 'error' || !q.accepted)) {
      handleClose();
    }
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  function handleClose() {
    show = false;
    phase = 'upload';
    queue = [];
    dragOver = false;
    saving = false;
    expandedIds = new Set();
    dispatch('close');
  }

  function positionClass(pos) {
    if (!pos) return 'bi-pos-neutral';
    const p = pos.toLowerCase();
    if (p === 'support') return 'bi-pos-support';
    if (p === 'objection') return 'bi-pos-objection';
    if (p === 'object') return 'bi-pos-objection';
    if (p === 'conditional support') return 'bi-pos-conditional';
    if (p === 'mixed') return 'bi-pos-conditional';
    if (p === 'neutral') return 'bi-pos-neutral';
    if (p === 'no comment') return 'bi-pos-neutral';
    return 'bi-pos-neutral';
  }
</script>

{#if show}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="bi-overlay" on:click|self={handleClose}>
  <div class="bi-modal">

    <!-- Header -->
    <div class="bi-header">
      <div class="bi-header-left">
        <i class="las la-layer-group"></i>
        <h2 class="bi-title">{cfg.title}</h2>
      </div>
      <button class="btn btn-icon btn-ghost" on:click={handleClose}><i class="las la-times"></i></button>
    </div>

    <!-- Phase indicator -->
    <div class="bi-phases">
      <div class="bi-phase" class:bi-phase-active={phase === 'upload'} class:bi-phase-done={phase !== 'upload'}>
        <span class="bi-phase-num">{phase !== 'upload' ? '✓' : '1'}</span> Upload files
      </div>
      <div class="bi-phase-sep"></div>
      <div class="bi-phase" class:bi-phase-active={phase === 'processing'} class:bi-phase-done={phase === 'review'}>
        <span class="bi-phase-num">{phase === 'review' ? '✓' : '2'}</span> Process
      </div>
      <div class="bi-phase-sep"></div>
      <div class="bi-phase" class:bi-phase-active={phase === 'review'}>
        <span class="bi-phase-num">3</span> Review & save
      </div>
    </div>

    <div class="bi-body">

      <!-- ── Phase: Upload ──────────────────────────────────────────────── -->
      {#if phase === 'upload'}

        <!-- Dropzone -->
        <div
          class="bi-dropzone" class:bi-dragover={dragOver}
          on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}
          on:click={() => document.getElementById('bi-file-input').click()}
        >
          <i class="las la-cloud-upload-alt bi-drop-icon"></i>
          <span class="bi-drop-label">Drag and drop files here, or click to select</span>
          <span class="bi-drop-hint">PDF, DOCX, TXT — select multiple at once</span>
        </div>
        <input
          id="bi-file-input" type="file" multiple
          accept=".pdf,.docx,.txt,.doc"
          style="display:none"
          on:change={handleFileInput}
        />

        <!-- Queue list -->
        {#if queue.length}
          <div class="bi-queue">
            {#each queue as item (item.id)}
              <div class="bi-queue-row">
                <i class="las la-file-alt bi-queue-icon"></i>
                <span class="bi-queue-name">{item.file.name}</span>
                <span class="bi-queue-size">{(item.file.size / 1024).toFixed(0)} KB</span>
                <button class="btn btn-icon btn-ghost bi-queue-remove" on:click={() => removeItem(item.id)} title="Remove">
                  <i class="las la-times"></i>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="bi-no-files">No files added yet.</p>
        {/if}

      <!-- ── Phase: Processing ──────────────────────────────────────────── -->
      {:else if phase === 'processing'}

        <div class="bi-progress-header">
          <span class="bi-progress-label">Processing {doneCount + errorCount} of {totalCount}…</span>
          <div class="bi-progress-bar-wrap">
            <div class="bi-progress-bar" style="width:{Math.round(((doneCount + errorCount) / totalCount) * 100)}%"></div>
          </div>
        </div>

        <div class="bi-queue">
          {#each queue as item (item.id)}
            <div class="bi-queue-row">
              {#if item.status === 'processing'}
                <span class="bi-spinner bi-spinner-sm"></span>
              {:else if item.status === 'done'}
                <i class="las la-check-circle bi-status-done"></i>
              {:else if item.status === 'error'}
                <i class="las la-times-circle bi-status-error"></i>
              {:else}
                <i class="las la-clock bi-status-pending"></i>
              {/if}
              <span class="bi-queue-name">{item.file.name}</span>
              {#if item.status === 'error'}
                <span class="bi-queue-error">{item.error}</span>
              {:else if item.status === 'done'}
                <span class="bi-queue-ok">Extracted</span>
              {/if}
            </div>
          {/each}
        </div>

      <!-- ── Phase: Review ──────────────────────────────────────────────── -->
      {:else if phase === 'review'}

        <div class="bi-review-toolbar">
          <span class="bi-review-summary">
            {doneCount} extracted
            {#if errorCount} · <span class="bi-err-count">{errorCount} failed</span>{/if}
            · <strong>{acceptedCount} selected to save</strong>
          </span>
          <div class="bi-review-toolbar-right">
            <button class="btn btn-ghost btn-sm" on:click={skipAll}>Deselect all</button>
            <button class="btn btn-ghost btn-sm" on:click={acceptAll}>Select all</button>
          </div>
        </div>

        <div class="bi-cards">
          {#each queue as item (item.id)}
            {@const expanded = expandedIds.has(item.id)}

            <div class="bi-card"
              class:bi-card-accepted={item.status === 'done' && item.accepted}
              class:bi-card-skipped={item.status === 'done' && !item.accepted}
              class:bi-card-error={item.status === 'error'}
              class:bi-card-saved={item.status === 'saved'}
            >
              <!-- Card header -->
              <div class="bi-card-hd">
                <div class="bi-card-hd-left">
                  {#if item.status === 'error'}
                    <i class="las la-exclamation-triangle bi-status-error"></i>
                    <span class="bi-card-filename">{item.file.name}</span>
                  {:else if item.status === 'saved'}
                    <i class="las la-check-circle bi-status-done"></i>
                    <span class="bi-card-filename">{item.file.name}</span>
                    <span class="bi-saved-badge">Saved</span>
                  {:else}
                    <!-- Accept toggle -->
                    <button
                      class="bi-accept-toggle"
                      class:bi-accept-on={item.accepted}
                      on:click={() => toggleAccepted(item.id)}
                      title={item.accepted ? 'Click to skip' : 'Click to include'}
                    >
                      <i class="las {item.accepted ? 'la-check-circle' : 'la-circle'}"></i>
                    </button>
                    <span class="bi-card-filename">{item.file.name}</span>
                    {#if item.fields.position}
                      <span class="bi-pos-badge {positionClass(item.fields.position)}">{item.fields.position}</span>
                    {/if}
                    {#if item.fields[cfg.nameKey]}
                      <span class="bi-card-name">{item.fields[cfg.nameKey]}</span>
                    {/if}
                  {/if}
                </div>
                <div class="bi-card-hd-right">
                  {#if item.status === 'error'}
                    <button class="btn btn-secondary btn-sm" on:click={() => retryItem(item)}>
                      <i class="las la-redo"></i> Retry
                    </button>
                    <button class="btn btn-icon btn-ghost" on:click={() => removeItem(item.id)}><i class="las la-times"></i></button>
                  {:else if item.status !== 'saved'}
                    <button class="btn btn-ghost btn-sm bi-edit-btn" on:click={() => toggleExpand(item.id)}>
                      <i class="las {expanded ? 'la-chevron-up' : 'la-pen'}"></i>
                      {expanded ? 'Collapse' : 'Edit'}
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Error message -->
              {#if item.status === 'error'}
                <p class="bi-card-error-msg">{item.error}</p>
              {/if}

              <!-- Extracted preview (collapsed) -->
              {#if item.status === 'done' && !expanded}
                <div class="bi-card-preview">
                  {#if item.fields[cfg.commentKey]}
                    <p class="bi-card-comment-preview">{item.fields[cfg.commentKey].slice(0, 200)}{item.fields[cfg.commentKey].length > 200 ? '…' : ''}</p>
                  {/if}
                </div>
              {/if}

              <!-- Edit form (expanded) -->
              {#if item.status === 'done' && expanded}
                <div class="bi-card-form">
                  <div class="bi-form-row">
                    <div class="bi-field">
                      <label class="bi-label">{cfg.nameLabel}</label>
                      <input type="text" class="form-input" value={item.fields[cfg.nameKey] || ''}
                        on:input={e => updateField(item.id, cfg.nameKey, e.target.value)} />
                    </div>
                    <div class="bi-field">
                      <label class="bi-label">Date</label>
                      <input type="date" class="form-input" value={item.fields.date_received || ''}
                        on:input={e => updateField(item.id, 'date_received', e.target.value)} />
                    </div>
                    <div class="bi-field">
                      <label class="bi-label">Position</label>
                      <select class="form-input" value={item.fields.position || ''}
                        on:change={e => updateField(item.id, 'position', e.target.value)}>
                        <option value="">— select —</option>
                        {#each cfg.positionOptions as p}<option value={p}>{p}</option>{/each}
                      </select>
                    </div>
                  </div>
                  <div class="bi-field">
                    <label class="bi-label">{cfg.commentLabel}</label>
                    <textarea class="form-input bi-ta" rows="5" value={item.fields[cfg.commentKey] || ''}
                      on:input={e => updateField(item.id, cfg.commentKey, e.target.value)}></textarea>
                  </div>
                  {#each cfg.extraFields as f}
                    <div class="bi-field">
                      <label class="bi-label">{f.label}</label>
                      <textarea class="form-input bi-ta" rows="3" value={item.fields[f.key] || ''}
                        on:input={e => updateField(item.id, f.key, e.target.value)}></textarea>
                    </div>
                  {/each}
                </div>
              {/if}

            </div>
          {/each}
        </div>

      {/if}
    </div>

    <!-- Footer -->
    <div class="bi-footer">
      <button class="btn btn-secondary" on:click={handleClose}>
        {phase === 'review' ? 'Close' : 'Cancel'}
      </button>

      {#if phase === 'upload'}
        <button class="btn btn-primary" disabled={queue.length === 0} on:click={processAll}>
          <i class="las la-magic"></i> Process {queue.length} file{queue.length !== 1 ? 's' : ''}
        </button>

      {:else if phase === 'processing'}
        <button class="btn btn-primary" disabled>
          <span class="bi-spinner bi-spinner-sm"></span>
          Processing {doneCount + errorCount} / {totalCount}…
        </button>

      {:else if phase === 'review'}
        <button
          class="btn btn-primary"
          disabled={acceptedCount === 0 || saving}
          on:click={saveAccepted}
        >
          {#if saving}
            <span class="bi-spinner bi-spinner-sm"></span> Saving…
          {:else}
            <i class="las la-save"></i> Save {acceptedCount} response{acceptedCount !== 1 ? 's' : ''}
          {/if}
        </button>
      {/if}
    </div>

  </div>
</div>
{/if}

<style>
  .bi-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 700;
    padding: 1.5rem 1rem;
  }
  .bi-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 780px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    overflow: hidden;
  }

  /* Header */
  .bi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .bi-header-left { display: flex; align-items: center; gap: 0.5rem; color: #6366f1; }
  .bi-header-left i { font-size: 1.2rem; }
  .bi-title { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }

  /* Phase indicator */
  .bi-phases {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .bi-phase {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 500;
    transition: color 0.15s;
  }
  .bi-phase-active { color: #6366f1; font-weight: 600; }
  .bi-phase-done   { color: #16a34a; }
  .bi-phase-num {
    width: 18px; height: 18px;
    background: #e2e8f0;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 700; color: #64748b;
    flex-shrink: 0;
  }
  .bi-phase-active .bi-phase-num { background: #6366f1; color: #fff; }
  .bi-phase-done   .bi-phase-num { background: #16a34a; color: #fff; }
  .bi-phase-sep {
    flex: 1; height: 1px; background: #e2e8f0; max-width: 40px;
  }

  /* Body */
  .bi-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  /* Dropzone */
  .bi-dropzone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.375rem; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 2.5rem 1rem;
    cursor: pointer; transition: all 0.15s;
  }
  .bi-dropzone:hover, .bi-dragover { border-color: #6366f1; background: #f5f3ff; }
  .bi-drop-icon  { font-size: 2rem; color: #94a3b8; }
  .bi-drop-label { font-size: 0.875rem; color: #475569; font-weight: 500; }
  .bi-drop-hint  { font-size: 0.75rem; color: #94a3b8; }

  /* Queue list */
  .bi-queue {
    display: flex; flex-direction: column; gap: 0.375rem;
    border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
  }
  .bi-queue-row {
    display: flex; align-items: center; gap: 0.625rem;
    padding: 0.5rem 0.875rem;
    background: #fff; font-size: 0.82rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .bi-queue-row:last-child { border-bottom: none; }
  .bi-queue-icon  { color: #94a3b8; flex-shrink: 0; }
  .bi-queue-name  { flex: 1; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bi-queue-size  { color: #94a3b8; font-size: 0.72rem; flex-shrink: 0; }
  .bi-queue-remove { flex-shrink: 0; opacity: 0.5; }
  .bi-queue-remove:hover { opacity: 1; }
  .bi-queue-error { color: #dc2626; font-size: 0.72rem; flex-shrink: 0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bi-queue-ok    { color: #16a34a; font-size: 0.72rem; flex-shrink: 0; font-weight: 600; }

  .bi-no-files { color: #94a3b8; font-size: 0.82rem; text-align: center; margin: 0; padding: 1rem; }

  /* Status icons */
  .bi-status-done    { color: #16a34a; }
  .bi-status-error   { color: #dc2626; }
  .bi-status-pending { color: #cbd5e1; }

  /* Progress bar */
  .bi-progress-header { display: flex; flex-direction: column; gap: 0.5rem; }
  .bi-progress-label  { font-size: 0.82rem; color: #64748b; font-weight: 500; }
  .bi-progress-bar-wrap {
    height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;
  }
  .bi-progress-bar {
    height: 100%; background: #6366f1; border-radius: 999px; transition: width 0.3s ease;
  }

  /* Review toolbar */
  .bi-review-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; flex-wrap: wrap;
  }
  .bi-review-summary { font-size: 0.82rem; color: #475569; }
  .bi-review-toolbar-right { display: flex; gap: 0.375rem; }
  .bi-err-count { color: #dc2626; }

  /* Cards */
  .bi-cards { display: flex; flex-direction: column; gap: 0.625rem; }
  .bi-card {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .bi-card-accepted  { border-color: #bbf7d0; background: #f0fdf4; }
  .bi-card-skipped   { opacity: 0.55; background: #f8fafc; }
  .bi-card-error     { border-color: #fca5a5; background: #fff7f7; }
  .bi-card-saved     { border-color: #bbf7d0; background: #f0fdf4; opacity: 0.7; }

  .bi-card-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.625rem 0.875rem; gap: 0.5rem;
  }
  .bi-card-hd-left  { display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1; }
  .bi-card-hd-right { display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0; }

  .bi-accept-toggle {
    background: none; border: none; cursor: pointer;
    font-size: 1.25rem; color: #94a3b8; padding: 0; flex-shrink: 0;
    transition: color 0.15s;
  }
  .bi-accept-toggle:hover { color: #16a34a; }
  .bi-accept-on { color: #16a34a; }

  .bi-card-filename {
    font-size: 0.78rem; color: #64748b;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 200px; flex-shrink: 0;
  }
  .bi-card-name {
    font-size: 0.82rem; font-weight: 600; color: #1e293b;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .bi-pos-badge {
    display: inline-block; font-size: 0.68rem; font-weight: 600;
    padding: 0.1rem 0.45rem; border-radius: 999px; flex-shrink: 0;
  }
  .bi-pos-support     { background: #dcfce7; color: #16a34a; }
  .bi-pos-objection   { background: #fee2e2; color: #dc2626; }
  .bi-pos-conditional { background: #fef3c7; color: #d97706; }
  .bi-pos-neutral     { background: #f1f5f9; color: #64748b; }

  .bi-saved-badge {
    font-size: 0.68rem; font-weight: 700; color: #16a34a;
    background: #dcfce7; padding: 0.1rem 0.45rem; border-radius: 999px;
  }

  .bi-card-error-msg {
    margin: 0 0 0.5rem; padding: 0 0.875rem;
    font-size: 0.75rem; color: #dc2626;
  }
  .bi-card-preview { padding: 0 0.875rem 0.625rem; }
  .bi-card-comment-preview {
    margin: 0; font-size: 0.78rem; color: #475569; line-height: 1.5;
  }
  .bi-edit-btn { font-size: 0.75rem; }

  /* Edit form */
  .bi-card-form {
    border-top: 1px solid #e2e8f0;
    padding: 0.875rem;
    display: flex; flex-direction: column; gap: 0.625rem;
    background: rgba(255,255,255,0.7);
  }
  .bi-form-row {
    display: grid; grid-template-columns: 1fr 140px 140px; gap: 0.5rem;
  }
  .bi-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .bi-label { font-size: 0.72rem; font-weight: 600; color: #475569; }
  .bi-ta    { font-size: 0.8rem; font-family: inherit; line-height: 1.55; resize: vertical; }

  /* Footer */
  .bi-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  /* Spinner */
  .bi-spinner {
    display: inline-block;
    width: 20px; height: 20px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: bi-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .bi-spinner-sm { width: 14px; height: 14px; border-width: 2px; }
  @keyframes bi-spin { to { transform: rotate(360deg); } }
</style>
