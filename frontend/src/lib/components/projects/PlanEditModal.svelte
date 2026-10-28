<script>
  // Add or edit one entry in Relevant Documents (a development plan, SPD,
  // or other material consideration). Which section it sits in is just a field.
  import { createEventDispatcher } from 'svelte';
  import { createPolicyDocument, updatePolicyDocument } from '$lib/api/policyDocuments.js';
  import NppfPickerModal from '$lib/components/projects/NppfPickerModal.svelte';

  export let projectId;
  export let existingPolicies = []; // so the NPPF picker can mark ones already added
  export let plan = null; // existing row to edit, or null to add
  export let defaultSection = 'adopted';

  const dispatch = createEventDispatcher();

  const SECTIONS = [
    { key: 'adopted', label: 'Development Plan Adopted' },
    { key: 'emerging', label: 'Development Plan Emerging' },
    { key: 'supplementary', label: 'Supplementary Guidance' },
    { key: 'other', label: 'Other Material Considerations' }
  ];

  let form = {
    section: plan?.section || defaultSection,
    plan_name: plan?.plan_name || '',
    plan_type: plan?.plan_type || 'local',
    year_adopted: plan?.year_adopted ?? '',
    month_adopted: plan?.month_adopted ?? '',
    summary: plan?.summary || '',
    relevance: plan?.relevance || ''
  };
  let saving = false;
  let formError = null;

  $: isPlanSection = form.section === 'adopted' || form.section === 'emerging';
  $: rich = form.section === 'supplementary' || form.section === 'other';
  $: dated = form.section === 'adopted' || rich;

  // Adding a new "Other Material Considerations" entry can start from the NPPF
  // library: the ticked policies are staged for review, linked to this entry.
  let showNppfPicker = false;
  $: canPickNppf = !plan && form.section === 'other';

  function buildPayload() {
    return {
      section: form.section,
      plan_name: form.plan_name.trim(),
      plan_type: isPlanSection ? form.plan_type : null,
      year_adopted: dated && form.year_adopted ? parseInt(form.year_adopted) : null,
      month_adopted: dated && form.month_adopted ? parseInt(form.month_adopted) : null,
      summary: rich ? (form.summary.trim() || null) : null,
      relevance: rich ? (form.relevance.trim() || null) : null
    };
  }

  async function save() {
    if (!form.plan_name.trim()) { formError = 'Name is required'; return; }
    saving = true;
    formError = null;
    try {
      const payload = buildPayload();
      const saved = plan
        ? await updatePolicyDocument(plan.id, payload)
        : await createPolicyDocument(projectId, payload);
      dispatch('saved', saved);
    } catch (err) {
      formError = err.message;
      saving = false;
    }
  }

  // Saves this entry (named "National Planning Policy Framework (NPPF)" if left
  // blank), then hands the chosen policies on for review attached to it.
  async function onNppfChosen(e) {
    showNppfPicker = false;
    saving = true;
    formError = null;
    try {
      if (!form.plan_name.trim()) form.plan_name = 'National Planning Policy Framework (NPPF)';
      const saved = await createPolicyDocument(projectId, buildPayload());
      const rows = e.detail.rows.map(r => ({ ...r, plan_id: saved.id }));
      dispatch('saved', { ...saved, stagedRows: rows });
    } catch (err) {
      formError = err.message;
      saving = false;
    }
  }
</script>

<div class="dialog-backdrop" on:click|self={() => dispatch('close')} role="presentation">
  <div class="dialog dialog-md">
    <div class="dialog-header">
      <h3 class="dialog-title">{plan ? 'Edit Document' : 'Add Document'}</h3>
      <button class="dialog-close" on:click={() => dispatch('close')} aria-label="Close">&times;</button>
    </div>

    <div class="dialog-body">
      {#if canPickNppf}
        <button class="btn btn-secondary" type="button" on:click={() => showNppfPicker = true} disabled={saving}>
          <i class="las la-book"></i> Add NPPF policies from the library
        </button>
      {/if}

      <div class="form-item">
        <label class="form-label" for="pe-section">Where it sits</label>
        <select id="pe-section" class="form-input" bind:value={form.section}>
          {#each SECTIONS as s}<option value={s.key}>{s.label}</option>{/each}
        </select>
      </div>

      <div class="form-item">
        <label class="form-label" for="pe-name">{rich ? 'Name' : 'Plan name'} <span class="form-required">*</span></label>
        <input id="pe-name" type="text" class="form-input" bind:value={form.plan_name}
          placeholder={form.section === 'supplementary' ? 'e.g. Renewable Energy SPD' : form.section === 'other' ? 'e.g. NPPF (2024)' : 'e.g. Local Plan 2019'} />
      </div>

      {#if isPlanSection}
        <div class="form-item">
          <label class="form-label" for="pe-type">Plan type</label>
          <select id="pe-type" class="form-input" bind:value={form.plan_type}>
            <option value="local">Local Plan</option>
            <option value="neighbourhood">Neighbourhood Plan</option>
          </select>
        </div>
      {/if}

      {#if dated}
        <div class="form-cols">
          <div class="form-item">
            <label class="form-label" for="pe-year">Year adopted <span class="form-optional">(optional)</span></label>
            <input id="pe-year" type="number" class="form-input" bind:value={form.year_adopted} placeholder="e.g. 2021" min="1900" max="2100" />
          </div>
          <div class="form-item">
            <label class="form-label" for="pe-month">Month adopted <span class="form-optional">(optional)</span></label>
            <input id="pe-month" type="number" class="form-input" bind:value={form.month_adopted} placeholder="e.g. 9 for September" min="1" max="12" />
          </div>
        </div>
      {/if}

      {#if rich}
        <div class="form-item">
          <label class="form-label" for="pe-summary">Summary</label>
          <textarea id="pe-summary" class="form-input" bind:value={form.summary} rows="3" placeholder="What this covers…"></textarea>
        </div>
        <div class="form-item">
          <label class="form-label" for="pe-relevance">Relevance to project <span class="form-optional">(optional)</span></label>
          <textarea id="pe-relevance" class="form-input" bind:value={form.relevance} rows="2" placeholder="How this applies to the project…"></textarea>
        </div>
      {/if}

      {#if formError}<div class="alert alert-error">{formError}</div>{/if}
    </div>

    <div class="dialog-footer">
      <span></span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => dispatch('close')} disabled={saving}>Cancel</button>
        <button class="btn btn-primary" on:click={save} disabled={saving}>{saving ? 'Saving…' : plan ? 'Save Changes' : 'Add Document'}</button>
      </div>
    </div>
  </div>
</div>

{#if showNppfPicker}
  <NppfPickerModal {existingPolicies} on:close={() => showNppfPicker = false} on:review={onNppfChosen} />
{/if}
