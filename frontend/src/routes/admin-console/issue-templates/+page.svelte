<script>
  import { onMount, tick } from 'svelte';
  import { listIssueTypes, createIssueType, updateIssueType, deleteIssueType } from '$lib/api/issueTypes.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';

  const FIELDS = [
    { key: 'nppf_text',           label: 'National Planning Policy Framework (NPPF)' },
    { key: 'nppg_text',           label: 'National Planning Practice Guidance (NPPG)' },
    { key: 'other_national_text', label: 'Other National Policy' },
    { key: 'other_guidance_text', label: 'Other Policy and Guidance' },
  ];

  let issueTypes = [];
  let loading = true;
  let error = null;

  let modalOpen = false;
  let modalSaving = false;
  let modalError = null;
  let isNew = false;
  let activeId = null;
  let form = { label: '', development_type: '', nppf_text: '', nppg_text: '', other_national_text: '', other_guidance_text: '' };
  let activeField = 'nppf_text';
  let editor;

  let confirmDeleteId = null;

  let previewOpen = false;
  let previewTitle = '';
  let previewHtml = '';

  function openPreview(t, field) {
    previewTitle = `${t.label}${t.development_type ? ` (${t.development_type})` : ''} — ${field.label}`;
    previewHtml = t[field.key] ?? '';
    previewOpen = true;
  }

  onMount(load);

  async function load() {
    loading = true; error = null;
    try { issueTypes = await listIssueTypes(); }
    catch (err) { error = err.message; }
    finally { loading = false; }
  }

  function openNew() {
    isNew = true;
    activeId = null;
    form = { label: '', development_type: '', nppf_text: '', nppg_text: '', other_national_text: '', other_guidance_text: '' };
    activeField = 'nppf_text';
    modalError = null;
    modalOpen = true;
    tick().then(() => editor?.setHTML(''));
  }

  function openEdit(t) {
    isNew = false;
    activeId = t.id;
    form = {
      label:               t.label ?? '',
      development_type:    t.development_type ?? '',
      nppf_text:           t.nppf_text ?? '',
      nppg_text:           t.nppg_text ?? '',
      other_national_text: t.other_national_text ?? '',
      other_guidance_text: t.other_guidance_text ?? '',
    };
    activeField = 'nppf_text';
    modalError = null;
    modalOpen = true;
    tick().then(() => editor?.setHTML(form[activeField]));
  }

  async function switchField(key) {
    form[activeField] = editor?.getHTML() ?? form[activeField];
    activeField = key;
    await tick();
    editor?.setHTML(form[activeField]);
  }

  async function save() {
    form[activeField] = editor?.getHTML() ?? form[activeField];
    if (!form.label.trim()) { modalError = 'Label is required'; return; }
    modalSaving = true; modalError = null;
    try {
      const payload = {
        label:               form.label.trim(),
        development_type:    form.development_type.trim() || null,
        nppf_text:           form.nppf_text || null,
        nppg_text:           form.nppg_text || null,
        other_national_text: form.other_national_text || null,
        other_guidance_text: form.other_guidance_text || null,
      };
      if (isNew) {
        const created = await createIssueType(payload);
        issueTypes = [...issueTypes, created].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
      } else {
        const updated = await updateIssueType(activeId, payload);
        issueTypes = issueTypes.map(t => t.id === activeId ? updated : t);
      }
      modalOpen = false;
    } catch (err) {
      modalError = err.message;
    } finally {
      modalSaving = false;
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteIssueType(id);
      issueTypes = issueTypes.filter(t => t.id !== id);
    } catch (err) {
      error = err.message;
    } finally {
      confirmDeleteId = null;
    }
  }

  function wordCount(text) {
    if (!text?.trim()) return 0;
    return text.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Per Issue Planning Assessment Templates</h1>
      <p>Per-issue NPPF/NPPG text injected into Planning Statement policy assessment sections. Assign an issue type to a project issue track to apply the template.</p>
    </div>
    <button class="btn-add" on:click={openNew}><i class="las la-plus"></i> New Issue Type</button>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else}
    <table class="tpl-table">
      <thead>
        <tr>
          <th>Issue Type</th>
          <th>Dev Type</th>
          <th>NPPF</th>
          <th>NPPG</th>
          <th>Other National</th>
          <th>Other Guidance</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each issueTypes as t (t.id)}
          <tr>
            <td class="label-cell">{t.label}</td>
            <td class="devtype-cell">{#if t.development_type}{t.development_type}{:else}<span class="muted">—</span>{/if}</td>
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
              {#if confirmDeleteId === t.id}
                <span class="confirm-delete">
                  Delete?
                  <button class="btn-danger-sm" on:click={() => confirmDelete(t.id)}>Yes</button>
                  <button class="btn-cancel-sm" on:click={() => confirmDeleteId = null}>No</button>
                </span>
              {:else}
                <button class="btn-edit" on:click={() => openEdit(t)}><i class="las la-edit"></i> Edit</button>
                <button class="btn-delete" on:click={() => confirmDeleteId = t.id}><i class="las la-trash"></i></button>
              {/if}
            </td>
          </tr>
        {/each}
        {#if !issueTypes.length}
          <tr><td colspan="7" class="empty-row">No issue types yet. Click "New Issue Type" to add one.</td></tr>
        {/if}
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
          <h2>{isNew ? 'New Issue Type' : form.label}</h2>
          <p class="modal-sub">Policy context text injected into the planning assessment for this issue.</p>
        </div>
        <button class="close-btn" on:click={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-meta">
        <div class="meta-field">
          <label>Issue Label</label>
          <input type="text" bind:value={form.label} placeholder="e.g. Listed Building, Noise, Flood Risk…" />
        </div>
        <div class="meta-field">
          <label>Development Type <span class="optional">optional</span></label>
          <input type="text" bind:value={form.development_type} placeholder="e.g. Solar, Residential… (blank = all types)" />
        </div>
      </div>

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
  .page { max-width: 1200px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  .page-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: #1e293b; }
  .page-header p { margin: 0; color: #64748b; font-size: 0.875rem; }

  .btn-add {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; background: #2563eb; color: white;
    border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .btn-add:hover { background: #1d4ed8; }

  .tpl-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
  .tpl-table th { background: #f8fafc; padding: 0.75rem 1rem; text-align: left; font-size: 0.8125rem; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .tpl-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; color: #1e293b; vertical-align: middle; }
  .tpl-table tr:last-child td { border-bottom: none; }

  .label-cell { font-weight: 500; }
  .devtype-cell { color: #64748b; font-size: 0.8125rem; }
  .muted { color: #94a3b8; }
  .status-cell { text-align: center; }
  .empty-row { text-align: center; color: #94a3b8; padding: 2rem; }

  .pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .pill-ok { background: #dcfce7; color: #15803d; }
  .pill-empty { background: #f1f5f9; color: #94a3b8; }
  .pill-btn { border: none; cursor: pointer; }
  .pill-btn:hover { background: #bbf7d0; }

  .preview-modal { width: 760px; max-height: 80vh; }
  .preview-body { padding: 1.5rem; overflow-y: auto; flex: 1; font-size: 0.9rem; line-height: 1.7; color: #1e293b; }
  .preview-body :global(p) { margin: 0 0 0.75rem; }
  .preview-body :global(blockquote) { margin: 0.75rem 0 0.75rem 1rem; padding-left: 1rem; border-left: 3px solid #cbd5e1; color: #475569; }

  .actions-cell { white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .btn-edit { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-edit:hover { background: #dbeafe; }
  .btn-delete { display: inline-flex; align-items: center; padding: 0.35rem 0.5rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-delete:hover { background: #fee2e2; }
  .confirm-delete { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: #dc2626; }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  .loading { padding: 3rem; text-align: center; color: #64748b; }
  .error-banner { padding: 1rem; background: #fef2f2; color: #dc2626; border-radius: 6px; margin-bottom: 1rem; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; border-radius: 10px; width: 960px; max-width: 98vw; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
  .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .modal-header h2 { margin: 0 0 0.25rem; font-size: 1.25rem; color: #1e293b; }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: #64748b; }
  .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #64748b; padding: 0.25rem; flex-shrink: 0; }
  .close-btn:hover { color: #1e293b; }
  .modal-error { padding: 0.75rem 1.5rem; background: #fef2f2; color: #dc2626; font-size: 0.875rem; flex-shrink: 0; }

  .modal-meta { display: flex; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .meta-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
  .meta-field label { font-size: 0.8125rem; font-weight: 500; color: #374151; }
  .optional { font-weight: 400; color: #94a3b8; font-size: 0.75rem; }
  .meta-field input { padding: 0.5rem 0.625rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; }
  .meta-field input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .field-tabs { display: flex; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; overflow-x: auto; }
  .field-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer; white-space: nowrap; transition: all 0.15s; margin-bottom: -1px; }
  .field-tab:hover { color: #1e293b; background: #f8fafc; }
  .field-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
  .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tab-dot-ok { background: #22c55e; }
  .tab-dot-empty { background: #cbd5e1; }

  .editor-wrap { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
  .editor-wrap :global(.rich-text-editor) { flex: 1; display: flex; flex-direction: column; border-radius: 0; border: none; min-height: 0; }
  .editor-wrap :global(.editor-content) { flex: 1; max-height: none; min-height: 0; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
  .btn-primary { padding: 0.5rem 1.25rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 0.5rem 1.25rem; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
