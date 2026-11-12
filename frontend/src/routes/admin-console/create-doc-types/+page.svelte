<script>
  import { onMount } from 'svelte';
  import { listCreateDocTypes, createCreateDocType, updateCreateDocType, deleteCreateDocType } from '$lib/api/createDocTypes.js';

  // The .docx files the Word export can use (frontend/static). Values are the exact
  // paths the export code uses, so a chosen type can feed straight into it.
  const WORD_TEMPLATES = [
    { value: '/basicdocument.docx', label: 'Basic document' },
    { value: '/letter.docx', label: 'Letter' },
    { value: '/planning%20statement%20template%20c%20and%20s.docx', label: 'Planning statement (C&S)' },
    { value: '/appeal%20soc%20template%20c%20and%20s.docx', label: 'Appeal Statement of Case (C&S)' },
    { value: '/appeal%20socg%20template%20c%20and%20s.docx', label: 'Appeal Statement of Common Ground (C&S)' },
    { value: '/stage1reviewtemplate.docx', label: 'Stage 1 review' },
  ];
  const templateLabel = path => WORD_TEMPLATES.find(t => t.value === path)?.label ?? path ?? 'Basic document';

  let docTypes = $state([]);
  let loading = $state(true);
  let error = $state(null);

  let modalOpen = $state(false);
  let modalSaving = $state(false);
  let modalError = $state(null);
  let isNew = $state(false);
  let activeId = $state(null);
  let activeTab = $state('example');
  let form = $state({ name: '', word_template: '/basicdocument.docx', example_text: '', structure_notes: '', sort_order: 0, is_active: true });

  let confirmDeleteId = $state(null);

  onMount(load);

  async function load() {
    loading = true; error = null;
    try {
      docTypes = await listCreateDocTypes();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openNew() {
    isNew = true; activeId = null;
    const nextOrder = docTypes.reduce((max, d) => Math.max(max, d.sort_order ?? 0), 0) + 10;
    form = { name: '', word_template: '/basicdocument.docx', example_text: '', structure_notes: '', sort_order: nextOrder, is_active: true };
    activeTab = 'example';
    modalError = null;
    modalOpen = true;
  }

  function openEdit(d) {
    isNew = false; activeId = d.id;
    form = {
      name: d.name ?? '',
      word_template: d.word_template ?? '/basicdocument.docx',
      example_text: d.example_text ?? '',
      structure_notes: d.structure_notes ?? '',
      sort_order: d.sort_order ?? 0,
      is_active: d.is_active ?? true,
    };
    activeTab = 'example';
    modalError = null;
    modalOpen = true;
  }

  async function save() {
    if (!form.name.trim()) { modalError = 'Name is required'; return; }
    modalSaving = true; modalError = null;
    try {
      const payload = {
        name: form.name.trim(),
        word_template: form.word_template || null,
        example_text: form.example_text.trim() || null,
        structure_notes: form.structure_notes.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (isNew) {
        const created = await createCreateDocType(payload);
        docTypes = [...docTypes, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      } else {
        const updated = await updateCreateDocType(activeId, payload);
        docTypes = docTypes.map(d => d.id === activeId ? updated : d).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
      await deleteCreateDocType(id);
      docTypes = docTypes.filter(d => d.id !== id);
    } catch (err) {
      error = err.message;
    } finally {
      confirmDeleteId = null;
    }
  }

  function wordCount(text) {
    if (!text?.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Create Doc Types</h1>
      <p>The document types offered on the Create card. Each sets the Word template the finished document exports with, and can carry an example document and structure notes the AI uses as a guide to tone, layout and level of detail. The example is a style guide only, never a source of facts.</p>
    </div>
    <button class="btn-add" onclick={openNew}>
      <i class="las la-plus"></i> New Doc Type
    </button>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if !docTypes.length}
    <div class="empty-state">
      <i class="las la-file-alt"></i>
      <p>No document types yet. Add one to offer it on the Create card.</p>
    </div>
  {:else}
    <table class="types-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Word template</th>
          <th>Example</th>
          <th>Notes</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each docTypes as d (d.id)}
          <tr class:inactive={!d.is_active}>
            <td class="name-cell">{d.name}</td>
            <td><span class="template-badge">{templateLabel(d.word_template)}</span></td>
            <td>
              {#if d.example_text?.trim()}
                <span class="pill pill-ok">{wordCount(d.example_text).toLocaleString()}w</span>
              {:else}
                <span class="pill pill-empty">none</span>
              {/if}
            </td>
            <td>
              {#if d.structure_notes?.trim()}
                <span class="pill pill-blue">notes</span>
              {:else}
                <span class="pill pill-empty">none</span>
              {/if}
            </td>
            <td>
              {#if d.is_active}<span class="pill pill-ok">Active</span>{:else}<span class="pill pill-empty">Hidden</span>{/if}
            </td>
            <td class="actions-cell">
              {#if confirmDeleteId === d.id}
                <span class="confirm-delete">
                  Delete?
                  <button class="btn-danger-sm" onclick={() => confirmDelete(d.id)}>Yes</button>
                  <button class="btn-cancel-sm" onclick={() => confirmDeleteId = null}>No</button>
                </span>
              {:else}
                <button class="btn-edit" onclick={() => openEdit(d)}><i class="las la-edit"></i> Edit</button>
                <button class="btn-delete" aria-label="Delete {d.name}" onclick={() => confirmDeleteId = d.id}><i class="las la-trash"></i></button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

{#if modalOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) modalOpen = false; }}>
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{isNew ? 'New Doc Type' : form.name}</h2>
          <p class="modal-sub">Choose the Word template, and optionally add an example and notes for the AI.</p>
        </div>
        <button class="close-btn" aria-label="Close" onclick={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-meta">
        <div class="meta-field meta-field-grow">
          <label for="cdt-name">Name</label>
          <input id="cdt-name" type="text" bind:value={form.name} placeholder="e.g. Cover letter" />
        </div>
        <div class="meta-field">
          <label for="cdt-template">Word template</label>
          <select id="cdt-template" bind:value={form.word_template}>
            {#each WORD_TEMPLATES as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </div>
        <div class="meta-field meta-field-narrow">
          <label for="cdt-order">Order</label>
          <input id="cdt-order" type="number" bind:value={form.sort_order} />
        </div>
        <label class="active-toggle">
          <input type="checkbox" bind:checked={form.is_active} />
          Show on Create card
        </label>
      </div>

      <div class="field-tabs">
        <button class="field-tab" class:active={activeTab === 'example'} onclick={() => activeTab = 'example'}>
          <i class="las la-align-left"></i>
          Example document
          {#if form.example_text?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
        <button class="field-tab" class:active={activeTab === 'notes'} onclick={() => activeTab = 'notes'}>
          <i class="las la-sticky-note"></i>
          Structure notes
          {#if form.structure_notes?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
      </div>

      <div class="editor-wrap">
        {#if activeTab === 'example'}
          <div class="tab-help">
            Paste a real example of this type of document as plain text. The AI uses it for tone, structure, paragraph length and level of detail, and is told never to copy its content. Keep it free of confidential or client-identifiable detail.
            {#if form.example_text?.trim()}<span class="word-count">{wordCount(form.example_text).toLocaleString()} words</span>{/if}
          </div>
          <textarea
            class="text-area"
            bind:value={form.example_text}
            placeholder="Paste the example document here as plain text (headings, paragraphs, etc.)."
          ></textarea>
        {:else}
          <div class="tab-help">Tell the AI how this type of document should be structured or what it must contain, e.g. "Open with the application reference. Keep to one page. Sign off from the case officer's point of view."</div>
          <textarea
            class="text-area"
            bind:value={form.structure_notes}
            placeholder="Optional guidance on structure and contents."
          ></textarea>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => modalOpen = false} disabled={modalSaving}>Cancel</button>
        <button class="btn-primary" onclick={save} disabled={modalSaving}>
          {modalSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 1100px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
  .page-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: var(--color-slate-800); }
  .page-header p { margin: 0; color: var(--color-slate-500); font-size: 0.875rem; max-width: 680px; }

  .btn-add {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; background: var(--color-primary-600); color: var(--color-white);
    border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .btn-add:hover { background: var(--color-primary-700); }

  .types-table { width: 100%; border-collapse: collapse; background: var(--color-white); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-sm); }
  .types-table th { background: var(--color-slate-50); padding: 0.625rem 1rem; text-align: left; font-size: 0.8125rem; font-weight: 600; color: var(--color-slate-500); border-bottom: 1px solid var(--color-slate-200); }
  .types-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-slate-100); font-size: 0.875rem; color: var(--color-slate-800); vertical-align: middle; }
  .types-table tr:last-child td { border-bottom: none; }
  .types-table tr.inactive td { color: var(--color-slate-400); }

  .name-cell { font-weight: 500; }
  .template-badge { display: inline-block; padding: 0.15rem 0.5rem; background: var(--color-slate-100); color: var(--color-slate-700); border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .pill-ok { background: var(--color-badge-success-bg); color: var(--color-badge-success-fg); }
  .pill-blue { background: var(--color-badge-info-bg); color: var(--color-blue-700); }
  .pill-empty { background: var(--color-slate-100); color: var(--color-slate-400); }

  .actions-cell { white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .btn-edit { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: var(--color-primary-50); color: var(--color-primary-600); border: 1px solid var(--color-primary-200); border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-edit:hover { background: var(--color-primary-100); }
  .btn-delete { display: inline-flex; align-items: center; padding: 0.35rem 0.5rem; background: var(--color-red-50); color: var(--color-red-600); border: 1px solid var(--color-red-200); border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-delete:hover { background: var(--color-red-100); }
  .confirm-delete { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--color-red-600); }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: var(--color-red-600); color: var(--color-white); border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: var(--color-slate-100); color: var(--color-slate-700); border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  .empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-slate-400); }
  .empty-state i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .empty-state p { margin: 0; font-size: 0.9375rem; }

  .loading { padding: 3rem; text-align: center; color: var(--color-slate-500); }
  .error-banner { padding: 1rem; background: var(--color-red-50); color: var(--color-red-600); border-radius: 6px; margin-bottom: 1rem; }

  .modal-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: var(--color-white); border-radius: 10px; width: 900px; max-width: 98vw; height: 80vh; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-modal); }
  .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .modal-header h2 { margin: 0 0 0.2rem; font-size: 1.2rem; color: var(--color-slate-800); }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: var(--color-slate-500); }
  .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--color-slate-500); padding: 0.25rem; flex-shrink: 0; }
  .close-btn:hover { color: var(--color-slate-800); }
  .modal-error { padding: 0.75rem 1.5rem; background: var(--color-red-50); color: var(--color-red-600); font-size: 0.875rem; flex-shrink: 0; border-bottom: 1px solid var(--color-red-200); }

  .modal-meta { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; align-items: flex-end; flex-wrap: wrap; }
  .meta-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .meta-field-grow { flex: 1; min-width: 180px; }
  .meta-field-narrow input { min-width: 0; width: 5rem; }
  .meta-field label { font-size: 0.8125rem; font-weight: 500; color: var(--color-slate-700); }
  .meta-field input, .meta-field select { padding: 0.5rem 0.625rem; border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.875rem; background: var(--color-white); min-width: 220px; }
  .meta-field input:focus, .meta-field select:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }
  .active-toggle { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--color-slate-700); padding-bottom: 0.55rem; cursor: pointer; }

  .field-tabs { display: flex; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .field-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.8125rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
  .field-tab:hover { color: var(--color-slate-800); background: var(--color-slate-50); }
  .field-tab.active { color: var(--color-teal-600); border-bottom-color: var(--color-teal-600); }
  .field-tab i { font-size: 1rem; }
  .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tab-dot-ok { background: var(--color-green-500); }
  .tab-dot-empty { background: var(--color-slate-300); }

  .editor-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .tab-help { padding: 0.625rem 1.5rem; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-100); font-size: 0.8rem; color: var(--color-slate-500); line-height: 1.5; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .word-count { color: var(--color-primary-500); font-weight: 500; white-space: nowrap; }
  .text-area { flex: 1; width: 100%; padding: 1rem 1.5rem; border: none; resize: none; font-size: 0.875rem; line-height: 1.7; color: var(--color-slate-800); font-family: inherit; background: var(--color-white); box-sizing: border-box; }
  .text-area:focus { outline: none; }
  .text-area::placeholder { color: var(--color-slate-400); }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .btn-primary { padding: 0.5rem 1.25rem; background: var(--color-primary-600); color: var(--color-white); border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: var(--color-primary-700); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 0.5rem 1.25rem; background: var(--color-white); color: var(--color-slate-700); border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
  .btn-secondary:hover { background: var(--color-slate-50); }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
