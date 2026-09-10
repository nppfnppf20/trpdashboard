<script>
  // Same "suggest, accept or decline" pattern as KeyDateSuggestionCard.svelte,
  // just for setting a field to a suggested value (e.g. a quote's work
  // status) rather than adding a key date.
  export let suggestion; // { field_label, value }
  export let onAccept;   // async () => boolean
  export let onDismiss = () => {};

  let status = 'pending'; // 'pending' | 'saving' | 'accepted' | 'error'

  async function accept() {
    status = 'saving';
    const ok = await onAccept?.();
    status = ok ? 'accepted' : 'error';
  }
</script>

{#if status !== 'dismissed'}
  <div class="fsc">
    <div class="fsc-icon"><i class="las la-exchange-alt"></i></div>
    <div class="fsc-body">
      <div class="fsc-label">Set <strong>{suggestion.field_label}</strong> to <strong>"{suggestion.value}"</strong>?</div>
      {#if status === 'pending'}
        <div class="fsc-actions">
          <button class="fsc-btn fsc-btn-accept" on:click={accept}>Set</button>
          <button class="fsc-btn fsc-btn-dismiss" on:click={() => { status = 'dismissed'; onDismiss?.(); }}>Not now</button>
        </div>
      {:else if status === 'saving'}
        <div class="fsc-status"><span class="fsc-spinner"></span> Saving…</div>
      {:else if status === 'accepted'}
        <div class="fsc-status fsc-status-ok"><i class="las la-check-circle"></i> Updated</div>
      {:else if status === 'error'}
        <div class="fsc-actions">
          <span class="fsc-status fsc-status-error">Failed to save.</span>
          <button class="fsc-btn fsc-btn-accept" on:click={accept}>Retry</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .fsc {
    display: flex;
    gap: 0.6rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-amber-100);
    border: 1px solid var(--color-amber-200);
    border-radius: 8px;
  }
  .fsc-icon {
    flex-shrink: 0;
    color: var(--color-amber-800);
    font-size: 1.1rem;
    line-height: 1.4;
  }
  .fsc-body { flex: 1; min-width: 0; }
  .fsc-label { font-size: 0.85rem; color: var(--color-amber-800); line-height: 1.4; }

  .fsc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .fsc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .fsc-btn-accept {
    background: var(--color-primary-600);
    color: var(--color-white);
  }
  .fsc-btn-accept:hover { background: var(--color-primary-700); }
  .fsc-btn-dismiss {
    background: none;
    border-color: var(--color-amber-200);
    color: var(--color-amber-800);
  }
  .fsc-btn-dismiss:hover { background: var(--color-amber-200); }

  .fsc-status { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--color-amber-800); }
  .fsc-status-ok { color: var(--color-emerald-600); font-weight: 600; }
  .fsc-status-error { color: var(--color-red-600); }

  .fsc-spinner {
    display: inline-block;
    width: 0.75rem; height: 0.75rem;
    border: 2px solid var(--color-amber-200);
    border-top-color: var(--color-amber-800);
    border-radius: 50%;
    animation: fsc-spin 0.7s linear infinite;
  }
  @keyframes fsc-spin { to { transform: rotate(360deg); } }
</style>
