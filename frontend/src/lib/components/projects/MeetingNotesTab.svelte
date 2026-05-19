<script>
  import { onMount } from 'svelte';
  import {
    getMeetingNotes,
    getMeetingActions,
    getMeetingTranscript,
    deleteMeetingNote,
    createMeetingAction,
    updateMeetingAction,
    deleteMeetingAction
  } from '$lib/api/meetingNotes.js';

  export let project;
  $: projectId = project?.id;

  // Data
  let notes = [];         // meeting notes with summary
  let actions = [];       // all actions for project
  let loading = true;
  let error = null;

  // UI toggles
  let showAllMeetings = false;
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

  // Transcript view
  let transcriptData = {};   // meetingId → { loading, text, error }

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

  $: pendingActions  = actions.filter(a => a.status === 'pending');
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

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function toggleStatus(action) {
    const newStatus = action.status === 'pending' ? 'complete' : 'pending';
    try {
      const updated = await updateMeetingAction(action.id, { status: newStatus });
      actions = actions.map(a => a.id === action.id ? updated : a);
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
      const updated = await updateMeetingAction(actionId, {
        action_text: editForm.action_text,
        owner: editForm.owner || null,
        due_date: editForm.due_date || null,
        notes: editForm.notes || null
      });
      actions = actions.map(a => a.id === actionId ? updated : a);
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

  // ── Meeting notes ─────────────────────────────────────────────────────────────

  async function removeNote(id) {
    if (!confirm('Delete this meeting note and all its actions?')) return;
    try {
      await deleteMeetingNote(id);
      notes = notes.filter(n => n.id !== id);
      actions = actions.filter(a => a.transcript_id !== id);
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
</script>

<div class="meeting-notes-tab">

  {#if loading}
    <div class="loading-state"><span class="spinner"></span> Loading meeting notes…</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else}

    <!-- ── Outstanding Actions ──────────────────────────────────────────── -->
    <section class="section">
      <div class="section-header">
        <h3>Outstanding Actions</h3>
        <span class="count-badge">{pendingActions.length}</span>
        <button class="btn-add" on:click={() => { showAddForm = !showAddForm; addError = null; }}>
          <i class="las la-plus"></i> Add Action
        </button>
      </div>

      {#if showAddForm}
        <div class="add-form">
          <div class="add-form-grid">
            <div class="field field-wide">
              <label>Action <span class="required">*</span></label>
              <input type="text" bind:value={newAction.action_text} placeholder="Describe the action…" />
            </div>
            <div class="field">
              <label>Owner</label>
              <input type="text" bind:value={newAction.owner} placeholder="Person responsible" />
            </div>
            <div class="field">
              <label>Due Date</label>
              <input type="date" bind:value={newAction.due_date} />
            </div>
            <div class="field field-wide">
              <label>Notes</label>
              <input type="text" bind:value={newAction.notes} placeholder="Any additional context" />
            </div>
          </div>
          {#if addError}<div class="error-msg-sm">{addError}</div>{/if}
          <div class="add-form-actions">
            <button class="btn-cancel-sm" on:click={() => { showAddForm = false; addError = null; }}>Cancel</button>
            <button class="btn-save-sm" on:click={addAction} disabled={adding}>
              {adding ? 'Adding…' : 'Add Action'}
            </button>
          </div>
        </div>
      {/if}

      {#if pendingActions.length === 0}
        <p class="empty-state">No outstanding actions. Good work!</p>
      {:else}
        <div class="actions-table">
          <div class="actions-head">
            <span>Action</span>
            <span>Owner</span>
            <span>Due</span>
            <span>From</span>
            <span></span>
          </div>
          {#each pendingActions as action (action.id)}
            {#if editingActionId === action.id}
              <div class="action-row action-row-editing">
                <div class="edit-grid">
                  <div class="field field-wide">
                    <label>Action</label>
                    <input type="text" bind:value={editForm.action_text} />
                  </div>
                  <div class="field">
                    <label>Owner</label>
                    <input type="text" bind:value={editForm.owner} placeholder="Person responsible" />
                  </div>
                  <div class="field">
                    <label>Due Date</label>
                    <input type="date" bind:value={editForm.due_date} />
                  </div>
                  <div class="field field-wide">
                    <label>Notes</label>
                    <input type="text" bind:value={editForm.notes} placeholder="Optional notes" />
                  </div>
                </div>
                <div class="edit-actions">
                  <button class="btn-cancel-sm" on:click={() => editingActionId = null}>Cancel</button>
                  <button class="btn-save-sm" on:click={() => saveEdit(action.id)}>Save</button>
                </div>
              </div>
            {:else}
              <div class="action-row" class:overdue={isOverdue(action.due_date)}>
                <button class="status-toggle pending" on:click={() => toggleStatus(action)} title="Mark complete">
                  <i class="las la-circle"></i>
                </button>
                <span class="action-text">
                  {action.action_text}
                  {#if action.notes}
                    <span class="action-notes">{action.notes}</span>
                  {/if}
                </span>
                <span class="action-owner">{action.owner ?? '—'}</span>
                <span class="action-due" class:overdue-text={isOverdue(action.due_date)}>
                  {formatDate(action.due_date)}
                </span>
                <span class="action-source">
                  {#if action.meeting_title}{action.meeting_title}{:else}<span class="manual-badge">Manual</span>{/if}
                </span>
                <div class="action-btns">
                  <button class="icon-btn" on:click={() => startEdit(action)} title="Edit"><i class="las la-pen"></i></button>
                  <button class="icon-btn danger" on:click={() => removeAction(action.id)} title="Delete"><i class="las la-trash"></i></button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </section>

    <!-- ── Latest Meeting Summary ────────────────────────────────────────── -->
    {#if latestNote}
      <section class="section">
        <div class="section-header">
          <h3>Latest Meeting</h3>
          <span class="meeting-meta">
            {latestNote.title}
            {#if latestNote.meeting_date} · {formatDate(latestNote.meeting_date)}{/if}
            {#if latestNote.attendees_text} · {latestNote.attendees_text}{/if}
          </span>
        </div>
        {#if latestNote.summary_html}
          <div class="summary-body">
            {@html latestNote.summary_html}
          </div>
        {/if}
      </section>
    {/if}

    <!-- ── Completed Actions ─────────────────────────────────────────────── -->
    {#if completedActions.length > 0}
      <section class="section section-muted">
        <button class="section-toggle" on:click={() => showCompleted = !showCompleted}>
          <i class="las la-{showCompleted ? 'angle-up' : 'angle-down'}"></i>
          Completed Actions ({completedActions.length})
        </button>
        {#if showCompleted}
          <div class="actions-table mt-sm">
            <div class="actions-head">
              <span>Action</span>
              <span>Owner</span>
              <span>Completed</span>
              <span>From</span>
              <span></span>
            </div>
            {#each completedActions as action (action.id)}
              <div class="action-row completed-row">
                <button class="status-toggle complete" on:click={() => toggleStatus(action)} title="Mark as pending">
                  <i class="las la-check-circle"></i>
                </button>
                <span class="action-text done">{action.action_text}</span>
                <span class="action-owner">{action.owner ?? '—'}</span>
                <span class="action-due">{formatDate(action.completed_at)}</span>
                <span class="action-source">
                  {#if action.meeting_title}{action.meeting_title}{:else}<span class="manual-badge">Manual</span>{/if}
                </span>
                <div class="action-btns">
                  <button class="icon-btn danger" on:click={() => removeAction(action.id)} title="Delete"><i class="las la-trash"></i></button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- ── All Meeting Notes ─────────────────────────────────────────────── -->
    <section class="section section-muted">
      <button class="section-toggle" on:click={() => showAllMeetings = !showAllMeetings}>
        <i class="las la-{showAllMeetings ? 'angle-up' : 'angle-down'}"></i>
        All Meeting Notes ({notes.length})
      </button>
      {#if showAllMeetings}
        {#if notes.length === 0}
          <p class="empty-state mt-sm">No meeting notes yet. Upload a transcript in Project Docs.</p>
        {:else}
          <div class="notes-list mt-sm">
            {#each notes as note (note.id)}
              <div class="note-card">
                <div class="note-card-header">
                  <div class="note-card-info">
                    <span class="note-title">{note.title}</span>
                    {#if note.meeting_date}
                      <span class="note-date">{formatDate(note.meeting_date)}</span>
                    {/if}
                    {#if note.attendees_text}
                      <span class="note-attendees">{note.attendees_text}</span>
                    {/if}
                  </div>
                  <div class="note-card-meta">
                    {#if Number(note.pending_count) > 0}
                      <span class="count-badge small">{note.pending_count} open</span>
                    {/if}
                    {#if Number(note.complete_count) > 0}
                      <span class="count-badge small done">{note.complete_count} done</span>
                    {/if}
                    <button
                      class="btn-transcript"
                      on:click={() => toggleTranscript(note.id)}
                    >
                      <i class="las la-file-alt"></i>
                      {expandedTranscripts.has(note.id) ? 'Hide Transcript' : 'View Transcript'}
                    </button>
                    <button class="icon-btn danger" on:click={() => removeNote(note.id)} title="Delete meeting note">
                      <i class="las la-trash"></i>
                    </button>
                  </div>
                </div>

                {#if note.summary_html}
                  <div class="note-summary">
                    {@html note.summary_html}
                  </div>
                {/if}

                {#if expandedTranscripts.has(note.id)}
                  <div class="transcript-view">
                    {#if transcriptData[note.id]?.loading}
                      <span class="spinner-sm"></span> Loading transcript…
                    {:else if transcriptData[note.id]?.error}
                      <span class="error-msg-sm">{transcriptData[note.id].error}</span>
                    {:else if transcriptData[note.id]?.text}
                      <pre class="transcript-text">{transcriptData[note.id].text}</pre>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </section>

  {/if}
</div>

<style>
  .meeting-notes-tab { padding: 1.25rem 0; display: flex; flex-direction: column; gap: 1.25rem; }

  .loading-state { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.875rem; padding: 2rem; }
  .error-msg { color: #dc2626; font-size: 0.85rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.6rem 0.8rem; }
  .error-msg-sm { color: #dc2626; font-size: 0.8rem; margin-top: 0.4rem; }
  .empty-state { color: #94a3b8; font-size: 0.85rem; padding: 0.5rem 0; }
  .mt-sm { margin-top: 0.75rem; }

  /* Spinner */
  .spinner {
    width: 1rem; height: 1rem;
    border: 2px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  .spinner-sm {
    width: 0.8rem; height: 0.8rem;
    border: 2px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Sections */
  .section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem 1.25rem;
  }
  .section-muted { background: #f8fafc; }
  .section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.85rem;
    flex-wrap: wrap;
  }
  .section-header h3 { font-size: 0.9rem; font-weight: 700; color: #1e293b; margin: 0; }
  .section-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    padding: 0;
  }
  .section-toggle:hover { color: #1e293b; }

  .meeting-meta { font-size: 0.8rem; color: #64748b; }
  .count-badge {
    background: #fef3c7;
    color: #92400e;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 10px;
  }
  .count-badge.small { font-size: 0.68rem; }
  .count-badge.done { background: #dcfce7; color: #166534; }

  .btn-add {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-add:hover { background: #4f46e5; }

  /* Add form */
  .add-form {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.85rem;
    margin-bottom: 0.85rem;
  }
  .add-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .field { display: flex; flex-direction: column; gap: 0.25rem; }
  .field-wide { grid-column: 1 / -1; }
  label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .required { color: #ef4444; }
  input[type="text"], input[type="date"] {
    padding: 0.4rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.83rem;
    font-family: inherit;
    background: #fff;
    color: #1e293b;
  }
  .add-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.65rem;
  }

  .btn-cancel-sm {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    cursor: pointer;
    color: #475569;
  }
  .btn-save-sm {
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-save-sm:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Actions table */
  .actions-table { display: flex; flex-direction: column; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .actions-head {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr auto;
    gap: 0.75rem;
    padding: 0.45rem 0.75rem;
    background: #f1f5f9;
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .action-row {
    display: grid;
    grid-template-columns: auto 2fr 1fr 1fr 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.75rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.84rem;
    transition: background 0.1s;
  }
  .action-row:hover { background: #f8fafc; }
  .action-row.overdue { background: #fff7f7; }
  .action-row.completed-row { opacity: 0.7; }
  .action-row-editing {
    display: block;
    padding: 0.75rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .edit-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .edit-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

  .status-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0;
    line-height: 1;
  }
  .status-toggle.pending { color: #94a3b8; }
  .status-toggle.pending:hover { color: #22c55e; }
  .status-toggle.complete { color: #22c55e; }
  .status-toggle.complete:hover { color: #94a3b8; }

  .action-text { color: #1e293b; font-size: 0.84rem; line-height: 1.4; }
  .action-text.done { text-decoration: line-through; color: #94a3b8; }
  .action-notes { display: block; font-size: 0.76rem; color: #94a3b8; margin-top: 0.15rem; }
  .action-owner { color: #475569; font-size: 0.82rem; }
  .action-due { color: #475569; font-size: 0.82rem; }
  .action-due.overdue-text { color: #dc2626; font-weight: 600; }
  .action-source { color: #94a3b8; font-size: 0.78rem; }
  .manual-badge {
    background: #f1f5f9;
    color: #64748b;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .action-btns { display: flex; gap: 0.35rem; }
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.95rem;
    padding: 0.2rem 0.3rem;
    border-radius: 4px;
    line-height: 1;
  }
  .icon-btn:hover { background: #f1f5f9; color: #475569; }
  .icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }

  /* Summary body */
  .summary-body { font-size: 0.85rem; color: #334155; line-height: 1.65; }
  .summary-body :global(h3) { font-size: 0.88rem; font-weight: 700; color: #1e293b; margin: 0.75rem 0 0.3rem; }
  .summary-body :global(h3:first-child) { margin-top: 0; }
  .summary-body :global(p) { margin: 0 0 0.45rem; }
  .summary-body :global(ul) { margin: 0 0 0.45rem; padding-left: 1.25rem; }
  .summary-body :global(li) { margin-bottom: 0.2rem; }

  /* Note cards */
  .notes-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .note-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .note-card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    flex-wrap: wrap;
  }
  .note-card-info { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
  .note-title { font-size: 0.875rem; font-weight: 700; color: #1e293b; }
  .note-date { font-size: 0.78rem; color: #64748b; }
  .note-attendees { font-size: 0.78rem; color: #94a3b8; }
  .note-card-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .btn-transcript {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 0.25rem 0.6rem;
    font-size: 0.77rem;
    color: #475569;
    cursor: pointer;
  }
  .btn-transcript:hover { background: #f1f5f9; }

  .note-summary { padding: 0.85rem 1rem; font-size: 0.84rem; color: #334155; line-height: 1.6; }
  .note-summary :global(h3) { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin: 0.65rem 0 0.25rem; }
  .note-summary :global(h3:first-child) { margin-top: 0; }
  .note-summary :global(p) { margin: 0 0 0.4rem; }
  .note-summary :global(ul) { margin: 0 0 0.4rem; padding-left: 1.2rem; }

  .transcript-view {
    padding: 0.85rem 1rem;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
  }
  .transcript-text {
    font-family: inherit;
    font-size: 0.8rem;
    color: #475569;
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
  }
</style>
