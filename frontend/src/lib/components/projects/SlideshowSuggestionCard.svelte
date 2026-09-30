<script>
  export let suggestion; // { guidance }
  export let onStart;    // () => void — opens the Create Slideshow modal
  export let compact = false;
</script>

<div class="ssc" class:ssc-compact={compact}>
  <div class="ssc-icon"><i class="las la-file-powerpoint"></i></div>
  <div class="ssc-body">
    <div class="ssc-label">Create a <strong>PowerPoint slideshow</strong> from your notes?</div>
    {#if suggestion.guidance}<div class="ssc-reason">{suggestion.guidance}</div>{/if}
    <div class="ssc-actions">
      <button class="ssc-btn" on:click={() => onStart?.()}>Create slideshow</button>
    </div>
  </div>
</div>

<style>
  .ssc {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.5rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-white);
    border: 1px solid var(--color-primary-200);
    border-radius: 8px;
  }
  .ssc-icon { flex-shrink: 0; color: var(--color-primary-600); font-size: 1.1rem; line-height: 1.4; }
  .ssc-body { flex: 1; min-width: 0; }
  .ssc-label { font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.4; }
  .ssc-reason { margin-top: 0.15rem; font-size: 0.76rem; color: var(--color-slate-500); }
  .ssc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
  .ssc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--color-primary-600);
    background: var(--color-primary-600);
    color: var(--color-white);
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .ssc-btn:hover { background: var(--color-primary-700); border-color: var(--color-primary-700); }

  .ssc-compact { padding: 0.5rem 0.6rem; }
  .ssc-compact .ssc-label { font-size: 0.75rem; }
  .ssc-compact .ssc-reason { font-size: 0.68rem; }
  .ssc-compact .ssc-btn { font-size: 0.7rem; padding: 0.25rem 0.55rem; }
</style>
