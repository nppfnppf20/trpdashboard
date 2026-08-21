<script>
  import { onMount } from 'svelte';
  import {
    getPolicyDocuments,
    createPolicyDocument,
    updatePolicyDocument,
    deletePolicyDocument
  } from '$lib/api/policyDocuments.js';

  export let project;
  $: projectId = project?.id;

  let docs = [];
  let loading = true;
  let error = null;

  let showForm = false;
  let formSection = 'adopted';
  let editingId = null;
  let saving = false;
  let formError = null;

  const emptyForm = () => ({ plan_name: '', plan_type: 'local', year_adopted: '', month_adopted: '', summary: '', relevance: '' });
  let form = emptyForm();

  onMount(() => { if (projectId) load(); });

  // Called by the parent (ProjectViewModal) after it creates plan documents
  // directly via the extract-from-document flow, so this list picks them up.
  export function refresh() {
    return load();
  }

  async function load() {
    loading = true;
    error = null;
    try {
      docs = await getPolicyDocuments(projectId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: adoptedDocs  = docs.filter(d => d.section === 'adopted');
  $: emergingDocs = docs.filter(d => d.section === 'emerging');
  $: otherDocs    = docs.filter(d => d.section === 'other');

  function openAdd(section) {
    formSection = section;
    editingId = null;
    form = emptyForm();
    formError = null;
    showForm = true;
  }

  function openEdit(doc) {
    formSection = doc.section;
    editingId = doc.id;
    form = {
      plan_name: doc.plan_name || '',
      plan_type: doc.plan_type || 'local',
      year_adopted: doc.year_adopted ?? '',
      month_adopted: doc.month_adopted ?? '',
      summary: doc.summary || '',
      relevance: doc.relevance || ''
    };
    formError = null;
    showForm = true;
  }

  function cancel() {
    showForm = false;
    editingId = null;
    form = emptyForm();
    formError = null;
  }

  async function save() {
    if (!form.plan_name.trim()) { formError = 'Plan name is required'; return; }
    saving = true;
    formError = null;
    try {
      const richSection = formSection === 'supplementary' || formSection === 'other';
      const isPlanSection = formSection === 'adopted' || formSection === 'emerging';
      const payload = {
        section: formSection,
        plan_name: form.plan_name.trim(),
        plan_type: isPlanSection ? form.plan_type : null,
        year_adopted: formSection === 'adopted' && form.year_adopted ? parseInt(form.year_adopted) : null,
        month_adopted: formSection === 'adopted' && form.month_adopted ? parseInt(form.month_adopted) : null,
        summary: richSection ? (form.summary.trim() || null) : null,
        relevance: richSection ? (form.relevance.trim() || null) : null
      };
      if (editingId) {
        const updated = await updatePolicyDocument(editingId, payload);
        docs = docs.map(d => d.id === editingId ? updated : d);
      } else {
        const created = await createPolicyDocument(projectId, payload);
        docs = [...docs, created];
      }
      cancel();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(doc) {
    if (!confirm(`Delete "${doc.plan_name}"?`)) return;
    try {
      await deletePolicyDocument(doc.id);
      docs = docs.filter(d => d.id !== doc.id);
    } catch (err) {
      alert(err.message);
    }
  }

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const SECTIONS = [
    { key: 'adopted',       label: 'Development Plan Adopted' },
    { key: 'emerging',      label: 'Development Plan Emerging' },
    { key: 'supplementary', label: 'Supplementary Guidance' },
    { key: 'other',         label: 'Other Material Considerations' }
  ];

  function docsForSection(key) {
    return docs.filter(d => d.section === key);
  }
</script>

<div class="rd-section">
  {#if loading}
    <div class="rd-loading">
      <div class="spinner"></div>
      <span>Loading…</span>
    </div>
  {:else if error}
    <div class="rd-error">
      <i class="las la-exclamation-circle"></i>
      <span>{error}</span>
      <button on:click={load}>Retry</button>
    </div>
  {:else}

    {#each SECTIONS as sec}
      {#if showForm && formSection === sec.key}
        {@const rich = sec.key === 'supplementary' || sec.key === 'other'}
        <div class="rd-form-card">
          <div class="form-title">
            {editingId ? 'Edit Entry' : 'Add Entry'}
          </div>

          <div class="form-row">
            <div class="field">
              <label>{rich ? 'Name' : 'Plan Name'} <span class="required">*</span></label>
              <input type="text" bind:value={form.plan_name} placeholder={sec.key === 'supplementary' ? 'e.g. Renewable Energy SPD' : sec.key === 'other' ? 'e.g. NPPF (2024)' : 'e.g. Local Plan 2019'} />
            </div>
          </div>

          {#if sec.key === 'adopted' || sec.key === 'emerging'}
            <div class="form-row">
              <div class="field">
                <label>Plan Type</label>
                <select bind:value={form.plan_type}>
                  <option value="local">Local Plan</option>
                  <option value="neighbourhood">Neighbourhood Plan</option>
                </select>
              </div>
            </div>
          {/if}

          {#if sec.key === 'adopted'}
            <div class="form-row two-col">
              <div class="field">
                <label>Year Adopted</label>
                <input type="number" bind:value={form.year_adopted} placeholder="e.g. 2021" min="1900" max="2100" />
              </div>
              <div class="field">
                <label>Month Adopted <span class="optional">(optional)</span></label>
                <input type="number" bind:value={form.month_adopted} placeholder="e.g. 9 for September" min="1" max="12" />
              </div>
            </div>
          {/if}

          {#if rich}
            <div class="form-row">
              <div class="field">
                <label>Summary</label>
                <textarea bind:value={form.summary} rows="3" placeholder="What this covers…"></textarea>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Relevance to Project <span class="optional">(optional)</span></label>
                <textarea bind:value={form.relevance} rows="2" placeholder="How this applies to the project…"></textarea>
              </div>
            </div>
          {/if}

          {#if formError}
            <div class="form-error">{formError}</div>
          {/if}

          <div class="form-actions">
            <button class="btn-cancel" on:click={cancel} disabled={saving}>Cancel</button>
            <button class="btn-save" on:click={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      {/if}
      <div class="rd-card">
        <div class="rd-card-header">
          <span class="rd-card-title">{sec.label}</span>
          <button class="btn-add" on:click={() => openAdd(sec.key)}>
            <i class="las la-plus"></i> Add
          </button>
        </div>

        {#if docsForSection(sec.key).length === 0}
          <div class="rd-empty">No entries yet.</div>
        {:else}
          {@const rich = sec.key === 'supplementary' || sec.key === 'other'}
          {@const isPlanSection = sec.key === 'adopted' || sec.key === 'emerging'}
          <table class="rd-table">
            <thead>
              <tr>
                <th>{rich ? 'Name' : 'Plan Name'}</th>
                {#if isPlanSection}<th>Plan Type</th>{/if}
                {#if sec.key === 'adopted'}<th>Adopted</th>{/if}
                {#if rich}<th>Summary</th><th>Relevance to Project</th>{/if}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each docsForSection(sec.key) as doc (doc.id)}
                <tr>
                  <td class="cell-name">{doc.plan_name}</td>
                  {#if isPlanSection}
                    <td class="cell-year">{doc.plan_type === 'neighbourhood' ? 'Neighbourhood Plan' : 'Local Plan'}</td>
                  {/if}
                  {#if sec.key === 'adopted'}
                    <td class="cell-year">{doc.year_adopted ? (doc.month_adopted ? `${MONTH_NAMES[doc.month_adopted - 1]} ${doc.year_adopted}` : doc.year_adopted) : '—'}</td>
                  {/if}
                  {#if rich}
                    <td class="cell-text">{doc.summary ?? '—'}</td>
                    <td class="cell-text">{doc.relevance ?? '—'}</td>
                  {/if}
                  <td class="cell-actions">
                    <button class="icon-btn" on:click={() => openEdit(doc)} title="Edit">
                      <i class="las la-pen"></i>
                    </button>
                    <button class="icon-btn danger" on:click={() => remove(doc)} title="Delete">
                      <i class="las la-trash"></i>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}

  {/if}
</div>

<style>
  .rd-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
  }

  .rd-loading, .rd-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: #64748b;
    font-size: 0.85rem;
  }
  .rd-error i { color: #ef4444; }
  .rd-error button {
    padding: 0.3rem 0.75rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
  }

  .spinner {
    width: 1.25rem; height: 1.25rem;
    border: 2px solid #f3f4f6; border-top-color: #9333ea;
    border-radius: 50%; animation: spin 1s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Form */
  .rd-form-card {
    background: #faf5ff;
    border: 1px solid #e9d5ff;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .form-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #7e22ce;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .form-badge {
    font-size: 0.68rem;
    font-weight: 600;
    background: #e9d5ff;
    color: #7e22ce;
    padding: 0.15rem 0.5rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .form-row { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-row.two-col { flex-direction: row; gap: 0.75rem; }
  .form-row.two-col .field { flex: 1; }
  .field { display: flex; flex-direction: column; gap: 0.25rem; }
  select {
    padding: 0.45rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
  }
  label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .required { color: #ef4444; }
  .optional { color: #94a3b8; font-weight: 400; }
  input[type="text"], input[type="number"], textarea {
    padding: 0.45rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    resize: vertical;
  }
  input[type="text"]:focus, input[type="number"]:focus, textarea:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px #f3e8ff;
  }
  .form-error {
    font-size: 0.78rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.4rem 0.65rem;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .btn-cancel {
    padding: 0.4rem 0.9rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 6px;
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    color: #64748b;
  }
  .btn-cancel:hover { background: #f8fafc; }
  .btn-save {
    padding: 0.4rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: #7e22ce; }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Section cards */
  .rd-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .rd-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.9rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    gap: 0.5rem;
  }

  .rd-card-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-add:hover { background: #7e22ce; }

  .rd-empty {
    padding: 0.75rem 0.9rem;
    color: #94a3b8;
    font-size: 0.82rem;
    font-style: italic;
  }

  /* Table */
  .rd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .rd-table thead tr {
    background: #fafafa;
    border-bottom: 1px solid #e2e8f0;
  }
  .rd-table th {
    padding: 0.4rem 0.75rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .rd-table tbody tr { border-bottom: 1px solid #f1f5f9; }
  .rd-table tbody tr:last-child { border-bottom: none; }
  .rd-table tbody tr:hover { background: #f8fafc; }
  .rd-table td { padding: 0.5rem 0.75rem; color: #334155; vertical-align: middle; }

  .cell-name { line-height: 1.4; }
  .cell-year { color: #64748b; white-space: nowrap; width: 5rem; }
  .cell-text { color: #64748b; line-height: 1.4; white-space: pre-wrap; }
  .cell-actions { text-align: right; white-space: nowrap; width: 4rem; }

  .icon-btn {
    width: 26px; height: 26px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 5px; color: #64748b; font-size: 0.88rem;
  }
  .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
  .icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }
</style>
