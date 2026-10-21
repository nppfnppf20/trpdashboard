<script>
  // One policy in the Relevant Policy list. The select box only shows on hover
  // (or once anything is selected) so it stays out of the way until needed.
  import { createEventDispatcher } from 'svelte';

  export let policy;
  export let selected = false;
  export let selecting = false; // true once any policy is selected
  export let showType = false; // type badge is redundant inside a plan, so it's opt-in

  const dispatch = createEventDispatcher();

  const TYPE_LABELS = { national: 'National', local: 'Local', neighbourhood: 'Neighbourhood', supplementary: 'Supplementary', other: 'Other' };
  const TYPE_BADGES = { national: 'badge-info', local: 'badge-success', neighbourhood: 'badge-warning', supplementary: 'badge-purple', other: 'badge-neutral' };
</script>

<div class="card policy-card" class:key={policy.is_key_policy} class:selected class:selecting>
  <div class="policy-card-header">
    <div class="policy-meta">
      <input type="checkbox" class="policy-select-checkbox" checked={selected} on:change={() => dispatch('select')} aria-label="Select policy" />
      <label class="key-toggle" class:active={policy.is_key_policy} title="Key Policy: flag this as a primary determining policy for the project">
        <input type="checkbox" checked={policy.is_key_policy} on:change={() => dispatch('togglekey')} />
        <i class="las la-star"></i> Key
      </label>
      {#if showType}
        <span class="badge badge-sm {TYPE_BADGES[policy.policy_type] ?? 'badge-neutral'}">{TYPE_LABELS[policy.policy_type]}</span>
      {/if}
      {#if policy.policy_reference}
        <span class="ref-chip">{policy.policy_reference}</span>
      {/if}
    </div>
    <div class="policy-actions">
      <button class="btn btn-ghost btn-icon" on:click={() => dispatch('edit')} title="Edit"><i class="las la-pen"></i></button>
      <button class="btn btn-danger-ghost btn-icon" on:click={() => dispatch('delete')} title="Delete"><i class="las la-trash"></i></button>
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

<style>
  .policy-card { display: flex; flex-direction: column; gap: var(--space-2); }
  .policy-card.key { border-color: var(--color-primary-200); background: var(--color-primary-50); }
  .policy-card.selected { border-color: var(--color-primary-600); background: var(--color-primary-50); }

  .policy-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); }
  .policy-meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
  .policy-actions { display: flex; gap: var(--space-1); flex-shrink: 0; }

  .policy-select-checkbox {
    width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer; flex-shrink: 0;
    opacity: 0; transition: opacity 0.12s;
  }
  .policy-card:hover .policy-select-checkbox,
  .policy-card:focus-within .policy-select-checkbox,
  .policy-card.selecting .policy-select-checkbox { opacity: 1; }

  /* Key flag: a toggle chip, so the real checkbox is visually hidden */
  .key-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.0625rem 0.5rem;
    border-radius: var(--radius-pill);
    background: var(--color-slate-100);
    color: var(--color-slate-400);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s, color 0.15s;
  }
  .key-toggle:hover, .key-toggle.active { background: var(--color-primary-100); color: var(--color-primary-700); }
  .key-toggle input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

  .ref-chip {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    font-family: monospace;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .policy-name { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-slate-800); line-height: 1.4; }

  .policy-detail { font-size: var(--font-size-xs); }
  .policy-detail summary { cursor: pointer; color: var(--color-primary-600); font-weight: 500; user-select: none; }
  .detail-body {
    margin: var(--space-2) 0 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-slate-50);
    border-left: 3px solid var(--color-slate-200);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    color: var(--color-slate-700);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .policy-notes { display: flex; gap: var(--space-2); align-items: flex-start; font-size: var(--font-size-xs); color: var(--color-slate-500); }
  .policy-notes i { color: var(--color-primary-600); margin-top: 1px; flex-shrink: 0; }
</style>
