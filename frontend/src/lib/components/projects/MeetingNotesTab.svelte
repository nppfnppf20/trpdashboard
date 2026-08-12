<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
  import AddActionModal from '$lib/components/projects/AddActionModal.svelte';
  import {
    getDocumentSummaries,
    generateDocumentSummary,
    saveDocumentSummary,
    updateDocumentSummary,
    deleteDocumentSummary,
    getDocumentSummaryTranscript
  } from '$lib/api/projectDocs.js';
  import {
    getMeetingNotes,
    getMeetingTranscript,
    deleteMeetingNote,
    updateMeetingNote,
    updateMeetingSummary,
    processMeetingNote
  } from '$lib/api/meetingNotes.js';

  export let project;
  $: projectId = project?.id;

  // "Add this to the Issues Tracker?" hop — triggered from the post-process
  // review modal below, reused whether this tab is rendered inside the
  // per-project view or the standalone /meeting-notes page.
  let issuesPromptNoteId = null;
  let showDraftIssuesModal = false;

  // Post-process review modal — opens right after a transcript is processed.
  // Lets you edit the AI summary before it's saved, then offers the Issues
  // Tracker hop. Actions/completion tracking lives in the DB only now —
  // this tab doesn't surface or edit them.
  let reviewOpen = false;
  let reviewTranscript = null; // { id, title, meeting_date, attendees_text }
  let reviewSummaryHtml = '';
  let reviewEditor;            // bind:this on RichTextEditor
  let reviewSaving = false;
  let reviewSaved = false;     // true once Save has committed — swaps footer to the Issues Tracker prompt
  let reviewError = null;

  // Sub-tab
  let activeSubTab = 'meetings'; // 'meetings' | 'briefing'

  // Full screen view
  let isFullscreen = false;
  function handleFullscreenKeydown(e) {
    if (e.key === 'Escape' && isFullscreen) isFullscreen = false;
  }

  // Briefing sub-tab state
  let showMeetingGuide = false;
  let briefings = [];
  let briefingsLoaded = false;
  let briefingsLoading = false;
  let briefingsError = null;
  let bInputTab = 'upload'; // 'upload' | 'paste'
  let bFile = null;
  let bPasteText = '';
  let bDragOver = false;
  let bProcessing = false;
  let bError = null;
  let bFileInput;
  let bResult = null; // { summary_html, file_name }
  let bTitle = '';
  let bSaving = false;
  let bSaveError = null;

  async function loadBriefings() {
    briefingsLoading = true;
    briefingsError = null;
    try {
      const all = await getDocumentSummaries(projectId);
      briefings = all.filter(s => s.doc_type === 'briefing_transcript');
      briefingsLoaded = true;
    } catch (err) {
      briefingsError = err.message;
    } finally {
      briefingsLoading = false;
    }
  }

  function openBriefingTab() {
    activeSubTab = 'briefing';
    if (!briefingsLoaded) loadBriefings();
  }

  function handleBriefingDrop(e) {
    e.preventDefault();
    bDragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { bFile = file; bInputTab = 'upload'; }
  }

  function handleBriefingFileChange(e) {
    bFile = e.target.files[0] || null;
  }

  function saveBriefingDirectly() {
    if (!bPasteText.trim()) { bError = 'Please paste some text first.'; return; }
    bError = null;
    const escaped = bPasteText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    bResult = {
      summary_html: `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.875rem;line-height:1.6;">${escaped}</pre>`,
      file_name: null,
      transcript_text: bPasteText
    };
    bTitle = 'Briefing Transcript';
  }

  async function submitBriefingUpload() {
    bError = null;
    if (bInputTab === 'upload' && !bFile) { bError = 'Please select a file.'; return; }
    if (bInputTab === 'paste' && !bPasteText.trim()) { bError = 'Please paste the briefing text.'; return; }
    bProcessing = true;
    bResult = null;
    try {
      const payload = { docType: 'briefing_transcript' };
      if (bInputTab === 'upload') {
        payload.file = bFile;
      } else {
        payload.text = bPasteText;
        payload.fileName = 'Pasted text';
      }
      const result = await generateDocumentSummary(projectId, payload);
      bResult = result;
      bTitle = result.file_name || (bFile ? bFile.name : 'Briefing Transcript');
    } catch (err) {
      bError = err.message;
    } finally {
      bProcessing = false;
    }
  }

  async function saveBriefing() {
    if (!bTitle.trim()) { bSaveError = 'Please enter a title.'; return; }
    bSaving = true;
    bSaveError = null;
    try {
      const entry = await saveDocumentSummary(projectId, {
        title: bTitle,
        file_name: bResult.file_name || null,
        doc_type: 'briefing_transcript',
        summary_html: bResult.summary_html,
        transcript_text: bResult.transcript_text || null
      });
      briefings = [entry, ...briefings];
      bResult = null;
      bTitle = '';
      bFile = null;
      bPasteText = '';
    } catch (err) {
      bSaveError = err.message;
    } finally {
      bSaving = false;
    }
  }

  // Briefing viewer modal
  let viewingBriefing = null;

  // Briefing transcript viewer modal (lazy-loaded)
  let briefingTranscripts = {}; // id -> { loading, text, error }
  let viewingTranscriptBriefing = null;

  function openBriefingTranscript(b) {
    viewingTranscriptBriefing = b;
    loadBriefingTranscript(b);
  }

  async function loadBriefingTranscript(b) {
    if (briefingTranscripts[b.id]) return;
    if (b.transcript_text) {
      briefingTranscripts = { ...briefingTranscripts, [b.id]: { loading: false, text: b.transcript_text, error: null } };
      return;
    }
    briefingTranscripts = { ...briefingTranscripts, [b.id]: { loading: true, text: null, error: null } };
    try {
      const data = await getDocumentSummaryTranscript(b.id);
      briefingTranscripts = { ...briefingTranscripts, [b.id]: { loading: false, text: data.transcript_text, error: null } };
    } catch (err) {
      briefingTranscripts = { ...briefingTranscripts, [b.id]: { loading: false, text: null, error: err.message } };
    }
  }

  // Briefing editor modal
  let editingBriefing = null;   // the briefing being edited
  let bEditTitle = '';
  let bEditSaving = false;
  let bEditError = null;
  let briefingEditor;           // bind:this on RichTextEditor

  function openBriefingEditor(b) {
    editingBriefing = b;
    bEditTitle = b.title ?? '';
    bEditError = null;
  }

  function closeBriefingEditor() {
    if (bEditSaving) return;
    editingBriefing = null;
    bEditError = null;
  }

  async function saveBriefingEdit() {
    if (!bEditTitle.trim()) { bEditError = 'Please enter a title.'; return; }
    bEditSaving = true;
    bEditError = null;
    try {
      const html = briefingEditor?.getHTML() ?? editingBriefing.summary_html;
      const updated = await updateDocumentSummary(editingBriefing.id, {
        title: bEditTitle.trim(),
        summary_html: html
      });
      briefings = briefings.map(b => b.id === editingBriefing.id ? { ...b, ...updated } : b);
      editingBriefing = null;
    } catch (err) {
      bEditError = err.message;
    } finally {
      bEditSaving = false;
    }
  }

  async function deleteBriefing(id) {
    if (!confirm('Delete this briefing transcript?')) return;
    try {
      await deleteDocumentSummary(id);
      briefings = briefings.filter(b => b.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  // Data
  let notes = [];
  let loading = true;
  let error = null;

  // UI toggles
  let showAllMeetings = false;
  let viewingTranscriptNote = null; // note object currently shown in the transcript viewer modal

  // Inline edit — note metadata
  let editingNoteId = null;
  let noteEditForm = { title: '', meeting_date: '', attendees_text: '' };

  // Transcript view (lazy-loaded)
  let transcriptData = {};

  // Note editor modal (view/edit summary)
  let editorNote = null;     // the note object currently open
  let editorInitialHtml = '';
  let editorSaving = false;
  let richTextEditor;        // bind:this on RichTextEditor

  // ── Upload panel ──────────────────────────────────────────────────────────
  let showUploadPanel = false;
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadSummaryType = 'brief'; // 'brief' | 'detailed' | 'custom'
  let uploadProvider = ''; // '' = AI Providers admin default | 'anthropic' | 'openai'
  let uploadCustomPrompt = '';
  let uploadFile = null;
  let uploadPasteText = '';
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
      notes = await getMeetingNotes(projectId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: latestNote = notes[0] ?? null;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Meeting notes ─────────────────────────────────────────────────────────

  async function removeNote(id) {
    if (!confirm('Delete this meeting note?')) return;
    try {
      await deleteMeetingNote(id);
      notes = notes.filter(n => n.id !== id);
      if (editorNote?.id === id) { editorNote = null; }
    } catch (err) {
      alert(err.message);
    }
  }

  function startEditNote(note) {
    editingNoteId = note.id;
    noteEditForm = {
      title: note.title ?? '',
      meeting_date: note.meeting_date ? note.meeting_date.split('T')[0] : '',
      attendees_text: note.attendees_text ?? ''
    };
  }

  async function saveNoteEdit(noteId) {
    try {
      const updated = await updateMeetingNote(noteId, {
        title: noteEditForm.title || null,
        meeting_date: noteEditForm.meeting_date || null,
        attendees_text: noteEditForm.attendees_text || null
      });
      notes = notes.map(n => n.id === noteId
        ? { ...n, title: updated.title, meeting_date: updated.meeting_date, attendees_text: updated.attendees_text }
        : n
      );
      editingNoteId = null;
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

  function openTranscript(note) {
    viewingTranscriptNote = note;
    loadTranscript(note.id);
  }

  // ── Upload panel ──────────────────────────────────────────────────────────

  function openUploadPanel() {
    showUploadPanel = true;
    uploadFile = null;
    uploadPasteText = '';
    uploadUserNotes = '';
    uploadAgenda = '';
    uploadError = null;
    uploadInputTab = 'upload';
    uploadSummaryType = 'brief';
    uploadProvider = '';
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
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file to upload.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the transcript text.'; return; }

    uploadProcessing = true;
    uploadError = null;
    try {
      const result = await processMeetingNote(projectId, {
        file: uploadInputTab === 'upload' ? uploadFile : null,
        text: uploadInputTab === 'paste' ? uploadPasteText : null,
        userNotes: uploadUserNotes.trim() || null,
        agenda: uploadAgenda.trim() || null,
        summaryType: uploadSummaryType,
        customPrompt: uploadSummaryType === 'custom' ? uploadCustomPrompt.trim() || null : null,
        provider: uploadProvider || null
      });

      const newNote = {
        id: result.transcript.id,
        title: result.transcript.title,
        meeting_date: result.transcript.meeting_date,
        attendees_text: result.transcript.attendees_text,
        file_name: result.transcript.file_name,
        created_at: result.transcript.created_at,
        summary_id: result.summary?.id,
        summary_html: result.summary?.summary_html
      };

      notes = [newNote, ...notes];
      showUploadPanel = false;

      // Open the review modal — nothing beyond the transcript + raw summary
      // is committed until Save is pressed there.
      reviewTranscript = newNote;
      reviewSummaryHtml = result.summary?.summary_html || '';
      reviewSaving = false;
      reviewSaved = false;
      reviewError = null;
      reviewOpen = true;
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  // ── Post-process review modal ───────────────────────────────────────────────

  async function saveReview() {
    reviewSaving = true;
    reviewError = null;
    try {
      const html = reviewEditor?.getHTML() ?? reviewSummaryHtml;
      const updated = await updateMeetingSummary(reviewTranscript.id, html);
      notes = notes.map(n => n.id === reviewTranscript.id ? { ...n, summary_html: updated.summary_html } : n);

      reviewSaved = true;
    } catch (err) {
      reviewError = err.message;
    } finally {
      reviewSaving = false;
    }
  }

  function closeReview() {
    if (reviewSaving) return;
    reviewOpen = false;
    reviewTranscript = null;
    reviewSummaryHtml = '';
    reviewSaved = false;
    reviewError = null;
  }

  function reviewAddToIssuesTracker() {
    issuesPromptNoteId = reviewTranscript.id;
    showDraftIssuesModal = true;
    closeReview();
  }

  // ── Note editor ───────────────────────────────────────────────────────────

  function openNoteEditor(note) {
    editorNote = note;
    editorInitialHtml = note.summary_html || '';
  }

  function closeNoteEditor() {
    editorNote = null;
    editorInitialHtml = '';
  }

  async function saveNoteEditor() {
    if (!editorNote) return;
    editorSaving = true;
    try {
      const html = richTextEditor?.getHTML() ?? editorNote.summary_html;
      const updated = await updateMeetingSummary(editorNote.id, html);
      notes = notes.map(n => n.id === editorNote.id ? { ...n, summary_html: updated.summary_html } : n);
      closeNoteEditor();
    } catch (err) {
      alert(err.message);
    } finally {
      editorSaving = false;
    }
  }

  async function downloadFromEditor() {
    const note = editorNote;
    const title = note.title || 'Meeting Notes';
    const dateStr = note.meeting_date
      ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, note.attendees_text].filter(Boolean).join(' · ');
    const html = richTextEditor?.getHTML() ?? note.summary_html ?? '';
    const exportHtml = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${html}`;
    await exportHtmlToWord(exportHtml, buildExportFilename(project, `${title}${dateStr ? ` ${dateStr}` : ''}`), '/basicdocument.docx');
  }

  // ── Download (from note card, no editor) ─────────────────────────────────

  async function downloadNote(note) {
    const title = note.title || 'Meeting Notes';
    const dateStr = note.meeting_date
      ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, note.attendees_text].filter(Boolean).join(' · ');
    const html = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${note.summary_html || '<p>No summary available.</p>'}`;
    await exportHtmlToWord(html, buildExportFilename(project, `${title}${dateStr ? ` ${dateStr}` : ''}`), '/basicdocument.docx');
  }
</script>

<MeetingGuideModal
  show={showMeetingGuide}
  project={project}
  issueTracks={[]}
  onClose={() => showMeetingGuide = false}
/>

<AddActionModal
  bind:show={showDraftIssuesModal}
  {projectId}
  initialMode="meeting-notes"
  preselectedTranscriptId={issuesPromptNoteId}
  on:done={() => { showDraftIssuesModal = false; issuesPromptNoteId = null; }}
  on:close={() => showDraftIssuesModal = false}
/>

<svelte:window on:keydown={handleFullscreenKeydown} />

<div class="mn-tab" class:mn-fullscreen={isFullscreen}>

  <!-- Sub-tab toggle -->
  <div class="mn-subtabs">
    <button class="mn-subtab" class:mn-subtab--active={activeSubTab === 'meetings'} on:click={() => activeSubTab = 'meetings'}>
      <i class="las la-users"></i> Project Meetings
    </button>
    <button class="mn-subtab" class:mn-subtab--active={activeSubTab === 'briefing'} on:click={openBriefingTab}>
      <i class="las la-file-alt"></i> Briefing Note
    </button>
    <button class="btn btn-secondary btn-sm mn-fullscreen-toggle" on:click={() => isFullscreen = !isFullscreen} title={isFullscreen ? 'Exit full screen (Esc)' : 'Open full screen'}>
      <i class="las {isFullscreen ? 'la-compress' : 'la-expand'}"></i> {isFullscreen ? 'Exit' : 'Full Screen'}
    </button>
  </div>

  {#if activeSubTab === 'briefing'}

    <!-- ── Briefing Note sub-tab ─────────────────────────────────────────── -->
    <div class="mn-briefing-tab">

      <!-- Meeting Guide card -->
      <div class="mn-guide-card">
        <div class="mn-guide-card-left">
          <div class="mn-guide-icon"><i class="las la-clipboard-list"></i></div>
          <div>
            <div class="mn-guide-title">Meeting Guide</div>
            <div class="mn-guide-desc">Structured agenda and talking points for your pre-application briefing meeting.</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" on:click={() => showMeetingGuide = true}>
          <i class="las la-clipboard-list"></i> Open Meeting Guide
        </button>
      </div>

      <!-- Upload briefing transcript -->
      <div class="mn-upload-card">
        <h3 class="mn-card-title">Upload Briefing Transcript</h3>
        <p class="mn-briefing-hint">Once uploaded, the transcript powers "Populate from Briefing" in the Key Issues board.</p>

        <div class="mn-input-tabs">
          <button class="btn btn-sm" class:btn-secondary={bInputTab === 'upload'} class:btn-ghost={bInputTab !== 'upload'} on:click={() => bInputTab = 'upload'}>
            <i class="las la-upload"></i> Upload File
          </button>
          <button class="btn btn-sm" class:btn-secondary={bInputTab === 'paste'} class:btn-ghost={bInputTab !== 'paste'} on:click={() => bInputTab = 'paste'}>
            <i class="las la-clipboard"></i> Paste Text
          </button>
        </div>

        {#if bInputTab === 'upload'}
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div class="mn-drop-zone" class:drag-over={bDragOver} role="button" tabindex="0"
            on:dragover|preventDefault={() => bDragOver = true}
            on:dragleave={() => bDragOver = false}
            on:drop={handleBriefingDrop}
            on:click={() => bFileInput.click()}
            on:keydown={(e) => e.key === 'Enter' && bFileInput.click()}
          >
            {#if bFile}
              <i class="las la-file-alt mn-drop-icon"></i>
              <span class="mn-drop-filename">{bFile.name}</span>
              <span class="mn-drop-hint">Click to change file</span>
            {:else}
              <i class="las la-cloud-upload-alt mn-drop-icon"></i>
              <span>Drop a file here or click to browse</span>
              <span class="mn-drop-hint">PDF, DOCX or TXT</span>
            {/if}
          </div>
          <input bind:this={bFileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleBriefingFileChange} />
        {:else}
          <textarea class="form-input mn-paste" bind:value={bPasteText} placeholder="Paste the briefing transcript here…" rows="4"></textarea>
        {/if}

        {#if bError}<div class="mn-error">{bError}</div>{/if}

        {#if bInputTab === 'paste' && !bResult}
          <div class="mn-briefing-paste-actions">
            <button class="btn btn-primary mn-process-btn" on:click={submitBriefingUpload} disabled={bProcessing}>
              {#if bProcessing}
                <span class="mn-spinner"></span> Processing…
              {:else}
                <i class="las la-magic"></i> Summarise with AI
              {/if}
            </button>
            <button class="btn btn-secondary mn-process-btn" on:click={saveBriefingDirectly} disabled={bProcessing}>
              <i class="las la-save"></i> Save as-is
            </button>
          </div>
        {/if}

        {#if bResult}
          <div class="mn-briefing-result">
            <div class="form-group">
              <label>Title</label>
              <input type="text" class="form-input" bind:value={bTitle} placeholder="e.g. Briefing Note - Feb 2025" />
            </div>
            <div class="mn-briefing-preview">{@html bResult.summary_html}</div>
            {#if bSaveError}<div class="mn-error-sm">{bSaveError}</div>{/if}
            <div class="mn-form-footer">
              <button class="btn btn-secondary btn-sm" on:click={() => { bResult = null; bTitle = ''; }}>Discard</button>
              <button class="btn btn-primary btn-sm" on:click={saveBriefing} disabled={bSaving}>
                {bSaving ? 'Saving…' : 'Save Briefing'}
              </button>
            </div>
          </div>
        {:else if bInputTab === 'upload'}
          <button class="btn btn-primary mn-process-btn" on:click={submitBriefingUpload} disabled={bProcessing}>
            {#if bProcessing}
              <span class="mn-spinner"></span> Processing…
            {:else}
              <i class="las la-magic"></i> Process Briefing
            {/if}
          </button>
        {/if}
      </div>

      <!-- Existing briefing transcripts -->
      <div class="mn-section mn-section-muted">
        <h3 class="mn-briefings-heading">Saved Briefing Transcripts</h3>
        {#if briefingsLoading}
          <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading…</div>
        {:else if briefingsError}
          <div class="mn-error">{briefingsError}</div>
        {:else if briefings.length === 0}
          <p class="mn-empty">No briefing transcripts saved yet.</p>
        {:else}
          <div class="mn-notes-list mn-table-mt">
            {#each briefings as b (b.id)}
              <div class="mn-note-card">
                <div class="mn-note-info">
                  <div class="mn-note-meta">
                    <span class="mn-note-title">{b.title}</span>
                    {#if b.created_at}<span class="mn-cell-muted">{formatDate(b.created_at)}</span>{/if}
                  </div>
                  <div class="mn-note-actions">
                    <button class="btn btn-secondary btn-sm" on:click={() => viewingBriefing = b}>
                      <i class="las la-eye"></i> View
                    </button>
                    <button class="btn btn-secondary btn-sm" on:click={() => openBriefingEditor(b)}>
                      <i class="las la-pen"></i> Edit
                    </button>
                    {#if b.has_transcript || b.transcript_text}
                      <button class="btn btn-secondary btn-sm" on:click={() => openBriefingTranscript(b)}>
                        <i class="las la-file-alt"></i> Transcript
                      </button>
                    {/if}
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => deleteBriefing(b.id)} title="Delete">
                      <i class="las la-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    </div>

  {:else}

  {#if loading}
    <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading meeting notes…</div>
  {:else if error}
    <div class="mn-error">{error}</div>
  {:else}

    <!-- ── Top row ────────────────────────────────────────────────────── -->
    <div class="mn-top-row">

      <!-- Upload card -->
      <div class="mn-upload-card">
        <h3 class="mn-card-title">Add Meeting Notes</h3>

        <div class="mn-type-row">
          <span class="mn-type-label">Summary</span>
          <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'brief'} class:btn-secondary={uploadSummaryType !== 'brief'} on:click={() => uploadSummaryType = 'brief'}>Brief <span class="mn-type-sub">· 1 page</span></button>
          <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'detailed'} class:btn-secondary={uploadSummaryType !== 'detailed'} on:click={() => uploadSummaryType = 'detailed'}>Detailed <span class="mn-type-sub">· 3-4 pages</span></button>
          <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'custom'} class:btn-secondary={uploadSummaryType !== 'custom'} on:click={() => { uploadSummaryType = 'custom'; showExtras = true; }}>Custom</button>
          <select class="mn-provider-select" bind:value={uploadProvider} title="AI model used to generate this summary — Default uses the AI Providers admin setting">
            <option value="">Default</option>
            <option value="anthropic">Claude</option>
            <option value="openai">GPT-5.6</option>
          </select>
        </div>
        {#if uploadSummaryType === 'custom'}
          <p class="mn-custom-hint"><i class="las la-info-circle"></i> Describe the format you want in the Custom Instructions field in Optional Extras below.</p>
        {/if}

        <div class="mn-input-tabs">
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
          <textarea class="form-input mn-paste" bind:value={uploadPasteText} placeholder="Paste the meeting transcript here…" rows="3"></textarea>
        {/if}

        <button class="btn btn-ghost btn-sm mn-extras-toggle" on:click={() => showExtras = !showExtras}>
          <i class="las la-{showExtras ? 'angle-up' : 'angle-right'}"></i>
          {showExtras ? 'Hide' : 'Show'} optional extras
        </button>
        {#if showExtras}
          <div class="form-row">
            <div class="form-group">
              <label>Agenda</label>
              <textarea class="form-input" bind:value={uploadAgenda} rows="3" placeholder="Paste the meeting agenda…"></textarea>
            </div>
            <div class="form-group">
              <label>Consultant Notes</label>
              <textarea class="form-input" bind:value={uploadUserNotes} rows="3" placeholder="Your own notes, included verbatim in the summary…"></textarea>
            </div>
          </div>
          {#if uploadSummaryType === 'custom'}
            <div class="form-group">
              <label>Custom Instructions</label>
              <textarea class="form-input" bind:value={uploadCustomPrompt} rows="3" placeholder="e.g. Produce a short bullet-point briefing note focused on planning policy. Include a risk register at the end."></textarea>
            </div>
          {/if}
        {/if}

        {#if uploadError}<div class="mn-error">{uploadError}</div>{/if}

        <button class="btn btn-primary mn-process-btn" on:click={submitUpload} disabled={uploadProcessing}>
          {#if uploadProcessing}
            <span class="mn-spinner"></span> Processing…
          {:else}
            <i class="las la-magic"></i> Process Meeting Notes
          {/if}
        </button>
      </div>

      <!-- Latest meeting card -->
      <div class="mn-latest-card">
        {#if latestNote}
          <div class="mn-latest-card-inner">
            <div class="mn-latest-card-top">
              <span class="mn-card-label">Latest Meeting</span>
              <button class="btn btn-icon btn-ghost" on:click={() => startEditNote(latestNote)} title="Edit details">
                <i class="las la-pen"></i>
              </button>
            </div>
            <div class="mn-latest-title">{latestNote.title}</div>
            <div class="mn-latest-meta-row">
              {#if latestNote.meeting_date}<span class="mn-cell-muted">{formatDate(latestNote.meeting_date)}</span>{/if}
              {#if latestNote.attendees_text}<span class="mn-cell-dim">{latestNote.attendees_text}</span>{/if}
            </div>
            <div class="mn-latest-card-btns">
              <button class="btn btn-primary btn-sm" on:click={() => openNoteEditor(latestNote)}>
                <i class="las la-eye"></i> View Notes
              </button>
              <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(latestNote)}>
                <i class="las la-download"></i> Download
              </button>
            </div>
          </div>
        {:else}
          <div class="mn-latest-empty">
            <i class="las la-calendar-times"></i>
            <p>No meetings yet.<br>Upload a transcript to get started.</p>
          </div>
        {/if}
      </div>

    </div>

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
                {#if editingNoteId === note.id}
                  <div class="mn-note-edit-form">
                    <div class="form-row-3">
                      <div class="form-group form-group-wide">
                        <label>Title</label>
                        <input type="text" class="form-input" bind:value={noteEditForm.title} placeholder="Meeting title" />
                      </div>
                      <div class="form-group">
                        <label>Date</label>
                        <input type="date" class="form-input" bind:value={noteEditForm.meeting_date} />
                      </div>
                      <div class="form-group">
                        <label>Attendees</label>
                        <input type="text" class="form-input" bind:value={noteEditForm.attendees_text} placeholder="e.g. Josh, Sarah, Client" />
                      </div>
                    </div>
                    <div class="mn-form-footer">
                      <button class="btn btn-secondary btn-sm" on:click={() => editingNoteId = null}>Cancel</button>
                      <button class="btn btn-primary btn-sm" on:click={() => saveNoteEdit(note.id)}>Save</button>
                    </div>
                  </div>
                {:else}
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
                  </div>
                  <div class="mn-note-actions">
                    <button class="btn btn-secondary btn-sm" on:click={() => openNoteEditor(note)}>
                      <i class="las la-eye"></i> View Notes
                    </button>
                    <button class="btn btn-secondary btn-sm" on:click={() => openTranscript(note)}>
                      <i class="las la-file-alt"></i> Transcript
                    </button>
                    <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(note)}>
                      <i class="las la-download"></i> Download
                    </button>
                    <button class="btn btn-icon btn-ghost" on:click={() => startEditNote(note)} title="Edit details">
                      <i class="las la-pen"></i>
                    </button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeNote(note.id)} title="Delete meeting note">
                      <i class="las la-trash"></i>
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

  {/if}

  {/if} <!-- end activeSubTab === 'briefing' / else -->

</div>

<!-- ── Post-process Review Modal ──────────────────────────────────────────── -->
{#if reviewOpen}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && !reviewSaving && closeReview()}>
    <div class="mn-modal mn-editor-modal mn-review-modal">

      <!-- Header -->
      <div class="modal-header mn-editor-header">
        <div>
          <h2 class="mn-modal-title">{reviewTranscript.title}</h2>
          <p class="mn-modal-meta">
            {formatDate(reviewTranscript.meeting_date)}
            {#if reviewTranscript.attendees_text} &bull; {reviewTranscript.attendees_text}{/if}
          </p>
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={closeReview} disabled={reviewSaving}>
          <i class="las la-times"></i>
        </button>
      </div>

      {#if !reviewSaved}
        <!-- Body — scrolls: just the summary editor -->
        <div class="mn-editor-body mn-review-body">
          <section class="mn-review-section">
            <h3 class="mn-review-section-title">Meeting Notes</h3>
            <RichTextEditor
              bind:this={reviewEditor}
              content={reviewSummaryHtml}
              placeholder="Meeting summary…"
              fullHeight={false}
            />
          </section>

          {#if reviewError}<p class="mn-error-sm" style="padding:0 0.25rem">{reviewError}</p>{/if}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" on:click={closeReview} disabled={reviewSaving}>Close without saving</button>
          <button class="btn btn-primary" on:click={saveReview} disabled={reviewSaving}>
            {#if reviewSaving}<span class="mn-spinner"></span> Saving…{:else}<i class="las la-save"></i> Save{/if}
          </button>
        </div>
      {:else}
        <!-- Post-save — hand off to the Issues Tracker draft flow -->
        <div class="mn-editor-body mn-review-body">
          <div class="mn-issues-prompt">
            <span class="mn-issues-prompt-text"><i class="las la-list-alt"></i> Saved. Add "{reviewTranscript.title}" to the Issues Tracker?</span>
            <div class="mn-issues-prompt-actions">
              <button class="btn btn-primary btn-sm" on:click={reviewAddToIssuesTracker}>
                <i class="las la-magic"></i> Yes, draft from this note
              </button>
              <button class="btn btn-ghost btn-sm" on:click={closeReview}>No, done</button>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

<!-- ── Note Editor Modal ─────────────────────────────────────────────────── -->
{#if editorNote}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && !editorSaving && closeNoteEditor()}>
    <div class="mn-modal mn-editor-modal">

      <!-- Header -->
      <div class="modal-header mn-editor-header">
        <div>
          <h2 class="mn-modal-title">{editorNote.title}</h2>
          <p class="mn-modal-meta">
            {formatDate(editorNote.meeting_date)}
            {#if editorNote.attendees_text} &bull; {editorNote.attendees_text}{/if}
          </p>
        </div>
        <div class="mn-editor-header-btns">
          <button class="btn btn-secondary btn-sm" on:click={downloadFromEditor} disabled={editorSaving}>
            <i class="las la-download"></i> Download
          </button>
          <button class="btn btn-icon btn-ghost close-btn" on:click={closeNoteEditor} disabled={editorSaving}>
            <i class="las la-times"></i>
          </button>
        </div>
      </div>

      <!-- Rich text editor — scrolls -->
      <div class="mn-editor-body">
        <RichTextEditor
          bind:this={richTextEditor}
          content={editorInitialHtml}
          placeholder="Meeting summary…"
          fullHeight={false}
        />
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={closeNoteEditor} disabled={editorSaving}>
          Close
        </button>
        <button class="btn btn-primary" on:click={saveNoteEditor} disabled={editorSaving}>
          {#if editorSaving}
            <span class="mn-spinner"></span> Saving…
          {:else}
            <i class="las la-save"></i> Save changes
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- ── Briefing Viewer Modal ─────────────────────────────────────────────── -->
{#if viewingBriefing}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (viewingBriefing = null)}>
    <div class="mn-modal mn-editor-modal">

      <div class="modal-header">
        <div>
          <h2 class="mn-modal-title">{viewingBriefing.title}</h2>
          {#if viewingBriefing.created_at}
            <p class="mn-modal-meta">{formatDate(viewingBriefing.created_at)}</p>
          {/if}
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={() => viewingBriefing = null}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="mn-summary-html">
          {@html viewingBriefing.summary_html}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={() => viewingBriefing = null}>Close</button>
        <button class="btn btn-primary btn-sm" on:click={() => { openBriefingEditor(viewingBriefing); viewingBriefing = null; }}>
          <i class="las la-pen"></i> Edit
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- ── Meeting Transcript Viewer Modal ────────────────────────────────────── -->
{#if viewingTranscriptNote}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (viewingTranscriptNote = null)}>
    <div class="mn-modal mn-editor-modal">

      <div class="modal-header">
        <div>
          <h2 class="mn-modal-title">{viewingTranscriptNote.title}</h2>
          <p class="mn-modal-meta">
            Full transcript
            {#if viewingTranscriptNote.meeting_date}&nbsp;&bull; {formatDate(viewingTranscriptNote.meeting_date)}{/if}
            {#if viewingTranscriptNote.attendees_text}&nbsp;&bull; {viewingTranscriptNote.attendees_text}{/if}
          </p>
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={() => viewingTranscriptNote = null}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if transcriptData[viewingTranscriptNote.id]?.loading}
          <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading transcript…</div>
        {:else if transcriptData[viewingTranscriptNote.id]?.error}
          <div class="mn-error">{transcriptData[viewingTranscriptNote.id].error}</div>
        {:else if transcriptData[viewingTranscriptNote.id]?.text}
          <pre class="mn-transcript-text mn-transcript-modal-text">{transcriptData[viewingTranscriptNote.id].text}</pre>
        {:else}
          <p class="mn-empty">No transcript stored for this meeting.</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={() => viewingTranscriptNote = null}>Close</button>
      </div>

    </div>
  </div>
{/if}

<!-- ── Briefing Transcript Viewer Modal ──────────────────────────────────── -->
{#if viewingTranscriptBriefing}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (viewingTranscriptBriefing = null)}>
    <div class="mn-modal mn-editor-modal">

      <div class="modal-header">
        <div>
          <h2 class="mn-modal-title">{viewingTranscriptBriefing.title}</h2>
          <p class="mn-modal-meta">Full transcript{#if viewingTranscriptBriefing.created_at}&nbsp;&bull; {formatDate(viewingTranscriptBriefing.created_at)}{/if}</p>
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={() => viewingTranscriptBriefing = null}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if briefingTranscripts[viewingTranscriptBriefing.id]?.loading}
          <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading transcript…</div>
        {:else if briefingTranscripts[viewingTranscriptBriefing.id]?.error}
          <div class="mn-error">{briefingTranscripts[viewingTranscriptBriefing.id].error}</div>
        {:else if briefingTranscripts[viewingTranscriptBriefing.id]?.text}
          <pre class="mn-transcript-text mn-transcript-modal-text">{briefingTranscripts[viewingTranscriptBriefing.id].text}</pre>
        {:else}
          <p class="mn-empty">No transcript stored for this briefing.</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={() => viewingTranscriptBriefing = null}>Close</button>
      </div>

    </div>
  </div>
{/if}

<!-- ── Briefing Editor Modal ─────────────────────────────────────────────── -->
{#if editingBriefing}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeBriefingEditor()}>
    <div class="mn-modal mn-editor-modal">

      <div class="modal-header mn-editor-header">
        <input type="text" class="form-input mn-briefing-title-input" bind:value={bEditTitle} placeholder="Briefing title" disabled={bEditSaving} />
        <button class="btn btn-icon btn-ghost close-btn" on:click={closeBriefingEditor} disabled={bEditSaving}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="mn-editor-body">
        <RichTextEditor
          bind:this={briefingEditor}
          content={editingBriefing.summary_html || ''}
          placeholder="Briefing transcript…"
          fullHeight={false}
        />
      </div>

      {#if bEditError}<p class="mn-error-sm" style="padding:0.5rem 1.5rem 0">{bEditError}</p>{/if}

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={closeBriefingEditor} disabled={bEditSaving}>Cancel</button>
        <button class="btn btn-primary" on:click={saveBriefingEdit} disabled={bEditSaving}>
          {#if bEditSaving}
            <span class="mn-spinner"></span> Saving…
          {:else}
            <i class="las la-save"></i> Save changes
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}

<style>
  /* ── Layout ────────────────────────────────────────────────────────────── */
  .mn-tab { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem 0; overflow-y: auto; flex: 1; min-height: 0; }

  /* Full screen: lift the whole tab over the project modal (1000). Kept below
     1100 so nested modals — MeetingGuideModal (1100), this tab's own dialogs
     and AddActionModal (2000) — still open on top of it. */
  .mn-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1050;
    background: #fff;
    padding: 1.25rem 1.75rem;
    margin: 0;
    flex: none;
  }

  /* ── Sub-tabs ───────────────────────────────────────────────────────────── */
  .mn-subtabs {
    display: flex;
    align-items: center;
    gap: 0;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 0.25rem;
  }
  .mn-fullscreen-toggle { margin-left: auto; }
  .mn-subtab {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .mn-subtab:hover { color: #1e293b; }
  .mn-subtab--active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600; }

  /* ── Briefing sub-tab ───────────────────────────────────────────────────── */
  .mn-briefing-tab { display: flex; flex-direction: column; gap: 1rem; }

  .mn-guide-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .mn-guide-card-left { display: flex; align-items: center; gap: 0.875rem; }
  .mn-guide-icon {
    width: 2.5rem; height: 2.5rem;
    background: #eff6ff;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem;
    color: #3b82f6;
    flex-shrink: 0;
  }
  .mn-guide-title { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
  .mn-guide-desc { font-size: 0.8rem; color: #64748b; margin-top: 0.1rem; }

  .mn-briefing-hint { font-size: 0.8rem; color: #64748b; margin: 0; }

  .mn-briefing-result {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.875rem;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .mn-briefing-preview {
    font-size: 0.8rem;
    color: #475569;
    max-height: 200px;
    overflow-y: auto;
    line-height: 1.6;
  }
  .mn-briefings-heading { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin: 0 0 0.5rem; }
  .mn-briefing-title-input { font-weight: 600; max-width: 480px; }
  .mn-briefing-paste-actions { display: flex; flex-direction: column; gap: 0.4rem; }

  /* ── Top row ────────────────────────────────────────────────────────────── */
  .mn-top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: stretch;
  }

  /* Upload card */
  .mn-upload-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .mn-card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
  .mn-process-btn { width: 100%; }

  /* Latest meeting card */
  .mn-latest-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
  }
  .mn-latest-card-inner {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    height: 100%;
  }
  .mn-latest-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mn-card-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }
  .mn-latest-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.3;
  }
  .mn-latest-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    font-size: 0.8rem;
  }
  .mn-latest-card-btns {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 0.35rem;
  }
  .mn-latest-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    height: 100%;
    min-height: 80px;
    color: #94a3b8;
    text-align: center;
  }
  .mn-latest-empty i { font-size: 1.5rem; }
  .mn-latest-empty p { font-size: 0.8rem; margin: 0; line-height: 1.4; }

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

  .mn-table-mt { margin-top: 0.75rem; }

  /* ── Upload panel ──────────────────────────────────────────────────────── */

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

  /* Summary type toggle */
  .mn-type-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .mn-type-label { font-size: 0.8rem; color: #64748b; white-space: nowrap; }
  .mn-type-sub { font-size: 0.7rem; opacity: 0.8; }
  .mn-provider-select {
    margin-left: auto;
    padding: 0.35rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    cursor: pointer;
  }
  .mn-provider-select:focus { outline: none; border-color: #7c3aed; }
  .mn-input-tabs { display: flex; gap: 0.35rem; }
  .mn-custom-hint { font-size: 0.8rem; color: #3b82f6; margin: 0; display: flex; align-items: center; gap: 0.35rem; }

  /* Drop zone */
  .mn-drop-zone {
    border: 2px dashed #bfdbfe;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    text-align: center;
    cursor: pointer;
    color: #64748b;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mn-drop-zone:hover, .mn-drop-zone.drag-over { background: #eff6ff; border-color: #3b82f6; }
  .mn-drop-icon { font-size: 1.4rem; color: #93c5fd; }
  .mn-drop-filename { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
  .mn-drop-hint { font-size: 0.75rem; color: #94a3b8; }

  .mn-paste { min-height: 72px; }

  .mn-extras-toggle { font-size: 0.8rem; }

  .mn-cell-muted { color: #64748b; font-size: 0.8rem; }
  .mn-cell-dim { color: #94a3b8; font-size: 0.78rem; }

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
  .mn-note-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 0.6rem;
  }

  .mn-note-edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .mn-latest-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    margin-top: 0.5rem;
  }

  /* Transcript viewer */
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
  .mn-transcript-modal-text {
    max-height: none;
    overflow-y: visible;
    font-size: 0.85rem;
  }

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
  .mn-issues-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    margin-bottom: 0.75rem;
  }
  .mn-issues-prompt-text {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #0369a1;
  }
  .mn-issues-prompt-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
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

  /* ── Note editor modal ───────────────────────────────────────────────────── */
  .mn-editor-modal { max-width: 860px; height: 88vh; }

  .mn-editor-header {
    justify-content: space-between;
  }
  .mn-editor-header-btns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Rich text editor — takes the scroll space */
  .mn-editor-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .mn-editor-body :global(.rich-text-editor),
  .mn-editor-body :global([contenteditable]) {
    flex: 1;
    min-height: 0;
  }

  /* ── Post-process review modal ──────────────────────────────────────────── */
  .mn-review-modal { max-width: 780px; }
  .mn-review-body {
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
  }
  .mn-review-section-title {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
  }

  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
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
  .mn-summary-html :global(pre) { white-space: pre-wrap; font-family: inherit; margin: 0; }
</style>
