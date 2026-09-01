<script>
  // Same "suggest, accept or decline" pattern as ProjectDateSuggestionCard.svelte,
  // just for adding a key date to a Condition/Issue/Consultation response
  // directly rather than setting one of the project's own date fields.
  export let suggestion; // { date, title }
  export let onAccept;   // async () => boolean
  export let onDismiss = () => {};

  let status = 'pending'; // 'pending' | 'saving' | 'accepted' | 'error'

  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function accept() {
    status = 'saving';
    const ok = await onAccept?.();
    status = ok ? 'accepted' : 'error';
  }
</script>

{#if status !== 'dismissed'}
  <div class="kdsc">
    <div class="kdsc-icon"><i class="las la-calendar-plus"></i></div>
    <div class="kdsc-body">
      <div class="kdsc-label">Add key date <strong>"{suggestion.title}"</strong> on <strong>{formatDate(suggestion.date)}</strong>?</div>
      {#if status === 'pending'}
        <div class="kdsc-actions">
          <button class="kdsc-btn kdsc-btn-accept" on:click={accept}>Add</button>
          <button class="kdsc-btn kdsc-btn-dismiss" on:click={() => { status = 'dismissed'; onDismiss?.(); }}>Not now</button>
        </div>
      {:else if status === 'saving'}
        <div class="kdsc-status"><span class="kdsc-spinner"></span> Saving…</div>
      {:else if status === 'accepted'}
        <div class="kdsc-status kdsc-status-ok"><i class="las la-check-circle"></i> Added</div>
      {:else if status === 'error'}
        <div class="kdsc-actions">
          <span class="kdsc-status kdsc-status-error">Failed to save.</span>
          <button class="kdsc-btn kdsc-btn-accept" on:click={accept}>Retry</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .kdsc {
    display: flex;
    gap: 0.6rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-amber-100);
    border: 1px solid var(--color-amber-200);
    border-radius: 8px;
  }
  .kdsc-icon {
    flex-shrink: 0;
    color: var(--color-amber-800);
    font-size: 1.1rem;
    line-height: 1.4;
  }
  .kdsc-body { flex: 1; min-width: 0; }
  .kdsc-label { font-size: 0.85rem; color: var(--color-amber-800); line-height: 1.4; }

  .kdsc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .kdsc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .kdsc-btn-accept {
    background: var(--color-primary-600);
    color: var(--color-white);
  }
  .kdsc-btn-accept:hover { background: var(--color-primary-700); }
  .kdsc-btn-dismiss {
    background: none;
    border-color: var(--color-amber-200);
    color: var(--color-amber-800);
  }
  .kdsc-btn-dismiss:hover { background: var(--color-amber-200); }

  .kdsc-status { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--color-amber-800); }
  .kdsc-status-ok { color: var(--color-emerald-600); font-weight: 600; }
  .kdsc-status-error { color: var(--color-red-600); }

  .kdsc-spinner {
    display: inline-block;
    width: 0.75rem; height: 0.75rem;
    border: 2px solid var(--color-amber-200);
    border-top-color: var(--color-amber-800);
    border-radius: 50%;
    animation: kdsc-spin 0.7s linear infinite;
  }
  @keyframes kdsc-spin { to { transform: rotate(360deg); } }
</style>
