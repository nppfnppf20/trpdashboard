<script>
  // Parallel to PolicyTierNotes.svelte, deliberately not sharing code with it —
  // that component is wired to the planning-notes.js store (planning_applications
  // .issue_notes / policy_track_relevance), this one is prop-driven so it can sit
  // on top of admin_console.drafting_issues instead, fully independently.

  export let issue;
  export let policies = [];
  export let relevantPolicyIds = [];
  export let toggleFn; // async (policyId, issueId) => { linked }
  export let onNoteChange; // (tierKey, value) => void
  export let allSnippets = []; // full admin_console.issue_types library
  export let relevantSnippetFields = []; // [{issue_type_id, field}]
  export let snippetToggleFn; // async (issueTypeId, field) => { linked }

  const SNIPPET_FIELDS = [
    { key: 'nppf_text', label: 'NPPF' },
    { key: 'nppg_text', label: 'NPPG' },
    { key: 'other_national_text', label: 'Other National' },
    { key: 'other_guidance_text', label: 'Other Guidance' },
  ];

  const POLICY_TIERS = [
    { key: 'policy_national',      label: 'National Policy',      dbType: 'national',      placeholder: 'Add further national policy notes...' },
    { key: 'policy_local',         label: 'Local Policy',         dbType: 'local',         placeholder: 'Add further local policy notes...' },
    { key: 'policy_neighbourhood', label: 'Neighbourhood Policy', dbType: 'neighbourhood', placeholder: 'Add further neighbourhood policy notes...' },
    { key: 'policy_supplementary', label: 'Supplementary',        dbType: 'supplementary', placeholder: 'Add further supplementary guidance notes...' },
    { key: 'policy_other',         label: 'Other',                dbType: 'other',         placeholder: 'Add further policy notes...' },
  ];

  let open = {};
  let toggling = {};
  let previewPolicy = null;
  let previewSnippet = null;
  let snippetToggling = {};
  let editingSnippets = false;
  let textareaExpanded = {};

  function expandTextarea(tierKey) {
    textareaExpanded = { ...textareaExpanded, [tierKey]: true };
  }

  function collapseTextareaIfEmpty(tierKey, value) {
    if (!value?.trim()) {
      textareaExpanded = { ...textareaExpanded, [tierKey]: false };
    }
  }

  $: policiesByType = policies.reduce((acc, p) => {
    const t = (p.policy_type ?? '').toLowerCase();
    if (!acc[t]) acc[t] = [];
    acc[t].push(p);
    return acc;
  }, {});

  $: linkedFieldKeySet = new Set(relevantSnippetFields.map(f => `${f.issue_type_id}:${f.field}`));
  $: linkedSnippetsList = allSnippets
    .map(snippet => ({ snippet, fields: SNIPPET_FIELDS.filter(f => linkedFieldKeySet.has(`${snippet.id}:${f.key}`)) }))
    .filter(x => x.fields.length > 0);

  async function handleToggle(policy) {
    if (toggling[policy.id]) return;
    toggling = { ...toggling, [policy.id]: true };
    try {
      await toggleFn(policy.id, issue.id);
    } catch (e) {
      console.error('Failed to toggle policy:', e);
    } finally {
      toggling = { ...toggling, [policy.id]: false };
    }
  }

  async function handleSnippetToggle(snippet, fieldKey) {
    const toggleKey = `${snippet.id}:${fieldKey}`;
    if (snippetToggling[toggleKey]) return;
    snippetToggling = { ...snippetToggling, [toggleKey]: true };
    try {
      await snippetToggleFn(snippet.id, fieldKey);
    } catch (e) {
      console.error('Failed to toggle snippet field:', e);
    } finally {
      snippetToggling = { ...snippetToggling, [toggleKey]: false };
    }
  }

  function toggle(tierKey) {
    open = { ...open, [tierKey]: !open[tierKey] };
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
    {#each POLICY_TIERS as tier}
      {@const hasContent = !!issue[tier.key]?.trim() || (tier.key === 'policy_national' && relevantSnippetFields.length > 0)}
      <button
        class="tier-btn"
        class:active={open[tier.key] || hasContent}
        on:click={() => toggle(tier.key)}
      >
        {tier.label}
        {#if hasContent}<span class="tier-dot"></span>{/if}
      </button>
    {/each}
  </div>

  {#each POLICY_TIERS as tier}
    {#if open[tier.key] || issue[tier.key]?.trim() || (tier.key === 'policy_national' && relevantSnippetFields.length > 0)}
      <div class="tier-field">
        <label class="tier-label">{tier.label}</label>

        {#if tier.key === 'policy_national' && allSnippets.length}
          <div class="snippet-section">
            {#if !editingSnippets}
              {#if linkedSnippetsList.length}
                <div class="policy-refs">
                  {#each linkedSnippetsList as { snippet, fields }}
                    <div class="policy-ref snippet-ref linked">
                      <div class="policy-ref-header">
                        <button class="policy-ref-name-btn" on:click={() => previewSnippet = snippet}>
                          {snippet.label}
                        </button>
                        <span class="snippet-dev-type">{snippet.development_type || 'generic'}</span>
                      </div>
                      <div class="snippet-field-pills">
                        {#each fields as f}
                          <span class="snippet-field-pill">{f.label}</span>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="snippet-empty">No snippet templates linked yet.</p>
              {/if}
              <button class="snippet-edit-btn" on:click={() => editingSnippets = true}>
                <i class="las la-pen"></i> Edit linked templates
              </button>
            {:else}
              <div class="policy-refs">
                {#each allSnippets as snippet}
                  {@const availableFields = SNIPPET_FIELDS.filter(f => snippet[f.key]?.trim())}
                  {#if availableFields.length}
                    <div class="policy-ref snippet-ref">
                      <div class="policy-ref-header">
                        <button class="policy-ref-name-btn" on:click={() => previewSnippet = snippet}>
                          {snippet.label}
                        </button>
                        <span class="snippet-dev-type">{snippet.development_type || 'generic'}</span>
                      </div>
                      <div class="snippet-field-toggles">
                        {#each availableFields as f}
                          {@const toggleKey = `${snippet.id}:${f.key}`}
                          {@const linked = linkedFieldKeySet.has(toggleKey)}
                          <button
                            class="policy-link-btn snippet-field-btn"
                            class:linked
                            disabled={snippetToggling[toggleKey]}
                            on:click={() => handleSnippetToggle(snippet, f.key)}
                            title={linked ? `Remove ${f.label} from this issue` : `Mark ${f.label} as relevant to this issue`}
                          >
                            {#if snippetToggling[toggleKey]}
                              <span class="mini-spinner"></span>
                            {:else if linked}
                              <i class="las la-check"></i> {f.label}
                            {:else}
                              <i class="las la-plus"></i> {f.label}
                            {/if}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
              <button class="snippet-edit-btn" on:click={() => editingSnippets = false}>
                <i class="las la-check"></i> Done
              </button>
            {/if}
          </div>
        {/if}

        {#if policiesByType[tier.dbType]?.length}
          <div class="policy-refs">
            {#each policiesByType[tier.dbType] as policy}
              {@const linked = relevantPolicyIds.includes(policy.id)}
              <div class="policy-ref" class:linked>
                <div class="policy-ref-header">
                  {#if policy.policy_reference}<span class="policy-ref-code">{policy.policy_reference}</span>{/if}
                  <button class="policy-ref-name-btn" on:click={() => previewPolicy = policy}>
                    {policy.policy_name}
                  </button>
                  {#if policy.is_key_policy}<span class="policy-ref-key">Key</span>{/if}
                  <button
                    class="policy-link-btn"
                    class:linked
                    disabled={toggling[policy.id]}
                    on:click={() => handleToggle(policy)}
                    title={linked ? 'Remove from this issue' : 'Mark as relevant to this issue'}
                  >
                    {#if toggling[policy.id]}
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
          <p class="policy-modal-label">Supporting Text</p>
          <p class="policy-modal-body policy-modal-support">{previewPolicy.relevant_supporting_text}</p>
        </div>
      {/if}
      {#if previewPolicy.notes}
        <div class="policy-modal-section">
          <p class="policy-modal-label">Notes</p>
          <p class="policy-modal-body policy-modal-support">{previewPolicy.notes}</p>
        </div>
      {/if}
      {#if !previewPolicy.policy_text && !previewPolicy.relevant_supporting_text && !previewPolicy.notes}
        <p class="policy-modal-empty">No text recorded for this policy.</p>
      {/if}
    </div>
  </div>
{/if}

{#if previewSnippet}
  <div class="policy-modal-backdrop" on:click={() => previewSnippet = null}>
    <div class="policy-modal" on:click|stopPropagation>
      <div class="policy-modal-header">
        <div class="policy-modal-title">
          <span>{previewSnippet.label}</span>
          <span class="policy-modal-type">{previewSnippet.development_type || 'generic'}</span>
        </div>
        <button class="policy-modal-close" on:click={() => previewSnippet = null}>
          <i class="las la-times"></i>
        </button>
      </div>
      {#if previewSnippet.nppf_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">NPPF</p>
          <p class="policy-modal-body">{@html previewSnippet.nppf_text}</p>
        </div>
      {/if}
      {#if previewSnippet.nppg_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">NPPG</p>
          <p class="policy-modal-body">{@html previewSnippet.nppg_text}</p>
        </div>
      {/if}
      {#if previewSnippet.other_national_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">Other National Policy</p>
          <p class="policy-modal-body">{@html previewSnippet.other_national_text}</p>
        </div>
      {/if}
      {#if previewSnippet.other_guidance_text}
        <div class="policy-modal-section">
          <p class="policy-modal-label">Other Guidance</p>
          <p class="policy-modal-body">{@html previewSnippet.other_guidance_text}</p>
        </div>
      {/if}
      {#if !previewSnippet.nppf_text && !previewSnippet.nppg_text && !previewSnippet.other_national_text && !previewSnippet.other_guidance_text}
        <p class="policy-modal-empty">No text recorded for this template.</p>
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

  .snippet-dev-type {
    font-size: 0.7rem; font-weight: 500; color: var(--color-slate-500); background: var(--color-slate-100); padding: 0.1rem 0.35rem; border-radius: 3px;
  }

  .snippet-ref.linked { border-left-color: var(--color-emerald-600); }
  .snippet-ref .policy-link-btn.linked { border-color: var(--color-emerald-600); background: var(--color-emerald-600); }

  .snippet-field-pills { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }

  .snippet-field-pill {
    font-size: 0.7rem; font-weight: 600; color: var(--color-green-800); background: var(--color-slate-100); border: 1px solid var(--color-emerald-100);
    padding: 0.1rem 0.4rem; border-radius: 999px;
  }

  .snippet-field-toggles { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }

  .snippet-field-btn { margin-left: 0; }
  .snippet-field-btn.linked { border-color: var(--color-emerald-600); background: var(--color-emerald-600); }

  .snippet-section { margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }

  .snippet-empty { margin: 0; font-size: 0.8rem; color: var(--color-slate-400); font-style: italic; }

  .snippet-edit-btn {
    align-self: flex-start; display: flex; align-items: center; gap: 0.3rem;
    background: none; border: none; padding: 0.15rem 0; font-size: 0.75rem; font-weight: 500;
    color: var(--color-violet-600); cursor: pointer; font-family: inherit;
  }
  .snippet-edit-btn:hover { text-decoration: underline; }

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
