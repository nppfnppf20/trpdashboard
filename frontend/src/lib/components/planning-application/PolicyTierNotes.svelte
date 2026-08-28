<script>
  import { createEventDispatcher } from 'svelte';
  import { issueNotes, noteStatus, handleNoteInput } from '$lib/stores/planning-notes.js';
  import { togglePolicyTrack } from '$lib/api/planningApplication.js';

  export let issue;
  export let projectId;
  export let policies = [];
  export let relevantPolicyIds = [];

  const dispatch = createEventDispatcher();

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
      const result = await togglePolicyTrack(policy.id, issue.id);
      dispatch('relevancechange', { policyId: policy.id, linked: result.linked });
    } catch (e) {
      console.error('Failed to toggle policy:', e);
    } finally {
      toggling = { ...toggling, [policy.id]: false };
    }
  }

  function toggle(tierKey) {
    open = { ...open, [tierKey]: !open[tierKey] };
  }

  function autoresize(node, _value) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      update() { resize(); },
      destroy() { node.removeEventListener('input', resize); }
    };
  }
</script>

<div class="policy-notes">
  <div class="tier-header">
    <span class="tier-header-label">Policy</span>
    {#if $noteStatus[issue.id] === 'saving'}
      <span class="note-status saving"><span class="mini-spinner"></span> Saving</span>
    {:else if $noteStatus[issue.id] === 'saved'}
      <span class="note-status saved"><i class="las la-check"></i> Saved</span>
    {/if}
  </div>

  <div class="tier-buttons">
    {#each POLICY_TIERS as tier}
      {@const hasContent = !!$issueNotes[issue.id]?.[tier.key]?.trim()}
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
    {#if open[tier.key] || $issueNotes[issue.id]?.[tier.key]?.trim()}
      <div class="tier-field">
        <label class="tier-label">{tier.label}</label>

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
          value={$issueNotes[issue.id]?.[tier.key] ?? ''}
          use:autoresize={$issueNotes[issue.id]?.[tier.key]}
          on:input={(e) => handleNoteInput(issue.id, tier.key, e.target.value)}
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

<style>
  .policy-notes {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .tier-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .tier-header-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .note-status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .note-status.saving { color: var(--color-slate-400); }
  .note-status.saved  { color: var(--color-emerald-600); }

  .tier-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tier-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 999px;
    background: white;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .tier-btn:hover { border-color: var(--color-teal-600); color: var(--color-teal-600); background: var(--color-primary-50); }

  .tier-btn.active {
    background: var(--color-teal-600);
    border-color: var(--color-teal-600);
    color: white;
  }

  .tier-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }

  .tier-btn:not(.active) .tier-dot {
    background: var(--color-teal-600);
  }

  .tier-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .tier-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-teal-600);
  }

  .tier-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-sky-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: var(--color-primary-50);
    resize: none;
    overflow: hidden;
    line-height: 1.5;
    min-height: 100px;
    transition: border-color 0.15s, background 0.15s;
  }

  .tier-textarea:focus {
    outline: none;
    border-color: var(--color-teal-600);
    background: white;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.07);
  }

  .tier-textarea::placeholder { color: var(--color-slate-400); }

  .policy-refs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .policy-ref {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-left: 3px solid var(--color-slate-300);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    opacity: 0.7;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .policy-ref.linked {
    border-left-color: var(--color-teal-600);
    opacity: 1;
    background: var(--color-primary-50);
  }

  .policy-ref-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .policy-link-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 999px;
    background: white;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .policy-link-btn:hover:not(:disabled) {
    border-color: var(--color-teal-600);
    color: var(--color-teal-600);
    background: var(--color-primary-50);
  }

  .policy-link-btn.linked {
    border-color: var(--color-teal-600);
    background: var(--color-teal-600);
    color: white;
  }

  .policy-link-btn:disabled { opacity: 0.6; cursor: default; }

  .policy-ref-code {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-teal-600);
    background: var(--color-sky-100);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .policy-ref-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .policy-ref-key {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-orange-700);
    background: var(--color-amber-100);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }

  .policy-ref-name-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: var(--color-slate-300);
    text-underline-offset: 2px;
  }

  .policy-ref-name-btn:hover { color: var(--color-teal-600); text-decoration-color: var(--color-teal-600); }

  .policy-modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .policy-modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    max-width: 580px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .policy-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .policy-modal-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .policy-modal-type {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-200);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    text-transform: capitalize;
  }

  .policy-modal-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-slate-400);
    font-size: 1.1rem;
    padding: 0.1rem 0.25rem;
    flex-shrink: 0;
  }

  .policy-modal-close:hover { color: var(--color-slate-600); }

  .policy-modal-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .policy-modal-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-slate-400);
    margin: 0;
  }

  .policy-modal-body {
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.65;
    white-space: pre-wrap;
    margin: 0;
  }

  .policy-modal-support { color: var(--color-slate-500); font-style: italic; }

  .policy-modal-empty {
    font-size: 0.875rem;
    color: var(--color-slate-400);
    font-style: italic;
    margin: 0;
  }

  .mini-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
