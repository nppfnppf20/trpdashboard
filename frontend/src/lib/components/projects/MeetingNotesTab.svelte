<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import {
    getMeetingNotes,
    getMeetingActions,
    getMeetingTranscript,
    deleteMeetingNote,
    processMeetingNote,
    createMeetingAction,
    updateMeetingAction,
    deleteMeetingAction
  } from '$lib/api/meetingNotes.js';

  export let project;
  $: projectId = project?.id;

  // Data
  let notes = [];
  let actions = [];
  let loading = true;
  let error = null;

  // UI toggles
  let showAllMeetings = true;
  let showCompleted = false;
  let showAddForm = false;
  let expandedTranscripts = new Set();

  // Inline edit
  let editingActionId = null;
  let editForm = {};

  // Add action form
  let newAction = { action_text: '', owner: '', due_date: '', notes: '' };
  let addError = null;
  let adding = false;

  // Transcript view (lazy-loaded)
  let transcriptData = {};

  // Modal — view a note's summary
  let viewingNote = null;

  // ── Upload panel ──────────────────────────────────────────────────────────
  let showUploadPanel = false;
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadSummaryType = 'brief'; // 'brief' | 'detailed'
  let uploadFile = null;
  let uploadPasteText = '';
  let uploadTitle = '';
  let uploadDate = '';
  let uploadAttendees = '';
  let uploadUserNotes = '';
  let uploadAgenda = '';
  let uploadProcessing = false;
  let uploadError = null;
  let uploadDragOver = false;
  let showExtras = false;
  let fileInput;

  onMount(() => { if (projectId) loadAll(); });
  $: if (projectId) loadAll();

  async function loadAll() {
    loading = true;
    error = null;
    try {
      [notes, actions] = await Promise.all([
        getMeetingNotes(projectId),
        getMeetingActions(projectId)
      ]);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: pendingActions   = actions.filter(a => a.status === 'pending');
  $: completedActions = actions.filter(a => a.status === 'complete');
  $: latestNote = notes[0] ?? null;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function isOverdue(due_date) {
    if (!due_date) return false;
    return new Date(due_date) < new Date(new Date().toDateString());
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function toggleStatus(action) {
    const newStatus = action.status === 'pending' ? 'complete' : 'pending';
    try {
      await updateMeetingAction(action.id, { status: newStatus });
      // Update locally to preserve meeting_title, meeting_date etc.
      actions = actions.map(a => a.id === action.id
        ? { ...a, status: newStatus, completed_at: newStatus === 'complete' ? new Date().toISOString() : null }
        : a
      );
    } catch (err) {
      alert(err.message);
    }
  }

  function startEdit(action) {
    editingActionId = action.id;
    editForm = {
      action_text: action.action_text,
      owner: action.owner ?? '',
      due_date: action.due_date ? action.due_date.split('T')[0] : '',
      notes: action.notes ?? ''
    };
  }

  async function saveEdit(actionId) {
    try {
      await updateMeetingAction(actionId, {
        action_text: editForm.action_text,
        owner: editForm.owner || null,
        due_date: editForm.due_date || null,
        notes: editForm.notes || null
      });
      actions = actions.map(a => a.id === actionId
        ? { ...a, action_text: editForm.action_text, owner: editForm.owner || null, due_date: editForm.due_date || null, notes: editForm.notes || null }
        : a
      );
      editingActionId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeAction(id) {
    if (!confirm('Delete this action?')) return;
    try {
      await deleteMeetingAction(id);
      actions = actions.filter(a => a.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addAction() {
    if (!newAction.action_text.trim()) { addError = 'Action text is required.'; return; }
    adding = true;
    addError = null;
    try {
      const created = await createMeetingAction(projectId, {
        action_text: newAction.action_text,
        owner: newAction.owner || null,
        due_date: newAction.due_date || null,
        notes: newAction.notes || null
      });
      actions = [created, ...actions];
      newAction = { action_text: '', owner: '', due_date: '', notes: '' };
      showAddForm = false;
    } catch (err) {
      addError = err.message;
    } finally {
      adding = false;
    }
  }

  // ── Meeting notes ─────────────────────────────────────────────────────────

  async function removeNote(id) {
    if (!confirm('Delete this meeting note and all its actions?')) return;
    try {
      await deleteMeetingNote(id);
      notes = notes.filter(n => n.id !== id);
      actions = actions.filter(a => a.transcript_id !== id);
      if (viewingNote?.id === id) viewingNote = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadTranscript(meetingId) {
    if (transcriptData[meetingId]) return;
    transcriptData[meetingId] = { loading: true, text: null, error: null };
    transcriptData = { ...transcriptData };
    try {
      const data = await getMeetingTranscript(meetingId);
      transcriptData[meetingId] = { loading: false, text: data.transcript_text, error: null };
    } catch (err) {
      transcriptData[meetingId] = { loading: false, text: null, error: err.message };
    }
    transcriptData = { ...transcriptData };
  }

  function toggleTranscript(meetingId) {
    if (expandedTranscripts.has(meetingId)) {
      expandedTranscripts = new Set([...expandedTranscripts].filter(id => id !== meetingId));
    } else {
      expandedTranscripts = new Set([...expandedTranscripts, meetingId]);
      loadTranscript(meetingId);
    }
  }

  // ── Upload panel ──────────────────────────────────────────────────────────

  function openUploadPanel() {
    showUploadPanel = true;
    uploadFile = null;
    uploadPasteText = '';
    uploadTitle = '';
    uploadDate = '';
    uploadAttendees = '';
    uploadUserNotes = '';
    uploadAgenda = '';
    uploadError = null;
    uploadInputTab = 'upload';
    uploadSummaryType = 'brief';
    showExtras = false;
    uploadProcessing = false;
  }

  function closeUploadPanel() {
    if (uploadProcessing) return;
    showUploadPanel = false;
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

  async function submitUpload() {
    if (!uploadTitle.trim()) { uploadError = 'Title is required.'; return; }
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file to upload.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the transcript text.'; return; }

    uploadProcessing = true;
    uploadError = null;
    try {
      const result = await processMeetingNote(projectId, {
        file: uploadInputTab === 'upload' ? uploadFile : null,
        text: uploadInputTab === 'paste' ? uploadPasteText : null,
        title: uploadTitle.trim(),
        meetingDate: uploadDate || null,
        attendeesText: uploadAttendees.trim() || null,
        userNotes: uploadUserNotes.trim() || null,
        agenda: uploadAgenda.trim() || null,
        summaryType: uploadSummaryType
      });

      const newNote = {
        id: result.transcript.id,
        title: result.transcript.title,
        meeting_date: result.transcript.meeting_date,
        attendees_text: result.transcript.attendees_text,
        file_name: result.transcript.file_name,
        created_at: result.transcript.created_at,
        summary_id: result.summary?.id,
        summary_html: result.summary?.summary_html,
        pending_count: result.actions?.length ?? 0,
        complete_count: 0
      };
      const newActions = (result.actions || []).map(a => ({
        ...a,
        meeting_title: result.transcript.title,
        meeting_date: result.transcript.meeting_date
      }));

      notes = [newNote, ...notes];
      actions = [...newActions, ...actions];
      showUploadPanel = false;
      showAllMeetings = true;
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function downloadNote(note) {
    const title = note.title || 'Meeting Notes';
    const dateStr = note.meeting_date
      ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, note.attendees_text].filter(Boolean).join(' · ');

    const html = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${note.summary_html || '<p>No summary available.</p>'}`;
    const filename = `${title}${dateStr ? ` ${dateStr}` : ''}`;

    await exportHtmlToWord(html, filename, '/basicdocument.docx');
  }
</script>

<!-- ── Tab header ────────────────────────────────────────────────────────── -->
<div class="mn-tab">

  <div class="mn-header">
    <h2 class="mn-title">Meeting Notes</h2>
    <button class="btn btn-primary btn-sm" on:click={openUploadPanel} disabled={showUploadPanel}>
      <i class="las la-plus"></i> Add Meeting Notes
    </button>
  </div>

  <!-- ── Upload panel ──────────────────────────────────────────────────── -->
  {#if showUploadPanel}
    <div class="mn-upload-panel">
      <div class="mn-upload-header">
        <h3>Add Meeting Notes</h3>
        <button class="btn btn-icon btn-ghost" on:click={closeUploadPanel} disabled={uploadProcessing}>
          <i class="las la-times"></i>
        </button>
      </div>

      <!-- Title / Date / Attendees -->
      <div class="form-row-3">
        <div class="form-group form-group-wide">
          <label>Title <span class="required">*</span></label>
          <input type="text" class="form-input" bind:value={uploadTitle} placeholder="e.g. Design Team Meeting" />
        </div>
        <div class="form-group">
          <label>Meeting Date</label>
          <input type="date" class="form-input" bind:value={uploadDate} />
        </div>
        <div class="form-group">
          <label>Attendees</label>
          <input type="text" class="form-input" bind:value={uploadAttendees} placeholder="e.g. Josh, Sarah, Client" />
        </div>
      </div>

      <!-- Summary length -->
      <div class="mn-type-row">
        <span class="mn-type-label">Summary length</span>
        <div class="mn-type-toggle">
          <button
            class="mn-type-btn"
            class:active={uploadSummaryType === 'brief'}
            on:click={() => uploadSummaryType = 'brief'}
          >Brief <span class="mn-type-sub">· one page</span></button>
          <button
            class="mn-type-btn"
            class:active={uploadSummaryType === 'detailed'}
            on:click={() => uploadSummaryType = 'detailed'}
          >Detailed <span class="mn-type-sub">· 3–4 pages</span></button>
        </div>
      </div>

      <!-- Upload / Paste tabs -->
      <div class="mn-input-tabs">
        <button class="mn-input-tab" class:active={uploadInputTab === 'upload'} on:click={() => uploadInputTab = 'upload'}>
          <i class="las la-upload"></i> Upload File
        </button>
        <button class="mn-input-tab" class:active={uploadInputTab === 'paste'} on:click={() => uploadInputTab = 'paste'}>
          <i class="las la-clipboard"></i> Paste Text
        </button>
      </div>

      {#if uploadInputTab === 'upload'}
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
          class="mn-drop-zone"
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
            <i class="las la-file-alt mn-drop-icon"></i>
            <span class="mn-drop-filename">{uploadFile.name}</span>
            <span class="mn-drop-hint">Click to change file</span>
          {:else}
            <i class="las la-cloud-upload-alt mn-drop-icon"></i>
            <span>Drop a file here or click to browse</span>
            <span class="mn-drop-hint">PDF, DOCX or TXT</span>
          {/if}
        </div>
        <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
      {:else}
        <textarea
          class="form-input mn-paste"
          bind:value={uploadPasteText}
          placeholder="Paste the meeting transcript here…"
          rows="8"
        ></textarea>
      {/if}

      <!-- Optional extras -->
      <button class="btn btn-ghost btn-sm mn-extras-toggle" on:click={() => showExtras = !showExtras}>
        <i class="las la-{showExtras ? 'angle-up' : 'angle-right'}"></i>
        {showExtras ? 'Hide' : 'Show'} optional extras (agenda, consultant notes)
      </button>

      {#if showExtras}
        <div class="form-row">
          <div class="form-group">
            <label>Agenda</label>
            <textarea class="form-input" bind:value={uploadAgenda} rows="3" placeholder="Paste the meeting agenda…"></textarea>
          </div>
          <div class="form-group">
            <label>Consultant Notes</label>
            <textarea class="form-input" bind:value={uploadUserNotes} rows="3" placeholder="Your own notes — included verbatim in the summary…"></textarea>
          </div>
        </div>
      {/if}

      {#if uploadError}
        <div class="mn-error">{uploadError}</div>
      {/if}

      <div class="mn-upload-footer">
        <button class="btn btn-secondary btn-sm" on:click={closeUploadPanel} disabled={uploadProcessing}>Cancel</button>
        <button class="btn btn-primary" on:click={submitUpload} disabled={uploadProcessing}>
          {#if uploadProcessing}
            <span class="mn-spinner"></span> Processing…
          {:else}
            <i class="las la-magic"></i> Process Meeting Notes
          {/if}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading meeting notes…</div>
  {:else if error}
    <div class="mn-error">{error}</div>
  {:else}

    <!-- ── Outstanding Actions ─────────────────────────────────────────── -->
    <div class="mn-section">
      <div class="mn-section-head">
        <h3>Outstanding Actions</h3>
        {#if pendingActions.length > 0}
          <span class="mn-badge mn-badge-warn">{pendingActions.length}</span>
        {/if}
        <button class="btn btn-primary btn-sm mn-ml-auto" on:click={() => { showAddForm = !showAddForm; addError = null; }}>
          <i class="las la-plus"></i> Add Action
        </button>
      </div>

      {#if showAddForm}
        <div class="mn-add-form">
          <div class="form-row">
            <div class="form-group form-group-wide">
              <label>Action <span class="required">*</span></label>
              <input type="text" class="form-input" bind:value={newAction.action_text} placeholder="Describe the action…" />
            </div>
            <div class="form-group">
              <label>Owner</label>
              <input type="text" class="form-input" bind:value={newAction.owner} placeholder="Person responsible" />
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" class="form-input" bind:value={newAction.due_date} />
            </div>
            <div class="form-group form-group-wide">
              <label>Notes</label>
              <input type="text" class="form-input" bind:value={newAction.notes} placeholder="Any additional context" />
            </div>
          </div>
          {#if addError}<p class="mn-error-sm">{addError}</p>{/if}
          <div class="mn-form-footer">
            <button class="btn btn-secondary btn-sm" on:click={() => { showAddForm = false; addError = null; }}>Cancel</button>
            <button class="btn btn-primary btn-sm" on:click={addAction} disabled={adding}>
              {adding ? 'Adding…' : 'Add Action'}
            </button>
          </div>
        </div>
      {/if}

      {#if pendingActions.length === 0}
        <p class="mn-empty">No outstanding actions.</p>
      {:else}
        <div class="mn-table">
          <div class="mn-table-head">
            <span>Action</span>
            <span>Owner</span>
            <span>Due</span>
            <span>From</span>
            <span></span>
          </div>
          {#each pendingActions as action (action.id)}
            {#if editingActionId === action.id}
              <div class="mn-row mn-row-editing">
                <div class="form-row">
                  <div class="form-group form-group-wide">
                    <label>Action</label>
                    <input type="text" class="form-input" bind:value={editForm.action_text} />
                  </div>
                  <div class="form-group">
                    <label>Owner</label>
                    <input type="text" class="form-input" bind:value={editForm.owner} placeholder="Person responsible" />
                  </div>
                  <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" class="form-input" bind:value={editForm.due_date} />
                  </div>
                  <div class="form-group form-group-wide">
                    <label>Notes</label>
                    <input type="text" class="form-input" bind:value={editForm.notes} placeholder="Optional notes" />
                  </div>
                </div>
                <div class="mn-form-footer">
                  <button class="btn btn-secondary btn-sm" on:click={() => editingActionId = null}>Cancel</button>
                  <button class="btn btn-primary btn-sm" on:click={() => saveEdit(action.id)}>Save</button>
                </div>
              </div>
            {:else}
              <div class="mn-row" class:mn-row-overdue={isOverdue(action.due_date)}>
                <button class="mn-status-btn mn-status-pending" on:click={() => toggleStatus(action)} title="Mark complete">
                  <i class="las la-circle"></i>
                </button>
                <span class="mn-action-text">
                  {action.action_text}
                  {#if action.notes}<span class="mn-action-note">{action.notes}</span>{/if}
                </span>
                <span class="mn-cell-muted">{action.owner ?? '—'}</span>
                <span class="mn-cell-muted" class:mn-overdue-text={isOverdue(action.due_date)}>
                  {formatDate(action.due_date)}
                </span>
                <span class="mn-cell-dim">
                  {#if action.meeting_title}{action.meeting_title}{:else}<span class="mn-manual">Manual</span>{/if}
                </span>
                <div class="mn-row-btns">
                  <button class="btn btn-icon btn-ghost" on:click={() => startEdit(action)} title="Edit">
                    <i class="las la-pen"></i>
                  </button>
                  <button class="btn btn-icon btn-danger-ghost" on:click={() => removeAction(action.id)} title="Delete">
                    <i class="las la-trash"></i>
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Latest Meeting ─────────────────────────────────────────────── -->
    {#if latestNote}
      <div class="mn-section">
        <div class="mn-section-head">
          <h3>Latest Meeting</h3>
          <span class="mn-cell-muted mn-meeting-meta">
            {latestNote.title}
            {#if latestNote.meeting_date} · {formatDate(latestNote.meeting_date)}{/if}
            {#if latestNote.attendees_text} · {latestNote.attendees_text}{/if}
          </span>
          <div class="mn-ml-auto mn-row-btns">
            <button class="btn btn-secondary btn-sm" on:click={() => viewingNote = latestNote}>
              <i class="las la-eye"></i> View Notes
            </button>
            <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(latestNote)}>
              <i class="las la-download"></i> Download
            </button>
          </div>
        </div>
        {#if latestNote.pending_count > 0 || latestNote.complete_count > 0}
          <div class="mn-note-badges">
            {#if Number(latestNote.pending_count) > 0}
              <span class="mn-badge mn-badge-warn">{latestNote.pending_count} open action{latestNote.pending_count > 1 ? 's' : ''}</span>
            {/if}
            {#if Number(latestNote.complete_count) > 0}
              <span class="mn-badge mn-badge-ok">{latestNote.complete_count} completed</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Completed Actions ──────────────────────────────────────────── -->
    {#if completedActions.length > 0}
      <div class="mn-section mn-section-muted">
        <button class="mn-concertina-btn" on:click={() => showCompleted = !showCompleted}>
          <i class="las la-{showCompleted ? 'angle-up' : 'angle-down'}"></i>
          Completed Actions ({completedActions.length})
        </button>
        {#if showCompleted}
          <div class="mn-table mn-table-mt">
            <div class="mn-table-head">
              <span>Action</span>
              <span>Owner</span>
              <span>Completed</span>
              <span>From</span>
              <span></span>
            </div>
            {#each completedActions as action (action.id)}
              <div class="mn-row mn-row-done">
                <button class="mn-status-btn mn-status-complete" on:click={() => toggleStatus(action)} title="Reopen">
                  <i class="las la-check-circle"></i>
                </button>
                <span class="mn-action-text mn-done">{action.action_text}</span>
                <span class="mn-cell-muted">{action.owner ?? '—'}</span>
                <span class="mn-cell-muted">{formatDate(action.completed_at)}</span>
                <span class="mn-cell-dim">
                  {#if action.meeting_title}{action.meeting_title}{:else}<span class="mn-manual">Manual</span>{/if}
                </span>
                <div class="mn-row-btns">
                  <button class="btn btn-icon btn-danger-ghost" on:click={() => removeAction(action.id)} title="Delete">
                    <i class="las la-trash"></i>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── All Meeting Notes ──────────────────────────────────────────── -->
    <div class="mn-section mn-section-muted">
      <button class="mn-concertina-btn" on:click={() => showAllMeetings = !showAllMeetings}>
        <i class="las la-{showAllMeetings ? 'angle-up' : 'angle-down'}"></i>
        All Meeting Notes ({notes.length})
      </button>
      {#if showAllMeetings}
        {#if notes.length === 0}
          <p class="mn-empty mn-table-mt">No meeting notes yet. Click "Add Meeting Notes" above to get started.</p>
        {:else}
          <div class="mn-notes-list mn-table-mt">
            {#each notes as note (note.id)}
              <div class="mn-note-card">
                <div class="mn-note-info">
                  <div class="mn-note-meta">
                    <span class="mn-note-title">{note.title}</span>
                    {#if note.meeting_date}
                      <span class="mn-cell-muted">{formatDate(note.meeting_date)}</span>
                    {/if}
                    {#if note.attendees_text}
                      <span class="mn-cell-dim">{note.attendees_text}</span>
                    {/if}
                  </div>
                  <div class="mn-note-badges-row">
                    {#if Number(note.pending_count) > 0}
                      <span class="mn-badge mn-badge-warn">{note.pending_count} open</span>
                    {/if}
                    {#if Number(note.complete_count) > 0}
                      <span class="mn-badge mn-badge-ok">{note.complete_count} done</span>
                    {/if}
                  </div>
                </div>
                <div class="mn-note-actions">
                  <button class="btn btn-secondary btn-sm" on:click={() => viewingNote = note}>
                    <i class="las la-eye"></i> View Notes
                  </button>
                  <button class="btn btn-secondary btn-sm" on:click={() => toggleTranscript(note.id)}>
                    <i class="las la-file-alt"></i>
                    {expandedTranscripts.has(note.id) ? 'Hide' : 'Transcript'}
                  </button>
                  <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(note)}>
                    <i class="las la-download"></i> Download
                  </button>
                  <button class="btn btn-icon btn-danger-ghost" on:click={() => removeNote(note.id)} title="Delete meeting note">
                    <i class="las la-trash"></i>
                  </button>
                </div>

                {#if expandedTranscripts.has(note.id)}
                  <div class="mn-transcript">
                    {#if transcriptData[note.id]?.loading}
                      <span class="mn-spinner-blue"></span> Loading transcript…
                    {:else if transcriptData[note.id]?.error}
                      <span class="mn-error-sm">{transcriptData[note.id].error}</span>
                    {:else if transcriptData[note.id]?.text}
                      <pre class="mn-transcript-text">{transcriptData[note.id].text}</pre>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

  {/if}
</div>

<!-- ── Meeting Note Modal ─────────────────────────────────────────────────── -->
{#if viewingNote}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" on:click|self={() => viewingNote = null} on:keydown={(e) => e.key === 'Escape' && (viewingNote = null)} role="dialog" tabindex="-1">
    <div class="mn-modal">
      <div class="modal-header">
        <div>
          <h2 class="mn-modal-title">{viewingNote.title}</h2>
          <p class="mn-modal-meta">
            {formatDate(viewingNote.meeting_date)}
            {#if viewingNote.attendees_text} &bull; {viewingNote.attendees_text}{/if}
          </p>
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={() => viewingNote = null}>
          <i class="las la-times"></i>
        </button>
      </div>
      <div class="modal-body mn-modal-body">
        {#if viewingNote.summary_html}
          <div class="mn-summary-html">
            {@html viewingNote.summary_html}
          </div>
        {:else}
          <p class="mn-empty">No summary available for this meeting.</p>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(viewingNote)}>
          <i class="las la-download"></i> Download
        </button>
        <button class="btn btn-secondary btn-sm" on:click={() => viewingNote = null}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ────────────────────────────────────────────────────────────── */
  .mn-tab { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem 0; overflow-y: auto; flex: 1; min-height: 0; }

  .mn-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mn-title { font-size: 1rem; font-weight: 600; color: #1e293b; margin: 0; }

  /* ── Sections ──────────────────────────────────────────────────────────── */
  .mn-section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }
  .mn-section-muted { background: #f8fafc; }

  .mn-section-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .mn-section-head h3 { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin: 0; }

  .mn-concertina-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
  }
  .mn-concertina-btn:hover { color: #1e293b; }

  .mn-ml-auto { margin-left: auto; }
  .mn-row-btns { display: flex; align-items: center; gap: 0.4rem; }
  .mn-table-mt { margin-top: 0.75rem; }

  /* ── Upload panel ──────────────────────────────────────────────────────── */
  .mn-upload-panel {
    background: #fff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 1.1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .mn-upload-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mn-upload-header h3 { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin: 0; }
  .mn-upload-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
  }

  /* Form overrides (matching site's form style) */
  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #1e293b;
    background: #fff;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  textarea.form-input { resize: vertical; line-height: 1.5; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .form-row-3 {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 0.75rem;
  }
  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-group-wide { grid-column: 1 / -1; }
  .form-group label { font-size: 0.8rem; font-weight: 500; color: #374151; }
  .required { color: #ef4444; }

  .mn-form-footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }

  .mn-add-form {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.85rem;
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;
  }

  /* Summary type toggle */
  .mn-type-row { display: flex; align-items: center; gap: 0.75rem; }
  .mn-type-label { font-size: 0.8rem; font-weight: 500; color: #374151; white-space: nowrap; }
  .mn-type-toggle {
    display: flex;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    overflow: hidden;
  }
  .mn-type-btn {
    background: none;
    border: none;
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .mn-type-btn:first-child { border-right: 1px solid #d1d5db; }
  .mn-type-btn.active { background: #3b82f6; color: #fff; font-weight: 600; }
  .mn-type-btn:hover:not(.active) { background: #f1f5f9; }
  .mn-type-sub { font-size: 0.72rem; opacity: 0.75; }

  /* Input tabs (upload vs paste) */
  .mn-input-tabs {
    display: flex;
    border-bottom: 2px solid #e2e8f0;
  }
  .mn-input-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: color 0.15s;
  }
  .mn-input-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
  .mn-input-tab:hover:not(.active) { color: #475569; }

  /* Drop zone */
  .mn-drop-zone {
    border: 2px dashed #bfdbfe;
    border-radius: 6px;
    padding: 1.75rem 1rem;
    text-align: center;
    cursor: pointer;
    color: #64748b;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mn-drop-zone:hover, .mn-drop-zone.drag-over { background: #eff6ff; border-color: #3b82f6; }
  .mn-drop-icon { font-size: 2rem; color: #93c5fd; }
  .mn-drop-filename { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
  .mn-drop-hint { font-size: 0.75rem; color: #94a3b8; }

  .mn-paste { min-height: 160px; }

  .mn-extras-toggle { font-size: 0.8rem; }

  /* ── Actions table ─────────────────────────────────────────────────────── */
  .mn-table {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    margin-top: 0.75rem;
  }
  .mn-table-head {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr auto;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    font-size: 0.72rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #e2e8f0;
  }
  .mn-row {
    display: grid;
    grid-template-columns: auto 2fr 1fr 1fr 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.75rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.875rem;
  }
  .mn-row:hover { background: #f8fafc; }
  .mn-row-overdue { background: #fff7f7; }
  .mn-row-done { opacity: 0.7; }
  .mn-row-editing {
    display: block;
    padding: 0.75rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .mn-status-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }
  .mn-status-pending { color: #cbd5e1; }
  .mn-status-pending:hover { color: #22c55e; }
  .mn-status-complete { color: #22c55e; }
  .mn-status-complete:hover { color: #cbd5e1; }

  .mn-action-text { color: #1e293b; font-size: 0.875rem; line-height: 1.4; }
  .mn-action-text.mn-done { text-decoration: line-through; color: #94a3b8; }
  .mn-action-note { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.1rem; }
  .mn-cell-muted { color: #64748b; font-size: 0.8rem; }
  .mn-cell-dim { color: #94a3b8; font-size: 0.78rem; }
  .mn-overdue-text { color: #dc2626 !important; font-weight: 600; }
  .mn-manual {
    background: #f1f5f9;
    color: #64748b;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  /* ── Note cards (All Meeting Notes) ──────────────────────────────────── */
  .mn-notes-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .mn-note-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem 1rem;
  }
  .mn-note-info {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .mn-note-meta { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; }
  .mn-note-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
  .mn-note-badges-row { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
  .mn-note-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 0.6rem;
  }

  .mn-meeting-meta { font-size: 0.8rem; }

  .mn-note-badges { display: flex; gap: 0.4rem; margin-top: 0.5rem; }

  /* Transcript expand */
  .mn-transcript {
    margin-top: 0.6rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.8rem;
    color: #64748b;
  }
  .mn-transcript-text {
    font-family: inherit;
    font-size: 0.8rem;
    color: #475569;
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
    max-height: 360px;
    overflow-y: auto;
    background: #f8fafc;
    border-radius: 4px;
    padding: 0.75rem;
  }

  /* ── Badges ─────────────────────────────────────────────────────────────── */
  .mn-badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    white-space: nowrap;
  }
  .mn-badge-warn { background: #fef3c7; color: #92400e; }
  .mn-badge-ok   { background: #dcfce7; color: #166534; }

  /* ── States ─────────────────────────────────────────────────────────────── */
  .mn-empty { color: #94a3b8; font-size: 0.875rem; padding: 0.5rem 0; margin: 0; }
  .mn-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.6rem 0.85rem;
    color: #991b1b;
    font-size: 0.875rem;
  }
  .mn-error-sm { color: #dc2626; font-size: 0.8rem; margin: 0.25rem 0 0; }
  .mn-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  /* Spinners */
  .mn-spinner {
    display: inline-block;
    width: 0.85rem; height: 0.85rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: mn-spin 0.7s linear infinite;
  }
  .mn-spinner-blue {
    display: inline-block;
    width: 0.9rem; height: 0.9rem;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: mn-spin 0.7s linear infinite;
  }
  @keyframes mn-spin { to { transform: rotate(360deg); } }

  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .mn-modal {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .mn-modal-title { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 0.2rem; }
  .mn-modal-meta { font-size: 0.8rem; color: #64748b; margin: 0; }
  .close-btn { flex-shrink: 0; }
  .modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
  .mn-modal-body { padding: 1.25rem 1.5rem; }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    flex-shrink: 0;
  }

  /* Summary HTML rendering inside modal */
  .mn-summary-html { font-size: 0.875rem; color: #334155; line-height: 1.7; }
  .mn-summary-html :global(h3) { font-size: 0.9rem; font-weight: 700; color: #1e293b; margin: 1rem 0 0.35rem; }
  .mn-summary-html :global(h3:first-child) { margin-top: 0; }
  .mn-summary-html :global(p) { margin: 0 0 0.5rem; }
  .mn-summary-html :global(ul) { margin: 0 0 0.5rem; padding-left: 1.25rem; }
  .mn-summary-html :global(li) { margin-bottom: 0.25rem; }
  .mn-summary-html :global(strong) { font-weight: 700; color: #1e293b; }
</style>
