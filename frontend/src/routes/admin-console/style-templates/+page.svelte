<script>
  import { onMount } from 'svelte';
  import { listDocumentStyleTemplates, createDocumentStyleTemplate, updateDocumentStyleTemplate, deleteDocumentStyleTemplate } from '$lib/api/documentStyleTemplates.js';
  import { listGuidingBriefs } from '$lib/api/guidingBriefs.js';

  let templates = $state([]);
  let guidingBriefs = $state([]);
  let loading = $state(true);
  let error = $state(null);

  let modalOpen = $state(false);
  let modalSaving = $state(false);
  let modalError = $state(null);
  let isNew = $state(false);
  let activeId = $state(null);
  let activeTab = $state('text');
  let form = $state({ name: '', guiding_brief_id: '', style_text: '', notes: '' });

  let confirmDeleteId = $state(null);

  onMount(load);

  async function load() {
    loading = true; error = null;
    try {
      [templates, guidingBriefs] = await Promise.all([
        listDocumentStyleTemplates(),
        listGuidingBriefs(),
      ]);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Group templates by document_type (via guiding brief)
  const DOCUMENT_TYPE_LABELS = {
    hlpv: 'HLPV Narrative',
    planning_statement: 'Planning Statement',
    statement_of_case: 'Statement of Case',
    statement_of_common_ground: 'Statement of Common Ground',
    proof_of_evidence: 'Proof of Evidence',
    planning_notice: 'Planning Notice',
    stage1_review: 'Stage 1 Review',
  };

  const grouped = $derived(() => {
    const map = new Map();
    for (const t of templates) {
      const key = t.document_type || '__none__';
      if (!map.has(key)) map.set(key, { label: DOCUMENT_TYPE_LABELS[key] || key || 'No document type', items: [] });
      map.get(key).items.push(t);
    }
    return [...map.values()];
  });

  function openNew() {
    isNew = true; activeId = null;
    form = { name: '', guiding_brief_id: guidingBriefs[0]?.id ?? '', style_text: '', notes: '' };
    activeTab = 'text';
    modalError = null;
    modalOpen = true;
  }

  function openEdit(t) {
    isNew = false; activeId = t.id;
    form = {
      name:             t.name ?? '',
      guiding_brief_id: t.guiding_brief_id ?? '',
      style_text:       t.style_text ?? '',
      notes:            t.notes ?? '',
    };
    activeTab = 'text';
    modalError = null;
    modalOpen = true;
  }

  async function save() {
    if (!form.name.trim()) { modalError = 'Name is required'; return; }
    modalSaving = true; modalError = null;
    try {
      const payload = {
        name:             form.name.trim(),
        guiding_brief_id: form.guiding_brief_id || null,
        style_text:       form.style_text.trim() || null,
        notes:            form.notes.trim() || null,
      };
      if (isNew) {
        const created = await createDocumentStyleTemplate(payload);
        templates = [...templates, created];
      } else {
        const updated = await updateDocumentStyleTemplate(activeId, payload);
        templates = templates.map(t => t.id === activeId ? updated : t);
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
      await deleteDocumentStyleTemplate(id);
      templates = templates.filter(t => t.id !== id);
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

  const selectedBrief = $derived(
    guidingBriefs.find(b => b.id === Number(form.guiding_brief_id)) ?? null
  );
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Style Templates</h1>
      <p>Example documents used as style guides when drafting. Linked to a Guiding Brief to inherit document type and development type. The LLM finds the matching section and writes in that style.</p>
    </div>
    <button class="btn-add" onclick={openNew} disabled={!guidingBriefs.length}>
      <i class="las la-plus"></i> New Style Template
    </button>
  </div>

  {#if !guidingBriefs.length && !loading}
    <div class="info-banner">
      <i class="las la-info-circle"></i>
      You need at least one Guiding Brief before adding style templates. <a href="/admin-console/guiding-briefs">Add a Guiding Brief</a> first.
    </div>
  {/if}

  {#if error}<div class="error-banner">{error}</div>{/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if !templates.length}
    <div class="empty-state">
      <i class="las la-file-alt"></i>
      <p>No style templates yet. Add one to give the LLM an example to match when drafting.</p>
    </div>
  {:else}
    {#each grouped() as group}
      <div class="group">
        <div class="group-header">
          <span class="group-label">{group.label}</span>
          <span class="group-count">{group.items.length} template{group.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table class="templates-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Guiding Brief</th>
              <th>Dev Type</th>
              <th>Style Text</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each group.items as t (t.id)}
              <tr>
                <td class="name-cell">{t.name}</td>
                <td class="brief-cell">
                  {#if t.guiding_brief_name}
                    <span class="brief-badge">{t.guiding_brief_name}</span>
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
                <td class="devtype-cell">
                  {#if t.development_type}
                    <span class="devtype-badge">{t.development_type}</span>
                  {:else}
                    <span class="muted">All types</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if t.style_text?.trim()}
                    <span class="pill pill-ok">{wordCount(t.style_text).toLocaleString()}w</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if t.notes?.trim()}
                    <span class="pill pill-blue">note</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="actions-cell">
                  {#if confirmDeleteId === t.id}
                    <span class="confirm-delete">
                      Delete?
                      <button class="btn-danger-sm" onclick={() => confirmDelete(t.id)}>Yes</button>
                      <button class="btn-cancel-sm" onclick={() => confirmDeleteId = null}>No</button>
                    </span>
                  {:else}
                    <button class="btn-edit" onclick={() => openEdit(t)}><i class="las la-edit"></i> Edit</button>
                    <button class="btn-delete" onclick={() => confirmDeleteId = t.id}><i class="las la-trash"></i></button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  {/if}
</div>

{#if modalOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) modalOpen = false; }}>
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{isNew ? 'New Style Template' : form.name}</h2>
          <p class="modal-sub">
            {#if selectedBrief}
              {DOCUMENT_TYPE_LABELS[selectedBrief.document_type] ?? selectedBrief.document_type}{selectedBrief.development_type ? ` - ${selectedBrief.development_type}` : ''}
            {:else}
              Paste an example document to guide the LLM's writing style.
            {/if}
          </p>
        </div>
        <button class="close-btn" onclick={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-meta">
        <div class="meta-field meta-field-grow">
          <label for="st-name">Name</label>
          <input id="st-name" type="text" bind:value={form.name} placeholder="e.g. Planning Statement - Solar Farm" />
        </div>
        <div class="meta-field">
          <label for="st-brief">Guiding Brief</label>
          <select id="st-brief" bind:value={form.guiding_brief_id}>
            <option value="">None</option>
            {#each guidingBriefs as b}
              <option value={b.id}>
                {DOCUMENT_TYPE_LABELS[b.document_type] ?? b.document_type}{b.development_type ? ` / ${b.development_type}` : ''}: {b.name}
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field-tabs">
        <button class="field-tab" class:active={activeTab === 'text'} onclick={() => activeTab = 'text'}>
          <i class="las la-align-left"></i>
          Style Text
          {#if form.style_text?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
        <button class="field-tab" class:active={activeTab === 'notes'} onclick={() => activeTab = 'notes'}>
          <i class="las la-sticky-note"></i>
          Notes
          {#if form.notes?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
      </div>

      <div class="editor-wrap">
        {#if activeTab === 'text'}
          <div class="tab-help">
            Paste an example document as plain text. The LLM will find the section that most closely matches what it is working on and write in that style. If no section matches, it uses the overall document tone. Do not include confidential or client-identifiable content.
            {#if form.style_text?.trim()}<span class="word-count">{wordCount(form.style_text).toLocaleString()} words</span>{/if}
          </div>
          <textarea
            class="text-area"
            bind:value={form.style_text}
            placeholder="Paste the example document here as plain text (headings, paragraphs, etc.)."
          ></textarea>
        {:else}
          <div class="tab-help">Internal notes about this template: source, version, or usage context.</div>
          <textarea
            class="text-area"
            bind:value={form.notes}
            placeholder="Optional notes, e.g. source of this example, date prepared, any caveats."
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
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  .page-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: #1e293b; }
  .page-header p { margin: 0; color: #64748b; font-size: 0.875rem; max-width: 640px; }

  .btn-add {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; background: #2563eb; color: white;
    border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .btn-add:hover:not(:disabled) { background: #1d4ed8; }
  .btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

  .info-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; margin-bottom: 1.5rem; font-size: 0.875rem; }
  .info-banner a { color: #1d4ed8; font-weight: 500; }

  .group { margin-bottom: 2rem; }
  .group-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .group-label { font-size: 0.9375rem; font-weight: 700; color: #1e293b; }
  .group-count { font-size: 0.8125rem; color: #94a3b8; }

  .templates-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
  .templates-table th { background: #f8fafc; padding: 0.625rem 1rem; text-align: left; font-size: 0.8125rem; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .templates-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; color: #1e293b; vertical-align: middle; }
  .templates-table tr:last-child td { border-bottom: none; }

  .name-cell { font-weight: 500; }
  .brief-badge { display: inline-block; padding: 0.15rem 0.5rem; background: #f0fdf4; color: #15803d; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .devtype-badge { display: inline-block; padding: 0.15rem 0.5rem; background: #ede9fe; color: #6d28d9; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .muted { color: #94a3b8; font-size: 0.8125rem; }
  .pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .pill-ok { background: #dcfce7; color: #15803d; }
  .pill-blue { background: #dbeafe; color: #1d4ed8; }
  .pill-empty { background: #f1f5f9; color: #94a3b8; }

  .actions-cell { white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .btn-edit { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-edit:hover { background: #dbeafe; }
  .btn-delete { display: inline-flex; align-items: center; padding: 0.35rem 0.5rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-delete:hover { background: #fee2e2; }
  .confirm-delete { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: #dc2626; }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  .empty-state { text-align: center; padding: 4rem 2rem; color: #94a3b8; }
  .empty-state i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .empty-state p { margin: 0; font-size: 0.9375rem; }

  .loading { padding: 3rem; text-align: center; color: #64748b; }
  .error-banner { padding: 1rem; background: #fef2f2; color: #dc2626; border-radius: 6px; margin-bottom: 1rem; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; border-radius: 10px; width: 900px; max-width: 98vw; height: 80vh; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
  .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .modal-header h2 { margin: 0 0 0.2rem; font-size: 1.2rem; color: #1e293b; }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: #64748b; }
  .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #64748b; padding: 0.25rem; flex-shrink: 0; }
  .close-btn:hover { color: #1e293b; }
  .modal-error { padding: 0.75rem 1.5rem; background: #fef2f2; color: #dc2626; font-size: 0.875rem; flex-shrink: 0; border-bottom: 1px solid #fecaca; }

  .modal-meta { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; align-items: flex-end; }
  .meta-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .meta-field-grow { flex: 1; }
  .meta-field label { font-size: 0.8125rem; font-weight: 500; color: #374151; }
  .meta-field input, .meta-field select { padding: 0.5rem 0.625rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; background: white; min-width: 220px; }
  .meta-field input:focus, .meta-field select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .field-tabs { display: flex; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .field-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
  .field-tab:hover { color: #1e293b; background: #f8fafc; }
  .field-tab.active { color: #0d9488; border-bottom-color: #0d9488; }
  .field-tab i { font-size: 1rem; }
  .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tab-dot-ok { background: #22c55e; }
  .tab-dot-empty { background: #cbd5e1; }

  .editor-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .tab-help { padding: 0.625rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; font-size: 0.8rem; color: #64748b; line-height: 1.5; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .word-count { color: #3b82f6; font-weight: 500; white-space: nowrap; }
  .text-area { flex: 1; width: 100%; padding: 1rem 1.5rem; border: none; resize: none; font-size: 0.875rem; line-height: 1.7; color: #1e293b; font-family: inherit; background: white; box-sizing: border-box; }
  .text-area:focus { outline: none; }
  .text-area::placeholder { color: #94a3b8; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
  .btn-primary { padding: 0.5rem 1.25rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 0.5rem 1.25rem; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
