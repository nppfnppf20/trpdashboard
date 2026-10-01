<script>
  export let suggestion; // { reason }
  export let onStart;    // () => void — opens the Draft Fee Quote Request flow
  export let compact = false;
</script>

<div class="fqc" class:fqc-compact={compact}>
  <div class="fqc-icon"><i class="las la-magic"></i></div>
  <div class="fqc-body">
    <div class="fqc-label">Draft <strong>fee quote requests</strong> from your meeting notes and docs?</div>
    {#if suggestion.reason}<div class="fqc-reason">{suggestion.reason}</div>{/if}
    <div class="fqc-actions">
      <button class="fqc-btn" on:click={() => onStart?.()}>Draft Fee Quote Request</button>
    </div>
  </div>
</div>

<style>
  .fqc {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.5rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-white);
    border: 1px solid var(--color-violet-300);
    border-radius: 8px;
  }
  .fqc-icon { flex-shrink: 0; color: var(--color-violet-600); font-size: 1.1rem; line-height: 1.4; }
  .fqc-body { flex: 1; min-width: 0; }
  .fqc-label { font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.4; }
  .fqc-reason { margin-top: 0.15rem; font-size: 0.76rem; color: var(--color-slate-500); }
  .fqc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
  .fqc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--color-violet-600);
    background: var(--color-violet-600);
    color: var(--color-white);
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .fqc-btn:hover { background: var(--color-violet-700); border-color: var(--color-violet-700); }

  .fqc-compact { padding: 0.5rem 0.6rem; }
  .fqc-compact .fqc-label { font-size: 0.75rem; }
  .fqc-compact .fqc-reason { font-size: 0.68rem; }
  .fqc-compact .fqc-btn { font-size: 0.7rem; padding: 0.25rem 0.55rem; }
</style>
