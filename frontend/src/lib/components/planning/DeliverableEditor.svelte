<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getDeliverableAsHTML, updateDeliverableFromHTML, updateDeliverable } from '$lib/services/planningDeliverablesApi.js';
  import { exportDeliverableToWord } from '$lib/services/planningDeliverablesExport.js';
  import RichTextEditor from './RichTextEditor.svelte';

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
    currentHTML = event.detail.html;
    hasUnsavedChanges = true;

    // Clear existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set new timer for auto-save
    autoSaveTimer = setTimeout(() => {
      saveContent(true);
    }, AUTO_SAVE_DELAY);
  }

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
          />

          <div class="editor-help">
            <p><strong>Tips:</strong></p>
            <ul>
              <li>Your changes are automatically saved every few seconds</li>
              <li>Use the toolbar to format text with headings, bold, italic, etc.</li>
              <li>Placeholders from the template have been replaced with project data</li>
              <li>You can edit any text freely - the document is fully customizable</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </div>
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
    border-radius: 12px;
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px var(--overlay-bg);
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
    border-radius: 8px;
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
    border-radius: 4px;
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
    border-radius: 4px;
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
    border-radius: 6px;
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
    border-radius: 6px;
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
    border-radius: 8px;
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
    border-radius: 8px;
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
</style>

