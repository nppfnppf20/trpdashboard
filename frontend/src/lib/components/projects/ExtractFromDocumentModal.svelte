<script>
  // Reads a planning document (e.g. a stage one review or planning statement),
  // pulls out the policies and development plan documents it cites, and stages
  // both for review before anything is saved. The plans the user keeps are
  // created here; the policies are handed to the parent's review table.
  import { createEventDispatcher } from 'svelte';
  import { extractPoliciesFromDocument } from '$lib/api/lpaAnalysis.js';
  import { getPolicyDocuments, createPolicyDocument } from '$lib/api/policyDocuments.js';

  export let projectId;

  const dispatch = createEventDispatcher();

  let step = 'input'; // 'input' | 'plans'
  let mode = 'file'; // 'file' | 'text'
  let file = null;
  let text = '';
  let extracting = false;
  let confirmingPlans = false;
  let error = null;
  let warning = null;
  let stagedPlans = [];
  let stagedPolicies = [];

  function onFileChange(e) {
    file = e.target.files?.[0] ?? null;
  }

  // Builds the review table's rows from extracted policies, matching each one
  // to a plan by name (case-insensitive) from the given plan list.
  function policiesToRows(policies, plans) {
    return policies.map(p => {
      const matched = p.plan_name
        ? plans.find(d => d.plan_name?.trim().toLowerCase() === p.plan_name.trim().toLowerCase())
        : null;
      return {
        policy_reference: p.policy_reference || '',
        policy_name: p.policy_name || '',
        policy_type: p.policy_type || 'national',
        policy_text: p.policy_text || '',
        relevant_supporting_text: '',
        notes: '',
        is_key_policy: false,
        plan_id: matched ? matched.id : ''
      };
    });
  }

  async function runExtract() {
    if (mode === 'file' && !file) { error = 'Choose a file to upload'; return; }
    if (mode === 'text' && !text.trim()) { error = 'Paste some text first'; return; }
    extracting = true;
    error = null;
    try {
      const { policies: found, plans: foundPlans, warning: w } = await extractPoliciesFromDocument(
        projectId,
        mode === 'file' ? { file } : { text }
      );
      warning = w || null;
      if (!found.length && !foundPlans.length) {
        error = 'No policies or development plan documents were found in that document.';
        return;
      }
      stagedPolicies = found;
      if (foundPlans.length > 0) {
        stagedPlans = foundPlans.map(p => ({ ...p, include: true }));
        step = 'plans';
      } else {
        const existingPlans = await getPolicyDocuments(projectId);
        dispatch('review', { rows: policiesToRows(found, existingPlans), warning });
      }
    } catch (err) {
      error = err.message;
    } finally {
      extracting = false;
    }
  }

  // Creates whichever staged plans the user kept ticked, then hands the
  // policies on for review with each matched to its plan.
  async function confirmPlans() {
    confirmingPlans = true;
    error = null;
    try {
      const toCreate = stagedPlans.filter(p => p.include && p.plan_name.trim());
      const datedSection = p => p.section === 'adopted' || p.section === 'supplementary' || p.section === 'other';
      await Promise.all(toCreate.map(p => createPolicyDocument(projectId, {
        section: p.section,
        plan_name: p.plan_name.trim(),
        plan_type: (p.section === 'adopted' || p.section === 'emerging') ? p.plan_type : null,
        year_adopted: datedSection(p) ? (p.year_adopted || null) : null,
        month_adopted: datedSection(p) ? (p.month_adopted || null) : null
      })));
      const allPlans = await getPolicyDocuments(projectId);
      dispatch('review', { rows: policiesToRows(stagedPolicies, allPlans), warning });
    } catch (err) {
      error = err.message;
    } finally {
      confirmingPlans = false;
    }
  }
</script>

<div class="dialog-backdrop" on:click|self={() => dispatch('close')} role="presentation">
  <div class="dialog dialog-lg">
    <div class="dialog-header">
      <h3 class="dialog-title">{step === 'input' ? 'Add Policies from a Document' : 'Plans & Guidance Documents Found'}</h3>
      <button class="dialog-close" on:click={() => dispatch('close')} aria-label="Close">&times;</button>
    </div>

    <div class="dialog-body">
      {#if step === 'input'}
        <p class="dialog-hint">
          Upload a planning document (e.g. a stage one review or planning statement) or paste its text below.
          The AI finds every policy it cites, plus any development plans, SPDs, or other documents it references.
          NPPF policies get their wording filled in automatically; for everything else you add the wording yourself.
          You review and edit everything before anything is saved.
        </p>

        <div class="btn-group">
          <button type="button" class="btn btn-sm {mode === 'file' ? 'btn-primary' : 'btn-secondary'}" on:click={() => mode = 'file'}>Upload file</button>
          <button type="button" class="btn btn-sm {mode === 'text' ? 'btn-primary' : 'btn-secondary'}" on:click={() => mode = 'text'}>Paste text</button>
        </div>

        {#if mode === 'file'}
          <input type="file" class="form-input" accept=".pdf,.docx,.txt,.md" on:change={onFileChange} />
          {#if file}<p class="file-name"><i class="las la-file-alt"></i> {file.name}</p>{/if}
        {:else}
          <textarea class="form-input" bind:value={text} rows="10" placeholder="Paste the document text here…"></textarea>
        {/if}
      {:else}
        <p class="dialog-hint">
          Found {stagedPlans.length} document{stagedPlans.length === 1 ? '' : 's'} referenced.
          Check each one's <strong>type</strong>, as the AI's guess isn't always right (supplementary guidance or national documents can get labelled as an adopted plan).
          Untick any you don't want added to Relevant Documents, correct their name/type/date as needed, then continue to review the policies.
        </p>

        <div class="staged-list">
          {#each stagedPlans as plan, i (i)}
            <div class="staged-row" class:excluded={!plan.include}>
              <input type="checkbox" bind:checked={plan.include} />
              <input type="text" class="form-input staged-name" bind:value={plan.plan_name} disabled={!plan.include} />
              <select class="form-input staged-select" bind:value={plan.section} disabled={!plan.include}>
                <option value="adopted">Adopted</option>
                <option value="emerging">Emerging</option>
                <option value="supplementary">Supplementary</option>
                <option value="other">Other</option>
              </select>
              {#if plan.section === 'adopted' || plan.section === 'emerging'}
                <select class="form-input staged-select" bind:value={plan.plan_type} disabled={!plan.include}>
                  <option value="local">Local Plan</option>
                  <option value="neighbourhood">Neighbourhood Plan</option>
                </select>
              {/if}
              {#if plan.section === 'adopted' || plan.section === 'supplementary' || plan.section === 'other'}
                <input type="number" class="form-input staged-num" bind:value={plan.year_adopted} placeholder="Year" min="1900" max="2100" disabled={!plan.include} />
                <input type="number" class="form-input staged-num" bind:value={plan.month_adopted} placeholder="Month" min="1" max="12" disabled={!plan.include} />
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if warning}<div class="alert alert-warning">{warning}</div>{/if}
      {#if error}<div class="alert alert-error">{error}</div>{/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">Nothing is saved until you review and confirm the results</span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => dispatch('close')} disabled={extracting || confirmingPlans}>Cancel</button>
        {#if step === 'input'}
          <button class="btn btn-primary" on:click={runExtract} disabled={extracting}>{extracting ? 'Extracting…' : 'Extract'}</button>
        {:else}
          <button class="btn btn-primary" on:click={confirmPlans} disabled={confirmingPlans}>{confirmingPlans ? 'Adding…' : 'Continue to Policies'}</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .file-name { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: var(--font-size-xs); color: var(--color-slate-600); }

  .staged-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .staged-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-x: auto;
    padding: var(--space-2) var(--space-3);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
  }
  .staged-row.excluded { opacity: 0.55; }
  .staged-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer; flex-shrink: 0; }
  /* The shared .form-input is width:100%; in this single-line row each control sizes itself.
     min-width keeps the name readable: the row scrolls sideways rather than squeezing it. */
  .staged-name { flex: 1 1 auto; width: auto; min-width: 14rem; }
  .staged-select { flex-shrink: 0; width: auto; }
  .staged-num { flex-shrink: 0; width: 5.5rem; }
</style>
