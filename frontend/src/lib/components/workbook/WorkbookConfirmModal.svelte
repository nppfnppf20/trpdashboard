<script>
  // Warning shown before deleting something that other rows depend on, or that takes data with it.
  export let title = 'Delete this?';
  export let lines = [];
  export let confirmLabel = 'Delete';
  export let onConfirm = async () => {};
  export let onCancel = () => {};

  let working = false;

  async function confirm() {
    working = true;
    try {
      await onConfirm();
    } finally {
      working = false;
    }
  }
  function onKey(e) { if (e.key === 'Escape' && !working) onCancel(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wc-backdrop" on:click|self={() => !working && onCancel()} role="presentation">
  <div class="wc-modal" role="alertdialog" aria-modal="true" aria-label={title}>
    <div class="wc-head">
      <i class="las la-exclamation-triangle wc-icon"></i>
      <h2>{title}</h2>
    </div>
    <div class="wc-body">
      {#each lines as line (line)}<p>{line}</p>{/each}
    </div>
    <div class="wc-foot">
      <button class="btn btn-secondary btn-sm" on:click={onCancel} disabled={working}>Cancel</button>
      <button class="btn btn-danger btn-sm" on:click={confirm} disabled={working}>{working ? 'Deleting…' : confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .wc-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2200; padding: 1rem; }
  .wc-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(30rem, 100%); box-shadow: var(--shadow-modal); overflow: hidden; }
  .wc-head { display: flex; align-items: center; gap: 0.625rem; padding: 1rem 1.25rem 0.5rem; }
  .wc-head h2 { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wc-icon { font-size: 1.4rem; color: var(--color-amber-600); }
  .wc-body { padding: 0.25rem 1.25rem 0.75rem; }
  .wc-body p { margin: 0 0 0.5rem; font-size: 0.875rem; line-height: 1.5; color: var(--color-slate-600); }
  .wc-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--color-slate-200); }
</style>
