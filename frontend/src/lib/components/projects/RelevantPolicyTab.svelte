<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getPolicies, createPolicy, updatePolicy, deletePolicy, getNationalPolicyPrecedents } from '$lib/api/lpaAnalysis.js';
  import { getPolicyDocuments } from '$lib/api/policyDocuments.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';

  const dispatch = createEventDispatcher();

  export let project;
  $: projectId = project?.id;
  $: projectDevTypes = project?.development_types ?? [];

  let policies = [];
  let planDocs = [];
  let issueTypes = [];
  let precedents = [];
  let loading = true;
  let error = null;
  let showTemplates = false;
  let showPrecedents = false;
  let importingKey = null;

  // Generic templates (development_type IS NULL) always apply; dev-type ones
  // only apply where they overlap the project's selected development types.
  $: matchingTemplates = issueTypes.filter(
    t => !t.development_type || projectDevTypes.includes(t.development_type)
  );

  function templateFieldCount(t) {
    return ['nppf_text', 'nppg_text', 'other_national_text', 'other_guidance_text'].filter(f => t[f]?.trim()).length;
  }

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
    is_key_policy: false,
    plan_id: ''
  });

  let form = emptyForm();

  onMount(() => { if (projectId) load(); });

  async function load() {
    loading = true;
    error = null;
    try {
      [policies, planDocs] = await Promise.all([
        getPolicies(projectId),
        getPolicyDocuments(projectId)
      ]);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
    // Loaded independently — a failure here shouldn't block the policy list above.
    try { issueTypes = await listIssueTypes(); }
    catch (err) { console.error('Failed to load policy snippet templates:', err); }
    try { precedents = await getNationalPolicyPrecedents(projectId); }
    catch (err) { console.error('Failed to load national policy precedents:', err); }
  }

  // Copies only the portable parts (reference/name/verbatim text) — never
  // relevant_supporting_text or is_key_policy, which are the other project's
  // own judgment calls, not facts that should carry across.
  async function importPrecedent(p) {
    const key = `${p.policy_reference}|${p.policy_name}`;
    importingKey = key;
    try {
      await createPolicy(projectId, {
        policy_reference: p.policy_reference,
        policy_name: p.policy_name,
        policy_type: 'national',
        policy_text: p.policy_text
      });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      importingKey = null;
    }
  }

  function planLabel(doc) {
    const typeTag = doc.plan_type === 'neighbourhood' ? 'Neighbourhood Plan' : doc.plan_type === 'local' ? 'Local Plan' : null;
    return typeTag ? `${doc.plan_name} (${typeTag})` : doc.plan_name;
  }

  function openAdd() {
    editingId = null;
    form = emptyForm();
    formError = null;
    showForm = true;
    dispatch('formopen');
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
      is_key_policy: policy.is_key_policy || false,
      plan_id: policy.plan_id ?? ''
    };
    formError = null;
    showForm = true;
    dispatch('formopen');
  }

  function cancel() {
    showForm = false;
    editingId = null;
    form = emptyForm();
    formError = null;
    dispatch('formclose');
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
        is_key_policy: form.is_key_policy,
        plan_id: form.plan_id || null
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

  // Bulk add state
  let showBulkModal = false;
  let bulkRows = [];
  let bulkSaving = false;
  let bulkError = null;

  function emptyRow() {
    return {
      policy_reference: '',
      policy_name: '',
      policy_type: 'national',
      policy_text: '',
      relevant_supporting_text: '',
      notes: '',
      is_key_policy: false
    };
  }

  function openBulkModal() {
    bulkRows = Array.from({ length: 4 }, emptyRow);
    bulkError = null;
    showBulkModal = true;
  }

  function closeBulkModal() {
    showBulkModal = false;
    bulkRows = [];
    bulkError = null;
  }

  function addBulkRow() {
    bulkRows = [...bulkRows, emptyRow()];
  }

  function removeBulkRow(i) {
    bulkRows = bulkRows.filter((_, idx) => idx !== i);
  }

  function applyTypeToAll(type) {
    bulkRows = bulkRows.map(r => ({ ...r, policy_type: type }));
  }

  async function saveAll() {
    const toSave = bulkRows.filter(r => r.policy_name.trim());
    if (toSave.length === 0) { bulkError = 'At least one policy name is required'; return; }
    bulkSaving = true;
    bulkError = null;
    try {
      await Promise.all(toSave.map(r => createPolicy(projectId, {
        policy_reference: r.policy_reference.trim() || null,
        policy_name: r.policy_name.trim(),
        policy_type: r.policy_type,
        policy_text: r.policy_text.trim() || null,
        relevant_supporting_text: r.relevant_supporting_text.trim() || null,
        notes: r.notes.trim() || null,
        is_key_policy: r.is_key_policy
      })));
      await load();
      closeBulkModal();
    } catch (err) {
      bulkError = err.message;
    } finally {
      bulkSaving = false;
    }
  }
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
      <button class="btn-templates" on:click={() => showTemplates = !showTemplates}>
        <i class="las la-layer-group"></i> National Policy Templates ({matchingTemplates.length})
        <i class="las {showTemplates ? 'la-angle-up' : 'la-angle-down'}"></i>
      </button>
      <button class="btn-templates" on:click={() => showPrecedents = !showPrecedents}>
        <i class="las la-history"></i> Used on Similar Projects ({precedents.length})
        <i class="las {showPrecedents ? 'la-angle-up' : 'la-angle-down'}"></i>
      </button>
      <div class="tab-header-actions">
        <button class="btn-add-multiple" on:click={openBulkModal}>
          <i class="las la-list-ul"></i> Add Multiple
        </button>
        <button class="btn-add" on:click={openAdd}>
          <i class="las la-plus"></i> Add Policy
        </button>
      </div>
    </div>

    {#if showTemplates}
      <div class="templates-panel">
        {#if !projectDevTypes.length}
          <p class="templates-hint">This project has no Development Type set - only generic (non-dev-type-specific) templates are shown below. Set a development type on the project's info page to also see dev-type-specific ones.</p>
        {/if}
        {#if matchingTemplates.length === 0}
          <p class="templates-empty">No matching snippet templates.</p>
        {:else}
          <div class="templates-list">
            {#each matchingTemplates as t (t.id)}
              <details class="template-item">
                <summary>
                  <span class="template-label">{t.label}</span>
                  <span class="template-devtype">{t.development_type || 'generic'}</span>
                  <span class="template-fields">{templateFieldCount(t)} field{templateFieldCount(t) === 1 ? '' : 's'}</span>
                </summary>
                {#if t.nppf_text}<div class="template-field"><strong>NPPF</strong>{@html t.nppf_text}</div>{/if}
                {#if t.nppg_text}<div class="template-field"><strong>NPPG</strong>{@html t.nppg_text}</div>{/if}
                {#if t.other_national_text}<div class="template-field"><strong>Other National Policy</strong>{@html t.other_national_text}</div>{/if}
                {#if t.other_guidance_text}<div class="template-field"><strong>Other Guidance</strong>{@html t.other_guidance_text}</div>{/if}
              </details>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if showPrecedents}
      <div class="templates-panel">
        {#if !projectDevTypes.length}
          <p class="templates-hint">This project has no Development Type set, so no other projects can be matched. Set a development type on the project's info page first.</p>
        {:else if precedents.length === 0}
          <p class="templates-empty">No national policies recorded yet on other projects sharing this project's development type.</p>
        {:else}
          <div class="templates-list">
            {#each precedents as p (`${p.policy_reference}|${p.policy_name}`)}
              <div class="precedent-item">
                <div class="precedent-header">
                  {#if p.policy_reference}<span class="ref-chip">{p.policy_reference}</span>{/if}
                  <span class="precedent-name">{p.policy_name}</span>
                  <span class="precedent-used-on">used on {p.used_on} other project{p.used_on == 1 ? '' : 's'}</span>
                  <button
                    class="btn-import"
                    disabled={importingKey === `${p.policy_reference}|${p.policy_name}`}
                    on:click={() => importPrecedent(p)}
                  >
                    {importingKey === `${p.policy_reference}|${p.policy_name}` ? 'Adding…' : 'Add to this project'}
                  </button>
                </div>
                {#if p.policy_text}
                  <details class="policy-detail">
                    <summary>Policy text</summary>
                    <p class="detail-body">{p.policy_text}</p>
                  </details>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

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
            <label>Parent Plan <span class="optional">(optional)</span></label>
            <select bind:value={form.plan_id}>
              <option value="">None</option>
              {#each planDocs as doc (doc.id)}
                <option value={doc.id}>{planLabel(doc)}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Relevant Policy Text</label>
            <textarea bind:value={form.policy_text} rows="5" placeholder="Paste the relevant policy wording here…"></textarea>
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
            <span class="toggle-text">Key Policy: flag this as a primary determining policy for the project</span>
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

    {#if policies.length > 0}
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
                {#if policy.plan_name}
                  <span class="ref-chip">{policy.plan_name}</span>
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
                <summary>Relevant policy text</summary>
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

<!-- Bulk Add Modal -->
{#if showBulkModal}
  <div class="bulk-backdrop" on:click|self={closeBulkModal} role="presentation">
    <div class="bulk-modal">
      <div class="bulk-modal-header">
        <h3>Add Multiple Policies</h3>
        <button class="bulk-close-btn" on:click={closeBulkModal}>&times;</button>
      </div>

      <div class="bulk-modal-body">
        {#each bulkRows as row, i (i)}
          <div class="bulk-row-card">
            <div class="bulk-row-number">#{i + 1}</div>
            <div class="bulk-row-fields">
              <div class="bulk-form-row two-col">
                <div class="field">
                  <label>Policy Reference</label>
                  <input type="text" bind:value={row.policy_reference} />
                </div>
                <div class="field">
                  <label>Policy Type {#if i === 0}<span class="apply-all-hint">(sets all)</span>{/if}</label>
                  <select bind:value={row.policy_type} on:change={i === 0 ? (e) => applyTypeToAll(e.target.value) : undefined}>
                    <option value="national">National</option>
                    <option value="local">Local</option>
                    <option value="neighbourhood">Neighbourhood</option>
                    <option value="supplementary">Supplementary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="field field--key-policy">
                  <label class="toggle-label">
                    <input type="checkbox" bind:checked={row.is_key_policy} />
                    <span>Key Policy</span>
                  </label>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>Policy Name <span class="required">*</span></label>
                  <input type="text" bind:value={row.policy_name} />
                </div>
              </div>
              <div class="bulk-form-row two-col">
                <div class="field">
                  <label>Relevant Policy Text</label>
                  <textarea bind:value={row.policy_text} rows="2"></textarea>
                </div>
                <div class="field">
                  <label>Relevant Supporting Text</label>
                  <textarea bind:value={row.relevant_supporting_text} rows="2"></textarea>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>Notes</label>
                  <textarea bind:value={row.notes} rows="1"></textarea>
                </div>
              </div>
            </div>
            {#if bulkRows.length > 1}
              <button class="bulk-remove-btn" on:click={() => removeBulkRow(i)} title="Remove row">
                <i class="las la-times"></i>
              </button>
            {/if}
          </div>
        {/each}

        <button class="bulk-add-row-btn" on:click={addBulkRow}>
          <i class="las la-plus-circle"></i> Add Row
        </button>
      </div>

      {#if bulkError}
        <div class="bulk-error">{bulkError}</div>
      {/if}

      <div class="bulk-modal-footer">
        <span class="bulk-count-hint">{bulkRows.filter(r => r.policy_name.trim()).length} of {bulkRows.length} rows will be saved</span>
        <div class="bulk-footer-actions">
          <button class="btn-cancel" on:click={closeBulkModal} disabled={bulkSaving}>Cancel</button>
          <button class="btn-save" on:click={saveAll} disabled={bulkSaving}>
            {bulkSaving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

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
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
  }

  .tab-header-actions { display: flex; align-items: center; gap: 0.5rem; }

  .btn-templates {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-templates:hover { background: #f8fafc; border-color: #cbd5e1; }

  .templates-panel {
    margin: 0 1.25rem 0.5rem;
    padding: 0.9rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .templates-hint {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
  }
  .templates-empty { margin: 0; font-size: 0.85rem; color: #94a3b8; }
  .templates-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .template-item {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
  }
  .template-item summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #1e293b;
    font-weight: 500;
    list-style: none;
  }
  .template-item summary::-webkit-details-marker { display: none; }
  .template-label { flex: 1; }
  .template-devtype {
    font-size: 0.7rem; font-weight: 600; color: #64748b; background: #f1f5f9;
    padding: 0.1rem 0.4rem; border-radius: 3px; text-transform: capitalize;
  }
  .template-fields { font-size: 0.72rem; color: #94a3b8; white-space: nowrap; }
  .template-field {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.8rem;
    color: #334155;
    line-height: 1.6;
  }
  .template-field strong {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
    margin-bottom: 0.2rem;
  }

  .precedent-item {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
  }
  .precedent-header { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  .precedent-name { flex: 1; font-weight: 500; color: #1e293b; min-width: 8rem; }
  .precedent-used-on { font-size: 0.72rem; color: #94a3b8; white-space: nowrap; }
  .btn-import {
    padding: 0.3rem 0.7rem;
    background: white;
    color: #9333ea;
    border: 1px solid #9333ea;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
  }
  .btn-import:hover:not(:disabled) { background: #faf5ff; }
  .btn-import:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-add-multiple {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: white;
    color: #9333ea;
    border: 1px solid #9333ea;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-add-multiple:hover { background: #faf5ff; }

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
  .optional { color: #94a3b8; font-weight: 400; }
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
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 0.5rem;
    color: #94a3b8;
    font-size: 0.875rem;
  }
  .empty-state i { font-size: 1.25rem; opacity: 0.6; }
  .empty-state p { margin: 0; }

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

  /* Bulk Add Modal */
  .bulk-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .bulk-modal {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .bulk-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .bulk-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
  }
  .bulk-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #64748b;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .bulk-close-btn:hover { color: #1e293b; }

  .bulk-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bulk-row-card {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    background: #faf5ff;
    border: 1px solid #e9d5ff;
    border-radius: 10px;
    padding: 1rem;
    position: relative;
  }

  .bulk-row-number {
    font-size: 0.7rem;
    font-weight: 700;
    color: #9333ea;
    background: #f3e8ff;
    border-radius: 20px;
    padding: 0.15rem 0.5rem;
    flex-shrink: 0;
    margin-top: 0.2rem;
    white-space: nowrap;
  }

  .bulk-row-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  .bulk-remove-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: #94a3b8;
    border-radius: 6px;
    margin-top: 0.15rem;
    font-size: 0.9rem;
  }
  .bulk-remove-btn:hover { background: #fef2f2; color: #dc2626; }

  .bulk-form-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bulk-form-row.two-col {
    flex-direction: row;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .bulk-form-row.two-col .field { flex: 1; min-width: 0; }
  .field--key-policy {
    flex: 0 0 auto !important;
    justify-content: flex-end;
    padding-top: 1.6rem;
  }

  .bulk-add-row-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1.25rem;
    border: 2px dashed #c4b5fd;
    background: white;
    color: #9333ea;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
    transition: background 0.15s, border-color 0.15s;
  }
  .bulk-add-row-btn:hover { background: #faf5ff; border-color: #9333ea; }
  .bulk-add-row-btn i { font-size: 1.1rem; }

  .bulk-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .bulk-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .bulk-count-hint {
    font-size: 0.8rem;
    color: #64748b;
  }
  .bulk-footer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .apply-all-hint {
    font-size: 0.7rem;
    font-weight: 400;
    color: #9333ea;
    margin-left: 0.25rem;
  }
</style>
