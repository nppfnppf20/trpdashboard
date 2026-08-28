<script>
  import { onMount } from 'svelte';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import MeetingNotesTab from '$lib/components/projects/MeetingNotesTab.svelte';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import {
    processInternalNote,
    getAllMeetingNotes,
    getMeetingNoteActions,
    getMeetingTranscript,
    updateMeetingSummary,
    updateMeetingNote,
    deleteMeetingNote,
    createStandaloneAction,
    createMeetingAction,
    updateMeetingAction,
    deleteMeetingAction,
    saveExtractedInsights,
  } from '$lib/api/meetingNotes.js';

  // ── Type selection ──────────────────────────────────────────────────────────
  // Starts unselected: the workspace below stays greyed out and inert until
  // the user explicitly picks a type — matches the per-project Meeting
  // Notes tab's Add Note dropdown.
  let meetingType = ''; // '' | 'internal' | 'cpd' | 'project'

  let noteTypeMenuOpen = false;
  let noteTypeDropdownEl;
  const noteTypeOptions = [
    { value: 'internal', label: 'Internal Meeting', description: 'General internal team meeting' },
    { value: 'cpd', label: 'CPD', description: 'CPD or training session' },
    { value: 'project', label: 'Project', description: 'Meeting tied to a specific client project' }
  ];
  $: selectedNoteTypeOption = noteTypeOptions.find(o => o.value === meetingType) ?? null;

  function handleWindowClick(e) {
    if (noteTypeMenuOpen && noteTypeDropdownEl && !noteTypeDropdownEl.contains(e.target)) {
      noteTypeMenuOpen = false;
    }
  }

  function handleWindowKeydown(e) {
    if (e.key === 'Escape' && noteTypeMenuOpen) noteTypeMenuOpen = false;
  }

  // ── Project selection ───────────────────────────────────────────────────────
  let selectedProject = null;
  let selectedProjectIdBinding = '';
  let projectSelectorComponent = null;
  let showCreateProjectModal = false;

  function handleProjectSelected(event) {
    selectedProject = event.detail?.project ?? null;
  }

  async function handleProjectCreated(project) {
    showCreateProjectModal = false;
    await projectSelectorComponent?.refreshProjects();
    setTimeout(() => {
      selectedProjectIdBinding = String(project.id);
      selectedProject = project;
    }, 100);
  }

  function switchType(type) {
    meetingType = type;
    noteTypeMenuOpen = false;
    // CPD defaults to Detailed since that's the common case, but it's just
    // a default now — the backend no longer forces it, so the user can
    // still pick Brief or Custom.
    if (type === 'cpd') {
      uploadSummaryType = 'detailed';
    } else if (type === 'internal') {
      uploadSummaryType = 'brief';
    }
    if (type !== 'project') {
      selectedProject = null;
      selectedProjectIdBinding = '';
      loadNotes();
    }
  }

  // ── Internal/CPD notes ──────────────────────────────────────────────────────
  let notes = [];
  let notesLoading = false;
  let notesError = null;
  let showAllNotes = false;

  // Transcript expand state
  let expandedTranscripts = new Set();
  let transcriptData = {}; // { [noteId]: { loading, text, error } }

  async function toggleTranscript(noteId) {
    if (expandedTranscripts.has(noteId)) {
      expandedTranscripts = new Set([...expandedTranscripts].filter(id => id !== noteId));
    } else {
      expandedTranscripts = new Set([...expandedTranscripts, noteId]);
      if (!transcriptData[noteId]) {
        transcriptData[noteId] = { loading: true, text: null, error: null };
        transcriptData = { ...transcriptData };
        try {
          const data = await getMeetingTranscript(noteId);
          transcriptData[noteId] = { loading: false, text: data.transcript_text, error: null };
        } catch (err) {
          transcriptData[noteId] = { loading: false, text: null, error: err.message };
        }
        transcriptData = { ...transcriptData };
      }
    }
  }

  async function loadNotes() {
    if (!meetingType || meetingType === 'project') return;
    notesLoading = true;
    notesError = null;
    try {
      notes = await getAllMeetingNotes(meetingType);
    } catch (err) {
      notesError = err.message;
    } finally {
      notesLoading = false;
    }
  }

  $: latestNote = notes[0] ?? null;

  // ── Upload panel ────────────────────────────────────────────────────────────
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadSummaryType = 'brief'; // 'brief' | 'detailed' | 'custom'
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

  function resetUpload() {
    uploadFile = null;
    uploadPasteText = '';
    uploadUserNotes = '';
    uploadAgenda = '';
    uploadError = null;
    uploadInputTab = 'upload';
    uploadSummaryType = 'brief';
    showExtras = false;
    uploadProcessing = false;
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
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the transcript text.'; return; }

    uploadProcessing = true;
    uploadError = null;
    try {
      const result = await processInternalNote(meetingType, {
        file: uploadInputTab === 'upload' ? uploadFile : null,
        text: uploadInputTab === 'paste' ? uploadPasteText : null,
        userNotes: uploadUserNotes.trim() || null,
        agenda: uploadAgenda.trim() || null,
        summaryType: uploadSummaryType,
        customPrompt: uploadSummaryType === 'custom' ? uploadCustomPrompt.trim() || null : null
      });

      // Auto-save suggested actions immediately
      const saved = await Promise.all(
        (result.suggestedActions || []).map(a => createStandaloneAction(result.transcript.id, {
          action_text: a.action_text,
          owner: a.owner || null,
          due_date: a.due_date || null,
          notes: a.notes || null
        }))
      );

      const newNote = {
        id: result.transcript.id,
        title: result.transcript.title,
        meeting_date: result.transcript.meeting_date,
        attendees_text: result.transcript.attendees_text,
        file_name: result.transcript.file_name,
        created_at: result.transcript.created_at,
        meeting_type: result.transcript.meeting_type,
        summary_id: result.summary?.id,
        summary_html: result.summary?.summary_html,
        pending_count: saved.length,
        complete_count: 0
      };

      notes = [newNote, ...notes];
      resetUpload();
      loadStream();

      // If the backend extracted policy updates / CPD topics, show the preview modal
      if (result.extractedInsights?.length > 0) {
        openInsightsPreview(result.transcript.id, meetingType, result.extractedInsights);
      }
    } catch (err) {
      uploadError = err.message;
    } finally {
      uploadProcessing = false;
    }
  }

  async function removeNote(id) {
    if (!confirm('Delete this meeting note and all its actions?')) return;
    try {
      await deleteMeetingNote(id);
      notes = notes.filter(n => n.id !== id);
      streamNotes = streamNotes.filter(n => n.id !== id);
      if (editorNote?.id === id) editorNote = null;
    } catch (err) {
      alert(err.message);
    }
  }

  // Inline edit — note metadata
  let editingNoteId = null;
  let noteEditForm = { title: '', meeting_date: '', attendees_text: '' };

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
      const patch = { title: updated.title, meeting_date: updated.meeting_date, attendees_text: updated.attendees_text };
      notes = notes.map(n => n.id === noteId ? { ...n, ...patch } : n);
      streamNotes = streamNotes.map(n => n.id === noteId ? { ...n, ...patch } : n);
      editingNoteId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Stream ──────────────────────────────────────────────────────────────────
  let streamNotes = [];
  let streamLoading = false;
  let streamError = null;
  let streamTab = 'all'; // 'all' | 'internal' | 'cpd' | 'project'

  $: filteredStream = streamTab === 'all'
    ? streamNotes
    : streamNotes.filter(n => n.meeting_type === streamTab);

  async function loadStream() {
    streamLoading = true;
    streamError = null;
    try {
      streamNotes = await getAllMeetingNotes();
    } catch (err) {
      streamError = err.message;
    } finally {
      streamLoading = false;
    }
  }

  onMount(() => {
    loadNotes();
    loadStream();
  });

  // ── Note editor modal ───────────────────────────────────────────────────────
  let editorNote = null;
  let editorIsNew = false;
  let editorInitialHtml = '';
  let editorSaving = false;
  let editorActions = []; // actions for the note currently open in editor
  let richTextEditor;

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
    return html.replace(/<h3[^>]*>\s*Actions\s*<\/h3>\s*<table[\s\S]*?<\/table>/i, '').trim();
  }

  async function openNoteEditor(note, suggestedActions = null) {
    // Resolve all async work BEFORE setting editorNote, so the modal
    // mounts the RichTextEditor only once the content is ready.
    let initialHtml = '';
    let loadedActions = [];

    if (suggestedActions !== null) {
      const actionsHtml = suggestedActions.length ? buildActionsHtml(suggestedActions) : '';
      initialHtml = (note.summary_html || '') + actionsHtml;
    } else {
      try {
        loadedActions = await getMeetingNoteActions(note.id);
      } catch {
        loadedActions = [];
      }
      const baseHtml = stripActionsTable(note.summary_html || '');
      initialHtml = baseHtml + (loadedActions.length ? buildActionsHtml(loadedActions) : '');
    }

    editorActions = loadedActions;
    editorInitialHtml = initialHtml;
    editorIsNew = suggestedActions !== null;
    editorNote = note; // set last — triggers modal render with content already populated
  }

  function closeNoteEditor() {
    editorNote = null;
    editorIsNew = false;
    editorInitialHtml = '';
    editorActions = [];
  }

  async function saveNoteEditor() {
    if (!editorNote) return;
    editorSaving = true;
    try {
      const html = richTextEditor?.getHTML() ?? editorNote.summary_html;
      const updated = await updateMeetingSummary(editorNote.id, html);

      const patch = { summary_html: updated.summary_html };
      notes = notes.map(n => n.id === editorNote.id ? { ...n, ...patch } : n);
      streamNotes = streamNotes.map(n => n.id === editorNote.id ? { ...n, ...patch } : n);

      const parsedActions = parseActionsFromHtml(html);
      const isProjectNote = editorNote.meeting_type === 'project';

      if (editorIsNew) {
        const saved = await Promise.all(
          parsedActions.map(a => isProjectNote
            ? createMeetingAction(editorNote.project_id, { ...a, transcript_id: editorNote.id })
            : createStandaloneAction(editorNote.id, a)
          )
        );
        const pendingCount = saved.length;
        notes = notes.map(n => n.id === editorNote.id ? { ...n, pending_count: pendingCount } : n);
        streamNotes = streamNotes.map(n => n.id === editorNote.id ? { ...n, pending_count: pendingCount } : n);
      } else if (parsedActions.length > 0) {
        for (const p of parsedActions) {
          const match = editorActions.find(a => a.action_text === p.action_text);
          if (match) {
            await updateMeetingAction(match.id, { action_text: p.action_text, owner: p.owner, due_date: p.due_date, notes: p.notes });
          } else {
            if (isProjectNote) {
              await createMeetingAction(editorNote.project_id, { ...p, transcript_id: editorNote.id });
            } else {
              await createStandaloneAction(editorNote.id, p);
            }
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
    await exportHtmlToWord(exportHtml, `${title}${dateStr ? ` ${dateStr}` : ''}`, '/basicdocument.docx');
  }

  async function downloadNote(note) {
    const title = note.title || 'Meeting Notes';
    const dateStr = note.meeting_date
      ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, note.attendees_text].filter(Boolean).join(' · ');
    const html = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${note.summary_html || '<p>No summary available.</p>'}`;
    await exportHtmlToWord(html, `${title}${dateStr ? ` ${dateStr}` : ''}`, '/basicdocument.docx');
  }

  // ── Insights preview ────────────────────────────────────────────────────────
  // Set after processInternalNote when extractedInsights are returned.
  // Shape: { transcriptId, meetingType, items: [...], selected: Set<number> }
  let insightsPreview = null;
  let insightsSaving = false;

  function openInsightsPreview(transcriptId, meetingType, items) {
    insightsPreview = {
      transcriptId,
      meetingType,
      items,
      selected: new Set(items.map((_, i) => i)), // all selected by default
    };
  }

  function toggleInsight(index) {
    const next = new Set(insightsPreview.selected);
    if (next.has(index)) next.delete(index); else next.add(index);
    insightsPreview = { ...insightsPreview, selected: next };
  }

  async function confirmInsights() {
    if (!insightsPreview) return;
    const toSave = insightsPreview.items.filter((_, i) => insightsPreview.selected.has(i));
    if (toSave.length === 0) { insightsPreview = null; return; }
    insightsSaving = true;
    try {
      await saveExtractedInsights(insightsPreview.transcriptId, toSave);
    } catch (err) {
      alert('Failed to save insights: ' + err.message);
    } finally {
      insightsSaving = false;
      insightsPreview = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const TYPE_LABELS = { internal: 'Internal', cpd: 'CPD', project: 'Project' };
  const TYPE_COLORS = { internal: 'badge-blue', cpd: 'badge-purple', project: 'badge-teal' };
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleWindowKeydown} />

<div class="mn-page">
  <a href="/" class="home-button" title="Back to Home">
    <i class="las la-home"></i>
    <span>Home</span>
  </a>

  <!-- Page header -->
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <i class="las la-file-signature"></i>
        Meeting Notes
      </h1>
      <p class="page-description">
        Process and manage meeting notes, CPD records, and project meetings in one place
      </p>
    </div>
  </div>

  <!-- Workspace -->
  <div class="workspace-container">
    <div class="workspace-tabs">
      <div class="mn-note-type-dropdown" bind:this={noteTypeDropdownEl}>
        <button
          type="button"
          class="mn-note-type-select"
          class:mn-note-type-select--unset={!meetingType}
          aria-haspopup="listbox"
          aria-expanded={noteTypeMenuOpen}
          on:click={() => noteTypeMenuOpen = !noteTypeMenuOpen}
        >
          <span>{selectedNoteTypeOption ? selectedNoteTypeOption.label : 'Select a note type…'}</span>
          <i class="las la-{noteTypeMenuOpen ? 'angle-up' : 'angle-down'}"></i>
        </button>
        {#if noteTypeMenuOpen}
          <div class="mn-note-type-menu" role="listbox">
            {#each noteTypeOptions as opt (opt.value)}
              <button
                type="button"
                class="mn-note-type-option"
                class:mn-note-type-option--active={meetingType === opt.value}
                role="option"
                aria-selected={meetingType === opt.value}
                on:click={() => switchType(opt.value)}
              >
                <span class="mn-note-type-option-label">{opt.label}</span>
                <span class="mn-note-type-option-desc">{opt.description}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {#if !meetingType}
        <p class="mn-type-placeholder">Choose a note type above to enable the workspace below.</p>
      {/if}
    </div>

    <div class="workspace-body">

    {#if meetingType === 'project'}
      <div class="project-selector-wrap">
        <ProjectSelector
          bind:this={projectSelectorComponent}
          bind:selectedProjectId={selectedProjectIdBinding}
          label="Select Project"
          hideOneOffOption={true}
          hideModeRow={true}
          showDivider={false}
          on:projectSelected={handleProjectSelected}
          on:createNewProject={() => showCreateProjectModal = true}
        />
      </div>
      {#if selectedProject}
        {#key selectedProject.id}
          <MeetingNotesTab project={selectedProject} />
        {/key}
      {/if}

    {:else}
      <!-- Internal / CPD workspace — shown by default (greyed while unset)
           since it's the simpler of the two non-project types. -->
      <div class="mn-upload-form" class:mn-upload-form--disabled={!meetingType} inert={!meetingType}>
      <div class="mn-top-row">

        <!-- Upload card -->
        <div class="mn-upload-card">
          <h3 class="mn-card-title">
            Add {meetingType === 'cpd' ? 'CPD' : 'Meeting'} Notes
          </h3>

          <div class="mn-type-row">
            <span class="mn-type-label">Summary</span>
            <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'brief'} class:btn-secondary={uploadSummaryType !== 'brief'} on:click={() => uploadSummaryType = 'brief'}>
              Brief <span class="mn-type-sub">· 1 page</span>
            </button>
            <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'detailed'} class:btn-secondary={uploadSummaryType !== 'detailed'} on:click={() => uploadSummaryType = 'detailed'}>
              Detailed <span class="mn-type-sub">· 3-4 pages</span>
            </button>
            <button class="btn btn-sm" class:btn-primary={uploadSummaryType === 'custom'} class:btn-secondary={uploadSummaryType !== 'custom'} on:click={() => { uploadSummaryType = 'custom'; showExtras = true; }}>
              Custom
            </button>
          </div>

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
            <textarea class="form-input mn-paste" bind:value={uploadPasteText} placeholder="Paste the {meetingType === 'cpd' ? 'CPD notes' : 'meeting transcript'} here…" rows="3"></textarea>
          {/if}

          <button class="btn btn-ghost btn-sm mn-extras-toggle" on:click={() => showExtras = !showExtras}>
            <i class="las la-{showExtras ? 'angle-up' : 'angle-right'}"></i>
            {showExtras ? 'Hide' : 'Show'} optional extras
          </button>
          {#if showExtras}
            <div class="form-row">
              <div class="form-group">
                <label>{meetingType === 'cpd' ? 'Agenda / Programme' : 'Agenda'}</label>
                <textarea class="form-input" bind:value={uploadAgenda} rows="3" placeholder="Paste the agenda…"></textarea>
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea class="form-input" bind:value={uploadUserNotes} rows="3" placeholder="Your own notes, included verbatim in the summary…"></textarea>
              </div>
            </div>
            {#if uploadSummaryType === 'custom'}
              <div class="form-group">
                <label>Custom Instructions</label>
                <textarea class="form-input" bind:value={uploadCustomPrompt} rows="3" placeholder="e.g. Produce a concise bullet-point summary…"></textarea>
              </div>
            {/if}
          {/if}

          {#if uploadError}<div class="mn-error">{uploadError}</div>{/if}

          <button class="btn btn-primary mn-process-btn" on:click={submitUpload} disabled={uploadProcessing}>
            {#if uploadProcessing}
              <span class="mn-spinner"></span> Processing…
            {:else}
              <i class="las la-magic"></i> Process {meetingType === 'cpd' ? 'CPD' : 'Meeting'} Notes
            {/if}
          </button>
        </div>

        <!-- Latest note card -->
        <div class="mn-latest-card">
          {#if notesLoading}
            <div class="mn-loading"><span class="mn-spinner-blue"></span></div>
          {:else if latestNote}
            <div class="mn-latest-card-inner">
              <div class="mn-latest-card-top">
                <span class="mn-card-label">Latest {meetingType === 'cpd' ? 'CPD' : 'Meeting'}</span>
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
              <p>No {meetingType === 'cpd' ? 'CPD records' : 'meetings'} yet.<br>Upload or paste above to get started.</p>
            </div>
          {/if}
        </div>

      </div>

      <!-- All notes (collapsible) -->
      {#if !notesError}
        <div class="mn-section mn-section-muted">
          <button class="mn-concertina-btn" on:click={() => showAllNotes = !showAllNotes}>
            <i class="las la-{showAllNotes ? 'angle-up' : 'angle-down'}"></i>
            All {meetingType === 'cpd' ? 'CPD Records' : 'Meeting Notes'} ({notes.length})
          </button>

          {#if showAllNotes}
            {#if notes.length === 0}
              <p class="mn-empty mn-table-mt">Nothing here yet.</p>
            {:else}
              <div class="mn-notes-list mn-table-mt">
                {#each notes as note (note.id)}
                  <div class="mn-note-card">
                    {#if editingNoteId === note.id}
                      <div class="mn-note-edit-form">
                        <div class="form-row-3">
                          <div class="form-group form-group-wide">
                            <label>Title</label>
                            <input type="text" class="form-input" bind:value={noteEditForm.title} />
                          </div>
                          <div class="form-group">
                            <label>Date</label>
                            <input type="date" class="form-input" bind:value={noteEditForm.meeting_date} />
                          </div>
                          <div class="form-group">
                            <label>Attendees</label>
                            <input type="text" class="form-input" bind:value={noteEditForm.attendees_text} />
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
                          {#if note.meeting_date}<span class="mn-cell-muted">{formatDate(note.meeting_date)}</span>{/if}
                          {#if note.attendees_text}<span class="mn-cell-dim">{note.attendees_text}</span>{/if}
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
                          <i class="las la-eye"></i> View
                        </button>
                        <button class="btn btn-secondary btn-sm" on:click={() => toggleTranscript(note.id)}>
                          <i class="las la-file-alt"></i> {expandedTranscripts.has(note.id) ? 'Hide' : 'Transcript'}
                        </button>
                        <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(note)}>
                          <i class="las la-download"></i> Download
                        </button>
                        <button class="btn btn-icon btn-ghost" on:click={() => startEditNote(note)} title="Edit details">
                          <i class="las la-pen"></i>
                        </button>
                        <button class="btn btn-icon btn-danger-ghost" on:click={() => removeNote(note.id)} title="Delete">
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
      </div>

    {/if}
    </div><!-- end workspace-body -->
  </div><!-- end workspace-container -->

  <!-- Stream -->
  <div class="stream-container">
    <div class="stream-header">
      <h2 class="stream-title">All Meeting Notes</h2>
    </div>

    <div class="stream-tabs">
      {#each [['all', 'All'], ['internal', 'Internal'], ['cpd', 'CPD'], ['project', 'Project']] as [key, label]}
        <button
          class="stream-tab"
          class:stream-tab--active={streamTab === key}
          on:click={() => streamTab = key}
        >
          {label}
          {#if key !== 'all'}
            <span class="stream-tab-count">
              {streamNotes.filter(n => n.meeting_type === key).length}
            </span>
          {:else}
            <span class="stream-tab-count">{streamNotes.length}</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if streamLoading}
      <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading…</div>
    {:else if streamError}
      <div class="mn-error">{streamError}</div>
    {:else if filteredStream.length === 0}
      <div class="stream-empty">
        <i class="las la-inbox"></i>
        <p>No {streamTab === 'all' ? '' : TYPE_LABELS[streamTab] + ' '}notes yet.</p>
      </div>
    {:else}
      <div class="stream-list">
        {#each filteredStream as note (note.id)}
          <div class="stream-card">
            <div class="stream-card-main">
            <div class="stream-card-left">
              <div class="stream-card-top">
                <span class="type-badge {TYPE_COLORS[note.meeting_type] ?? 'badge-gray'}">
                  {TYPE_LABELS[note.meeting_type] ?? note.meeting_type}
                </span>
                {#if note.project_name}
                  <span class="stream-project-name">{note.project_name}</span>
                {/if}
              </div>
              <div class="stream-card-title">{note.title}</div>
              <div class="stream-card-meta">
                {#if note.meeting_date}<span>{formatDate(note.meeting_date)}</span>{/if}
                {#if note.attendees_text}<span class="mn-cell-dim">{note.attendees_text}</span>{/if}
              </div>
            </div>
            <div class="stream-card-right">
              {#if Number(note.pending_count) > 0}
                <span class="mn-badge mn-badge-warn">{note.pending_count} open</span>
              {/if}
              {#if Number(note.complete_count) > 0}
                <span class="mn-badge mn-badge-ok">{note.complete_count} done</span>
              {/if}
              <button class="btn btn-secondary btn-sm" on:click={() => openNoteEditor(note)}>
                <i class="las la-eye"></i> View
              </button>
              <button class="btn btn-secondary btn-sm" on:click={() => toggleTranscript(note.id)} title="Full transcript">
                <i class="las la-file-alt"></i> {expandedTranscripts.has(note.id) ? 'Hide' : 'Transcript'}
              </button>
              <button class="btn btn-secondary btn-sm" on:click={() => downloadNote(note)}>
                <i class="las la-download"></i>
              </button>
              <button class="btn btn-icon btn-danger-ghost" on:click={() => removeNote(note.id)} title="Delete note">
                <i class="las la-trash"></i>
              </button>
            </div>
            </div><!-- end stream-card-main -->

          {#if expandedTranscripts.has(note.id)}
            <div class="mn-transcript stream-transcript">
              {#if transcriptData[note.id]?.loading}
                <span class="mn-spinner-blue"></span> Loading transcript…
              {:else if transcriptData[note.id]?.error}
                <span class="mn-error-sm">{transcriptData[note.id].error}</span>
              {:else if transcriptData[note.id]?.text}
                <pre class="mn-transcript-text">{transcriptData[note.id].text}</pre>
              {/if}
            </div>
          {/if}
          </div><!-- end stream-card -->
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create project modal -->
<AddProjectModal
  isOpen={showCreateProjectModal}
  onClose={() => showCreateProjectModal = false}
  onProjectCreated={handleProjectCreated}
/>

<!-- Insights preview modal -->
{#if insightsPreview}
  <div class="modal-backdrop" role="dialog">
    <div class="mn-modal mn-insights-modal">

      <div class="modal-header">
        <div>
          <h2 class="mn-modal-title">
            {#if insightsPreview.meetingType === 'cpd'}
              CPD Topics Extracted
            {:else}
              Policy Updates Extracted
            {/if}
          </h2>
          <p class="mn-modal-meta">
            {insightsPreview.items.length} item{insightsPreview.items.length !== 1 ? 's' : ''} found.
            Deselect any you don't want to save.
          </p>
        </div>
        <button class="btn btn-icon btn-ghost close-btn" on:click={() => insightsPreview = null} disabled={insightsSaving}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="mn-insights-body">
        {#each insightsPreview.items as item, i}
          <label class="insight-card" class:insight-card--unchecked={!insightsPreview.selected.has(i)}>
            <input
              type="checkbox"
              class="insight-checkbox"
              checked={insightsPreview.selected.has(i)}
              on:change={() => toggleInsight(i)}
            />
            <div class="insight-content">
              <div class="insight-topic">{item.topic}</div>
              {#if item.raised_by}
                <div class="insight-raised">Raised by {item.raised_by}</div>
              {/if}
              {#if item.detail}
                <div class="insight-detail">{item.detail}</div>
              {/if}
            </div>
          </label>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" on:click={() => insightsPreview = null} disabled={insightsSaving}>
          Skip, don't save
        </button>
        <button class="btn btn-primary" on:click={confirmInsights} disabled={insightsSaving || insightsPreview.selected.size === 0}>
          {#if insightsSaving}
            <span class="mn-spinner"></span> Saving…
          {:else}
            <i class="las la-check"></i>
            Save {insightsPreview.selected.size} item{insightsPreview.selected.size !== 1 ? 's' : ''}
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- Note editor modal -->
{#if editorNote}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && !editorSaving && closeNoteEditor()}>
    <div class="mn-modal mn-editor-modal">

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

      <div class="mn-editor-body">
        <RichTextEditor
          bind:this={richTextEditor}
          content={editorInitialHtml}
          placeholder="Meeting summary…"
          fullHeight={true}
        />
      </div>

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

<style>
  /* ── Page ──────────────────────────────────────────────────────────────────── */
  .mn-page {
    min-height: 100vh;
    background: var(--color-slate-50);
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
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    color: var(--color-slate-800);
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
    z-index: 10;
  }
  .home-button:hover { background: var(--color-slate-100); border-color: var(--color-slate-300); }
  .home-button i { font-size: 1.125rem; }

  .page-header { margin-bottom: 2rem; }
  .header-content { max-width: 1400px; margin: 0 auto; }

  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-slate-800);
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .page-title i { font-size: 2.5rem; color: var(--color-violet-600); }

  .page-description { font-size: 1.125rem; color: var(--color-slate-500); margin: 0; }

  /* ── Workspace (tabbed card) ───────────────────────────────────────────────── */
  .workspace-container {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 12px;
    overflow: hidden;
  }

  .workspace-tabs {
    padding: 1rem 1.5rem;
    background: var(--color-slate-50);
    border-bottom: 2px solid var(--color-slate-200);
    border-radius: 12px 12px 0 0;
  }

  /* ── Note-type dropdown — same pattern as the per-project Meeting Notes
     tab's Add Note selector: closed control shows just the name, the
     open list shows a description to help pick. Nothing else in the
     workspace is interactive until this is set. ─────────────────────── */
  .mn-note-type-dropdown { position: relative; max-width: 360px; z-index: 5; }
  .mn-note-type-select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--color-slate-800);
    background: var(--color-white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    text-align: left;
  }
  .mn-note-type-select:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
  /* Unset is the state that needs attention — pick me — so it gets the
     loud styling. Once chosen, the control settles into the calmer
     look above; the greyed-out workspace below stays the quiet part. */
  .mn-note-type-select--unset {
    color: var(--color-violet-700);
    font-weight: 700;
    border: 1.5px solid var(--color-violet-600);
    background: var(--color-violet-50);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
  }
  .mn-note-type-menu {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    z-index: 20;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .mn-note-type-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .mn-note-type-option:hover { background: var(--color-slate-100); }
  .mn-note-type-option--active { background: var(--color-violet-50); }
  .mn-note-type-option-label { font-size: 0.85rem; font-weight: 600; color: var(--color-slate-800); }
  .mn-note-type-option-desc { font-size: 0.75rem; color: var(--color-slate-500); line-height: 1.35; }
  .mn-type-placeholder { color: var(--color-slate-400); font-size: 0.78rem; margin: 0.5rem 0 0; }

  /* Workspace body — greyed out and inert until a note type is chosen */
  .mn-upload-form--disabled { opacity: 0.45; filter: grayscale(0.4); }

  .workspace-body { padding: 1.5rem; }

  .project-selector-wrap { max-width: 700px; margin-bottom: 1.5rem; }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--color-slate-400);
  }
  .empty-state i { font-size: 3.5rem; display: block; margin-bottom: 0.75rem; }
  .empty-state h2 { font-size: 1.25rem; font-weight: 600; color: var(--color-slate-600); margin: 0 0 0.5rem; }
  .empty-state p { font-size: 0.9rem; margin: 0; }

  /* ── Top row (internal/cpd) ────────────────────────────────────────────────── */
  .mn-top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: stretch;
    margin-bottom: 1rem;
  }

  .mn-upload-card, .mn-latest-card {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .mn-card-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); margin: 0; }
  .mn-process-btn { width: 100%; }

  .mn-latest-card-inner { display: flex; flex-direction: column; gap: 0.4rem; height: 100%; }
  .mn-latest-card-top { display: flex; align-items: center; justify-content: space-between; }
  .mn-card-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-slate-400); }
  .mn-latest-title { font-size: 0.9375rem; font-weight: 600; color: var(--color-slate-800); line-height: 1.3; }
  .mn-latest-meta-row { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; font-size: 0.8rem; }
  .mn-latest-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .mn-latest-card-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; padding-top: 0.35rem; }
  .mn-latest-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; height: 100%; min-height: 80px; color: var(--color-slate-400); text-align: center; }
  .mn-latest-empty i { font-size: 1.5rem; }
  .mn-latest-empty p { font-size: 0.8rem; margin: 0; line-height: 1.4; }

  /* ── Sections ──────────────────────────────────────────────────────────────── */
  .mn-section { background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: 8px; padding: 1rem 1.25rem; }
  .mn-section-muted { background: var(--color-slate-50); }

  .mn-concertina-btn {
    background: none; border: none; cursor: pointer;
    font-size: 0.875rem; font-weight: 600; color: var(--color-slate-600);
    display: flex; align-items: center; gap: 0.4rem; padding: 0; font-family: inherit;
  }
  .mn-concertina-btn:hover { color: var(--color-slate-800); }

  /* ── Note cards ────────────────────────────────────────────────────────────── */
  .mn-notes-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .mn-note-card { background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.75rem 1rem; }
  .mn-note-info { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
  .mn-note-meta { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; }
  .mn-note-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }
  .mn-note-badges-row { display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; }
  .mn-note-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin-top: 0.6rem; }
  .mn-note-edit-form { display: flex; flex-direction: column; gap: 0.6rem; }

  /* ── Stream ────────────────────────────────────────────────────────────────── */
  .stream-container {
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .stream-header { margin-bottom: 1rem; }
  .stream-title { font-size: 1.125rem; font-weight: 700; color: var(--color-slate-800); margin: 0; }

  .stream-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-slate-200);
    margin-bottom: 1rem;
  }

  .stream-tab {
    background: none; border: none; cursor: pointer;
    padding: 0.5rem 1rem;
    font-size: 0.875rem; font-weight: 500; color: var(--color-slate-500);
    display: flex; align-items: center; gap: 0.4rem;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .stream-tab:hover { color: var(--color-slate-800); }
  .stream-tab--active { color: var(--color-violet-600); border-bottom-color: var(--color-violet-600); font-weight: 600; }

  .stream-tab-count {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.05rem 0.4rem;
    border-radius: 8px;
    min-width: 1.2rem;
    text-align: center;
  }

  .stream-empty { text-align: center; padding: 3rem 1rem; color: var(--color-slate-400); }
  .stream-empty i { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }
  .stream-empty p { margin: 0; font-size: 0.875rem; }

  .stream-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .stream-card {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    overflow: hidden;
    transition: background 0.12s;
  }
  .stream-card:hover { background: var(--color-slate-100); }

  .stream-card-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .stream-card-left { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
  .stream-card-top { display: flex; align-items: center; gap: 0.5rem; }
  .stream-project-name { font-size: 0.75rem; color: var(--color-slate-500); }
  .stream-card-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }
  .stream-card-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.75rem; font-size: 0.8rem; color: var(--color-slate-500); }

  .stream-card-right { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; flex-wrap: wrap; }

  /* Type badges */
  .type-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge-blue   { background: var(--color-primary-50); color: var(--color-primary-700); }
  .badge-purple { background: var(--color-violet-50); color: var(--color-violet-700); }
  .badge-teal   { background: var(--color-slate-100); color: var(--color-emerald-600); }
  .badge-gray   { background: var(--color-slate-100); color: var(--color-slate-600); }

  /* ── Form helpers ──────────────────────────────────────────────────────────── */
  .form-input {
    width: 100%; padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300); border-radius: 6px;
    font-size: 0.875rem; font-family: inherit; color: var(--color-slate-800); background: var(--color-white);
    box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-input:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1); }
  textarea.form-input { resize: vertical; line-height: 1.5; }

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .form-row-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-group-wide { grid-column: 1 / -1; }
  .form-group label { font-size: 0.8rem; font-weight: 500; color: var(--color-slate-700); }

  .mn-form-footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }

  /* Upload panel */
  .mn-type-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .mn-type-label { font-size: 0.8rem; color: var(--color-slate-500); white-space: nowrap; }
  .mn-type-sub { font-size: 0.7rem; opacity: 0.8; }
  .mn-input-tabs { display: flex; gap: 0.35rem; }
  .mn-extras-toggle { font-size: 0.8rem; }

  .mn-drop-zone {
    border: 2px dashed var(--color-violet-200); border-radius: 6px; padding: 0.75rem 1rem;
    text-align: center; cursor: pointer; color: var(--color-slate-500); font-size: 0.875rem;
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mn-drop-zone:hover, .mn-drop-zone.drag-over { background: var(--color-violet-50); border-color: var(--color-violet-600); }
  .mn-drop-icon { font-size: 1.4rem; color: var(--color-violet-300); }
  .mn-drop-filename { font-weight: 600; color: var(--color-slate-800); font-size: 0.875rem; }
  .mn-drop-hint { font-size: 0.75rem; color: var(--color-slate-400); }
  .mn-paste { min-height: 72px; }

  /* ── Badges ────────────────────────────────────────────────────────────────── */
  .mn-badge { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 10px; white-space: nowrap; }
  .mn-badge-warn { background: var(--color-amber-100); color: var(--color-amber-800); }
  .mn-badge-ok   { background: var(--color-emerald-100); color: var(--color-green-800); }

  /* ── States ────────────────────────────────────────────────────────────────── */
  .mn-empty { color: var(--color-slate-400); font-size: 0.875rem; padding: 0.5rem 0; margin: 0; }
  .mn-error { background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: 6px; padding: 0.6rem 0.85rem; color: var(--color-red-800); font-size: 0.875rem; }
  .mn-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); font-size: 0.875rem; padding: 2rem; justify-content: center; }
  .mn-table-mt { margin-top: 0.75rem; }

  /* ── Transcript ────────────────────────────────────────────────────────────── */
  .mn-transcript {
    margin-top: 0.6rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-slate-100);
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }
  .stream-transcript {
    margin-top: 0;
    padding: 0 1rem 0.75rem;
    border-top: 1px solid var(--color-slate-200);
  }
  .mn-transcript-text {
    font-family: inherit;
    font-size: 0.8rem;
    color: var(--color-slate-600);
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
    max-height: 360px;
    overflow-y: auto;
    background: var(--color-slate-50);
    border-radius: 4px;
    padding: 0.75rem;
  }
  .mn-error-sm { color: var(--color-red-600); font-size: 0.8rem; }

  /* ── Text helpers ──────────────────────────────────────────────────────────── */
  .mn-cell-muted { color: var(--color-slate-500); font-size: 0.8rem; }
  .mn-cell-dim { color: var(--color-slate-400); font-size: 0.78rem; }

  /* ── Spinners ──────────────────────────────────────────────────────────────── */
  .mn-spinner {
    display: inline-block; width: 0.85rem; height: 0.85rem;
    border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: var(--color-white);
    border-radius: 50%; animation: mn-spin 0.7s linear infinite;
  }
  .mn-spinner-blue {
    display: inline-block; width: 0.9rem; height: 0.9rem;
    border: 2px solid var(--color-slate-200); border-top-color: var(--color-violet-600);
    border-radius: 50%; animation: mn-spin 0.7s linear infinite;
  }
  @keyframes mn-spin { to { transform: rotate(360deg); } }

  /* ── Editor modal ──────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed; inset: 0; background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
  }
  .mn-modal {
    background: var(--color-white); border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%; max-width: 720px; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .mn-editor-modal { max-width: 860px; height: 88vh; }

  .modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0;
  }
  .mn-editor-header { justify-content: space-between; }
  .mn-result-header-text { display: flex; align-items: flex-start; gap: 0.75rem; min-width: 0; }
  .mn-result-tick { font-size: 1.6rem; color: var(--color-green-500); line-height: 1; margin-top: 0.1rem; flex-shrink: 0; }
  .mn-editor-header-btns { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

  .mn-modal-title { font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); margin: 0 0 0.2rem; }
  .mn-modal-meta { font-size: 0.8rem; color: var(--color-slate-500); margin: 0; }
  .close-btn { flex-shrink: 0; }

  .mn-editor-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .mn-editor-body :global(.rich-text-editor) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .mn-editor-body :global(.editor-content) { flex: 1; min-height: 0; max-height: none; overflow-y: auto; }

  .modal-footer {
    display: flex; justify-content: flex-end; gap: 0.6rem;
    padding: 0.85rem 1.5rem; border-top: 1px solid var(--color-slate-200); background: var(--color-slate-50); flex-shrink: 0;
  }

  /* ── Insights preview modal ───────────────────────────────────────────────── */
  .mn-insights-modal { max-width: 680px; max-height: 82vh; }

  .mn-insights-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .insight-card {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .insight-card:hover { border-color: var(--color-violet-300); background: var(--color-purple-50); }
  .insight-card--unchecked { opacity: 0.5; background: var(--color-slate-50); }

  .insight-checkbox {
    margin-top: 0.2rem;
    width: 15px;
    height: 15px;
    accent-color: var(--color-violet-600);
    flex-shrink: 0;
    cursor: pointer;
  }

  .insight-content { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

  .insight-topic {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    line-height: 1.3;
  }

  .insight-raised {
    font-size: 0.75rem;
    color: var(--color-violet-600);
    font-weight: 500;
  }

  .insight-detail {
    font-size: 0.8rem;
    color: var(--color-slate-600);
    line-height: 1.55;
    margin-top: 0.1rem;
  }

  /* ── Responsive ────────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .mn-page { padding: 1rem; }
    .page-title { font-size: 2rem; }
    .page-title i { font-size: 2rem; }
    .mn-top-row { grid-template-columns: 1fr; }
    .stream-card { flex-direction: column; align-items: flex-start; }
    .stream-card-right { flex-wrap: wrap; }
  }
</style>
