<script>
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { updateMeetingSummary } from '$lib/api/meetingNotes.js';

  export let note;
  export let project;
  export let onClose;
  export let onUpdated; // (updatedNote) => void

  let editorSaving = false;
  let richTextEditor;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function save() {
    editorSaving = true;
    try {
      const html = richTextEditor?.getHTML() ?? note.summary_html;
      const updated = await updateMeetingSummary(note.id, html);
      onUpdated({ ...note, summary_html: updated.summary_html });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      editorSaving = false;
    }
  }

  async function download() {
    const title = note.title || 'Meeting Notes';
    const dateStr = note.meeting_date
      ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const metaLine = [dateStr, note.attendees_text].filter(Boolean).join(' · ');
    const html = richTextEditor?.getHTML() ?? note.summary_html ?? '';
    const exportHtml = `<h1>${title}</h1>${metaLine ? `<p>${metaLine}</p>` : ''}${html}`;
    await exportHtmlToWord(exportHtml, buildExportFilename(project, `${title}${dateStr ? ` ${dateStr}` : ''}`), '/basicdocument.docx');
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && !editorSaving && onClose()}>
  <div class="mn-modal mn-editor-modal">

    <div class="modal-header mn-editor-header">
      <div>
        <h2 class="mn-modal-title">{note.title}</h2>
        <p class="mn-modal-meta">
          {formatDate(note.meeting_date)}
          {#if note.attendees_text} &bull; {note.attendees_text}{/if}
        </p>
      </div>
      <div class="mn-editor-header-btns">
        <button class="btn btn-secondary btn-sm" on:click={download} disabled={editorSaving}>
          <i class="las la-download"></i> Download
        </button>
        <button class="btn btn-icon btn-ghost close-btn" on:click={onClose} disabled={editorSaving}>
          <i class="las la-times"></i>
        </button>
      </div>
    </div>

    <div class="mn-editor-body">
      <RichTextEditor
        bind:this={richTextEditor}
        content={note.summary_html || ''}
        placeholder="Meeting summary…"
        fullHeight={false}
      />
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" on:click={onClose} disabled={editorSaving}>
        Close
      </button>
      <button class="btn btn-primary" on:click={save} disabled={editorSaving}>
        {#if editorSaving}
          <span class="mn-spinner"></span> Saving…
        {:else}
          <i class="las la-save"></i> Save changes
        {/if}
      </button>
    </div>

  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .mn-modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .mn-editor-modal { max-width: 860px; height: 88vh; }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .mn-editor-header { justify-content: space-between; }
  .mn-editor-header-btns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .mn-modal-title { font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); margin: 0 0 0.2rem; }
  .mn-modal-meta { font-size: 0.8rem; color: var(--color-slate-500); margin: 0; }
  .close-btn { flex-shrink: 0; }

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

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    flex-shrink: 0;
  }

  .mn-spinner {
    display: inline-block;
    width: 0.85rem; height: 0.85rem;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: var(--color-white);
    border-radius: 50%;
    animation: mn-spin 0.7s linear infinite;
  }
  @keyframes mn-spin { to { transform: rotate(360deg); } }
</style>
