<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getDeliverableAsHTML, updateDeliverableFromHTML, updateDeliverable, incorporateDeliverableTargeted } from '$lib/services/planningDeliverablesApi.js';
  import { exportDeliverableToWord } from '$lib/services/planningDeliverablesExport.js';
  import RichTextEditor from './RichTextEditor.svelte';
  import SelectionPopup from '$lib/components/planning-application/SelectionPopup.svelte';
  import { splitAllParagraphs, mergeParagraphUpdates, markFragmentPending, markChangedWordsPending, clearPendingMarkers } from '$lib/utils/draftParagraphs.js';

  export let deliverable;
  export let project = null;

  const dispatch = createEventDispatcher();

  let editor;
  let loading = true;
  let saving = false;
  let error = null;
  let currentHTML = '';
  let deliverableName = deliverable.deliverable_name;
  let deliverableStatus = deliverable.status || 'draft';
  let hasUnsavedChanges = false;
  let lastSaved = null;

  // Auto-save timer
  let autoSaveTimer;
  const AUTO_SAVE_DELAY = 3000; // 3 seconds

  // A highlight's compose popup, or the header "Edit with AI" button's popup
  // scoped to every paragraph: { paragraphIds, quotedText, top, left,
  // isWholeDocument } | null
  let selectionPopup = null;
  // A quick AI edit awaiting Accept/Edit Again. Written straight into the
  // editor (marked with a pending CSS class so it renders in a different
  // color) rather than shown in a separate diff view:
  // { paragraphIds, quotedText, top, left, originalHtml, loading, error } | null
  let pendingAiEdit = null;

  onMount(async () => {
    await loadContent();

    // Cleanup on unmount
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  });

  async function loadContent() {
    loading = true;
    error = null;

    try {
      const result = await getDeliverableAsHTML(deliverable.id);
      currentHTML = result.html;
      
      // Wait for editor to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (editor) {
        editor.setHTML(currentHTML);
      }
    } catch (err) {
      console.error('Error loading content:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleContentChange(event) {
    markDirtyAndScheduleAutoSave(event.detail.html);
  }

  function markDirtyAndScheduleAutoSave(html) {
    currentHTML = html;
    hasUnsavedChanges = true;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
      saveContent(true);
    }, AUTO_SAVE_DELAY);
  }

  function handleTextSelected(event) {
    selectionPopup = { ...event.detail, isWholeDocument: false };
  }

  function closeSelectionPopup() {
    selectionPopup = null;
    editor?.clearSelectionHighlight();
  }

  // Opens the same compose popup as a highlight, but scoped to every
  // paragraph in the document — the "as if I'd highlighted the whole thing"
  // shortcut for a comment that applies broadly rather than to one passage.
  function openWholeDocumentAiEdit(event) {
    const allParagraphs = splitAllParagraphs(currentHTML);
    if (!allParagraphs.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    selectionPopup = {
      paragraphIds: allParagraphs.map(p => p.id),
      quotedText: '(Applies to the whole document)',
      top: rect.bottom,
      left: rect.left + rect.width / 2,
      isWholeDocument: true,
    };
  }

  async function handleSendToAi(e) {
    if (!selectionPopup) return;
    const { paragraphIds, quotedText, top, left, isWholeDocument } = selectionPopup;
    const { notes, file, documentText, documentTitle, docType } = e.detail;
    const originalHtml = currentHTML;
    selectionPopup = null;
    editor?.clearSelectionHighlight();
    // Don't let an autosave scheduled by typing just before the highlight
    // fire while the pending (blue-highlighted, unreviewed) edit is showing
    // — it would write the pending markers straight into the saved document.
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    pendingAiEdit = { paragraphIds, quotedText, top, left, originalHtml, loading: true, error: null };

    try {
      const allParagraphs = splitAllParagraphs(originalHtml);
      const targeted = allParagraphs.filter(p => paragraphIds.includes(p.id));
      const notesForApi = [
        !isWholeDocument && quotedText?.trim() ? `The user highlighted this exact text: "${quotedText.trim()}"` : null,
        notes?.trim() ? `Their instruction: ${notes.trim()}` : null,
      ].filter(Boolean).join('\n\n') || null;
      const result = await incorporateDeliverableTargeted(deliverable.id, {
        file: file ?? null,
        documentText: documentText ?? '',
        documentTitle: documentTitle ?? null,
        paragraphs: targeted,
        userNotes: notesForApi,
        docType: docType ?? null,
      });
      const oldHtmlById = Object.fromEntries(allParagraphs.map(p => [p.id, p.html]));
      const taggedUpdates = (result.updated ?? []).map(p => {
        const oldHtml = oldHtmlById[p.id];
        // A brand-new inserted paragraph has no prior version to diff against
        // — mark the whole thing pending instead of a word-level diff.
        const html = oldHtml ? markChangedWordsPending(oldHtml, p.html) : markFragmentPending(p.html);
        return { id: p.id, html };
      });
      const mergedHtml = mergeParagraphUpdates(allParagraphs, taggedUpdates);
      currentHTML = mergedHtml;
      editor?.setHTML(mergedHtml);
      hasUnsavedChanges = true;
      pendingAiEdit = { ...pendingAiEdit, loading: false };
    } catch (err) {
      pendingAiEdit = { ...pendingAiEdit, loading: false, error: err.message };
    }
  }

  function acceptPendingAiEdit() {
    if (!pendingAiEdit) return;
    const cleared = clearPendingMarkers(currentHTML);
    editor?.setHTML(cleared);
    pendingAiEdit = null;
    editor?.clearSelectionHighlight();
    markDirtyAndScheduleAutoSave(cleared);
  }

  function editPendingAiEditAgain() {
    if (!pendingAiEdit) return;
    const { paragraphIds, quotedText, top, left, originalHtml, isWholeDocument } = pendingAiEdit;
    currentHTML = originalHtml;
    editor?.setHTML(originalHtml);
    pendingAiEdit = null;
    editor?.clearSelectionHighlight();
    selectionPopup = { paragraphIds, quotedText, top, left, isWholeDocument };
  }

  function cancelPendingAiEdit() {
    if (!pendingAiEdit) return;
    currentHTML = pendingAiEdit.originalHtml;
    editor?.setHTML(pendingAiEdit.originalHtml);
    pendingAiEdit = null;
    editor?.clearSelectionHighlight();
  }

  const AI_POPOVER_WIDTH = 320;
  $: aiPopoverLeft = pendingAiEdit
    ? Math.min(Math.max(pendingAiEdit.left - AI_POPOVER_WIDTH / 2, 16), (typeof window !== 'undefined' ? window.innerWidth : 1200) - AI_POPOVER_WIDTH - 16)
    : 0;
  // Guess at the popover's height before it's measured (see bind:clientHeight
  // on .ai-edit-control) so it doesn't visibly jump on the first frame.
  let aiPopoverHeight = 110;
  $: aiPopoverTop = (() => {
    if (!pendingAiEdit) return 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const margin = 16;
    if (pendingAiEdit.top + 8 + aiPopoverHeight <= vh - margin) return pendingAiEdit.top + 8;
    return Math.max((vh - aiPopoverHeight) / 2, margin);
  })();

  async function saveContent(isAutoSave = false) {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    saving = true;
    error = null;

    try {
      // Save HTML content
      await updateDeliverableFromHTML(deliverable.id, currentHTML);

      // Also save name and status if changed
      if (deliverableName !== deliverable.deliverable_name || deliverableStatus !== deliverable.status) {
        await updateDeliverable(deliverable.id, {
          deliverableName,
          status: deliverableStatus
        });
      }

      hasUnsavedChanges = false;
      lastSaved = new Date();

      if (!isAutoSave) {
        // Show success message for manual saves
        alert('Deliverable saved successfully!');
      }
    } catch (err) {
      console.error('Error saving content:', err);
      error = err.message;
      if (!isAutoSave) {
        alert('Failed to save: ' + err.message);
      }
    } finally {
      saving = false;
    }
  }

  async function handleSave() {
    await saveContent(false);
  }

  function handleClose() {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    dispatch('close');
  }

  function formatLastSaved() {
    if (!lastSaved) return '';
    
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return lastSaved.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  async function handleExportWord() {
    try {
      await exportDeliverableToWord(deliverable, currentHTML, project);
    } catch (err) {
      console.error('Error exporting to Word:', err);
      alert('Failed to export to Word: ' + err.message);
    }
  }

  let copyLabel = 'Copy for Word';

  const WORD_STYLES = {
    h1: 'font-family:Calibri,Arial,sans-serif;font-size:24pt;font-weight:700;color:#1F4E78;margin:0 0 8pt;',
    h2: 'font-family:"Calibri Light",Calibri,Arial,sans-serif;font-size:16pt;font-weight:300;color:#1F4E78;margin:0 0 6pt;',
    h3: 'font-family:"Calibri Light",Calibri,Arial,sans-serif;font-size:13pt;font-weight:300;color:#1F4E78;margin:0 0 4pt;',
    h4: 'font-family:"Calibri Light",Calibri,Arial,sans-serif;font-size:16pt;font-weight:300;color:#1F4E78;margin:0 0 4pt;',
    p:  'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000;line-height:1.6;margin:0 0 8pt;',
    li: 'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000;line-height:1.6;margin:0 0 3pt;'
  };

  function prepareForWord(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Strip leading numbers from headings and apply inline styles
    div.querySelectorAll('h1, h2, h3, h4, p, li').forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (WORD_STYLES[tag]) el.setAttribute('style', WORD_STYLES[tag]);

      if (['h1','h2','h3','h4'].includes(tag)) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const firstText = walker.nextNode();
        if (firstText) firstText.nodeValue = firstText.nodeValue.replace(/^\d+(\.\d+)*\.?\s+/, '');
      }
    });

    return `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">${div.innerHTML}</div>`;
  }

  async function handleCopyForWord() {
    try {
      const styledHTML = prepareForWord(currentHTML);
      const blob = new Blob([styledHTML], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      copyLabel = 'Copied!';
      setTimeout(() => { copyLabel = 'Copy for Word'; }, 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      alert('Failed to copy: ' + err.message);
    }
  }
</script>

<div class="editor-modal-overlay">
  <div class="editor-modal-content">
    <div class="editor-header">
      <div class="header-left">
        <div class="deliverable-icon">
          <i class="las la-file-alt"></i>
        </div>
        <div class="header-info">
          <input
            type="text"
            bind:value={deliverableName}
            class="name-input"
            placeholder="Deliverable name"
          />
          <div class="meta-info">
            <select bind:value={deliverableStatus} class="status-select">
              <option value="draft">Draft</option>
              <option value="review" disabled>Review (coming soon)</option>
              <option value="final" disabled>Final (coming soon)</option>
            </select>
            {#if lastSaved}
              <span class="last-saved">
                <i class="las la-check-circle"></i>
                Saved {formatLastSaved()}
              </span>
            {/if}
            {#if hasUnsavedChanges}
              <span class="unsaved-badge">Unsaved changes</span>
            {/if}
          </div>
        </div>
      </div>
      <div class="header-actions">
        <button class="header-btn ai-edit-btn" on:click={openWholeDocumentAiEdit} disabled={loading || !currentHTML?.trim()} title="Tell the AI what to change across the whole document">
          <i class="las la-magic"></i>
          Edit with AI
        </button>
        {#if !['cover_letter', 'certificate_b_notice'].includes(deliverable.deliverable_type)}
        <button class="header-btn export-btn" on:click={handleExportWord} title="Export to Word">
          <i class="las la-file-word"></i>
          Export to Word
        </button>
        {/if}
        {#if ['cover_letter', 'certificate_b_notice'].includes(deliverable.deliverable_type)}
        <button class="header-btn copy-btn" on:click={handleCopyForWord} title="Copy content ready to paste into Word">
          <i class="las la-copy"></i>
          {copyLabel}
        </button>
        {/if}
        <button class="header-btn save-btn" on:click={handleSave} disabled={saving || !hasUnsavedChanges}>
          {#if saving}
            <i class="las la-spinner la-spin"></i>
            Saving...
          {:else}
            <i class="las la-save"></i>
            Save
          {/if}
        </button>
        <button class="header-btn close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
          Close
        </button>
      </div>
    </div>

    <div class="editor-body">
      {#if loading}
        <div class="loading-state">
          <i class="las la-spinner la-spin"></i>
          <p>Loading content...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <i class="las la-exclamation-circle"></i>
          <p>Error: {error}</p>
          <button on:click={loadContent} class="retry-btn">Retry</button>
        </div>
      {:else}
        <div class="editor-container">
          <div class="editor-info-banner">
            <i class="las la-info-circle"></i>
            <div>
              <strong>Editing:</strong> {deliverable.template_name} for {deliverable.project_name}
            </div>
          </div>

          <RichTextEditor
            bind:this={editor}
            content={currentHTML}
            placeholder="Start editing your document..."
            on:change={handleContentChange}
            on:textselected={handleTextSelected}
          />

          <div class="editor-help">
            <p><strong>Tips:</strong></p>
            <ul>
              <li>Your changes are automatically saved every few seconds</li>
              <li>Use the toolbar to format text with headings, bold, italic, etc.</li>
              <li>Highlight any text for an AI edit, or use "Edit with AI" above for the whole document</li>
              <li>Placeholders from the template have been replaced with project data</li>
              <li>You can edit any text freely - the document is fully customizable</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if selectionPopup}
    <SelectionPopup
      {project}
      paragraphIds={selectionPopup.paragraphIds}
      quotedText={selectionPopup.quotedText}
      top={selectionPopup.top}
      left={selectionPopup.left}
      allowComment={false}
      on:sendtoai={handleSendToAi}
      on:close={closeSelectionPopup}
    />
  {/if}

  {#if pendingAiEdit}
    <div class="ai-edit-control" bind:clientHeight={aiPopoverHeight} style="top:{aiPopoverTop}px; left:{aiPopoverLeft}px; width:{AI_POPOVER_WIDTH}px;">
      {#if pendingAiEdit.loading}
        <div class="ai-edit-status"><div class="mini-spinner"></div> Writing...</div>
      {:else if pendingAiEdit.error}
        <p class="ai-edit-error">{pendingAiEdit.error}</p>
        <div class="ai-edit-actions">
          <button class="btn btn-secondary" on:click={cancelPendingAiEdit}>Dismiss</button>
        </div>
      {:else}
        <span class="ai-edit-label"><i class="las la-magic"></i> AI-written — not yet reviewed</span>
        <div class="ai-edit-actions">
          <button class="btn btn-secondary" on:click={editPendingAiEditAgain}>Edit Again</button>
          <button class="btn btn-primary" on:click={acceptPendingAiEdit}>Accept</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .editor-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .editor-modal-content {
    background: white;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  .deliverable-icon {
    width: 3rem;
    height: 3rem;
    background: var(--color-teal-100);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .deliverable-icon i {
    font-size: 1.5rem;
    color: var(--color-teal-600);
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .name-input {
    width: 100%;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
    border: 1px solid transparent;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    background: transparent;
    transition: all 0.2s;
  }

  .name-input:hover {
    background: white;
    border-color: var(--color-slate-300);
  }

  .name-input:focus {
    outline: none;
    background: white;
    border-color: var(--color-teal-600);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .meta-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  .status-select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-slate-500);
    background: white;
    cursor: pointer;
  }

  .status-select:focus {
    outline: none;
    border-color: var(--color-teal-600);
  }

  .last-saved {
    font-size: 0.75rem;
    color: var(--color-emerald-500);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .unsaved-badge {
    font-size: 0.75rem;
    color: var(--color-amber-500);
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .header-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .save-btn {
    background: var(--color-teal-600);
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--color-emerald-600);
  }

  .save-btn:disabled {
    background: var(--color-slate-400);
    cursor: not-allowed;
  }

  .export-btn {
    background: var(--color-primary-500);
    color: white;
  }

  .export-btn:hover {
    background: var(--color-primary-600);
  }

  .copy-btn {
    background: var(--color-violet-600);
    color: white;
  }

  .copy-btn:hover {
    background: var(--color-violet-700);
  }

  .ai-edit-btn {
    background: var(--color-violet-600);
    color: white;
  }

  .ai-edit-btn:hover:not(:disabled) {
    background: var(--color-violet-700);
  }

  .ai-edit-btn:disabled {
    background: var(--color-slate-400);
    cursor: not-allowed;
  }


  .close-btn {
    background: white;
    border: 1px solid var(--color-slate-300);
    color: var(--color-slate-500);
  }

  .close-btn:hover {
    background: var(--color-slate-50);
    border-color: var(--color-slate-400);
  }

  .header-btn i {
    font-size: 1.125rem;
  }

  .editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
  }

  .loading-state i, .error-state i {
    font-size: 3rem;
    color: var(--color-slate-500);
  }

  .loading-state p, .error-state p {
    font-size: 1.125rem;
    color: var(--color-slate-500);
    margin: 0;
  }

  .retry-btn {
    padding: 0.5rem 1.5rem;
    background: var(--color-teal-600);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1rem;
  }

  .retry-btn:hover {
    background: var(--color-emerald-600);
  }

  .editor-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .editor-info-banner {
    background: var(--color-slate-100);
    border: 1px solid var(--color-sky-200);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .editor-info-banner i {
    font-size: 1.25rem;
    color: var(--color-teal-600);
    flex-shrink: 0;
  }

  .editor-info-banner strong {
    color: var(--color-emerald-600);
  }

  .editor-help {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  .editor-help p {
    margin: 0 0 0.5rem 0;
    font-weight: 600;
    color: var(--color-slate-600);
  }

  .editor-help ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .editor-help li {
    margin: 0.25rem 0;
  }

  @media (max-width: 768px) {
    .editor-modal-content {
      max-width: 100%;
      height: 100vh;
      border-radius: 0;
    }

    .editor-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .header-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .header-btn {
      flex: 1;
      justify-content: center;
      min-width: 100px;
    }
  }

  /* ── Quick AI edit control (Accept / Edit Again, follows a highlight or
     the "Edit with AI" header button) ── */
  .ai-edit-control {
    position: fixed;
    max-width: calc(100vw - 2rem);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0.7rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 1000;
  }
  .ai-edit-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--color-slate-600);
  }
  .ai-edit-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .ai-edit-error {
    font-size: 0.78rem;
    color: var(--color-red-500);
    margin: 0;
  }
  .ai-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .ai-edit-actions button {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: ai-edit-spin 0.8s linear infinite;
  }

  @keyframes ai-edit-spin { to { transform: rotate(360deg); } }
</style>

