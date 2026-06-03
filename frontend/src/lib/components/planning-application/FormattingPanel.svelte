<script>
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';

  const TEMPLATES = [
    { label: 'Planning Statement (Solar)',  path: '/planningstatementsolar.docx' },
    { label: 'Stage 1 Review',              path: '/stage1reviewtemplate.docx' },
    { label: 'Appeal Statement of Case',    path: '/AppealSoCtemplate.docx' },
    { label: 'Letter',                      path: '/letter.docx' },
    { label: 'Basic Document',              path: '/basicdocument.docx' },
  ];

  let editor;
  let selectedTemplate = TEMPLATES[0].path;
  let filename = '';
  let exporting = false;
  let error = null;

  function normaliseHtml(rawHtml) {
    const div = document.createElement('div');
    div.innerHTML = rawHtml;

    // If there are no element children the paste landed as bare text nodes.
    // Split on newlines and wrap each non-empty line in <p>.
    if (div.children.length === 0) {
      const text = div.textContent || '';
      if (!text.trim()) return '';
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p>${line}</p>`)
        .join('');
    }

    // If there are mixed text nodes at the top level alongside elements,
    // wrap each orphaned text node in <p> too.
    const nodes = Array.from(div.childNodes);
    const hasOrphans = nodes.some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!hasOrphans) return rawHtml;

    return nodes.map(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n.textContent.trim();
        return t ? `<p>${t}</p>` : '';
      }
      return n.outerHTML;
    }).join('');
  }

  async function exportToWord() {
    const raw = editor?.getHTML()?.trim();
    if (!raw) { error = 'Nothing to export — paste some text first.'; return; }
    const html = normaliseHtml(raw);
    if (!html) { error = 'Nothing to export — paste some text first.'; return; }
    exporting = true;
    error = null;
    try {
      const name = filename.trim() || 'document';
      await exportHtmlToWord(html, name, selectedTemplate);
    } catch (err) {
      error = err.message;
    } finally {
      exporting = false;
    }
  }
</script>

<div class="formatting-panel">
  <div class="panel-header">
    <div class="header-text">
      <h2>Formatting</h2>
      <p>Paste or write text below, select a template, and export to Word.</p>
    </div>
    <div class="export-controls">
      <input
        class="filename-input"
        type="text"
        bind:value={filename}
        placeholder="File name (optional)"
      />
      <select class="template-select" bind:value={selectedTemplate}>
        {#each TEMPLATES as t}
          <option value={t.path}>{t.label}</option>
        {/each}
      </select>
      <button class="btn-export" on:click={exportToWord} disabled={exporting}>
        {#if exporting}
          <span class="spinner"></span> Exporting…
        {:else}
          <i class="las la-file-word"></i> Export to Word
        {/if}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-banner">
      <i class="las la-exclamation-circle"></i> {error}
    </div>
  {/if}

  <div class="editor-wrapper">
    <RichTextEditor bind:this={editor} />
  </div>
</div>

<style>
  .formatting-panel {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .header-text h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.25rem;
  }

  .header-text p {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  .export-controls {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .filename-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    width: 180px;
    background: white;
    transition: border-color 0.15s;
  }

  .filename-input:focus {
    outline: none;
    border-color: #0d9488;
  }

  .filename-input::placeholder {
    color: #94a3b8;
  }

  .template-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .template-select:focus {
    outline: none;
    border-color: #0d9488;
  }

  .btn-export {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: #1F4E78;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-export:hover:not(:disabled) {
    background: #163d5e;
  }

  .btn-export:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .editor-wrapper {
    flex: 1;
    min-height: 0;
  }

  .spinner {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
