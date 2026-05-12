<script>
  import { onMount } from 'svelte';
  import { listPolicyTemplates, upsertPolicyTemplate, deletePolicyTemplate } from '$lib/api/planningApplication.js';

  const DISCIPLINES = [
    { value: 'heritage', label: 'Heritage' },
    { value: 'landscape', label: 'Landscape' },
    { value: 'ecology', label: 'Ecology' },
    { value: 'ag_land', label: 'Agricultural Land' },
    { value: 'renewables', label: 'Renewables' },
    { value: 'trees', label: 'Trees' },
    { value: 'airfields', label: 'Airfields' },
    { value: 'flood', label: 'Flood Risk' },
    { value: 'aviation', label: 'Aviation' },
    { value: 'highways', label: 'Highways' },
    { value: 'amenity', label: 'Amenity' }
  ];

  const DEV_TYPES = [
    'Residential', 'Commercial', 'Solar', 'Wind', 'Mixed Use',
    'Industrial', 'Change of Use', 'Agricultural', 'Other'
  ];

  let templates = [];
  let loading = true;
  let error = null;

  // Modal state
  let modalOpen = false;
  let modalSaving = false;
  let modalError = null;
  let editId = null; // null = new
  let form = { discipline: '', development_type: '', policy_national_text: '' };

  // Delete confirm
  let deleteId = null;
  let deleteLoading = false;

  onMount(loadTemplates);

  async function loadTemplates() {
    loading = true;
    error = null;
    try {
      templates = await listPolicyTemplates();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openNew() {
    editId = null;
    form = { discipline: '', development_type: '', policy_national_text: '' };
    modalError = null;
    modalOpen = true;
  }

  function openEdit(t) {
    editId = t.id;
    form = { discipline: t.discipline, development_type: t.development_type, policy_national_text: t.policy_national_text ?? '' };
    modalError = null;
    modalOpen = true;
  }

  async function saveTemplate() {
    if (!form.discipline || !form.development_type) {
      modalError = 'Discipline and development type are required.';
      return;
    }
    modalSaving = true;
    modalError = null;
    try {
      await upsertPolicyTemplate(form);
      modalOpen = false;
      await loadTemplates();
    } catch (err) {
      modalError = err.message;
    } finally {
      modalSaving = false;
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    deleteLoading = true;
    try {
      await deletePolicyTemplate(deleteId);
      deleteId = null;
      await loadTemplates();
    } catch (err) {
      error = err.message;
    } finally {
      deleteLoading = false;
    }
  }

  function disciplineLabel(val) {
    return DISCIPLINES.find(d => d.value === val)?.label ?? val;
  }

  function truncate(text, n = 120) {
    if (!text) return '—';
    return text.length > n ? text.slice(0, n) + '…' : text;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Policy Templates</h1>
      <p>Pre-written national policy text auto-applied when issue tracks are created, keyed by discipline and development type.</p>
    </div>
    <button class="btn-primary" on:click={openNew}>
      <i class="las la-plus"></i> New Template
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading templates…</div>
  {:else if error}
    <div class="error-banner">{error}</div>
  {:else if templates.length === 0}
    <div class="empty">No templates yet. Click "New Template" to create one.</div>
  {:else}
    <table class="tpl-table">
      <thead>
        <tr>
          <th>Development Type</th>
          <th>Discipline</th>
          <th>National Policy Text</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each templates as t}
          <tr>
            <td>{t.development_type}</td>
            <td>{disciplineLabel(t.discipline)}</td>
            <td class="text-preview">{truncate(t.policy_national_text)}</td>
            <td class="actions-cell">
              <button class="btn-sm btn-edit" on:click={() => openEdit(t)}>Edit</button>
              <button class="btn-sm btn-delete" on:click={() => deleteId = t.id}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<!-- Create / Edit modal -->
{#if modalOpen}
  <div class="modal-backdrop" on:click|self={() => modalOpen = false}>
    <div class="modal">
      <div class="modal-header">
        <h2>{editId ? 'Edit Template' : 'New Template'}</h2>
        <button class="close-btn" on:click={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}
        <div class="modal-error">{modalError}</div>
      {/if}

      <label>
        Development Type
        <select bind:value={form.development_type}>
          <option value="">Select…</option>
          {#each DEV_TYPES as dt}
            <option value={dt}>{dt}</option>
          {/each}
        </select>
      </label>

      <label>
        Discipline
        <select bind:value={form.discipline}>
          <option value="">Select…</option>
          {#each DISCIPLINES as d}
            <option value={d.value}>{d.label}</option>
          {/each}
        </select>
      </label>

      <label>
        National Policy Text
        <textarea bind:value={form.policy_national_text} rows="12" placeholder="Paste or type the national policy text for this discipline + development type combination…"></textarea>
      </label>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => modalOpen = false} disabled={modalSaving}>Cancel</button>
        <button class="btn-primary" on:click={saveTemplate} disabled={modalSaving}>
          {modalSaving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete confirm -->
{#if deleteId}
  <div class="modal-backdrop" on:click|self={() => deleteId = null}>
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2>Delete Template</h2>
        <button class="close-btn" on:click={() => deleteId = null}><i class="las la-times"></i></button>
      </div>
      <p>Are you sure you want to delete this template? This cannot be undone.</p>
      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => deleteId = null} disabled={deleteLoading}>Cancel</button>
        <button class="btn-delete-confirm" on:click={confirmDelete} disabled={deleteLoading}>
          {deleteLoading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 1100px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .page-header h1 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .page-header p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .btn-secondary:hover { background: #f9fafb; }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

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
    vertical-align: top;
  }

  .tpl-table tr:last-child td { border-bottom: none; }

  .text-preview {
    color: #475569;
    max-width: 420px;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .actions-cell {
    white-space: nowrap;
  }

  .btn-sm {
    padding: 0.3rem 0.65rem;
    border-radius: 5px;
    font-size: 0.8125rem;
    cursor: pointer;
    border: 1px solid transparent;
    margin-right: 0.35rem;
  }

  .btn-edit {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
  }

  .btn-edit:hover { background: #dbeafe; }

  .btn-delete {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }

  .btn-delete:hover { background: #fee2e2; }

  .btn-delete-confirm {
    padding: 0.5rem 1rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .btn-delete-confirm:hover { background: #dc2626; }
  .btn-delete-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

  .loading, .empty {
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
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 10px;
    padding: 1.5rem;
    width: 600px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-sm { width: 380px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #64748b;
    padding: 0.25rem;
  }

  .close-btn:hover { color: #1e293b; }

  .modal-error {
    padding: 0.75rem;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .modal label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .modal select,
  .modal textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
  }

  .modal textarea {
    resize: vertical;
    min-height: 200px;
    line-height: 1.6;
  }

  .modal select:focus,
  .modal textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }
</style>
