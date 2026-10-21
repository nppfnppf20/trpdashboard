<script>
  // Pick Policies from a Plan: upload a full development plan, confirm what
  // it is and where it sits in Relevant Documents, name the policies wanted,
  // then review their verbatim wording before everything is saved in one go.
  // The plan is far bigger than a model's context window, so the backend
  // indexes it and only sends the chosen policies' sections to the model
  // (see backend/src/services/planPolicyPicker.service.js).
  import { createEventDispatcher } from 'svelte';
  import { analysePlanDocument, extractPlanPolicies, createPolicy, updatePolicy } from '$lib/api/lpaAnalysis.js';
  import { createPolicyDocument } from '$lib/api/policyDocuments.js';

  export let projectId;
  export let planDocs = [];
  export let policies = [];

  const dispatch = createEventDispatcher();

  const SECTIONS = [
    { key: 'adopted', label: 'Development Plan Adopted' },
    { key: 'emerging', label: 'Development Plan Emerging' },
    { key: 'supplementary', label: 'Supplementary Guidance' },
    { key: 'other', label: 'Other Material Considerations' }
  ];
  const HINTS = [
    { key: '', label: 'No hint, let the AI judge' },
    { key: 'boxed', label: 'Policy wording is in a coloured / shaded box' },
    { key: 'numbered_paras', label: 'Supporting text has numbered paragraphs (e.g. 4.12)' },
    { key: 'bold', label: 'Policy wording is in bold' },
    { key: 'headings', label: 'Supporting text sits under a sub-heading (e.g. Reasoned Justification)' }
  ];
  const DISTINGUISHED = { box: 'a box', heading: 'a heading', paragraph_numbering: 'paragraph numbering', layout: 'layout', unclear: 'unclear' };

  let step = 'upload'; // 'upload' | 'plan' | 'pick' | 'review'
  let file = null;
  let busy = false;
  let error = null;
  let warning = null;

  // analyse result
  let suggestion = null;
  let index = [];
  let indexMethod = 'regex';

  // plan step (user-editable)
  let planTarget = 'new'; // 'new' | existing plan id (as string)
  let planForm = { plan_name: '', section: 'adopted', plan_type: 'local', year_adopted: '', month_adopted: '', summary: '' };

  // pick step
  let selectInput = '';
  let unmatched = [];
  let browseFilter = '';
  let selectedIds = new Set();
  let hint = '';
  let hintNote = '';

  // review step
  let rows = [];
  let alsoSaveSupporting = false;
  let showSection = null;

  $: existingTarget = planTarget !== 'new' ? planDocs.find(d => d.id === Number(planTarget)) : null;
  $: effectiveSection = existingTarget ? existingTarget.section : planForm.section;
  $: effectivePlanType = existingTarget ? existingTarget.plan_type : planForm.plan_type;
  $: policyType = effectiveSection === 'supplementary' ? 'supplementary'
    : effectiveSection === 'other' ? 'other'
    : effectivePlanType === 'neighbourhood' ? 'neighbourhood' : 'local';
  $: showPlanType = !existingTarget && (planForm.section === 'adopted' || planForm.section === 'emerging');
  $: showDate = !existingTarget && planForm.section !== 'emerging';
  $: filteredIndex = index.filter(e => !browseFilter.trim()
    || `${e.reference} ${e.name}`.toLowerCase().includes(browseFilter.trim().toLowerCase()));

  const normRef = s => (s || '').toLowerCase().replace(/^policy\s+/, '').replace(/[^a-z0-9]/g, '');

  function close() { dispatch('close'); }

  function onFileChange(e) { file = e.target.files?.[0] || null; }

  async function analyse() {
    if (!file) { error = 'Choose a file to upload'; return; }
    busy = true;
    error = null;
    try {
      const res = await analysePlanDocument(projectId, { file });
      suggestion = res.plan;
      index = res.index;
      indexMethod = res.indexMethod;
      warning = res.warning || null;
      planForm = {
        plan_name: res.plan.plan_name,
        section: res.plan.section,
        plan_type: res.plan.plan_type || 'local',
        year_adopted: res.plan.year_adopted ?? '',
        month_adopted: res.plan.month_adopted ?? '',
        summary: res.plan.summary || ''
      };
      planTarget = res.existingMatch ? String(res.existingMatch.id) : 'new';
      step = 'plan';
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  function validatePlan() {
    if (planTarget === 'new' && !planForm.plan_name.trim()) { error = 'Give the document a name'; return false; }
    return true;
  }

  function planPayload() {
    const dated = planForm.section !== 'emerging';
    return {
      section: planForm.section,
      plan_name: planForm.plan_name.trim(),
      plan_type: showPlanType ? planForm.plan_type : null,
      year_adopted: dated && planForm.year_adopted ? parseInt(planForm.year_adopted) : null,
      month_adopted: dated && planForm.month_adopted ? parseInt(planForm.month_adopted) : null,
      summary: planForm.summary.trim() || null
    };
  }

  async function savePlanOnly() {
    if (!validatePlan()) return;
    busy = true;
    error = null;
    try {
      if (planTarget === 'new') await createPolicyDocument(projectId, planPayload());
      dispatch('saved');
      close();
    } catch (err) {
      error = err.message;
      busy = false;
    }
  }

  function goPick() {
    if (!validatePlan()) return;
    error = null;
    step = 'pick';
  }

  // Free-text selection: each comma/newline-separated entry is matched to the
  // plan's policy index by reference ("DM4", "Policy DM 4") or by words in the
  // title ("flood risk"). Matches are ticked in the list below to confirm.
  function addFromText() {
    const tokens = selectInput.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
    const next = new Set(selectedIds);
    unmatched = [];
    for (const token of tokens) {
      const n = normRef(token);
      let hits = n ? index.filter(e => normRef(e.reference) === n) : [];
      if (!hits.length) hits = index.filter(e => `${e.reference} ${e.name}`.toLowerCase().includes(token.toLowerCase()));
      if (!hits.length) {
        const words = token.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length) hits = index.filter(e => words.every(w => e.name.toLowerCase().includes(w)));
      }
      if (hits.length) hits.forEach(h => next.add(h.id));
      else unmatched.push(token);
    }
    selectedIds = next;
    unmatched = unmatched;
    if (!unmatched.length) selectInput = '';
  }

  function toggleSelected(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  async function runExtract() {
    if (!selectedIds.size) { error = 'Choose at least one policy'; return; }
    busy = true;
    error = null;
    try {
      const selections = index
        .filter(e => selectedIds.has(e.id))
        .map(e => ({ id: e.id, reference: e.reference, name: e.name, start: e.start, end: e.end }));
      const res = await extractPlanPolicies(projectId, { file, selections, hint, hintNote });
      if (res.warning) warning = res.warning;

      const targetPlanId = existingTarget ? existingTarget.id : null;
      rows = res.results.map(r => {
        const existing = targetPlanId
          ? policies.find(p => p.plan_id === targetPlanId && normRef(p.policy_reference) === normRef(r.reference))
          : null;
        return {
          ...r,
          policy_reference: r.reference,
          policy_name: r.name,
          existingId: existing?.id ?? null,
          include: r.status === 'ok' && !!r.wording,
          showSupporting: false
        };
      });
      step = 'review';
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  function onWordingEdit(row) {
    // A hand-edited row is no longer the AI's verbatim slice.
    row.verbatim = null;
    row.include = !!row.wording?.trim();
    rows = rows;
  }

  $: toSave = rows.filter(r => r.include && r.wording?.trim());

  async function acceptAll() {
    if (!toSave.length) { error = 'Nothing selected to save'; return; }
    busy = true;
    error = null;
    try {
      let planId = existingTarget ? existingTarget.id : null;
      if (!planId) {
        const created = await createPolicyDocument(projectId, planPayload());
        planId = created.id;
      }

      for (const r of toSave) {
        const supporting = alsoSaveSupporting && r.supporting_text?.trim() ? r.supporting_text.trim() : null;
        const existing = r.existingId ? policies.find(p => p.id === r.existingId) : null;
        if (existing) {
          await updatePolicy(existing.id, {
            policy_reference: r.policy_reference.trim() || existing.policy_reference,
            policy_name: r.policy_name.trim() || existing.policy_name,
            policy_type: existing.policy_type,
            policy_text: r.wording.trim(),
            relevant_supporting_text: supporting ?? existing.relevant_supporting_text,
            notes: existing.notes,
            is_key_policy: existing.is_key_policy,
            plan_id: existing.plan_id
          });
        } else {
          await createPolicy(projectId, {
            policy_reference: r.policy_reference.trim(),
            policy_name: r.policy_name.trim() || r.policy_reference.trim(),
            policy_type: policyType,
            policy_text: r.wording.trim(),
            relevant_supporting_text: supporting,
            notes: '',
            is_key_policy: false,
            plan_id: planId
          });
        }
      }
      dispatch('saved');
      close();
    } catch (err) {
      error = err.message;
      busy = false;
    }
  }

  const STEP_ORDER = ['upload', 'plan', 'pick', 'review'];
  const STEP_SHORT = { upload: 'Upload', plan: 'Plan', pick: 'Policies', review: 'Review' };
  const STEP_TITLES = {
    upload: 'Pick Policies from a Plan',
    plan: 'Confirm the Development Plan',
    pick: 'Choose Policies',
    review: 'Review Verbatim Wording'
  };
  $: planLabel = existingTarget?.plan_name || planForm.plan_name || 'this plan';
</script>

<div class="pp-backdrop" on:click|self={close} role="presentation">
  <div class="pp-modal">
    <div class="pp-header">
      <div>
        <h3>{STEP_TITLES[step]}</h3>
        <div class="pp-steps">
          {#each STEP_ORDER as s, i}
            <span class="pp-step" class:active={step === s} class:done={STEP_ORDER.indexOf(step) > i}>{i + 1}. {STEP_SHORT[s]}</span>
          {/each}
        </div>
      </div>
      <button class="pp-close" on:click={close} aria-label="Close">&times;</button>
    </div>

    <div class="pp-body">
      {#if step === 'upload'}
        <p class="pp-hint">
          Upload a whole development plan, however long. The AI first works out what the document is and where it
          belongs in Relevant Documents, then builds an index of its policies. You then say which policies you want
          and only those are read, so the length of the plan doesn't matter.
        </p>
        <div class="field">
          <label for="pp-file">Development plan document</label>
          <input id="pp-file" type="file" accept=".pdf,.docx,.txt,.md" on:change={onFileChange} />
          {#if file}<p class="pp-filename"><i class="las la-file-alt"></i> {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>{/if}
        </div>

      {:else if step === 'plan'}
        <p class="pp-hint">
          Here is what the AI thinks this document is and where it sits in <strong>Relevant Documents</strong>. Edit anything that's wrong.
        </p>
        {#if suggestion?.placement_reason}
          <div class="pp-note">
            <i class="las la-lightbulb"></i>
            <span>
              {suggestion.placement_reason}
              <span class="pp-conf pp-conf-{suggestion.confidence}">{suggestion.confidence} confidence</span>
            </span>
          </div>
        {/if}

        {#if planDocs.length}
          <div class="field">
            <label for="pp-target">Add to</label>
            <select id="pp-target" bind:value={planTarget}>
              <option value="new">Create as a new document</option>
              {#each planDocs as d (d.id)}
                <option value={String(d.id)}>Use existing: {d.plan_name}{d.year_adopted ? ` (${d.year_adopted})` : ''}</option>
              {/each}
            </select>
            {#if existingTarget}
              <p class="pp-muted">This looks like <strong>{existingTarget.plan_name}</strong>, already in Relevant Documents. The chosen policies will be added to it.</p>
            {/if}
          </div>
        {/if}

        {#if !existingTarget}
          <div class="field">
            <label for="pp-name">Document name</label>
            <input id="pp-name" type="text" bind:value={planForm.plan_name} />
          </div>
          <div class="pp-grid">
            <div class="field">
              <label for="pp-section">Where it sits</label>
              <select id="pp-section" bind:value={planForm.section}>
                {#each SECTIONS as s}<option value={s.key}>{s.label}</option>{/each}
              </select>
            </div>
            {#if showPlanType}
              <div class="field">
                <label for="pp-type">Plan type</label>
                <select id="pp-type" bind:value={planForm.plan_type}>
                  <option value="local">Local Plan</option>
                  <option value="neighbourhood">Neighbourhood Plan</option>
                </select>
              </div>
            {/if}
            {#if showDate}
              <div class="field">
                <label for="pp-year">Year adopted / issued</label>
                <input id="pp-year" type="number" min="1900" max="2100" bind:value={planForm.year_adopted} placeholder="e.g. 2021" />
              </div>
              <div class="field">
                <label for="pp-month">Month (1-12)</label>
                <input id="pp-month" type="number" min="1" max="12" bind:value={planForm.month_adopted} placeholder="optional" />
              </div>
            {/if}
          </div>
          <div class="field">
            <label for="pp-summary">Summary</label>
            <textarea id="pp-summary" rows="3" bind:value={planForm.summary}></textarea>
          </div>
        {/if}

      {:else if step === 'pick'}
        <p class="pp-hint">
          {index.length
            ? `${index.length} polic${index.length === 1 ? 'y' : 'ies'} found in ${planLabel}. Type the ones you want (references or topics, separated by commas), or tick them below.`
            : `No policy headings were found in this document. Go back and check it is the right file, or paste the wording in by hand from the Policy tab.`}
          {#if indexMethod === 'llm' && index.length}<span class="pp-muted"> This plan's headings didn't follow a standard pattern, so the AI built the index. Check it looks complete.</span>{/if}
        </p>

        {#if index.length}
          <div class="field">
            <label for="pp-select">Policies to extract</label>
            <div class="pp-select-row">
              <textarea id="pp-select" rows="2" bind:value={selectInput} placeholder="e.g. DM1, DM4, Policy H2, flood risk"
                on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addFromText(); } }}></textarea>
              <button class="btn-save" on:click={addFromText} disabled={!selectInput.trim()}>Add</button>
            </div>
            {#if unmatched.length}
              <p class="pp-unmatched"><i class="las la-exclamation-circle"></i> No match for: {unmatched.join(', ')}. Pick from the list below instead.</p>
            {/if}
          </div>

          <div class="field">
            <label for="pp-browse">All policies found ({selectedIds.size} selected)</label>
            <input id="pp-browse" type="text" bind:value={browseFilter} placeholder="Filter the list…" />
            <div class="pp-index-list">
              {#each filteredIndex as e (e.id)}
                <label class="pp-index-item" class:selected={selectedIds.has(e.id)}>
                  <input type="checkbox" checked={selectedIds.has(e.id)} on:change={() => toggleSelected(e.id)} />
                  {#if e.reference}<span class="pp-ref">{e.reference}</span>{/if}
                  <span class="pp-index-name">{e.name}</span>
                </label>
              {/each}
              {#if !filteredIndex.length}<p class="pp-muted pp-pad">Nothing matches that filter.</p>{/if}
            </div>
          </div>

          <div class="pp-grid">
            <div class="field">
              <label for="pp-hint">How does this plan show its policy wording? <span class="pp-optional">(optional)</span></label>
              <select id="pp-hint" bind:value={hint}>
                {#each HINTS as h}<option value={h.key}>{h.label}</option>{/each}
              </select>
            </div>
            <div class="field">
              <label for="pp-hintnote">Anything else the AI should know <span class="pp-optional">(optional)</span></label>
              <input id="pp-hintnote" type="text" bind:value={hintNote} maxlength="500" placeholder="e.g. criteria are lettered (a), (b)…" />
            </div>
          </div>
        {/if}

      {:else if step === 'review'}
        <div class="pp-note">
          <i class="las la-info-circle"></i>
          <span>
            Wording is copied directly out of the source document, not retyped by the AI.
            <strong>Policy wording</strong> and <strong>supporting text</strong> are kept separate; only the policy wording is saved unless you tick the box below.
          </span>
        </div>
        <label class="pp-check">
          <input type="checkbox" bind:checked={alsoSaveSupporting} /> Also save supporting text into each policy's "supporting text" field
        </label>

        {#each rows as row (row.id)}
          <div class="pp-row">
            <input class="pp-row-check" type="checkbox" bind:checked={row.include} disabled={!row.wording?.trim()} aria-label="Include" />
            <div class="pp-row-main">
              <div class="pp-row-head">
                <input type="text" class="pp-ref-input" bind:value={row.policy_reference} placeholder="Ref" />
                <input type="text" class="pp-name-input" bind:value={row.policy_name} placeholder="Policy name" />
              </div>
              <div class="pp-badges">
                {#if row.status !== 'ok'}
                  <span class="pp-badge pp-badge-flag"><i class="las la-question-circle"></i> {row.status === 'failed' ? 'AI call failed' : 'Wording not located'}</span>
                {:else if row.verbatim}
                  <span class="pp-badge" class:pp-badge-ok={row.verbatim.verified} class:pp-badge-flag={!row.verbatim.verified}
                    title={row.verbatim.exact ? 'Found word for word in the source text' : `~${Math.round(row.verbatim.score * 100)}% match to the source text`}>
                    <i class="las {row.verbatim.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i>
                    {row.verbatim.verified ? 'Verbatim' : 'Check this'}
                  </span>
                {:else}
                  <span class="pp-badge pp-badge-flag"><i class="las la-pen"></i> Edited by hand</span>
                {/if}
                {#if row.confidence && row.confidence !== 'high'}<span class="pp-badge pp-badge-flag">{row.confidence} confidence</span>{/if}
                {#if row.distinguished_by && row.status === 'ok'}<span class="pp-muted">separated from supporting text by {DISTINGUISHED[row.distinguished_by] || row.distinguished_by}</span>{/if}
                {#if row.existingId}<span class="pp-badge pp-badge-info">Replaces saved wording</span>{/if}
              </div>
              {#if row.note}<p class="pp-muted">{row.note}</p>{/if}

              <label class="pp-field-label" for="w-{row.id}">Policy wording</label>
              <textarea id="w-{row.id}" rows="5" bind:value={row.wording} on:input={() => onWordingEdit(row)}
                placeholder="Not located. Paste the wording here if you have it."></textarea>

              {#if row.supporting_text}
                <button type="button" class="pp-link" on:click={() => { row.showSupporting = !row.showSupporting; rows = rows; }}>
                  {row.showSupporting ? 'Hide' : 'Show'} supporting text
                </button>
                {#if row.showSupporting}
                  <textarea rows="4" bind:value={row.supporting_text} class="pp-supporting"></textarea>
                {/if}
              {/if}

              {#if row.section_text}
                <button type="button" class="pp-link" on:click={() => showSection = showSection === row.id ? null : row.id}>
                  {showSection === row.id ? 'Hide' : 'View'} the text under this heading
                </button>
                {#if showSection === row.id}<pre class="pp-section-text">{row.section_text}</pre>{/if}
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    {#if error}<div class="pp-error">{error}</div>{/if}
    {#if warning}<div class="pp-error pp-warning">{warning}</div>{/if}

    <div class="pp-footer">
      {#if step === 'review'}
        <span class="pp-count">{toSave.length} of {rows.length} will be saved{!existingTarget ? `, plus "${planForm.plan_name || 'the plan'}" added to Relevant Documents` : ''}</span>
      {:else}<span></span>{/if}
      <div class="pp-actions">
        <button class="btn-cancel" on:click={close} disabled={busy}>Cancel</button>
        {#if step === 'upload'}
          <button class="btn-save" on:click={analyse} disabled={busy || !file}>{busy ? 'Reading document…' : 'Analyse Document'}</button>
        {:else if step === 'plan'}
          <button class="btn-cancel" on:click={() => { step = 'upload'; error = null; }} disabled={busy}>Back</button>
          {#if !existingTarget}
            <button class="btn-cancel" on:click={savePlanOnly} disabled={busy}>Save plan only</button>
          {/if}
          <button class="btn-save" on:click={goPick} disabled={busy}>Next: choose policies</button>
        {:else if step === 'pick'}
          <button class="btn-cancel" on:click={() => { step = 'plan'; error = null; }} disabled={busy}>Back</button>
          <button class="btn-save" on:click={runExtract} disabled={busy || !selectedIds.size}>
            {busy ? 'Extracting…' : `Extract ${selectedIds.size || ''} polic${selectedIds.size === 1 ? 'y' : 'ies'}`}
          </button>
        {:else if step === 'review'}
          <button class="btn-cancel" on:click={() => { step = 'pick'; error = null; }} disabled={busy}>Back</button>
          <button class="btn-save" on:click={acceptAll} disabled={busy || !toSave.length}>{busy ? 'Saving…' : 'Accept all & save'}</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .pp-backdrop {
    position: fixed; inset: 0; background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 2000; padding: 1rem;
  }
  .pp-modal {
    background: white; border-radius: 12px; width: 95%; max-width: 900px; max-height: 90vh;
    display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden;
  }
  .pp-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0;
  }
  .pp-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); }
  .pp-steps { display: flex; gap: 0.75rem; margin-top: 0.35rem; }
  .pp-step { font-size: 0.72rem; color: var(--color-slate-400); }
  .pp-step.active { color: var(--color-purple-600); font-weight: 600; }
  .pp-step.done { color: var(--color-slate-600); }
  .pp-close {
    background: none; border: none; font-size: 1.75rem; color: var(--color-slate-500);
    cursor: pointer; line-height: 1; padding: 0; width: 2rem; height: 2rem;
  }
  .pp-close:hover { color: var(--color-slate-800); }

  .pp-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .pp-hint { margin: 0; font-size: 0.85rem; color: var(--color-slate-600); line-height: 1.5; }
  .pp-muted { font-size: 0.75rem; color: var(--color-slate-500); margin: 0.2rem 0 0; }
  .pp-pad { padding: 0.5rem 0.75rem; }
  .pp-optional { color: var(--color-slate-400); font-weight: 400; }
  .pp-filename { display: flex; align-items: center; gap: 0.4rem; margin: 0.35rem 0 0; font-size: 0.8rem; color: var(--color-slate-600); }

  .pp-note {
    display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.8rem; color: var(--color-slate-600);
    background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.6rem 0.75rem;
  }
  .pp-note i { font-size: 1.1rem; color: var(--color-purple-600); flex-shrink: 0; }
  .pp-conf { margin-left: 0.4rem; font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 10px; }
  .pp-conf-high { color: var(--color-badge-success-fg); background: var(--color-badge-success-bg); }
  .pp-conf-medium, .pp-conf-low { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label, .pp-field-label { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); }
  input[type="text"], input[type="number"], select, textarea {
    padding: 0.5rem 0.65rem; border: 1px solid var(--color-slate-300); border-radius: 6px;
    font-size: 0.85rem; font-family: inherit; color: var(--color-slate-800); background: white; width: 100%; box-sizing: border-box;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--color-purple-600); box-shadow: var(--focus-ring-blue); }
  textarea { resize: vertical; }
  .pp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }

  .pp-select-row { display: flex; gap: 0.5rem; align-items: flex-start; }
  .pp-unmatched { margin: 0.25rem 0 0; font-size: 0.78rem; color: var(--color-badge-warning-fg); display: flex; gap: 0.3rem; align-items: center; }

  .pp-index-list {
    max-height: 240px; overflow-y: auto; border: 1px solid var(--color-slate-200); border-radius: 6px; background: white;
  }
  .pp-index-item {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--color-slate-100); cursor: pointer; font-weight: 400;
  }
  .pp-index-item:last-child { border-bottom: none; }
  .pp-index-item:hover { background: var(--color-slate-50); }
  .pp-index-item.selected { background: var(--color-purple-50); }
  .pp-index-item input { width: 16px; height: 16px; accent-color: var(--color-purple-600); flex-shrink: 0; }
  .pp-index-name { font-size: 0.85rem; color: var(--color-slate-800); }
  .pp-ref {
    font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); background: var(--color-slate-100);
    padding: 0.15rem 0.45rem; border-radius: 4px; font-family: monospace; white-space: nowrap;
  }

  .pp-check { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; font-size: 0.82rem; cursor: pointer; }
  .pp-check input { accent-color: var(--color-purple-600); }

  .pp-row {
    display: flex; gap: 0.75rem; align-items: flex-start; background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200); border-radius: 10px; padding: 1rem;
  }
  .pp-row-check { width: 16px; height: 16px; margin-top: 0.6rem; accent-color: var(--color-purple-600); cursor: pointer; flex-shrink: 0; }
  .pp-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.45rem; }
  .pp-row-head { display: flex; gap: 0.5rem; }
  .pp-ref-input { width: 9rem !important; flex-shrink: 0; font-family: monospace; }
  .pp-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
  .pp-badge {
    display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.68rem; font-weight: 600;
    padding: 0.1rem 0.4rem; border-radius: 10px; white-space: nowrap;
  }
  .pp-badge-ok { color: var(--color-badge-success-fg); background: var(--color-badge-success-bg); }
  .pp-badge-flag { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }
  .pp-badge-info { color: var(--color-badge-info-fg); background: var(--color-badge-info-bg); }
  .pp-supporting { background: var(--color-slate-50); }
  .pp-link {
    align-self: flex-start; background: none; border: none; padding: 0; color: var(--color-purple-600);
    font-size: 0.78rem; font-weight: 500; cursor: pointer; text-decoration: underline; font-family: inherit;
  }
  .pp-section-text {
    max-height: 220px; overflow-y: auto; margin: 0; background: white; border: 1px solid var(--color-slate-200);
    border-radius: 4px; padding: 0.5rem; font-size: 0.72rem; white-space: pre-wrap; color: var(--color-slate-700);
  }

  .pp-error {
    margin: 0 1.5rem 0.5rem; font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50);
    border: 1px solid var(--color-red-200); border-radius: 6px; padding: 0.5rem 0.75rem; flex-shrink: 0;
  }
  .pp-warning { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); border-color: var(--color-amber-200); }

  .pp-footer {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    padding: 1rem 1.5rem; border-top: 1px solid var(--color-slate-200); flex-shrink: 0;
  }
  .pp-count { font-size: 0.8rem; color: var(--color-slate-500); }
  .pp-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }

  .btn-cancel {
    padding: 0.45rem 1rem; border: 1px solid var(--color-slate-300); background: white; border-radius: 6px;
    font-size: 0.85rem; font-family: inherit; cursor: pointer; color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem; background: var(--color-purple-600); color: white; border: none; border-radius: 6px;
    font-size: 0.85rem; font-weight: 500; font-family: inherit; cursor: pointer; white-space: nowrap;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
