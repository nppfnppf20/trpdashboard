<script>
  import { onMount } from 'svelte';
  import {
    getPlanningHistory,
    createPlanningHistoryEntry,
    updatePlanningHistoryEntry,
    deletePlanningHistoryEntry
  } from '$lib/api/planningHistory.js';

  export let project;
  $: projectId = project?.id;

  let entries = [];
  let loading = true;
  let error = null;

  // Form state — section indicates which section's Add button was pressed
  let showForm = false;
  let formSection = 'on_site';
  let editingId = null;
  let saving = false;
  let formError = null;

  const emptyForm = () => ({
    planning_ref: '',
    description: '',
    decision: '',
    decision_date: ''
  });
  let form = emptyForm();

  onMount(() => { if (projectId) load(); });

  async function load() {
    loading = true;
    error = null;
    try {
      entries = await getPlanningHistory(projectId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: onSiteEntries = entries.filter(e => e.section === 'on_site');
  $: nearbyEntries = entries.filter(e => e.section === 'nearby');

  function openAdd(section) {
    formSection = section;
    editingId = null;
    form = emptyForm();
    formError = null;
    showForm = true;
  }

  function openEdit(entry) {
    formSection = entry.section;
    editingId = entry.id;
    form = {
      planning_ref: entry.planning_ref || '',
      description: entry.description || '',
      decision: entry.decision || '',
      decision_date: entry.decision_date || ''
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
    if (!form.planning_ref.trim() && !form.description.trim()) {
      formError = 'At least a reference or description is required';
      return;
    }
    saving = true;
    formError = null;
    try {
      const payload = {
        section: formSection,
        planning_ref: form.planning_ref.trim() || null,
        description: form.description.trim() || null,
        decision: form.decision.trim() || null,
        decision_date: form.decision_date || null
      };
      if (editingId) {
        const updated = await updatePlanningHistoryEntry(editingId, payload);
        entries = entries.map(e => e.id === editingId ? updated : e);
      } else {
        const created = await createPlanningHistoryEntry(projectId, payload);
        entries = [...entries, created];
      }
      cancel();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(entry) {
    if (!confirm(`Delete this planning history entry?`)) return;
    try {
      await deletePlanningHistoryEntry(entry.id);
      entries = entries.filter(e => e.id !== entry.id);
    } catch (err) {
      alert(err.message);
    }
  }

  function formatDate(d) {
    return d || '—';
  }
</script>

<div class="ph-tab">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading planning history…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{error}</p>
      <button on:click={load}>Retry</button>
    </div>
  {:else}

    <!-- On Site Planning History -->
    {#if showForm && formSection === 'on_site'}
      <div class="ph-form-card">
        <div class="form-title">{editingId ? 'Edit Entry' : 'Add Entry'}</div>

        <div class="form-row two-col">
          <div class="field">
            <label>Planning Application Reference</label>
            <input type="text" bind:value={form.planning_ref} placeholder="e.g. 22/01234/FUL" />
          </div>
          <div class="field">
            <label>Description</label>
            <input type="text" bind:value={form.description} placeholder="Brief description of development" />
          </div>
        </div>

        <div class="form-row two-col">
          <div class="field">
            <label>Decision</label>
            <input type="text" bind:value={form.decision} placeholder="e.g. Approved, Refused, Withdrawn" />
          </div>
          <div class="field">
            <label>Decision Date</label>
            <input type="text" bind:value={form.decision_date} placeholder="e.g. Jan 2021 or 15 Jan 2021" />
          </div>
        </div>

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
    <div class="ph-section">
      <div class="section-header">
        <div class="section-info">
          <h3>On Site Planning History</h3>
        </div>
        <button class="btn-add" on:click={() => openAdd('on_site')}>
          <i class="las la-plus"></i> Add
        </button>
      </div>

      {#if onSiteEntries.length === 0}
        <div class="empty-state">
          <i class="las la-history"></i>
          <p>No on-site planning history added yet.</p>
        </div>
      {:else}
        <div class="ph-table-wrapper">
          <table class="ph-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Description</th>
                <th>Decision</th>
                <th>Decision Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each onSiteEntries as entry (entry.id)}
                <tr>
                  <td class="cell-ref">{entry.planning_ref || '—'}</td>
                  <td class="cell-desc">{entry.description || '—'}</td>
                  <td class="cell-decision">{entry.decision || '—'}</td>
                  <td class="cell-date">{formatDate(entry.decision_date)}</td>
                  <td class="cell-actions">
                    <button class="icon-btn" on:click={() => openEdit(entry)} title="Edit">
                      <i class="las la-pen"></i>
                    </button>
                    <button class="icon-btn danger" on:click={() => remove(entry)} title="Delete">
                      <i class="las la-trash"></i>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <!-- Nearby Planning History -->
    {#if showForm && formSection === 'nearby'}
      <div class="ph-form-card">
        <div class="form-title">{editingId ? 'Edit Entry' : 'Add Entry'}</div>

        <div class="form-row two-col">
          <div class="field">
            <label>Planning Application Reference</label>
            <input type="text" bind:value={form.planning_ref} placeholder="e.g. 22/01234/FUL" />
          </div>
          <div class="field">
            <label>Description</label>
            <input type="text" bind:value={form.description} placeholder="Brief description of development" />
          </div>
        </div>

        <div class="form-row two-col">
          <div class="field">
            <label>Decision</label>
            <input type="text" bind:value={form.decision} placeholder="e.g. Approved, Refused, Withdrawn" />
          </div>
          <div class="field">
            <label>Decision Date</label>
            <input type="text" bind:value={form.decision_date} placeholder="e.g. Jan 2021 or 15 Jan 2021" />
          </div>
        </div>

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
    <div class="ph-section">
      <div class="section-header">
        <div class="section-info">
          <h3>Relevant Nearby Planning History</h3>
        </div>
        <button class="btn-add" on:click={() => openAdd('nearby')}>
          <i class="las la-plus"></i> Add
        </button>
      </div>

      {#if nearbyEntries.length === 0}
        <div class="empty-state">
          <i class="las la-map-marker-alt"></i>
          <p>No nearby planning history added yet.</p>
        </div>
      {:else}
        <div class="ph-table-wrapper">
          <table class="ph-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Description</th>
                <th>Decision</th>
                <th>Decision Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each nearbyEntries as entry (entry.id)}
                <tr>
                  <td class="cell-ref">{entry.planning_ref || '—'}</td>
                  <td class="cell-desc">{entry.description || '—'}</td>
                  <td class="cell-decision">{entry.decision || '—'}</td>
                  <td class="cell-date">{formatDate(entry.decision_date)}</td>
                  <td class="cell-actions">
                    <button class="icon-btn" on:click={() => openEdit(entry)} title="Edit">
                      <i class="las la-pen"></i>
                    </button>
                    <button class="icon-btn danger" on:click={() => remove(entry)} title="Delete">
                      <i class="las la-trash"></i>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  {/if}
</div>

<style>
  .ph-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.25rem;
    gap: 1.25rem;
  }

  /* Loading / error */
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: #64748b;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .error-state button {
    padding: 0.5rem 1rem; background: #9333ea; color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }
  .spinner {
    width: 2rem; height: 2rem;
    border: 3px solid #f3f4f6; border-top-color: #9333ea;
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Form */
  .ph-form-card {
    background: #faf5ff;
    border: 1px solid #e9d5ff;
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .form-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #7e22ce;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .form-section-badge {
    font-size: 0.7rem;
    font-weight: 600;
    background: #e9d5ff;
    color: #7e22ce;
    padding: 0.15rem 0.5rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .form-row { display: flex; flex-direction: column; gap: 0.5rem; }
  .form-row.two-col { flex-direction: row; gap: 1rem; }
  .form-row.two-col .field { flex: 1; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label { font-size: 0.78rem; font-weight: 600; color: #475569; }
  input[type="text"], input[type="date"] {
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
  }
  input[type="text"]:focus, input[type="date"]:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px #f3e8ff;
  }
  .form-error {
    font-size: 0.8rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }
  .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: #64748b;
  }
  .btn-cancel:hover { background: #f8fafc; }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: #7e22ce; }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Sections */
  .ph-section {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .section-info h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
  }
  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-add:hover { background: #7e22ce; }

  /* Empty state */
  .empty-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 0.5rem;
    color: #94a3b8;
    font-size: 0.875rem;
  }
  .empty-state i { font-size: 1.25rem; opacity: 0.6; }
  .empty-state p { margin: 0; }

  /* Table */
  .ph-table-wrapper {
    overflow-x: auto;
  }
  .ph-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .ph-table thead tr {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .ph-table th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .ph-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
  }
  .ph-table tbody tr:last-child { border-bottom: none; }
  .ph-table tbody tr:hover { background: #f8fafc; }
  .ph-table td {
    padding: 0.6rem 0.75rem;
    color: #334155;
    vertical-align: top;
  }
  .cell-ref {
    font-family: monospace;
    font-size: 0.82rem;
    color: #475569;
    white-space: nowrap;
  }
  .cell-desc { min-width: 200px; line-height: 1.4; }
  .cell-decision { color: #334155; font-size: 0.82rem; white-space: nowrap; }
  .cell-date { white-space: nowrap; color: #64748b; font-size: 0.82rem; }
  .cell-actions {
    white-space: nowrap;
    text-align: right;
  }
  .icon-btn {
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 6px;
    color: #64748b;
    font-size: 0.9rem;
  }
  .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
  .icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }
</style>
