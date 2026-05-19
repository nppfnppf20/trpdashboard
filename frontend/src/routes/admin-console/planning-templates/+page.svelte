<script>
  import { onMount, tick } from 'svelte';
  import { listPolicyContextTemplates, updatePolicyContextTemplate } from '$lib/api/planningApplication.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';

  const FIELDS = [
    { key: 'nppf_text',           label: 'National Planning Policy Framework (NPPF)' },
    { key: 'nppg_text',           label: 'National Planning Practice Guidance (NPPG)' },
    { key: 'other_national_text', label: 'Other National Policy' },
    { key: 'other_guidance_text', label: 'Other Policy and Guidance' },
  ];

  let templates = [];
  let loading = true;
  let error = null;

  let modalOpen = false;
  let modalSaving = false;
  let modalError = null;
  let activeDevType = null;
  let form = { nppf_text: '', nppg_text: '', other_national_text: '', other_guidance_text: '' };
  let activeField = 'nppf_text';

  let editor;

  let previewOpen = false;
  let previewTitle = '';
  let previewHtml = '';

  function openPreview(t, field) {
    previewTitle = `${t.development_type} — ${field.label}`;
    previewHtml = t[field.key] ?? '';
    previewOpen = true;
  }

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      templates = await listPolicyContextTemplates();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openEdit(t) {
    activeDevType = t.development_type;
    form = {
      nppf_text:           t.nppf_text ?? '',
      nppg_text:           t.nppg_text ?? '',
      other_national_text: t.other_national_text ?? '',
      other_guidance_text: t.other_guidance_text ?? '',
    };
    activeField = 'nppf_text';
    modalError = null;
    modalOpen = true;
    // Set editor content after modal renders
    tick().then(() => editor?.setHTML(form[activeField]));
  }

  async function switchField(key) {
    // Persist current editor content before switching
    form[activeField] = editor?.getHTML() ?? form[activeField];
    activeField = key;
    await tick();
    editor?.setHTML(form[activeField]);
  }

  async function save() {
    // Capture final editor state before saving
    form[activeField] = editor?.getHTML() ?? form[activeField];
    modalSaving = true;
    modalError = null;
    try {
      const updated = await updatePolicyContextTemplate(activeDevType, form);
      templates = templates.map(t => t.development_type === activeDevType ? { ...t, ...updated } : t);
      modalOpen = false;
    } catch (err) {
      modalError = err.message;
    } finally {
      modalSaving = false;
    }
  }

  function hasContent(t) {
    return !!(t.nppf_text || t.nppg_text || t.other_national_text || t.other_guidance_text);
  }

  function wordCount(text) {
    if (!text?.trim()) return 0;
    // Strip HTML tags before counting
    return text.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Policy Templates</h1>
      <p>Policy context text injected into Planning Statement drafts by development type. Edit each development type to add NPPF, NPPG, other national policy, and other guidance text.</p>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if error}
    <div class="error-banner">{error}</div>
  {:else}
    <table class="tpl-table">
      <thead>
        <tr>
          <th>Development Type</th>
          <th>NPPF</th>
          <th>NPPG</th>
          <th>Other National</th>
          <th>Other Guidance</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each templates as t}
          <tr>
            <td class="devtype-cell">{t.development_type}</td>
            {#each FIELDS as f}
              <td class="status-cell">
                {#if t[f.key]?.trim()}
                  <button class="pill pill-ok pill-btn" on:click={() => openPreview(t, f)}>{wordCount(t[f.key])}w</button>
                {:else}
                  <span class="pill pill-empty">—</span>
                {/if}
              </td>
            {/each}
            <td class="actions-cell">
              <button class="btn-edit" on:click={() => openEdit(t)}>
                <i class="las la-edit"></i> Edit
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

{#if previewOpen}
  <div class="modal-backdrop" on:click|self={() => previewOpen = false} role="dialog" aria-modal="true">
    <div class="modal preview-modal">
      <div class="modal-header">
        <h2>{previewTitle}</h2>
        <button class="close-btn" on:click={() => previewOpen = false}><i class="las la-times"></i></button>
      </div>
      <div class="preview-body prose">{@html previewHtml}</div>
    </div>
  </div>
{/if}

{#if modalOpen}
  <div class="modal-backdrop" on:click|self={() => modalOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{activeDevType}</h2>
          <p class="modal-sub">Policy context text for this development type.</p>
        </div>
        <button class="close-btn" on:click={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}
        <div class="modal-error">{modalError}</div>
      {/if}

      <div class="field-tabs">
        {#each FIELDS as f}
          <button
            class="field-tab"
            class:active={activeField === f.key}
            on:click={() => switchField(f.key)}
          >
            {f.label}
            {#if form[f.key]?.trim()}
              <span class="tab-dot tab-dot-ok"></span>
            {:else}
              <span class="tab-dot tab-dot-empty"></span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="editor-wrap">
        <RichTextEditor
          bind:this={editor}
          fullHeight={true}
          placeholder="Add policy text for this section…"
        />
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => modalOpen = false} disabled={modalSaving}>Cancel</button>
        <button class="btn-primary" on:click={save} disabled={modalSaving}>
          {modalSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 1100px; }

  .page-header { margin-bottom: 2rem; }

  .page-header h1 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .page-header p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .tpl-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  }

  .tpl-table th {
    background: #f8fafc;
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
  }

  .tpl-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.875rem;
    color: #1e293b;
    vertical-align: middle;
  }

  .tpl-table tr:last-child td { border-bottom: none; }

  .devtype-cell { font-weight: 500; }
  .status-cell { text-align: center; }

  .pill {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .pill-ok { background: #dcfce7; color: #15803d; }
  .pill-empty { background: #f1f5f9; color: #94a3b8; }
  .pill-btn { border: none; cursor: pointer; }
  .pill-btn:hover { background: #bbf7d0; }

  .preview-modal { width: 760px; max-height: 80vh; }
  .preview-body { padding: 1.5rem; overflow-y: auto; flex: 1; font-size: 0.9rem; line-height: 1.7; color: #1e293b; }
  .preview-body :global(p) { margin: 0 0 0.75rem; }
  .preview-body :global(blockquote) { margin: 0.75rem 0 0.75rem 1rem; padding-left: 1rem; border-left: 3px solid #cbd5e1; color: #475569; }

  .actions-cell { white-space: nowrap; }

  .btn-edit {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 5px;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .btn-edit:hover { background: #dbeafe; }

  .loading {
    padding: 3rem;
    text-align: center;
    color: #64748b;
  }

  .error-banner {
    padding: 1rem;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 960px;
    max-width: 98vw;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-header h2 { margin: 0 0 0.25rem; font-size: 1.25rem; color: #1e293b; }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: #64748b; }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #64748b;
    padding: 0.25rem;
    flex-shrink: 0;
  }

  .close-btn:hover { color: #1e293b; }

  .modal-error {
    padding: 0.75rem 1.5rem;
    background: #fef2f2;
    color: #dc2626;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .field-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    overflow-x: auto;
  }

  .field-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    margin-bottom: -1px;
  }

  .field-tab:hover { color: #1e293b; background: #f8fafc; }

  .field-tab.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }

  .tab-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tab-dot-ok { background: #22c55e; }
  .tab-dot-empty { background: #cbd5e1; }

  .editor-wrap {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Make the RichTextEditor fill the available space */
  .editor-wrap :global(.rich-text-editor) {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    border: none;
    border-top: none;
    min-height: 0;
  }

  .editor-wrap :global(.editor-content) {
    flex: 1;
    max-height: none;
    min-height: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .btn-primary {
    padding: 0.5rem 1.25rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-secondary {
    padding: 0.5rem 1.25rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .btn-secondary:hover { background: #f9fafb; }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
