<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
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
    getMeetingActions,
    getMeetingTranscript,
    deleteMeetingNote,
    updateMeetingNote,
    updateMeetingSummary,
    processMeetingNote,
    createMeetingAction,
    updateMeetingAction,
    deleteMeetingAction
  } from '$lib/api/meetingNotes.js';

  export let project;
  $: projectId = project?.id;

  // Sub-tab
  let activeSubTab = 'meetings'; // 'meetings' | 'briefing'

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
  let actions = [];
  let loading = true;
  let error = null;

  // UI toggles
  let showAllMeetings = false;
  let showCompleted = false;
  let showOutstandingActions = false;
  let showAddForm = false;
  let expandedTranscripts = new Set();

  // Inline edit — actions
  let editingActionId = null;
  let editForm = {};

  // Inline edit — note metadata
  let editingNoteId = null;
  let noteEditForm = { title: '', meeting_date: '', attendees_text: '' };

  // Add action form
  let newAction = { action_text: '', owner: '', due_date: '', notes: '' };
  let addError = null;
  let adding = false;

  // Transcript view (lazy-loaded)
  let transcriptData = {};

  // Note editor modal (view/edit summary + review actions)
  let editorNote = null;     // the note object currently open
  let editorIsNew = false;   // true = actions not yet saved (post-processing)
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

        // Auto-save suggested actions immediately — no editor confirmation step
      const saved = await Promise.all(
        (result.suggestedActions || []).map(a => createMeetingAction(projectId, {
          action_text: a.action_text,
          owner: a.owner || null,
          due_date: a.due_date || null,
          notes: a.notes || null,
          transcript_id: result.transcript.id
        }))
      );
      const enriched = saved.map(a => ({
        ...a,
        meeting_title: result.transcript.title,
        meeting_date: result.transcript.meeting_date
      }));
      actions = [...enriched, ...actions];

      const newNote = {
        id: result.transcript.id,
        title: result.transcript.title,
        meeting_date: result.transcript.meeting_date,
        attendees_text: result.transcript.attendees_text,
        file_name: result.transcript.file_name,
        created_at: result.transcript.created_at,
        summary_id: result.summary?.id,
        summary_html: result.summary?.summary_html,
        pending_count: saved.length,
        complete_count: 0
      };

      notes = [newNote, ...notes];
      showUploadPanel = false;
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  // ── Note editor ───────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function isoToDisplay(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-');
    return d ? `${d}/${m}/${y}` : iso;
  }

  function displayToIso(str) {
    if (!str) return null;
    const dm = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return null;
  }

  function buildActionsHtml(suggestedActions) {
    if (!suggestedActions?.length) return '';
    const td = 'style="padding:0.35rem 0.6rem;border:1px solid #e2e8f0;vertical-align:top;"';
    const th = 'style="text-align:left;padding:0.35rem 0.6rem;background:#f1f5f9;border:1px solid #e2e8f0;font-size:0.72rem;font-weight:600;color:#64748b;text-transform:uppercase;"';
    const rows = suggestedActions.map(a => {
      const date = isoToDisplay(a.due_date);
      return `<tr><td data-col="action" ${td}>${escapeHtml(a.action_text)}</td><td data-col="owner" ${td}>${escapeHtml(a.owner)}</td><td data-col="due_date" ${td}>${escapeHtml(date)}</td><td data-col="notes" ${td}>${escapeHtml(a.notes)}</td></tr>`;
    }).join('');
    return `<h3>Actions</h3><table data-mn-actions="1" style="border-collapse:collapse;width:100%;font-size:0.875rem;margin-top:0.25rem;"><thead><tr><th ${th}>Action</th><th ${th}>Owner</th><th ${th}>Due date (DD/MM/YYYY)</th><th ${th}>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function parseActionsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Prefer data attribute; fall back to finding any table whose first header is "Action"
    let table = doc.querySelector('table[data-mn-actions]');
    if (!table) {
      for (const t of doc.querySelectorAll('table')) {
        if (t.querySelector('thead th')?.textContent.trim().toLowerCase().startsWith('action')) {
          table = t; break;
        }
      }
    }
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr')).map(row => {
      const cell = (col) => (row.querySelector(`td[data-col="${col}"]`) ?? row.querySelectorAll('td')[{ action:0, owner:1, due_date:2, notes:3 }[col]])?.textContent.trim();
      return {
        action_text: cell('action') || '',
        owner: cell('owner') || null,
        due_date: displayToIso(cell('due_date')),
        notes: cell('notes') || null,
      };
    }).filter(a => a.action_text);
  }

  function stripActionsTable(html) {
    // Remove any <h3>Actions</h3> + following <table> regardless of attributes
    return html.replace(/<h3[^>]*>\s*Actions\s*<\/h3>\s*<table[\s\S]*?<\/table>/i, '').trim();
  }

  function openNoteEditor(note, suggestedActions = null) {
    editorNote = note;
    editorIsNew = suggestedActions !== null;
    if (suggestedActions !== null) {
      // New note post-processing — append LLM-suggested actions
      const actionsHtml = suggestedActions.length ? buildActionsHtml(suggestedActions) : '';
      editorInitialHtml = (note.summary_html || '') + actionsHtml;
    } else {
      // Existing note — rebuild actions table fresh from DB state
      const baseHtml = stripActionsTable(note.summary_html || '');
      const noteActions = actions.filter(a => a.transcript_id === note.id);
      editorInitialHtml = baseHtml + (noteActions.length ? buildActionsHtml(noteActions) : '');
    }
  }

  function closeNoteEditor() {
    editorNote = null;
    editorIsNew = false;
    editorInitialHtml = '';
  }

  async function saveNoteEditor() {
    if (!editorNote) return;
    editorSaving = true;
    try {
      const html = richTextEditor?.getHTML() ?? editorNote.summary_html;

      const updated = await updateMeetingSummary(editorNote.id, html);
      notes = notes.map(n => n.id === editorNote.id ? { ...n, summary_html: updated.summary_html } : n);

      const parsedActions = parseActionsFromHtml(html);

      if (editorIsNew) {
        // Create all action records fresh
        const saved = await Promise.all(
          parsedActions.map(a => createMeetingAction(projectId, {
            action_text: a.action_text,
            owner: a.owner || null,
            due_date: a.due_date || null,
            notes: a.notes || null,
            transcript_id: editorNote.id
          }))
        );
        const enriched = saved.map(a => ({ ...a, meeting_title: editorNote.title, meeting_date: editorNote.meeting_date }));
        actions = [...enriched, ...actions];
        notes = notes.map(n => n.id === editorNote.id ? { ...n, pending_count: saved.length } : n);
      } else if (parsedActions.length > 0) {
        // Update existing records matched by action_text; create any that are new
        const existingForNote = actions.filter(a => a.transcript_id === editorNote.id);
        for (const p of parsedActions) {
          const match = existingForNote.find(a => a.action_text === p.action_text);
          if (match) {
            const upd = await updateMeetingAction(match.id, {
              action_text: p.action_text,
              owner: p.owner,
              due_date: p.due_date,
              notes: p.notes
            });
            actions = actions.map(a => a.id === match.id ? { ...a, ...upd } : a);
          } else {
            const created = await createMeetingAction(projectId, {
              action_text: p.action_text,
              owner: p.owner || null,
              due_date: p.due_date || null,
              notes: p.notes || null,
              transcript_id: editorNote.id
            });
            actions = [...actions, { ...created, meeting_title: editorNote.title, meeting_date: editorNote.meeting_date }];
          }
        }
      }

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

<div class="mn-tab">

  <!-- Sub-tab toggle -->
  <div class="mn-subtabs">
    <button class="mn-subtab" class:mn-subtab--active={activeSubTab === 'meetings'} on:click={() => activeSubTab = 'meetings'}>
      <i class="las la-users"></i> Project Meetings
    </button>
    <button class="mn-subtab" class:mn-subtab--active={activeSubTab === 'briefing'} on:click={openBriefingTab}>
      <i class="las la-file-alt"></i> Briefing Note
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
            <div class="mn-latest-badges">
              {#if Number(latestNote.pending_count) > 0}
                <span class="mn-badge mn-badge-warn">{latestNote.pending_count} open action{latestNote.pending_count > 1 ? 's' : ''}</span>
              {/if}
              {#if Number(latestNote.complete_count) > 0}
                <span class="mn-badge mn-badge-ok">{latestNote.complete_count} completed</span>
              {/if}
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

    <!-- ── Outstanding Actions ─────────────────────────────────────────── -->
    <div class="mn-section mn-section-muted">
      <div class="mn-section-head">
        <button class="mn-concertina-btn" on:click={() => showOutstandingActions = !showOutstandingActions}>
          <i class="las la-{showOutstandingActions ? 'angle-up' : 'angle-down'}"></i>
          Outstanding Actions
        </button>
        {#if pendingActions.length > 0}
          <span class="mn-badge mn-badge-warn">{pendingActions.length}</span>
        {/if}
        <button class="btn btn-primary btn-sm mn-ml-auto" on:click={() => { showOutstandingActions = true; showAddForm = !showAddForm; addError = null; }}>
          <i class="las la-plus"></i> Add Action
        </button>
      </div>

      {#if showOutstandingActions}

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

      {/if}
    </div>

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
                    <button class="btn btn-secondary btn-sm" on:click={() => openNoteEditor(note)}>
                      <i class="las la-eye"></i> View Notes
                    </button>
                    <button class="btn btn-secondary btn-sm" on:click={() => toggleTranscript(note.id)}>
                      <i class="las la-file-alt"></i>
                      {expandedTranscripts.has(note.id) ? 'Hide' : 'Transcript'}
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

  {/if} <!-- end activeSubTab === 'briefing' / else -->

</div>

<!-- ── Note Editor Modal ─────────────────────────────────────────────────── -->
{#if editorNote}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && !editorSaving && closeNoteEditor()}>
    <div class="mn-modal mn-editor-modal">

      <!-- Header -->
      <div class="modal-header mn-editor-header">
        <div class="mn-result-header-text">
          {#if editorIsNew}<div class="mn-result-tick"><i class="las la-check-circle"></i></div>{/if}
          <div>
            <h2 class="mn-modal-title">{editorNote.title}</h2>
            <p class="mn-modal-meta">
              {formatDate(editorNote.meeting_date)}
              {#if editorNote.attendees_text} &bull; {editorNote.attendees_text}{/if}
            </p>
          </div>
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
          {editorIsNew ? 'Skip actions' : 'Close'}
        </button>
        <button class="btn btn-primary" on:click={saveNoteEditor} disabled={editorSaving}>
          {#if editorSaving}
            <span class="mn-spinner"></span> Saving…
          {:else if editorIsNew}
            <i class="las la-check"></i> Save &amp; accept actions
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

  /* ── Sub-tabs ───────────────────────────────────────────────────────────── */
  .mn-subtabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 0.25rem;
  }
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
  .mn-latest-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
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

  .mn-ml-auto { margin-left: auto; }
  .mn-row-btns { display: flex; align-items: center; gap: 0.4rem; }
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

  .mn-add-form {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.85rem;
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;
  }

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
  .mn-transcript-modal-text {
    max-height: none;
    overflow-y: visible;
    font-size: 0.85rem;
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

  /* ── Note editor modal ───────────────────────────────────────────────────── */
  .mn-editor-modal { max-width: 860px; height: 88vh; }

  .mn-editor-header {
    justify-content: space-between;
  }
  .mn-result-header-text {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
  }
  .mn-result-tick {
    font-size: 1.6rem;
    color: #22c55e;
    line-height: 1;
    margin-top: 0.1rem;
    flex-shrink: 0;
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
  .mn-summary-html :global(pre) { white-space: pre-wrap; font-family: inherit; margin: 0; }
</style>
