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
  export let relevantSnippetIds = [];
  export let snippetToggleFn; // async (issueTypeId, issueId) => { linked }

  const POLICY_TIERS = [
    { key: 'policy_national',      label: 'National Policy',      dbType: 'national',      placeholder: 'Key NPPF provisions and national guidance relevant to this issue...' },
    { key: 'policy_local',         label: 'Local Policy',         dbType: 'local',         placeholder: 'Local plan policies and their requirements...' },
    { key: 'policy_neighbourhood', label: 'Neighbourhood Policy', dbType: 'neighbourhood', placeholder: 'Neighbourhood plan policies (if applicable)...' },
    { key: 'policy_supplementary', label: 'Supplementary',        dbType: 'supplementary', placeholder: 'SPDs, design guides or other supplementary guidance...' },
    { key: 'policy_other',         label: 'Other',                dbType: 'other',         placeholder: 'Any other relevant planning policy or guidance...' },
  ];

  let open = {};
  let toggling = {};
  let previewPolicy = null;
  let previewSnippet = null;
  let snippetToggling = {};

  $: policiesByType = policies.reduce((acc, p) => {
    const t = (p.policy_type ?? '').toLowerCase();
    if (!acc[t]) acc[t] = [];
    acc[t].push(p);
    return acc;
  }, {});

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

  async function handleSnippetToggle(snippet) {
    if (snippetToggling[snippet.id]) return;
    snippetToggling = { ...snippetToggling, [snippet.id]: true };
    try {
      await snippetToggleFn(snippet.id, issue.id);
    } catch (e) {
      console.error('Failed to toggle snippet:', e);
    } finally {
      snippetToggling = { ...snippetToggling, [snippet.id]: false };
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
      {@const hasContent = !!issue[tier.key]?.trim() || (tier.key === 'policy_national' && relevantSnippetIds.length > 0)}
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
    {#if open[tier.key] || issue[tier.key]?.trim() || (tier.key === 'policy_national' && relevantSnippetIds.length > 0)}
      <div class="tier-field">
        <label class="tier-label">{tier.label}</label>

        {#if tier.key === 'policy_national' && allSnippets.length}
          <div class="policy-refs">
            {#each allSnippets as snippet}
              {@const linked = relevantSnippetIds.includes(snippet.id)}
              <div class="policy-ref snippet-ref" class:linked>
                <div class="policy-ref-header">
                  <button class="policy-ref-name-btn" on:click={() => previewSnippet = snippet}>
                    {snippet.label}
                  </button>
                  <span class="snippet-dev-type">{snippet.development_type || 'generic'}</span>
                  <button
                    class="policy-link-btn"
                    class:linked
                    disabled={snippetToggling[snippet.id]}
                    on:click={() => handleSnippetToggle(snippet)}
                    title={linked ? 'Remove from this issue' : 'Mark as relevant to this issue'}
                  >
                    {#if snippetToggling[snippet.id]}
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
          placeholder={tier.placeholder}
          value={issue[tier.key] ?? ''}
          use:autoresize
          on:blur={(e) => onNoteChange(tier.key, e.target.value)}
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
    font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;
  }

  .tier-buttons { display: flex; flex-wrap: wrap; gap: 0.375rem; }

  .tier-btn {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem;
    border: 1px solid #e2e8f0; border-radius: 999px; background: white;
    font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }

  .tier-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

  .tier-btn.active { background: #7c3aed; border-color: #7c3aed; color: white; }

  .tier-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.7); flex-shrink: 0; }
  .tier-btn:not(.active) .tier-dot { background: #7c3aed; }

  .tier-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .tier-label { font-size: 0.75rem; font-weight: 600; color: #7c3aed; }

  .tier-textarea {
    width: 100%; box-sizing: border-box; padding: 0.625rem 0.75rem;
    border: 1px solid #ddd6fe; border-radius: 6px; font-size: 0.875rem; font-family: inherit;
    color: #374151; background: #faf5ff; resize: none; overflow: hidden; line-height: 1.5;
    min-height: 100px; transition: border-color 0.15s, background 0.15s;
  }

  .tier-textarea:focus { outline: none; border-color: #7c3aed; background: white; box-shadow: 0 0 0 3px rgba(124,58,237,0.07); }
  .tier-textarea::placeholder { color: #94a3b8; }

  .policy-refs { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }

  .policy-ref {
    background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #cbd5e1; border-radius: 4px;
    padding: 0.5rem 0.75rem; opacity: 0.7; transition: opacity 0.15s, border-color 0.15s;
  }

  .policy-ref.linked { border-left-color: #7c3aed; opacity: 1; background: #faf5ff; }

  .policy-ref-header { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

  .policy-link-btn {
    margin-left: auto; display: flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem;
    border: 1px solid #e2e8f0; border-radius: 999px; background: white;
    font-size: 0.72rem; font-weight: 500; color: #64748b; cursor: pointer; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }

  .policy-link-btn:hover:not(:disabled) { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }
  .policy-link-btn.linked { border-color: #7c3aed; background: #7c3aed; color: white; }
  .policy-link-btn:disabled { opacity: 0.6; cursor: default; }

  .policy-ref-code {
    font-size: 0.75rem; font-weight: 700; color: #7c3aed; background: #f5f3ff; padding: 0.1rem 0.4rem; border-radius: 3px;
  }

  .policy-ref-key {
    font-size: 0.7rem; font-weight: 600; color: #b45309; background: #fef3c7; padding: 0.1rem 0.35rem; border-radius: 3px;
  }

  .snippet-dev-type {
    font-size: 0.7rem; font-weight: 500; color: #64748b; background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 3px;
  }

  .snippet-ref.linked { border-left-color: #16a34a; }
  .snippet-ref .policy-link-btn.linked { border-color: #16a34a; background: #16a34a; }

  .policy-ref-name-btn {
    background: none; border: none; padding: 0; font-size: 0.8rem; font-weight: 600; color: #1e293b;
    cursor: pointer; font-family: inherit; text-align: left; text-decoration: underline;
    text-decoration-color: #cbd5e1; text-underline-offset: 2px;
  }

  .policy-ref-name-btn:hover { color: #7c3aed; text-decoration-color: #7c3aed; }

  .policy-modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }

  .policy-modal {
    background: white; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    max-width: 580px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 1.5rem;
    display: flex; flex-direction: column; gap: 1rem;
  }

  .policy-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }

  .policy-modal-title {
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.95rem; font-weight: 600; color: #1e293b;
  }

  .policy-modal-type {
    font-size: 0.7rem; font-weight: 500; color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0;
    padding: 0.1rem 0.4rem; border-radius: 3px; text-transform: capitalize;
  }

  .policy-modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1.1rem; padding: 0.1rem 0.25rem; flex-shrink: 0; }
  .policy-modal-close:hover { color: #475569; }

  .policy-modal-section { display: flex; flex-direction: column; gap: 0.35rem; }

  .policy-modal-label {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0;
  }

  .policy-modal-body { font-size: 0.875rem; color: #374151; line-height: 1.65; white-space: pre-wrap; margin: 0; }
  .policy-modal-support { color: #64748b; font-style: italic; }
  .policy-modal-empty { font-size: 0.875rem; color: #94a3b8; font-style: italic; margin: 0; }

  .mini-spinner {
    display: inline-block; width: 0.75rem; height: 0.75rem; border: 1.5px solid #cbd5e1;
    border-top-color: #94a3b8; border-radius: 50%; animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
