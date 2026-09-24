<script>
  // Parallel to PolicyTierNotes.svelte, deliberately not sharing code with it —
  // that component is wired to the planning-notes.js store (planning_applications
  // .issue_notes / policy_track_relevance), this one is prop-driven so it can sit
  // on top of admin_console.drafting_issues instead, fully independently.

  export let issue;
  export let policies = [];
  export let relevantPolicyIds = [];
  export let toggleFn; // async (policyId, issueId) => { linked }
  // Supplementary Guidance / Other Material Considerations documents often
  // have no discrete policies of their own — their relevance is instead
  // written directly onto the plan document (policy_documents.relevance).
  // Normalised into policy-shaped items below (see planAsItem) so they can
  // render through the same markup as real policies rather than duplicating
  // it. Only ever populated for the supplementary/other tiers, since those
  // are the only policy_documents.section values that line up with a tier.
  export let plans = [];
  export let relevantPlanIds = [];
  export let planToggleFn; // async (planId, issueId) => { linked }
  export let onNoteChange; // (tierKey, value) => void

  const POLICY_TIERS = [
    { key: 'policy_national',      label: 'National Policy',      dbType: 'national',      placeholder: 'Add further national policy notes...' },
    { key: 'policy_local',         label: 'Local Policy',         dbType: 'local',         placeholder: 'Add further local policy notes...' },
    { key: 'policy_neighbourhood', label: 'Neighbourhood Policy', dbType: 'neighbourhood', placeholder: 'Add further neighbourhood policy notes...' },
    { key: 'policy_supplementary', label: 'Supplementary',        dbType: 'supplementary', placeholder: 'Add further supplementary guidance notes...' },
    { key: 'policy_other',         label: 'Other',                dbType: 'other',         placeholder: 'Add further policy notes...' },
  ];

  // Accordion — only one tier (or "All Linked") open at a time, and nothing
  // is open by default. A tier with existing content still needs a click to
  // view it, same as an empty one — no auto-expand, so the button's colour
  // always matches whether its panel is actually showing.
  let openKey = null;
  let toggling = {};
  let previewPolicy = null;
  let textareaExpanded = {};

  function expandTextarea(tierKey) {
    textareaExpanded = { ...textareaExpanded, [tierKey]: true };
  }

  function collapseTextareaIfEmpty(tierKey, value) {
    if (!value?.trim()) {
      textareaExpanded = { ...textareaExpanded, [tierKey]: false };
    }
  }

  // Only plans with an actual relevance summary are worth surfacing here —
  // one with nothing written yet has nothing to link or preview.
  function planAsItem(plan) {
    return {
      id: plan.id,
      _kind: 'plan',
      policy_reference: null,
      policy_name: plan.plan_name,
      policy_type: plan.section,
      is_key_policy: false,
      policy_text: null,
      relevant_supporting_text: plan.relevance,
      notes: plan.summary,
    };
  }

  $: itemsByType = [
    ...policies.map(p => ({ ...p, _kind: 'policy' })),
    ...plans.filter(p => p.relevance?.trim()).map(planAsItem),
  ].reduce((acc, item) => {
    const t = (item.policy_type ?? '').toLowerCase();
    if (!acc[t]) acc[t] = [];
    acc[t].push(item);
    return acc;
  }, {});

  function isLinked(item) {
    return item._kind === 'plan' ? relevantPlanIds.includes(item.id) : relevantPolicyIds.includes(item.id);
  }

  // "All Linked" — a cross-tier view, not one of POLICY_TIERS, so it needs
  // its own type label per row (mixing national/local/etc. together is the
  // whole point, unlike the per-tier lists above which are already scoped).
  const ALL_LINKED_KEY = 'all_linked';
  $: allLinkedItems = Object.values(itemsByType).flat().filter(isLinked);

  async function handleToggle(item) {
    const key = `${item._kind}:${item.id}`;
    if (toggling[key]) return;
    toggling = { ...toggling, [key]: true };
    try {
      if (item._kind === 'plan') await planToggleFn(item.id, issue.id);
      else await toggleFn(item.id, issue.id);
    } catch (e) {
      console.error(`Failed to toggle ${item._kind}:`, e);
    } finally {
      toggling = { ...toggling, [key]: false };
    }
  }

  function toggle(tierKey) {
    openKey = openKey === tierKey ? null : tierKey;
  }

  function autoresize(node) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      destroy() { node.removeEventListener('input', resize); }
    };
  }
</script>

<div class="policy-notes">
  <div class="tier-header">
    <span class="tier-header-label">Policy</span>
  </div>

  <div class="tier-buttons">
    <button
      class="tier-btn"
      class:active={openKey === ALL_LINKED_KEY}
      on:click={() => toggle(ALL_LINKED_KEY)}
    >
      All Linked
      {#if allLinkedItems.length > 0}<span class="tier-dot"></span>{/if}
    </button>
    {#each POLICY_TIERS as tier}
      {@const hasContent = !!issue[tier.key]?.trim()}
      <button
        class="tier-btn"
        class:active={openKey === tier.key}
        on:click={() => toggle(tier.key)}
      >
        {tier.label}
        {#if hasContent}<span class="tier-dot"></span>{/if}
      </button>
    {/each}
  </div>

  {#if openKey === ALL_LINKED_KEY}
    <div class="tier-field">
      <label class="tier-label">All Linked</label>

      {#if allLinkedItems.length}
        <div class="policy-refs">
          {#each allLinkedItems as item}
            <div class="policy-ref linked">
              <div class="policy-ref-header">
                {#if item.policy_reference}<span class="policy-ref-code">{item.policy_reference}</span>{/if}
                <button class="policy-ref-name-btn" on:click={() => previewPolicy = item}>
                  {item.policy_name}
                </button>
                {#if item.is_key_policy}<span class="policy-ref-key">Key</span>{/if}
                <span class="policy-ref-type">{item.policy_type}</span>
                <button
                  class="policy-link-btn linked"
                  disabled={toggling[`${item._kind}:${item.id}`]}
                  on:click={() => handleToggle(item)}
                  title="Remove from this issue"
                >
                  {#if toggling[`${item._kind}:${item.id}`]}
                    <span class="mini-spinner"></span>
                  {:else}
                    <i class="las la-check"></i> Linked
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="all-linked-empty">No policies linked to this issue yet.</p>
      {/if}
    </div>
  {/if}

  {#each POLICY_TIERS as tier}
    {#if openKey === tier.key}
      <div class="tier-field">
        <label class="tier-label">{tier.label}</label>

        {#if itemsByType[tier.dbType]?.length}
          <div class="policy-refs">
            {#each itemsByType[tier.dbType] as item}
              {@const linked = isLinked(item)}
              <div class="policy-ref" class:linked>
                <div class="policy-ref-header">
                  {#if item.policy_reference}<span class="policy-ref-code">{item.policy_reference}</span>{/if}
                  <button class="policy-ref-name-btn" on:click={() => previewPolicy = item}>
                    {item.policy_name}
                  </button>
                  {#if item.is_key_policy}<span class="policy-ref-key">Key</span>{/if}
                  {#if item._kind === 'plan'}<span class="policy-ref-plan-tag">Plan</span>{/if}
                  <button
                    class="policy-link-btn"
                    class:linked
                    disabled={toggling[`${item._kind}:${item.id}`]}
                    on:click={() => handleToggle(item)}
                    title={linked ? 'Remove from this issue' : 'Mark as relevant to this issue'}
                  >
                    {#if toggling[`${item._kind}:${item.id}`]}
                      <span class="mini-spinner"></span>
                    {:else if linked}
                      <i class="las la-check"></i> Linked
                    {:else}
                      <i class="las la-plus"></i> Link
                    {/if}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <textarea
          class="tier-textarea"
          class:tier-textarea-compact={!textareaExpanded[tier.key] && !issue[tier.key]?.trim()}
          placeholder={tier.placeholder}
          value={issue[tier.key] ?? ''}
          use:autoresize
          on:focus={() => expandTextarea(tier.key)}
          on:blur={(e) => { onNoteChange(tier.key, e.target.value); collapseTextareaIfEmpty(tier.key, e.target.value); }}
        ></textarea>
      </div>
    {/if}
  {/each}
</div>

{#if previewPolicy}
  <div class="policy-modal-backdrop" on:click={() => previewPolicy = null}>
    <div class="policy-modal" on:click|stopPropagation>
      <div class="policy-modal-header">
        <div class="policy-modal-title">
          {#if previewPolicy.policy_reference}<span class="policy-ref-code">{previewPolicy.policy_reference}</span>{/if}
          <span>{previewPolicy.policy_name}</span>
          {#if previewPolicy.is_key_policy}<span class="policy-ref-key">Key</span>{/if}
          {#if previewPolicy.policy_type}<span class="policy-modal-type">{previewPolicy.policy_type}</span>{/if}
        </div>
        <button class="policy-modal-close" on:click={() => previewPolicy = null}>
          <i class="las la-times"></i>
        </button>
      </div>
      {#if previewPolicy.policy_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">Policy Text</p>
          <p class="policy-modal-body">{previewPolicy.policy_text}</p>
        </div>
      {/if}
      {#if previewPolicy.relevant_supporting_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">{previewPolicy._kind === 'plan' ? 'Relevance to Project' : 'Supporting Text'}</p>
          <p class="policy-modal-body policy-modal-support">{previewPolicy.relevant_supporting_text}</p>
        </div>
      {/if}
      {#if previewPolicy.notes}
        <div class="policy-modal-section">
          <p class="policy-modal-label">{previewPolicy._kind === 'plan' ? 'Summary' : 'Notes'}</p>
          <p class="policy-modal-body policy-modal-support">{previewPolicy.notes}</p>
        </div>
      {/if}
      {#if !previewPolicy.policy_text && !previewPolicy.relevant_supporting_text && !previewPolicy.notes}
        <p class="policy-modal-empty">No text recorded for this {previewPolicy._kind === 'plan' ? 'plan' : 'policy'}.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .policy-notes { display: flex; flex-direction: column; gap: 0.625rem; }

  .tier-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

  .tier-header-label {
    font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); text-transform: uppercase; letter-spacing: 0.04em;
  }

  .tier-buttons { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  .tier-btn {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem;
    border: 1px solid var(--color-slate-200); border-radius: 999px; background: white;
    font-size: 0.8125rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }

  .tier-btn:hover { border-color: var(--color-violet-600); color: var(--color-violet-600); background: var(--color-purple-50); }

  .tier-btn.active { background: var(--color-violet-600); border-color: var(--color-violet-600); color: white; }

  .tier-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, 0.7); flex-shrink: 0; }
  .tier-btn:not(.active) .tier-dot { background: var(--color-violet-600); }

  .tier-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .tier-label { font-size: 0.75rem; font-weight: 600; color: var(--color-violet-600); }

  .tier-textarea {
    width: 100%; box-sizing: border-box; padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-violet-200); border-radius: 6px; font-size: 0.875rem; font-family: inherit;
    color: var(--color-slate-700); background: var(--color-purple-50); resize: none; overflow: hidden; line-height: 1.5;
    min-height: 100px; transition: border-color 0.15s, background 0.15s, min-height 0.15s;
  }

  /* Empty and not focused — shrunk to a single-line "click to add" affordance
     rather than a full-height empty box for every tier by default. */
  .tier-textarea-compact { min-height: 2.25rem; }

  .tier-textarea:focus { outline: none; border-color: var(--color-violet-600); background: white; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.07); }
  .tier-textarea::placeholder { color: var(--color-slate-400); }

  .policy-refs { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }

  .policy-ref {
    background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-left: 3px solid var(--color-slate-300); border-radius: 4px;
    padding: 0.5rem 0.75rem; opacity: 0.7; transition: opacity 0.15s, border-color 0.15s;
  }

  .policy-ref.linked { border-left-color: var(--color-violet-600); opacity: 1; background: var(--color-purple-50); }

  .policy-ref-header { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

  .policy-link-btn {
    margin-left: auto; display: flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem;
    border: 1px solid var(--color-slate-200); border-radius: 999px; background: white;
    font-size: 0.72rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }

  .policy-link-btn:hover:not(:disabled) { border-color: var(--color-violet-600); color: var(--color-violet-600); background: var(--color-purple-50); }
  .policy-link-btn.linked { border-color: var(--color-violet-600); background: var(--color-violet-600); color: white; }
  .policy-link-btn:disabled { opacity: 0.6; cursor: default; }

  .policy-ref-code {
    font-size: 0.75rem; font-weight: 700; color: var(--color-violet-600); background: var(--color-violet-50); padding: 0.1rem 0.4rem; border-radius: 3px;
  }

  .policy-ref-key {
    font-size: 0.7rem; font-weight: 600; color: var(--color-orange-700); background: var(--color-amber-100); padding: 0.1rem 0.35rem; border-radius: 3px;
  }

  .policy-ref-type {
    font-size: 0.7rem; font-weight: 500; color: var(--color-slate-500); background: var(--color-slate-100);
    padding: 0.1rem 0.35rem; border-radius: 3px; text-transform: capitalize;
  }

  .policy-ref-plan-tag {
    font-size: 0.7rem; font-weight: 600; color: var(--color-teal-600); background: var(--color-teal-100);
    padding: 0.1rem 0.35rem; border-radius: 3px;
  }

  .all-linked-empty { margin: 0; font-size: 0.8rem; color: var(--color-slate-400); font-style: italic; }

  .policy-ref-name-btn {
    background: none; border: none; padding: 0; font-size: 0.8rem; font-weight: 600; color: var(--color-slate-800);
    cursor: pointer; font-family: inherit; text-align: left; text-decoration: underline;
    text-decoration-color: var(--color-slate-300); text-underline-offset: 2px;
  }

  .policy-ref-name-btn:hover { color: var(--color-violet-600); text-decoration-color: var(--color-violet-600); }

  .policy-modal-backdrop {
    position: fixed; inset: 0; background: var(--overlay-bg); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }

  .policy-modal {
    background: white; border-radius: 10px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    max-width: 580px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 1.5rem;
    display: flex; flex-direction: column; gap: 1rem;
  }

  .policy-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }

  .policy-modal-title {
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.95rem; font-weight: 600; color: var(--color-slate-800);
  }

  .policy-modal-type {
    font-size: 0.7rem; font-weight: 500; color: var(--color-slate-500); background: var(--color-slate-100); border: 1px solid var(--color-slate-200);
    padding: 0.1rem 0.4rem; border-radius: 3px; text-transform: capitalize;
  }

  .policy-modal-close { background: none; border: none; cursor: pointer; color: var(--color-slate-400); font-size: 1.1rem; padding: 0.1rem 0.25rem; flex-shrink: 0; }
  .policy-modal-close:hover { color: var(--color-slate-600); }

  .policy-modal-section { display: flex; flex-direction: column; gap: 0.35rem; }

  .policy-modal-label {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-slate-400); margin: 0;
  }

  .policy-modal-body { font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.65; white-space: pre-wrap; margin: 0; }
  .policy-modal-support { color: var(--color-slate-500); font-style: italic; }
  .policy-modal-empty { font-size: 0.875rem; color: var(--color-slate-400); font-style: italic; margin: 0; }

  .mini-spinner {
    display: inline-block; width: 0.75rem; height: 0.75rem; border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400); border-radius: 50%; animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
