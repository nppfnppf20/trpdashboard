<script>
  import { goto } from '$app/navigation';
  import { getMeetingNotes } from '$lib/api/meetingNotes.js';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import NoteEditorModal from '$lib/components/projects/NoteEditorModal.svelte';
  import TranscriptViewerModal from '$lib/components/projects/TranscriptViewerModal.svelte';
  import MeetingNoteProcessModal from './MeetingNoteProcessModal.svelte';
  import { openProjectModal } from '$lib/stores/projectViewModal.js';
  import { debounce } from '$lib/utils/debounce.js';

  export let project;
  // Optional — when set (non-empty), merges the recent-notes feed across all
  // these projects instead of just `project`. The page this powers is
  // read-only, so merged mode drops the upload/paste UI entirely (creating a
  // note against a specific project happens from that project's own tab).
  export let projects = null;
  $: merged = Array.isArray(projects) && projects.length > 0;
  $: projectList = merged ? projects : (project ? [project] : []);
  $: projectId = project?.id;

  let notes = [];
  let loading = true;
  let error = null;
  let dragOver = false;
  let fileInput;
  let inputMode = 'upload'; // 'upload' | 'paste'
  let pasteText = '';

  let editingNote = null;      // note object open in the editor modal, or null
  let viewingTranscript = null; // note object open in the transcript modal, or null

  // A file dropped or text pasted here opens MeetingNoteProcessModal right
  // over this page instead of navigating to the full Meeting Notes tab —
  // processFile/processText are its seed input; null hides the popup.
  let processFile = null;
  let processText = null;

  // Per-project cache so re-ticking an already-seen project in the merged
  // multi-select is instant, and debounced so a burst of quick ticks
  // collapses into one load instead of one per click.
  const cache = new Map();
  const scheduleLoad = debounce(load, 350);

  let loadedKey = null;
  $: {
    const key = projectList.map(p => p.id).sort((a, b) => a - b).join(',');
    if (key !== loadedKey) {
      loadedKey = key;
      if (cache.size === 0) load(); else scheduleLoad();
    }
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const missing = projectList.filter(p => !cache.has(p.id));
      if (missing.length) {
        const fetched = await Promise.all(missing.map(async (p) => {
          const all = await getMeetingNotes(p.id);
          const recent = [...(all || [])]
            .sort((a, b) => String(b.meeting_date || b.created_at || '').localeCompare(String(a.meeting_date || a.created_at || '')))
            .slice(0, 2)
            .map(n => ({ ...n, _project: p }));
          return [p.id, recent];
        }));
        for (const [id, recent] of fetched) cache.set(id, recent);
      }
      notes = projectList.flatMap(p => cache.get(p.id) || [])
        .sort((a, b) => String(b.meeting_date || b.created_at || '').localeCompare(String(a.meeting_date || a.created_at || '')));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handOffFile(file) {
    if (!file) return;
    processFile = file;
  }

  function handOffText() {
    if (!pasteText.trim()) return;
    processText = pasteText;
  }

  function closeProcessModal() {
    processFile = null;
    processText = null;
  }

  function handleProcessModalSaved() {
    // Drop the affected project's cache entry so the refresh actually picks
    // up the new note instead of serving the stale cached list.
    if (project) cache.delete(project.id);
    load(); // refresh the recent-notes preview once the new note is saved
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    handOffFile(e.dataTransfer?.files?.[0]);
  }

  function handleFileChange(e) {
    handOffFile(e.target.files?.[0]);
  }

  function viewNotes(n) {
    editingNote = n;
  }

  function viewTranscript(n) {
    viewingTranscript = n;
  }

  function handleNoteUpdated(updated) {
    notes = notes.map(n => n.id === updated.id ? { ...n, summary_html: updated.summary_html } : n);
  }

  async function downloadNote(n) {
    const title = n.title || 'Meeting Notes';
    const dateStr = n.meeting_date
      ? new Date(n.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, n.attendees_text].filter(Boolean).join(' · ');
    const html = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${n.summary_html || '<p>No summary available.</p>'}`;
    await exportHtmlToWord(html, buildExportFilename(n._project || project, `${title}${dateStr ? ` ${dateStr}` : ''}`), '/basicdocument.docx');
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-file-signature"></i>
      Meeting Notes
    </div>
    <button class="widget-expand" on:click={() => merged ? goto('/meeting-notes') : openProjectModal(projectId, 'meeting_notes', 'details')}>
      View all <i class="las la-angle-right"></i>
    </button>
  </div>
  <div class="widget-body mnw-body">
    {#if !merged}
      <div class="mnw-input-tabs">
        <button class="mnw-tab" class:active={inputMode === 'upload'} on:click={() => inputMode = 'upload'}>
          <i class="las la-upload"></i> Upload
        </button>
        <button class="mnw-tab" class:active={inputMode === 'paste'} on:click={() => inputMode = 'paste'}>
          <i class="las la-clipboard"></i> Paste Text
        </button>
      </div>

      {#if inputMode === 'upload'}
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
          class="mnw-drop-zone"
          class:drag-over={dragOver}
          role="button"
          tabindex="0"
          on:dragover|preventDefault={() => dragOver = true}
          on:dragleave={() => dragOver = false}
          on:drop={handleDrop}
          on:click={() => fileInput.click()}
          on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
        >
          <i class="las la-cloud-upload-alt mnw-drop-icon"></i>
          <span>Drop a file here or click to browse</span>
          <span class="mnw-drop-hint">PDF, DOCX or TXT</span>
        </div>
        <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
      {:else}
        <textarea class="form-input mnw-paste" bind:value={pasteText} placeholder="Paste the meeting transcript here…" rows="3"></textarea>
        <button class="btn btn-primary btn-sm mnw-process-btn" on:click={handOffText} disabled={!pasteText.trim()}>
          <i class="las la-magic"></i> Process
        </button>
      {/if}
    {/if}

    {#if loading}
      <div class="mnw-state">Loading…</div>
    {:else if error}
      <div class="mnw-state mnw-state-error">{error}</div>
    {:else}
      {#each notes as n}
        <div class="mnw-note">
          <div class="mnw-note-title">
            {n.title}
            {#if merged}<span class="badge badge-neutral mnw-project-tag">{n._project?.project_name}</span>{/if}
          </div>
          <div class="mnw-note-date">{formatDate(n.meeting_date || n.created_at)}</div>
          <div class="mnw-note-btns">
            <button class="mnw-note-btn" on:click={() => viewNotes(n)}><i class="las la-eye"></i> View Notes</button>
            <button class="mnw-note-btn" on:click={() => viewTranscript(n)}><i class="las la-file-alt"></i> Transcript</button>
            <button class="mnw-note-btn" on:click={() => downloadNote(n)}><i class="las la-download"></i> Download</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

{#if editingNote}
  <NoteEditorModal note={editingNote} project={editingNote._project || project} onClose={() => editingNote = null} onUpdated={handleNoteUpdated} />
{/if}

{#if viewingTranscript}
  <TranscriptViewerModal note={viewingTranscript} onClose={() => viewingTranscript = null} />
{/if}

{#if processFile || processText}
  <MeetingNoteProcessModal
    {project}
    initialFile={processFile}
    initialText={processText}
    onClose={closeProcessModal}
    onSaved={handleProcessModalSaved}
  />
{/if}

<style>
  .mnw-body { display: flex; flex-direction: column; gap: 8px; }
  .mnw-project-tag { margin-left: 6px; }

  .mnw-input-tabs { display: flex; gap: 5px; }
  .mnw-tab {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-500);
    cursor: pointer; font-family: inherit;
  }
  .mnw-tab:hover { background: var(--color-slate-50); }
  .mnw-tab.active { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-700); }

  .mnw-drop-zone {
    border: 2px dashed var(--color-primary-200);
    border-radius: 6px;
    padding: 0.65rem 0.75rem;
    text-align: center;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mnw-drop-zone:hover, .mnw-drop-zone.drag-over { background: var(--color-primary-50); border-color: var(--color-primary-500); }
  .mnw-drop-icon { font-size: 1.15rem; color: var(--color-primary-200); }
  .mnw-drop-hint { font-size: 9.5px; color: var(--color-slate-400); }

  .mnw-paste { font-size: 11px; resize: vertical; }
  .mnw-process-btn { align-self: flex-start; }

  .mnw-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.25rem 0; }
  .mnw-state-error { color: var(--color-red-600); }

  .mnw-note + .mnw-note { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--color-slate-100); }
  .mnw-note-title { font-size: 12px; font-weight: 600; color: var(--color-slate-900); }
  .mnw-note-date { font-size: 10px; color: var(--color-slate-400); margin-bottom: 4px; }

  .mnw-note-btns { display: flex; flex-wrap: wrap; gap: 5px; }
  .mnw-note-btn {
    display: flex; align-items: center; gap: 3px;
    padding: 2px 7px; border-radius: 5px;
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.625rem; font-weight: 600; color: var(--color-slate-600);
    cursor: pointer; font-family: inherit;
  }
  .mnw-note-btn:hover { background: var(--color-slate-50); color: var(--color-slate-800); }
</style>
