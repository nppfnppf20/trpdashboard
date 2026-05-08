<script>
  import { onMount } from 'svelte';
  import { getPolicies, createPolicy, updatePolicy, deletePolicy } from '$lib/api/lpaAnalysis.js';

  export let project;
  $: projectId = project?.id;

  let policies = [];
  let loading = true;
  let error = null;

  // Form state
  let showForm = false;
  let editingId = null;
  let saving = false;
  let formError = null;

  const emptyForm = () => ({
    policy_reference: '',
    policy_name: '',
    policy_type: 'national',
    policy_text: '',
    relevant_supporting_text: '',
    notes: '',
    is_key_policy: false
  });

  let form = emptyForm();

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    loading = true;
    error = null;
    try {
      policies = await getPolicies(projectId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openAdd() {
    editingId = null;
    form = emptyForm();
    formError = null;
    showForm = true;
  }

  function openEdit(policy) {
    editingId = policy.id;
    form = {
      policy_reference: policy.policy_reference || '',
      policy_name: policy.policy_name || '',
      policy_type: policy.policy_type || 'national',
      policy_text: policy.policy_text || '',
      relevant_supporting_text: policy.relevant_supporting_text || '',
      notes: policy.notes || '',
      is_key_policy: policy.is_key_policy || false
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
    if (!form.policy_name.trim()) { formError = 'Policy name is required'; return; }
    saving = true;
    formError = null;
    try {
      const payload = {
        policy_reference: form.policy_reference.trim() || null,
        policy_name: form.policy_name.trim(),
        policy_type: form.policy_type,
        policy_text: form.policy_text.trim() || null,
        relevant_supporting_text: form.relevant_supporting_text.trim() || null,
        notes: form.notes.trim() || null,
        is_key_policy: form.is_key_policy
      };
      if (editingId) {
        await updatePolicy(editingId, payload);
      } else {
        await createPolicy(projectId, payload);
      }
      await load();
      cancel();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(policy) {
    if (!confirm(`Delete policy "${policy.policy_name}"?`)) return;
    try {
      await deletePolicy(policy.id);
      policies = policies.filter(p => p.id !== policy.id);
    } catch (err) {
      alert(err.message);
    }
  }

  const TYPE_LABELS = { national: 'National', local: 'Local', neighbourhood: 'Neighbourhood', supplementary: 'Supplementary', other: 'Other' };
  const TYPE_COLOURS = { national: '#3b82f6', local: '#10b981', neighbourhood: '#f59e0b', supplementary: '#8b5cf6', other: '#64748b' };
</script>

<div class="policy-tab">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading policies…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{error}</p>
      <button on:click={load}>Retry</button>
    </div>
  {:else}
    <div class="tab-header">
      <div class="header-info">
        <h3>Relevant Planning Policies</h3>
        <p>Policies the LPA will consider when determining this application. Used to contextualise LPA decision analysis.</p>
      </div>
      <button class="btn-add" on:click={openAdd}>
        <i class="las la-plus"></i> Add Policy
      </button>
    </div>

    {#if showForm}
      <div class="policy-form-card">
        <div class="form-title">{editingId ? 'Edit Policy' : 'Add Policy'}</div>

        <div class="form-row two-col">
          <div class="field">
            <label>Policy Reference</label>
            <input type="text" bind:value={form.policy_reference} placeholder="e.g. NPPF Para 11, Policy H1" />
          </div>
          <div class="field">
            <label>Policy Type</label>
            <select bind:value={form.policy_type}>
              <option value="national">National</option>
              <option value="local">Local</option>
              <option value="neighbourhood">Neighbourhood</option>
              <option value="supplementary">Supplementary</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Policy Name <span class="required">*</span></label>
            <input type="text" bind:value={form.policy_name} placeholder="e.g. Presumption in Favour of Sustainable Development" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Full Policy Text</label>
            <textarea bind:value={form.policy_text} rows="5" placeholder="Paste the full policy wording here…"></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Relevant Supporting Text</label>
            <textarea bind:value={form.relevant_supporting_text} rows="3" placeholder="Any supporting text, footnotes, or guidance relevant to this project…"></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Notes</label>
            <textarea bind:value={form.notes} rows="2" placeholder="Your notes on why this policy is relevant, how it applies, etc."></textarea>
          </div>
        </div>

        <div class="form-row key-toggle-row">
          <label class="toggle-label">
            <input type="checkbox" bind:checked={form.is_key_policy} />
            <span class="toggle-text">Key Policy — flag this as a primary determining policy for the project</span>
          </label>
        </div>

        {#if formError}
          <div class="form-error">{formError}</div>
        {/if}

        <div class="form-actions">
          <button class="btn-cancel" on:click={cancel} disabled={saving}>Cancel</button>
          <button class="btn-save" on:click={save} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Policy'}
          </button>
        </div>
      </div>
    {/if}

    {#if policies.length === 0 && !showForm}
      <div class="empty-state">
        <i class="las la-balance-scale"></i>
        <p>No policies added yet.</p>
        <p class="sub">Add the planning policies relevant to this project. These will be used to analyse how the LPA has treated them in similar decisions.</p>
      </div>
    {:else if policies.length > 0}
      <div class="policy-list">
        {#each policies as policy (policy.id)}
          <div class="policy-card" class:key={policy.is_key_policy}>
            <div class="policy-card-header">
              <div class="policy-meta">
                {#if policy.is_key_policy}
                  <span class="key-badge"><i class="las la-star"></i> Key Policy</span>
                {/if}
                <span class="type-badge" style="background: {TYPE_COLOURS[policy.policy_type]}22; color: {TYPE_COLOURS[policy.policy_type]}">
                  {TYPE_LABELS[policy.policy_type]}
                </span>
                {#if policy.policy_reference}
                  <span class="ref-chip">{policy.policy_reference}</span>
                {/if}
              </div>
              <div class="policy-actions">
                <button class="icon-btn" on:click={() => openEdit(policy)} title="Edit">
                  <i class="las la-pen"></i>
                </button>
                <button class="icon-btn danger" on:click={() => remove(policy)} title="Delete">
                  <i class="las la-trash"></i>
                </button>
              </div>
            </div>

            <div class="policy-name">{policy.policy_name}</div>

            {#if policy.policy_text}
              <details class="policy-detail">
                <summary>Full policy text</summary>
                <p class="detail-body">{policy.policy_text}</p>
              </details>
            {/if}

            {#if policy.relevant_supporting_text}
              <details class="policy-detail">
                <summary>Relevant supporting text</summary>
                <p class="detail-body">{policy.relevant_supporting_text}</p>
              </details>
            {/if}

            {#if policy.notes}
              <div class="policy-notes"><i class="las la-comment-alt"></i> {policy.notes}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .policy-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.25rem;
    gap: 1rem;
  }

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

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  .header-info h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }
  .header-info p {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-add:hover { background: #7e22ce; }

  /* Form */
  .policy-form-card {
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
  }
  .form-row { display: flex; flex-direction: column; gap: 0.5rem; }
  .form-row.two-col { flex-direction: row; gap: 1rem; }
  .form-row.two-col .field { flex: 1; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #475569;
  }
  .required { color: #ef4444; }
  input[type="text"], select, textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    resize: vertical;
  }
  input[type="text"]:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px #f3e8ff;
  }

  .key-toggle-row { flex-direction: row; align-items: center; }
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 400;
    color: #1e293b;
  }
  .toggle-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #9333ea;
    cursor: pointer;
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

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem;
    color: #94a3b8;
    text-align: center;
  }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; }
  .empty-state .sub { font-size: 0.8rem; max-width: 400px; line-height: 1.5; }

  /* Policy cards */
  .policy-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .policy-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .policy-card.key {
    border-color: #c4b5fd;
    background: #faf5ff;
  }

  .policy-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .policy-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 700;
    background: #f3e8ff;
    color: #7e22ce;
    padding: 0.2rem 0.5rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .type-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .ref-chip {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    background: #f1f5f9;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .policy-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 6px;
    color: #64748b;
    font-size: 0.95rem;
  }
  .icon-btn:hover { background: #f1f5f9; color: #1e293b; }
  .icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }

  .policy-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
  }

  .policy-detail {
    font-size: 0.82rem;
  }
  .policy-detail summary {
    cursor: pointer;
    color: #9333ea;
    font-weight: 500;
    user-select: none;
  }
  .detail-body {
    margin: 0.5rem 0 0;
    color: #334155;
    line-height: 1.6;
    white-space: pre-wrap;
    background: #f8fafc;
    border-left: 3px solid #e9d5ff;
    padding: 0.5rem 0.75rem;
    border-radius: 0 4px 4px 0;
  }

  .policy-notes {
    font-size: 0.8rem;
    color: #64748b;
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
  }
  .policy-notes i { color: #9333ea; margin-top: 1px; flex-shrink: 0; }
</style>
