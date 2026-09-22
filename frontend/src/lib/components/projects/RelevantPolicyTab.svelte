<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { getPolicies, createPolicy, updatePolicy, deletePolicy, getNationalPolicyPrecedents, extractPolicyWording } from '$lib/api/lpaAnalysis.js';
  import { getPolicyDocuments } from '$lib/api/policyDocuments.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';
  import { getNppfPolicies } from '$lib/api/nppfPolicies.js';

  const dispatch = createEventDispatcher();

  export let project;
  $: projectId = project?.id;
  $: projectDevTypes = project?.development_types ?? [];

  let policies = [];
  let planDocs = [];
  let issueTypes = [];
  let precedents = [];
  let nppfLibrary = [];
  let loading = true;
  let error = null;
  let showTemplates = false;
  let showPrecedents = false;
  let importingKey = null;
  let nppfPickId = '';

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
    try { nppfLibrary = await getNppfPolicies(); }
    catch (err) { console.error('Failed to load NPPF policy library:', err); }
  }

  // Selecting an entry from the NPPF library fills the form with its exact
  // reference/name/text — see [[project_nppf_policy_bank]]. Still editable
  // afterwards; this is a starting point, not a lock.
  function pickNppfPolicy() {
    if (!nppfPickId) return;
    const p = nppfLibrary.find(n => n.id === Number(nppfPickId));
    if (!p) return;
    form.policy_reference = p.policy_reference || '';
    form.policy_name = p.policy_name;
    form.policy_text = p.policy_text;
  }

  // Called by the parent (ProjectViewModal) after it creates plan documents
  // via the extract-from-document flow, so the Parent Plan dropdown here
  // (in both the single form and the bulk-add modal) picks them up.
  export async function refreshPlanDocs() {
    planDocs = await getPolicyDocuments(projectId);
  }

  // Called by the parent when the sibling Development Plans tab (which owns
  // its own separate copy of this data) adds/edits/deletes a plan directly —
  // a fuller reload than refreshPlanDocs since existing policies' plan_name
  // chips (from the listPolicies JOIN) also need to pick up the change.
  export async function refresh() {
    await load();
  }

  // Called by the parent to hand off extracted policies (with plan_id already
  // matched against the plan documents it just created) into the existing
  // bulk-review table, so the user reviews/edits everything before saving.
  export function reviewExtractedPolicies(rows, warning = null) {
    bulkRows = rows;
    bulkError = warning || null;
    showBulkModal = true;
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
    nppfPickId = '';
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
    nppfPickId = '';
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

  // Bulk select/delete — mainly for clearing out duplicate policies (see
  // [[project_nppf_policy_bank]]). Deleting a policy cascades to remove any
  // Drafting Issue links pointing at it (drafting_issue_policy_relevance.policy_id
  // ON DELETE CASCADE) — the confirm dialog below warns about this.
  let selectMode = false;
  let selectedIds = new Set();
  let bulkDeleting = false;

  function toggleSelectMode() {
    selectMode = !selectMode;
    if (!selectMode) selectedIds = new Set();
  }

  function toggleSelect(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function toggleSelectAll() {
    selectedIds = selectedIds.size === policies.length ? new Set() : new Set(policies.map(p => p.id));
  }

  async function deleteSelected() {
    if (!selectedIds.size) return;
    const n = selectedIds.size;
    if (!confirm(`Delete ${n} selected polic${n === 1 ? 'y' : 'ies'}? This cannot be undone, and will remove any Drafting Issue links to them.`)) return;
    bulkDeleting = true;
    try {
      await Promise.all([...selectedIds].map(id => deletePolicy(id)));
      policies = policies.filter(p => !selectedIds.has(p.id));
      selectedIds = new Set();
      selectMode = false;
    } catch (err) {
      alert(err.message);
    } finally {
      bulkDeleting = false;
    }
  }

  // Extract Policy Wording: pick a plan whose policies are already saved,
  // re-upload that plan's document, and let the LLM find each policy's
  // verbatim operative wording in it (one plan at a time, so the document
  // handed to the model only ever needs to cover the policies it belongs to).
  let showWordingModal = false;
  let wordingStep = 'plan'; // 'plan' | 'upload' | 'review'
  let wordingPlanId = '';
  let wordingMode = 'file'; // 'file' | 'text'
  let wordingFile = null;
  let wordingText = '';
  let wordingExtracting = false;
  let wordingSaving = false;
  let wordingError = null;
  let wordingWarning = null;
  let wordingSourceText = null;
  let wordingSourceFileName = null;
  let showWordingSourceText = false;
  let wordingRows = [];

  $: plansWithPolicies = planDocs.filter(d => policies.some(p => p.plan_id === d.id));

  // Rough, client-side context-window estimate for the upload step, mirroring
  // the ~200,000-char baseline used by the Planning Application Workspace's
  // context meters (PlanningWorkspace.svelte / StartingDocsModal.svelte) —
  // a fixed prompt/instructions allowance, the selected plan's policy list,
  // plus whatever's pasted/chosen so far. File size is used as a rough proxy
  // for extracted text length since it isn't parsed until submit.
  $: wordingPlanPolicies = wordingPlanId ? policies.filter(p => p.plan_id === Number(wordingPlanId)) : [];
  $: wordingPolicyListChars = wordingPlanPolicies.reduce((acc, p) => acc + (p.policy_reference?.length ?? 0) + (p.policy_name?.length ?? 0) + 5, 0);
  $: wordingDocChars = wordingMode === 'text' ? wordingText.length : (wordingFile?.size ?? 0);
  $: wordingContextChars = 1500 + wordingPolicyListChars + wordingDocChars;
  $: wordingContextPct = Math.min(100, Math.round(wordingContextChars / 200000 * 100));
  $: wordingContextColour = wordingContextPct >= 75 ? '#dc2626' : wordingContextPct >= 50 ? '#d97706' : '#16a34a';

  function openWordingModal() {
    showWordingModal = true;
    wordingStep = plansWithPolicies.length > 0 ? 'plan' : 'no-plans';
    wordingPlanId = '';
    wordingMode = 'file';
    wordingFile = null;
    wordingText = '';
    wordingError = null;
    wordingWarning = null;
    wordingSourceText = null;
    wordingSourceFileName = null;
    showWordingSourceText = false;
    wordingRows = [];
  }

  function closeWordingModal() {
    showWordingModal = false;
  }

  function chooseWordingPlan() {
    if (!wordingPlanId) return;
    wordingError = null;
    wordingStep = 'upload';
  }

  function onWordingFileChange(e) {
    wordingFile = e.target.files?.[0] || null;
  }

  function clearWordingVerbatim(row) {
    if (row._verbatim) row._verbatim = null;
  }

  async function runWordingExtract() {
    if (wordingMode === 'file' && !wordingFile) { wordingError = 'Choose a file to upload'; return; }
    if (wordingMode === 'text' && !wordingText.trim()) { wordingError = 'Paste the document text'; return; }
    const planPolicies = policies.filter(p => p.plan_id === Number(wordingPlanId));
    if (!planPolicies.length) { wordingError = 'No policies found for that plan'; return; }

    wordingExtracting = true;
    wordingError = null;
    try {
      const { results, warning, sourceText } = await extractPolicyWording(projectId, {
        file: wordingMode === 'file' ? wordingFile : null,
        text: wordingMode === 'text' ? wordingText : undefined,
        policyIds: planPolicies.map(p => p.id)
      });
      wordingWarning = warning || null;
      wordingSourceText = sourceText || null;
      wordingSourceFileName = wordingMode === 'file' ? wordingFile.name : 'pasted text';

      const byId = Object.fromEntries(results.map(r => [r.policy_id, r]));
      wordingRows = planPolicies.map(p => {
        const r = byId[p.id];
        return {
          policy_id: p.id,
          policy_reference: p.policy_reference,
          policy_name: p.policy_name,
          existing_text: p.policy_text || null,
          wording: r?.wording ?? '',
          found: !!r?.wording,
          _verbatim: r?.verbatim ?? null,
          include: !!r?.wording
        };
      });
      wordingStep = 'review';
    } catch (err) {
      wordingError = err.message;
    } finally {
      wordingExtracting = false;
    }
  }

  async function saveWording() {
    const toSave = wordingRows.filter(r => r.include && r.wording.trim());
    if (!toSave.length) { wordingError = 'Nothing selected to save'; return; }
    wordingSaving = true;
    wordingError = null;
    try {
      await Promise.all(toSave.map(r => {
        const existing = policies.find(p => p.id === r.policy_id);
        return updatePolicy(r.policy_id, {
          policy_reference: existing.policy_reference,
          policy_name: existing.policy_name,
          policy_type: existing.policy_type,
          policy_text: r.wording.trim(),
          relevant_supporting_text: existing.relevant_supporting_text,
          notes: existing.notes,
          is_key_policy: existing.is_key_policy,
          plan_id: existing.plan_id
        });
      }));
      await load();
      closeWordingModal();
    } catch (err) {
      wordingError = err.message;
    } finally {
      wordingSaving = false;
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
      is_key_policy: false,
      plan_id: ''
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

  // Settles each row independently rather than failing the whole batch on
  // one bad row (Promise.all would reject on the first failure while the
  // others had already been inserted — leaving the user with a generic
  // error and no way to tell which rows actually saved). Successful rows
  // are removed from the table; failed ones stay with their own error so
  // they can be fixed and retried without re-entering everything else.
  async function saveAll() {
    const toSave = bulkRows.filter(r => r.policy_name.trim());
    if (toSave.length === 0) { bulkError = 'At least one policy name is required'; return; }
    bulkSaving = true;
    bulkError = null;
    const results = await Promise.allSettled(toSave.map(r => createPolicy(projectId, {
      policy_reference: r.policy_reference.trim() || null,
      policy_name: r.policy_name.trim(),
      policy_type: r.policy_type,
      policy_text: r.policy_text.trim() || null,
      relevant_supporting_text: r.relevant_supporting_text.trim() || null,
      notes: r.notes.trim() || null,
      is_key_policy: r.is_key_policy,
      plan_id: r.plan_id || null
    })));

    const failed = [];
    toSave.forEach((r, i) => {
      const result = results[i];
      if (result.status === 'rejected') {
        failed.push({ ...r, saveError: result.reason?.message || 'Failed to save' });
      }
    });

    const succeededCount = toSave.length - failed.length;
    if (failed.length) {
      bulkRows = [...failed, ...bulkRows.filter(r => !r.policy_name.trim())];
      bulkError = `${succeededCount} of ${toSave.length} saved. ${failed.length} failed — see the error under each row below.`;
    } else {
      bulkError = null;
    }

    if (succeededCount > 0) await load();
    bulkSaving = false;
    if (!failed.length) closeBulkModal();
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
        <button class="btn-add-multiple" on:click={openWordingModal}>
          <i class="las la-file-alt"></i> Extract Policy Wording
        </button>
        <button class="btn-add-multiple" class:btn-select-active={selectMode} on:click={toggleSelectMode}>
          <i class="las la-check-square"></i> {selectMode ? 'Cancel Select' : 'Select'}
        </button>
        <button class="btn-add-multiple" on:click={openBulkModal}>
          <i class="las la-list-ul"></i> Add Multiple
        </button>
        <button class="btn-add" on:click={openAdd}>
          <i class="las la-plus"></i> Add Policy
        </button>
      </div>
    </div>

    {#if selectMode}
      <div class="select-bar">
        <label class="select-all-label">
          <input type="checkbox" checked={policies.length > 0 && selectedIds.size === policies.length} on:change={toggleSelectAll} />
          Select all ({policies.length})
        </label>
        <span class="select-count">{selectedIds.size} selected</span>
        <button class="btn-delete-selected" disabled={!selectedIds.size || bulkDeleting} on:click={deleteSelected}>
          <i class="las la-trash"></i> {bulkDeleting ? 'Deleting…' : `Delete Selected`}
        </button>
      </div>
    {/if}

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
      <div class="bulk-backdrop" on:click|self={cancel} role="presentation">
        <div class="bulk-modal policy-form-modal">
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

        {#if form.policy_type === 'national' && nppfLibrary.length > 0}
          <div class="form-row nppf-pick-row">
            <div class="field">
              <label><i class="las la-flag"></i> Import from NPPF Library <span class="optional">(optional)</span></label>
              <select bind:value={nppfPickId} on:change={pickNppfPolicy}>
                <option value="">Select a policy to fill in its wording…</option>
                {#each nppfLibrary as p (p.id)}
                  <option value={p.id}>{p.policy_reference ? `${p.policy_reference}: ` : ''}{p.policy_name}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}

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
        </div>
      </div>
    {/if}

    {#if policies.length > 0}
      <div class="policy-list">
        {#each policies as policy (policy.id)}
          <div class="card policy-card" class:key={policy.is_key_policy} class:selected={selectMode && selectedIds.has(policy.id)}>
            <div class="policy-card-header">
              <div class="policy-meta">
                {#if selectMode}
                  <input type="checkbox" class="policy-select-checkbox" checked={selectedIds.has(policy.id)} on:change={() => toggleSelect(policy.id)} />
                {/if}
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
              {#if row.saveError}
                <div class="bulk-row-error"><i class="las la-exclamation-triangle"></i> {row.saveError}</div>
              {/if}
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
              <div class="bulk-form-row two-col">
                <div class="field">
                  <label>Policy Name <span class="required">*</span></label>
                  <input type="text" bind:value={row.policy_name} />
                </div>
                <div class="field">
                  <label>Parent Plan <span class="optional">(optional)</span></label>
                  <select bind:value={row.plan_id}>
                    <option value="">None</option>
                    {#each planDocs as doc (doc.id)}
                      <option value={doc.id}>{planLabel(doc)}</option>
                    {/each}
                  </select>
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

<!-- Extract Policy Wording Modal -->
{#if showWordingModal}
  <div class="bulk-backdrop" on:click|self={closeWordingModal} role="presentation">
    <div class="bulk-modal">
      <div class="bulk-modal-header">
        <h3>Extract Policy Wording</h3>
        <button class="bulk-close-btn" on:click={closeWordingModal}>&times;</button>
      </div>

      <div class="bulk-modal-body">
        {#if wordingStep === 'no-plans'}
          <p class="wording-hint">
            This works one development plan at a time: pick a plan, re-upload its document, and the AI fills in
            verbatim wording for that plan's saved policies. Right now none of your saved policies have a
            <strong>Parent Plan</strong> set, so there's nothing to run it against yet.
          </p>
          <p class="wording-hint">
            To use this, open a policy (or add a new one) and set its <strong>Parent Plan</strong> field — for
            national/NPPF policies, use the <strong>Import from NPPF Library</strong> dropdown instead, which fills
            in the wording directly without needing a document at all.
          </p>
        {:else if wordingStep === 'plan'}
          <p class="wording-hint">
            Choose the development plan whose policies you want to fill in, then re-upload that plan's document.
            The AI will find each saved policy's operative wording in it, verbatim, excluding any reasoned
            justification or supporting text. Do this one plan at a time so the document only has to cover
            that plan's own policies.
          </p>
          <div class="field">
            <label>Plan</label>
            <select bind:value={wordingPlanId}>
              <option value="">Select a plan…</option>
              {#each plansWithPolicies as doc (doc.id)}
                <option value={doc.id}>{planLabel(doc)} ({policies.filter(p => p.plan_id === doc.id).length} polic{policies.filter(p => p.plan_id === doc.id).length === 1 ? 'y' : 'ies'})</option>
              {/each}
            </select>
          </div>
        {:else if wordingStep === 'upload'}
          <p class="wording-hint">
            Upload the document for <strong>{plansWithPolicies.find(d => d.id === Number(wordingPlanId))?.plan_name}</strong>, or paste its text.
            {wordingPlanPolicies.length} saved polic{wordingPlanPolicies.length === 1 ? 'y' : 'ies'} will be searched for.
          </p>

          <div class="extract-mode-toggle">
            <button type="button" class:active={wordingMode === 'file'} on:click={() => wordingMode = 'file'}>Upload file</button>
            <button type="button" class:active={wordingMode === 'text'} on:click={() => wordingMode = 'text'}>Paste text</button>
          </div>

          {#if wordingMode === 'file'}
            <div class="field">
              <label>Document</label>
              <input type="file" accept=".pdf,.docx,.txt,.md" on:change={onWordingFileChange} />
              {#if wordingFile}<p class="extract-filename"><i class="las la-file-alt"></i> {wordingFile.name}</p>{/if}
            </div>
          {:else}
            <div class="field">
              <label>Document text</label>
              <textarea bind:value={wordingText} rows="10" placeholder="Paste the document text here…"></textarea>
            </div>
          {/if}

          <div class="wording-context-bar" title="~{wordingContextPct}% of context window used (prompt + policy list + document)">
            <span class="wording-context-label">~{wordingContextPct}% context</span>
            <div class="wording-context-track">
              <div class="wording-context-fill" style="width:{wordingContextPct}%; background:{wordingContextColour}"></div>
            </div>
          </div>
        {:else if wordingStep === 'review'}
          {#if wordingSourceText}
            <div class="extract-note-info">
              <i class="las la-info-circle"></i>
              Extracted from {wordingSourceFileName}. Rows flagged <span class="verbatim-badge verbatim-flag"><i class="las la-exclamation-triangle"></i> Check this</span> didn't closely match the source text — compare against the original before trusting them.
              <button type="button" class="source-text-toggle" on:click={() => showWordingSourceText = !showWordingSourceText}>
                {showWordingSourceText ? 'Hide' : 'View'} extracted source text
              </button>
              {#if showWordingSourceText}<pre class="source-text-body">{wordingSourceText}</pre>{/if}
            </div>
          {/if}

          {#each wordingRows as row (row.policy_id)}
            <div class="bulk-row-card wording-row-card">
              <label class="wording-include">
                <input type="checkbox" bind:checked={row.include} disabled={!row.wording.trim()} />
              </label>
              <div class="bulk-row-fields">
                <div class="wording-row-header">
                  {#if row.policy_reference}<span class="ref-chip">{row.policy_reference}</span>{/if}
                  <span class="wording-policy-name">{row.policy_name}</span>
                  {#if !row.found}
                    <span class="verbatim-badge verbatim-flag"><i class="las la-question-circle"></i> Not found in this document</span>
                  {:else if row._verbatim}
                    <span class="verbatim-badge" class:verbatim-ok={row._verbatim.verified} class:verbatim-flag={!row._verbatim.verified} title={row._verbatim.verified ? 'Closely matches the source document' : `Only ~${Math.round(row._verbatim.score * 100)}% match to the source text — check against the original`}>
                      <i class="las {row._verbatim.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i> {row._verbatim.verified ? 'Verbatim' : 'Check this'}
                    </span>
                  {/if}
                </div>
                {#if row.existing_text && row.found}
                  <p class="wording-existing-hint">This will replace the policy text currently saved for this policy.</p>
                {/if}
                <textarea bind:value={row.wording} on:input={() => { clearWordingVerbatim(row); row.include = !!row.wording.trim(); }} rows="4" placeholder="Not found in this document — paste the wording manually if you have it"></textarea>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if wordingError}
        <div class="bulk-error">{wordingError}</div>
      {/if}
      {#if wordingWarning}
        <div class="bulk-error wording-warning">{wordingWarning}</div>
      {/if}

      <div class="bulk-modal-footer">
        {#if wordingStep === 'review'}
          <span class="bulk-count-hint">{wordingRows.filter(r => r.include && r.wording.trim()).length} of {wordingRows.length} will be saved</span>
        {:else}
          <span></span>
        {/if}
        <div class="bulk-footer-actions">
          <button class="btn-cancel" on:click={closeWordingModal} disabled={wordingExtracting || wordingSaving}>
            {wordingStep === 'no-plans' ? 'Close' : 'Cancel'}
          </button>
          {#if wordingStep === 'plan'}
            <button class="btn-save" on:click={chooseWordingPlan} disabled={!wordingPlanId}>Next</button>
          {:else if wordingStep === 'upload'}
            <button class="btn-save" on:click={runWordingExtract} disabled={wordingExtracting || (wordingMode === 'file' ? !wordingFile : !wordingText.trim())}>
              {wordingExtracting ? 'Extracting…' : 'Extract'}
            </button>
          {:else if wordingStep === 'review'}
            <button class="btn-save" on:click={saveWording} disabled={wordingSaving}>
              {wordingSaving ? 'Saving…' : 'Save Selected'}
            </button>
          {/if}
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
    color: var(--color-slate-500);
  }
  .error-state i { font-size: 2rem; color: var(--color-red-500); }
  .error-state button {
    padding: 0.5rem 1rem; background: var(--color-purple-600); color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }

  .spinner {
    width: 2rem; height: 2rem;
    border: 3px solid var(--color-slate-100); border-top-color: var(--color-purple-600);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .tab-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
  }

  .tab-header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }

  .btn-templates {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-purple-600);
    border: 1px solid var(--color-purple-600);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-templates:hover { background: var(--color-purple-50); }

  .templates-panel {
    margin: 0 1.25rem 0.5rem;
    padding: 0.9rem 1rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
  }
  .templates-hint {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    font-style: italic;
  }
  .templates-empty { margin: 0; font-size: 0.85rem; color: var(--color-slate-400); }
  .templates-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .template-item {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
  }
  .template-item summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-slate-800);
    font-weight: 500;
    list-style: none;
  }
  .template-item summary::-webkit-details-marker { display: none; }
  .template-label { flex: 1; }
  .template-devtype {
    font-size: 0.7rem; font-weight: 600; color: var(--color-slate-500); background: var(--color-slate-100);
    padding: 0.1rem 0.4rem; border-radius: 3px; text-transform: capitalize;
  }
  .template-fields { font-size: 0.72rem; color: var(--color-slate-400); white-space: nowrap; }
  .template-field {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-slate-100);
    font-size: 0.8rem;
    color: var(--color-slate-700);
    line-height: 1.6;
  }
  .template-field strong {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-slate-400);
    margin-bottom: 0.2rem;
  }

  .precedent-item {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
  }
  .precedent-header { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  .precedent-name { flex: 1; font-weight: 500; color: var(--color-slate-800); min-width: 8rem; }
  .precedent-used-on { font-size: 0.72rem; color: var(--color-slate-400); white-space: nowrap; }
  .btn-import {
    padding: 0.3rem 0.7rem;
    background: white;
    color: var(--color-purple-600);
    border: 1px solid var(--color-purple-600);
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
  }
  .btn-import:hover:not(:disabled) { background: var(--color-purple-50); }
  .btn-import:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-add-multiple {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-purple-600);
    border: 1px solid var(--color-purple-600);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-add-multiple:hover { background: var(--color-purple-50); }
  .btn-add-multiple.btn-select-active { background: var(--color-purple-600); color: white; }

  .select-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1.25rem;
    margin: 0 0 0.5rem;
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 8px;
  }
  .select-all-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
  }
  .select-all-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-purple-600);
    cursor: pointer;
  }
  .select-count {
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }
  .btn-delete-selected {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: auto;
    padding: 0.4rem 0.9rem;
    background: var(--color-red-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-delete-selected:hover:not(:disabled) { background: var(--color-red-700); }
  .btn-delete-selected:disabled { opacity: 0.5; cursor: not-allowed; }

  .policy-select-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--color-purple-600);
    cursor: pointer;
    flex-shrink: 0;
  }

  .policy-card.selected {
    border-color: var(--color-purple-600);
    background: var(--color-purple-50);
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: var(--color-purple-600);
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
  .btn-add:hover { background: var(--color-purple-700); }

  /* Form */
  .policy-form-modal {
    width: 95%;
    max-width: 640px;
  }
  .policy-form-card {
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    min-height: 0;
  }
  .form-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-purple-700);
  }
  .form-row { display: flex; flex-direction: column; gap: 0.5rem; }
  .form-row.two-col { flex-direction: row; gap: 1rem; }
  .form-row.two-col .field { flex: 1; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .required { color: var(--color-red-500); }
  .optional { color: var(--color-slate-400); font-weight: 400; }
  input[type="text"], select, textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    resize: vertical;
  }
  input[type="text"]:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--color-purple-600);
    box-shadow: 0 0 0 3px var(--color-violet-100);
  }

  .key-toggle-row { flex-direction: row; align-items: center; }
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--color-slate-800);
  }
  .toggle-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-purple-600);
    cursor: pointer;
  }

  .form-error {
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
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
    border: 1px solid var(--color-slate-300);
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Empty state */
  .empty-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 0.5rem;
    color: var(--color-slate-400);
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
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .policy-card.key {
    border-color: var(--color-violet-300);
    background: var(--color-purple-50);
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
    background: var(--color-violet-100);
    color: var(--color-purple-700);
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
    color: var(--color-slate-600);
    background: var(--color-slate-100);
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
    color: var(--color-slate-500);
    font-size: 0.95rem;
  }
  .icon-btn:hover { background: var(--color-slate-100); color: var(--color-slate-800); }
  .icon-btn.danger:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .policy-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-slate-800);
    line-height: 1.4;
  }

  .policy-detail {
    font-size: 0.82rem;
  }
  .policy-detail summary {
    cursor: pointer;
    color: var(--color-purple-600);
    font-weight: 500;
    user-select: none;
  }
  .detail-body {
    margin: 0.5rem 0 0;
    color: var(--color-slate-700);
    line-height: 1.6;
    white-space: pre-wrap;
    background: var(--color-slate-50);
    border-left: 3px solid var(--color-violet-200);
    padding: 0.5rem 0.75rem;
    border-radius: 0 4px 4px 0;
  }

  .policy-notes {
    font-size: 0.8rem;
    color: var(--color-slate-500);
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
  }
  .policy-notes i { color: var(--color-purple-600); margin-top: 1px; flex-shrink: 0; }

  /* Bulk Add Modal */
  .bulk-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
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
    box-shadow: 0 20px 60px var(--overlay-bg);
    overflow: hidden;
  }

  .bulk-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .bulk-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .bulk-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .bulk-close-btn:hover { color: var(--color-slate-800); }

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
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 10px;
    padding: 1rem;
    position: relative;
  }

  .bulk-row-error {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }

  .bulk-row-number {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-purple-600);
    background: var(--color-violet-100);
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
    color: var(--color-slate-400);
    border-radius: 6px;
    margin-top: 0.15rem;
    font-size: 0.9rem;
  }
  .bulk-remove-btn:hover { background: var(--color-red-50); color: var(--color-red-600); }

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
    border: 2px dashed var(--color-violet-300);
    background: white;
    color: var(--color-purple-600);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
    transition: background 0.15s, border-color 0.15s;
  }
  .bulk-add-row-btn:hover { background: var(--color-purple-50); border-color: var(--color-purple-600); }
  .bulk-add-row-btn i { font-size: 1.1rem; }

  .bulk-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .bulk-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .bulk-count-hint {
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }
  .bulk-footer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .apply-all-hint {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--color-purple-600);
    margin-left: 0.25rem;
  }

  /* Extract Policy Wording modal */
  .wording-hint {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: var(--color-slate-600);
    line-height: 1.5;
  }

  .extract-note-info {
    font-size: 0.8rem;
    color: var(--color-slate-600);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .source-text-toggle {
    background: none;
    border: none;
    color: var(--color-purple-600);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
    font-family: inherit;
    padding: 0;
  }
  .source-text-body {
    flex-basis: 100%;
    max-height: 220px;
    overflow-y: auto;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 4px;
    padding: 0.5rem;
    font-size: 0.72rem;
    white-space: pre-wrap;
    color: var(--color-slate-700);
    margin: 0.25rem 0 0;
  }

  .wording-row-card { align-items: flex-start; }
  .wording-include {
    display: flex;
    align-items: center;
    padding-top: 0.3rem;
  }
  .wording-include input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-purple-600);
    cursor: pointer;
  }
  .wording-row-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .wording-policy-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .wording-existing-hint {
    margin: 0.2rem 0 0;
    font-size: 0.72rem;
    color: var(--color-slate-500);
    font-style: italic;
  }
  .wording-warning { margin-top: 0.5rem; }

  .verbatim-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    white-space: nowrap;
  }
  .verbatim-ok   { color: var(--color-badge-success-fg); background: var(--color-badge-success-bg); }
  .verbatim-flag { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }

  .nppf-pick-row .field {
    background: var(--color-purple-50);
    border: 1px dashed var(--color-violet-300);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
  }
  .nppf-pick-row label { display: flex; align-items: center; gap: 0.3rem; color: var(--color-purple-700); }

  .extract-mode-toggle { display: flex; gap: 0.5rem; }
  .extract-mode-toggle button {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    color: var(--color-slate-500);
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .extract-mode-toggle button.active { background: var(--color-purple-600); color: white; border-color: var(--color-purple-600); }

  .extract-filename {
    display: flex; align-items: center; gap: 0.4rem;
    margin: 0.35rem 0 0; font-size: 0.8rem; color: var(--color-slate-600);
  }

  /* Context meter — mirrors PlanningWorkspace.svelte / StartingDocsModal.svelte */
  .wording-context-bar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0;
  }
  .wording-context-label {
    font-size: 0.72rem;
    color: var(--color-slate-400);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .wording-context-track {
    flex: 1;
    height: 4px;
    background: var(--color-slate-200);
    border-radius: 99px;
    overflow: hidden;
  }
  .wording-context-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.4s ease, background 0.3s;
  }
</style>
