<script>
  // Relevant Planning Policy: one list, grouped by the plan each policy comes
  // from. Everything is added from a single "Add" menu (NPPF library, a
  // document, by hand, or a plan itself); reference and checking tools sit in
  // the Beta "Tools" menu.
  import { onMount } from 'svelte';
  import { getPolicies, createPolicy, updatePolicy, deletePolicy } from '$lib/api/lpaAnalysis.js';
  import { getPolicyDocuments, deletePolicyDocument } from '$lib/api/policyDocuments.js';
  import { exportPolicyPdf } from '$lib/services/policyPdfExport.js';
  import PolicyTools from '$lib/components/projects/PolicyTools.svelte';
  import PolicyCard from '$lib/components/projects/PolicyCard.svelte';
  import PlanEditModal from '$lib/components/projects/PlanEditModal.svelte';
  import PastePoliciesModal from '$lib/components/projects/PastePoliciesModal.svelte';
  import ExtractFromDocumentModal from '$lib/components/projects/ExtractFromDocumentModal.svelte';
  import NppfPickerModal from '$lib/components/projects/NppfPickerModal.svelte';
  import PolicyPreviewModal from '$lib/components/shared/PolicyPreviewModal.svelte';
  import { formatOnPaste } from '$lib/utils/policyFormat.js';

  export let project;
  $: projectId = project?.id;
  $: projectDevTypes = project?.development_types ?? [];

  let policies = [];
  let planDocs = [];
  let loading = true;
  let error = null;

  onMount(() => { if (projectId) load(); });

  async function load() {
    loading = true;
    error = null;
    try {
      await refresh();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Re-fetches without the full-page spinner, so the list (and which plans are
  // collapsed) stays put after a save.
  async function refresh() {
    [policies, planDocs] = await Promise.all([getPolicies(projectId), getPolicyDocuments(projectId)]);
  }

  // ── Grouping ──
  const SECTIONS = [
    { key: 'adopted', label: 'Development Plan Adopted', addLabel: 'Add an adopted plan' },
    { key: 'emerging', label: 'Development Plan Emerging', addLabel: 'Add an emerging plan' },
    { key: 'supplementary', label: 'Supplementary Guidance', addLabel: 'Add supplementary guidance' },
    { key: 'other', label: 'Other Material Considerations', addLabel: 'Add another material consideration' }
  ];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  $: nationalPolicies = policies.filter(p => !p.plan_id && p.policy_type === 'national');
  $: unlinkedPolicies = policies.filter(p => !p.plan_id && p.policy_type !== 'national');
  $: planGroups = SECTIONS
    .map(s => ({
      ...s,
      plans: planDocs
        .filter(d => d.section === s.key)
        .map(doc => ({ doc, policies: policies.filter(p => p.plan_id === doc.id) }))
    }));
  // Every section shows, even with nothing in it, so each has its own add button.

  function planLabel(doc) {
    const typeTag = doc.plan_type === 'neighbourhood' ? 'Neighbourhood Plan' : doc.plan_type === 'local' ? 'Local Plan' : null;
    return typeTag ? `${doc.plan_name} (${typeTag})` : doc.plan_name;
  }

  function planMeta(doc) {
    const parts = [];
    if (doc.plan_type) parts.push(doc.plan_type === 'neighbourhood' ? 'Neighbourhood Plan' : 'Local Plan');
    if (doc.year_adopted) parts.push(doc.month_adopted ? `${MONTH_NAMES[doc.month_adopted - 1]} ${doc.year_adopted}` : String(doc.year_adopted));
    return parts.join(' · ');
  }

  // A policy added from inside a plan starts with the type that plan implies.
  function typeForPlan(doc) {
    if (doc.section === 'supplementary') return 'supplementary';
    if (doc.section === 'other') return 'other';
    return doc.plan_type === 'neighbourhood' ? 'neighbourhood' : 'local';
  }

  let collapsed = new Set();
  function toggleCollapsed(id) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
  }

  // ── Preview (read-only wording with bold / highlight etc.) ──
  let previewPolicy = null;

  // The modal saves its own formatting; this keeps the list in step so
  // reopening a policy shows what was saved.
  function onAnnotated(e) {
    const { id, html } = e.detail;
    policies = policies.map(p => p.id === id ? { ...p, policy_text_annotated: html } : p);
  }

  // ── Add menu ──
  // Adding a policy by hand happens from the plus on a plan card (or on the
  // National / Not-linked groups). The other routes are in the Tools menu.
  let showNppfPicker = false;
  let showExtract = false;
  // Paste-and-sort: opened from the Add Policy dialog, carrying over its plan/type
  let showPaste = false;
  let pastePlanId = '';
  let pasteType = 'national';

  function openPaste() {
    pastePlanId = form.plan_id;
    pasteType = form.policy_type;
    cancel();
    showPaste = true;
  }

  function onAdd(e) {
    const key = e.detail;
    if (key === 'nppf') showNppfPicker = true;
    else if (key === 'document') showExtract = true;
  }

  // Both the NPPF picker and the document extractor end in the same review
  // table, so nothing is saved until the user has looked at it.
  async function onReview(e) {
    showNppfPicker = false;
    showExtract = false;
    showPaste = false;
    try { await refresh(); } catch (err) { console.error('Refresh before review failed:', err); }
    openReview(e.detail.rows, e.detail.warning);
  }

  // ── Plans ──
  let showPlanModal = false;
  let editingPlan = null;

  // The new document starts in the section whose plus was pressed
  let newPlanSection = 'adopted';

  function openAddPlan(section = 'adopted') {
    editingPlan = null;
    newPlanSection = section;
    showPlanModal = true;
  }

  function openEditPlan(doc) {
    editingPlan = doc;
    showPlanModal = true;
  }

  // When the new document came with NPPF policies, they go to the review table
  // already linked to it.
  async function onPlanSaved(e) {
    showPlanModal = false;
    editingPlan = null;
    await refresh();
    if (e.detail?.stagedRows?.length) openReview(e.detail.stagedRows);
  }

  async function removePlan(doc, count) {
    const note = count ? ` Its ${count} polic${count === 1 ? 'y' : 'ies'} will be kept, but no longer linked to a plan.` : '';
    if (!confirm(`Delete "${doc.plan_name}"?${note}`)) return;
    try {
      await deletePolicyDocument(doc.id);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Single policy form ──
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

  // doc: the plan card whose plus was pressed; presetType: for groups that have no plan card
  function openAdd(doc = null, presetType = null) {
    editingId = null;
    form = emptyForm();
    if (doc) {
      form.plan_id = doc.id;
      form.policy_type = typeForPlan(doc);
    } else if (presetType) {
      form.policy_type = presetType;
    }
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
      is_key_policy: policy.is_key_policy || false,
      plan_id: policy.plan_id ?? ''
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
        is_key_policy: form.is_key_policy,
        plan_id: form.plan_id || null
      };
      if (editingId) {
        await updatePolicy(editingId, payload);
      } else {
        await createPolicy(projectId, payload);
      }
      await refresh();
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
      selectedIds = new Set([...selectedIds].filter(id => id !== policy.id));
    } catch (err) {
      alert(err.message);
    }
  }

  // Direct tick-box on the card, so flagging a policy as key doesn't require
  // opening the edit modal. Updates local state only, so the rest of the list
  // doesn't re-render. Reverts on failure.
  async function toggleKeyPolicy(policy) {
    const newValue = !policy.is_key_policy;
    policies = policies.map(p => p.id === policy.id ? { ...p, is_key_policy: newValue } : p);
    try {
      await updatePolicy(policy.id, {
        policy_reference: policy.policy_reference,
        policy_name: policy.policy_name,
        policy_type: policy.policy_type,
        policy_text: policy.policy_text,
        relevant_supporting_text: policy.relevant_supporting_text,
        notes: policy.notes,
        is_key_policy: newValue,
        plan_id: policy.plan_id
      });
    } catch (err) {
      policies = policies.map(p => p.id === policy.id ? { ...p, is_key_policy: !newValue } : p);
      alert(err.message);
    }
  }

  // ── Selecting policies (box appears on hover) for bulk delete, mainly for
  // clearing out duplicates. Deleting a policy cascades to remove any Drafting
  // Issue links pointing at it (drafting_issue_policy_relevance.policy_id ON
  // DELETE CASCADE); the confirm dialog warns about this. ──
  let selectedIds = new Set();
  let bulkDeleting = false;

  function toggleSelect(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  async function deleteSelected() {
    if (!selectedIds.size) return;
    const n = selectedIds.size;
    if (!confirm(`Delete ${n} selected polic${n === 1 ? 'y' : 'ies'}? This cannot be undone, and will remove any Policy Assessment links to them.`)) return;
    bulkDeleting = true;
    try {
      await Promise.all([...selectedIds].map(id => deletePolicy(id)));
      policies = policies.filter(p => !selectedIds.has(p.id));
      selectedIds = new Set();
    } catch (err) {
      alert(err.message);
    } finally {
      bulkDeleting = false;
    }
  }

  // ── Export ──
  function exportPolicy() {
    try {
      exportPolicyPdf(project, policies, planDocs);
    } catch (err) {
      alert(`Could not export policy PDF: ${err.message}`);
    }
  }

  // ── Review table (shared end point for the NPPF picker and document extractor) ──
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

  let bulkTitle = 'Review Policies';

  function openReview(rows, warning = null) {
    bulkTitle = 'Review Policies';
    bulkRows = rows;
    bulkError = warning || null;
    showBulkModal = true;
  }

  // From the single Add Policy dialog: swap to five blank rows that inherit
  // the plan/type already chosen there. Blank rows are skipped on save.
  function openAddMultiple() {
    const plan_id = form.plan_id;
    const policy_type = form.policy_type;
    cancel();
    bulkTitle = 'Add Multiple Policies';
    bulkRows = Array.from({ length: 5 }, () => ({ ...emptyRow(), plan_id, policy_type }));
    bulkError = null;
    showBulkModal = true;
  }

  function closeBulkModal() {
    showBulkModal = false;
    bulkRows = [];
    bulkError = null;
  }

  function addBulkRows(n = 5) {
    const last = bulkRows[bulkRows.length - 1];
    const extra = Array.from({ length: n }, () => ({
      ...emptyRow(),
      plan_id: last?.plan_id ?? '',
      policy_type: last?.policy_type ?? 'national'
    }));
    bulkRows = [...bulkRows, ...extra];
  }

  function removeBulkRow(i) {
    bulkRows = bulkRows.filter((_, idx) => idx !== i);
  }

  function applyTypeToAll(type) {
    bulkRows = bulkRows.map(r => ({ ...r, policy_type: type }));
  }

  // Settles each row independently rather than failing the whole batch on
  // one bad row (Promise.all would reject on the first failure while the
  // others had already been inserted, leaving the user with a generic
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
      bulkError = `${succeededCount} of ${toSave.length} saved. ${failed.length} failed. See the error under each row below.`;
    } else {
      bulkError = null;
    }

    if (succeededCount > 0) await refresh();
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
      <PolicyTools {projectId} {projectDevTypes} canExport={policies.length > 0} on:imported={refresh} on:add={onAdd} on:export={exportPolicy} />
      <span class="tab-counts">
        {planDocs.length} document{planDocs.length === 1 ? '' : 's'} · {policies.length} polic{policies.length === 1 ? 'y' : 'ies'}
      </span>
    </div>

    {#if selectedIds.size}
      <div class="select-bar">
        <span class="select-count">{selectedIds.size} selected</span>
        <button class="btn btn-ghost btn-sm" on:click={() => selectedIds = new Set()}>Clear</button>
        <button class="btn btn-danger btn-sm select-delete" disabled={bulkDeleting} on:click={deleteSelected}>
          <i class="las la-trash"></i> {bulkDeleting ? 'Deleting…' : 'Delete selected'}
        </button>
      </div>
    {/if}

    {#if !planDocs.length && !policies.length}
      <div class="empty-state">
        <i class="las la-balance-scale"></i>
        <p>Nothing here yet. Use the blue <strong>+</strong> beside a heading below to add a plan or guidance document, or <strong>Tools</strong> to bring in policies from the NPPF library or a planning document.</p>
      </div>
    {/if}

    {#if nationalPolicies.length}
      <div class="group-label">
        National policy <span class="badge badge-sm badge-neutral">{nationalPolicies.length}</span>
        <button class="btn-circle-add" on:click={() => openAdd(null, 'national')} title="Add a national policy" aria-label="Add a national policy"><i class="las la-plus"></i></button>
      </div>
      <div class="policy-list">
        {#each nationalPolicies as policy (policy.id)}
          <PolicyCard {policy} selected={selectedIds.has(policy.id)} selecting={selectedIds.size > 0}
            on:select={() => toggleSelect(policy.id)} on:togglekey={() => toggleKeyPolicy(policy)}
            on:preview={() => previewPolicy = policy} on:edit={() => openEdit(policy)} on:delete={() => remove(policy)} />
        {/each}
      </div>
    {/if}

    {#each planGroups as group (group.key)}
      <div class="group-label">
        {group.label} <span class="badge badge-sm badge-neutral">{group.plans.length}</span>
        <button class="btn-circle-add" on:click={() => openAddPlan(group.key)} title={group.addLabel} aria-label={group.addLabel}><i class="las la-plus"></i></button>
      </div>
      {#each group.plans as { doc, policies: planPolicies } (doc.id)}
        <div class="card plan-card">
          <div class="plan-head">
            <button class="plan-toggle" on:click={() => toggleCollapsed(doc.id)} aria-expanded={!collapsed.has(doc.id)}>
              <i class="las {collapsed.has(doc.id) ? 'la-angle-right' : 'la-angle-down'}"></i>
              <span class="plan-name">{doc.plan_name}</span>
            </button>
            {#if planMeta(doc)}<span class="plan-meta">{planMeta(doc)}</span>{/if}
            <span class="badge badge-sm badge-info">{planPolicies.length} polic{planPolicies.length === 1 ? 'y' : 'ies'}</span>
            <div class="plan-actions">
              <button class="btn-circle-add" on:click={() => openAdd(doc)} title="Add a policy to this plan" aria-label="Add a policy to this plan"><i class="las la-plus"></i></button>
              <button class="btn btn-ghost btn-icon" on:click={() => openEditPlan(doc)} title="Edit this document"><i class="las la-pen"></i></button>
              <button class="btn btn-danger-ghost btn-icon" on:click={() => removePlan(doc, planPolicies.length)} title="Delete this document"><i class="las la-trash"></i></button>
            </div>
          </div>

          {#if doc.summary || doc.relevance}
            <details class="plan-about">
              <summary>About this document</summary>
              {#if doc.summary}<p><strong>Summary:</strong> {doc.summary}</p>{/if}
              {#if doc.relevance}<p><strong>Relevance to project:</strong> {doc.relevance}</p>{/if}
            </details>
          {/if}

          {#if !collapsed.has(doc.id)}
            {#if planPolicies.length}
              <div class="policy-list plan-policies">
                {#each planPolicies as policy (policy.id)}
                  <PolicyCard {policy} selected={selectedIds.has(policy.id)} selecting={selectedIds.size > 0}
                    on:select={() => toggleSelect(policy.id)} on:togglekey={() => toggleKeyPolicy(policy)}
                    on:preview={() => previewPolicy = policy} on:edit={() => openEdit(policy)} on:delete={() => remove(policy)} />
                {/each}
              </div>
            {:else}
              <div class="plan-empty">No policies from this document yet.</div>
            {/if}
          {/if}
        </div>
      {/each}
    {/each}

    {#if unlinkedPolicies.length}
      <div class="group-label">
        Not linked to a plan <span class="badge badge-sm badge-neutral">{unlinkedPolicies.length}</span>
        <button class="btn-circle-add" on:click={() => openAdd(null, 'local')} title="Add a policy" aria-label="Add a policy"><i class="las la-plus"></i></button>
      </div>
      <div class="policy-list">
        {#each unlinkedPolicies as policy (policy.id)}
          <PolicyCard {policy} showType selected={selectedIds.has(policy.id)} selecting={selectedIds.size > 0}
            on:select={() => toggleSelect(policy.id)} on:togglekey={() => toggleKeyPolicy(policy)}
            on:preview={() => previewPolicy = policy} on:edit={() => openEdit(policy)} on:delete={() => remove(policy)} />
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#if previewPolicy}
  <PolicyPreviewModal policy={previewPolicy} on:close={() => previewPolicy = null} on:annotated={onAnnotated} />
{/if}

{#if showNppfPicker}
  <NppfPickerModal existingPolicies={policies} on:close={() => showNppfPicker = false} on:review={onReview} />
{/if}

{#if showPaste}
  <PastePoliciesModal {projectId} planId={pastePlanId} policyType={pasteType} on:close={() => showPaste = false} on:review={onReview} />
{/if}

{#if showExtract}
  <ExtractFromDocumentModal {projectId} on:close={() => showExtract = false} on:review={onReview} />
{/if}

{#if showPlanModal}
  <PlanEditModal {projectId} existingPolicies={policies} plan={editingPlan} defaultSection={newPlanSection} on:close={() => { showPlanModal = false; editingPlan = null; }} on:saved={onPlanSaved} />
{/if}

{#if showForm}
  <div class="dialog-backdrop" on:click|self={cancel} role="presentation">
    <div class="dialog dialog-md">
      <div class="dialog-header">
        <h3 class="dialog-title">{editingId ? 'Edit Policy' : 'Add Policy'}</h3>
        <button class="dialog-close" on:click={cancel} aria-label="Close">&times;</button>
      </div>

      <div class="dialog-body">
        <div class="form-cols">
          <div class="form-item">
            <label class="form-label" for="pf-ref">Policy Reference</label>
            <input id="pf-ref" type="text" class="form-input" bind:value={form.policy_reference} placeholder="e.g. NPPF Para 11, Policy H1" />
          </div>
          <div class="form-item">
            <label class="form-label" for="pf-type">Policy Type</label>
            <select id="pf-type" class="form-input" bind:value={form.policy_type}>
              <option value="national">National</option>
              <option value="local">Local</option>
              <option value="neighbourhood">Neighbourhood</option>
              <option value="supplementary">Supplementary</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-item">
          <label class="form-label" for="pf-name">Policy Name <span class="form-required">*</span></label>
          <input id="pf-name" type="text" class="form-input" bind:value={form.policy_name} placeholder="e.g. Presumption in Favour of Sustainable Development" />
        </div>

        <div class="form-item">
          <label class="form-label" for="pf-plan">Parent Plan <span class="form-optional">(optional)</span></label>
          <select id="pf-plan" class="form-input" bind:value={form.plan_id}>
            <option value="">None</option>
            {#each planDocs as doc (doc.id)}
              <option value={doc.id}>{planLabel(doc)}</option>
            {/each}
          </select>
        </div>

        <div class="form-item">
          <label class="form-label" for="pf-text">Relevant Policy Text</label>
          <textarea id="pf-text" class="form-input" bind:value={form.policy_text} use:formatOnPaste rows="5" placeholder="Paste the relevant policy wording here…"></textarea>
          <span class="form-hint">Pasted wording is tidied automatically: broken line wraps are joined and each (a), (b), (i) clause starts on its own line.</span>
        </div>

        <div class="form-item">
          <label class="form-label" for="pf-support">Relevant Supporting Text</label>
          <textarea id="pf-support" class="form-input" bind:value={form.relevant_supporting_text} use:formatOnPaste rows="3" placeholder="Any supporting text, footnotes, or guidance relevant to this project…"></textarea>
        </div>

        <div class="form-item">
          <label class="form-label" for="pf-notes">Notes</label>
          <textarea id="pf-notes" class="form-input" bind:value={form.notes} rows="2" placeholder="Your notes on why this policy is relevant, how it applies, etc."></textarea>
        </div>

        <label class="check-label">
          <input type="checkbox" bind:checked={form.is_key_policy} />
          <span>Key Policy: flag this as a primary determining policy for the project</span>
        </label>

        {#if formError}<div class="alert alert-error">{formError}</div>{/if}

        {#if !editingId}
          <div class="add-alt-row">
            <button class="btn btn-secondary btn-sm review-add" on:click={openAddMultiple} disabled={saving}>
              <i class="las la-plus-circle"></i> Add multiple
            </button>
            <button class="btn btn-secondary btn-sm review-add" on:click={openPaste} disabled={saving}
              title="Paste the text of one or more policies and let the AI sort it into the fields">
              <i class="las la-magic"></i> Paste &amp; auto-fill
            </button>
          </div>
        {/if}
      </div>

      <div class="dialog-footer">
        <span></span>
        <div class="dialog-actions">
          <button class="btn btn-secondary" on:click={cancel} disabled={saving}>Cancel</button>
          <button class="btn btn-primary" on:click={save} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Policy'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Review table: where policies from the NPPF library or a document land before saving -->
{#if showBulkModal}
  <div class="dialog-backdrop" on:click|self={closeBulkModal} role="presentation">
    <div class="dialog dialog-lg">
      <div class="dialog-header">
        <h3 class="dialog-title">{bulkTitle}</h3>
        <button class="dialog-close" on:click={closeBulkModal} aria-label="Close">&times;</button>
      </div>

      <div class="dialog-body">
        {#each bulkRows as row, i (i)}
          <div class="review-row">
            <span class="badge badge-sm badge-info review-num">#{i + 1}</span>
            <div class="review-fields">
              {#if row.saveError}
                <div class="alert alert-error"><i class="las la-exclamation-triangle"></i> {row.saveError}</div>
              {/if}
              {#if row.verbatim_issues?.length}
                <div class="alert alert-warning">
                  <i class="las la-exclamation-triangle"></i>
                  Doesn't match what you pasted word for word: {row.verbatim_issues.map(v => `${v.field} (${Math.round(v.score * 100)}% matched)`).join(', ')}.
                  <details>
                    <summary>Show what you pasted</summary>
                    <pre class="pasted-source">{row.pasted_source}</pre>
                  </details>
                </div>
              {:else if row.pasted_source}
                <div class="verbatim-ok"><i class="las la-check-circle"></i> Matches what you pasted word for word</div>
              {/if}
              <div class="form-cols">
                <div class="form-item">
                  <label class="form-label" for="rv-ref-{i}">Policy Reference</label>
                  <input id="rv-ref-{i}" type="text" class="form-input" bind:value={row.policy_reference} />
                </div>
                <div class="form-item">
                  <label class="form-label" for="rv-type-{i}">Policy Type {#if i === 0}<span class="form-optional">(sets all)</span>{/if}</label>
                  <select id="rv-type-{i}" class="form-input" bind:value={row.policy_type} on:change={i === 0 ? (e) => applyTypeToAll(e.target.value) : undefined}>
                    <option value="national">National</option>
                    <option value="local">Local</option>
                    <option value="neighbourhood">Neighbourhood</option>
                    <option value="supplementary">Supplementary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <label class="check-label review-key">
                  <input type="checkbox" bind:checked={row.is_key_policy} />
                  <span>Key Policy</span>
                </label>
              </div>
              <div class="form-cols">
                <div class="form-item">
                  <label class="form-label" for="rv-name-{i}">Policy Name <span class="form-required">*</span></label>
                  <input id="rv-name-{i}" type="text" class="form-input" bind:value={row.policy_name} />
                </div>
                <div class="form-item">
                  <label class="form-label" for="rv-plan-{i}">Parent Plan <span class="form-optional">(optional)</span></label>
                  <select id="rv-plan-{i}" class="form-input" bind:value={row.plan_id}>
                    <option value="">None</option>
                    {#each planDocs as doc (doc.id)}
                      <option value={doc.id}>{planLabel(doc)}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="form-cols">
                <div class="form-item">
                  <label class="form-label" for="rv-text-{i}">Relevant Policy Text</label>
                  <textarea id="rv-text-{i}" class="form-input" bind:value={row.policy_text} use:formatOnPaste rows="2"></textarea>
                </div>
                <div class="form-item">
                  <label class="form-label" for="rv-support-{i}">Relevant Supporting Text</label>
                  <textarea id="rv-support-{i}" class="form-input" bind:value={row.relevant_supporting_text} use:formatOnPaste rows="2"></textarea>
                </div>
              </div>
              <div class="form-item">
                <label class="form-label" for="rv-notes-{i}">Notes</label>
                <textarea id="rv-notes-{i}" class="form-input" bind:value={row.notes} rows="1"></textarea>
              </div>
            </div>
            {#if bulkRows.length > 1}
              <button class="btn btn-danger-ghost btn-icon" on:click={() => removeBulkRow(i)} title="Remove row">
                <i class="las la-times"></i>
              </button>
            {/if}
          </div>
        {/each}

        <button class="btn btn-secondary btn-sm review-add" on:click={() => addBulkRows(5)}>
          <i class="las la-plus-circle"></i> Add 5 more
        </button>

        {#if bulkError}<div class="alert alert-error">{bulkError}</div>{/if}
      </div>

      <div class="dialog-footer">
        <span class="dialog-meta">{bulkRows.filter(r => r.policy_name.trim()).length} of {bulkRows.length} rows will be saved</span>
        <div class="dialog-actions">
          <button class="btn btn-secondary" on:click={closeBulkModal} disabled={bulkSaving}>Cancel</button>
          <button class="btn btn-primary" on:click={saveAll} disabled={bulkSaving}>
            {bulkSaving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .add-alt-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .pasted-source {
    margin: var(--space-2) 0 0;
    max-height: 12rem;
    overflow: auto;
    white-space: pre-wrap;
    font-family: inherit;
    font-size: var(--font-size-xs);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
  }
  .verbatim-ok { display: flex; align-items: center; gap: var(--space-1); font-size: var(--font-size-xs); color: var(--color-emerald-800); }
  .policy-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    height: 100%;
    overflow-y: auto;
    padding: var(--space-5);
  }

  .loading-state, .error-state, .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--color-slate-500);
  }
  .loading-state, .error-state { flex-direction: column; padding: 3rem; }
  .empty-state { padding: var(--space-5) var(--space-2); font-size: var(--font-size-sm); color: var(--color-slate-400); }
  .empty-state i { font-size: 1.25rem; opacity: 0.6; }
  .empty-state p { margin: 0; }
  .error-state i { font-size: 2rem; color: var(--color-red-500); }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--color-slate-100);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Header: Add, Tools, Export */
  .tab-header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .tab-counts { margin-left: auto; font-size: var(--font-size-xs); color: var(--color-slate-500); }

  /* Selection bar (appears once something is ticked) */
  .select-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-md);
  }
  .select-count { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-slate-700); }
  .select-delete { margin-left: auto; }

  /* Groups and plan cards */
  .group-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-slate-500);
  }

  .policy-list { display: flex; flex-direction: column; gap: var(--space-3); }

  .plan-card { padding: 0; overflow: hidden; }
  .plan-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
  }
  .plan-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    color: var(--color-slate-800);
  }
  .plan-toggle i { color: var(--color-slate-400); }
  .plan-name { font-size: var(--font-size-sm); font-weight: 600; text-align: left; }
  .plan-meta { font-size: var(--font-size-xs); color: var(--color-slate-500); }
  .plan-actions { display: flex; align-items: center; gap: var(--space-1); margin-left: auto; }

  .plan-about { padding: var(--space-2) var(--space-4); font-size: var(--font-size-xs); border-bottom: 1px solid var(--color-slate-100); }
  .plan-about summary { cursor: pointer; color: var(--color-primary-600); font-weight: 500; user-select: none; }
  .plan-about p { margin: var(--space-2) 0 0; color: var(--color-slate-700); line-height: 1.5; white-space: pre-wrap; }
  .plan-policies { padding: var(--space-3) var(--space-4) var(--space-4); }
  .plan-empty { padding: var(--space-3) var(--space-4); font-size: var(--font-size-xs); color: var(--color-slate-400); }

  .form-hint { font-size: var(--font-size-xs); color: var(--color-slate-400); }

  /* Checkbox with an inline label */
  .check-label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--color-slate-800); cursor: pointer; }
  .check-label input { width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer; }

  /* Review table rows */
  .review-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-lg);
  }
  .review-num { flex-shrink: 0; margin-top: 0.2rem; white-space: nowrap; }
  .review-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .review-key { align-self: end; padding-bottom: var(--space-2); }
  .review-add { align-self: flex-start; }
</style>
