<script>
  export let suggestion; // { field, field_label, date, reason, source_id }
  export let onAccept;   // async (field, date) => boolean
  export let onDismiss;  // () => void
  export let compact = false;

  let status = 'pending'; // 'pending' | 'saving' | 'accepted' | 'error'

  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function accept() {
    status = 'saving';
    const ok = await onAccept?.(suggestion.field, suggestion.date);
    status = ok ? 'accepted' : 'error';
  }
</script>

{#if status !== 'dismissed'}
  <div class="dsc" class:dsc-compact={compact}>
    <div class="dsc-icon"><i class="las la-calendar-plus"></i></div>
    <div class="dsc-body">
      <div class="dsc-label">Set <strong>{suggestion.field_label}</strong> to <strong>{formatDate(suggestion.date)}</strong>?</div>
      {#if suggestion.reason}<div class="dsc-reason">{suggestion.reason}</div>{/if}
      {#if status === 'pending'}
        <div class="dsc-actions">
          <button class="dsc-btn dsc-btn-accept" on:click={accept}>Add to Project</button>
          <button class="dsc-btn dsc-btn-dismiss" on:click={() => { status = 'dismissed'; onDismiss?.(); }}>Not now</button>
        </div>
      {:else if status === 'saving'}
        <div class="dsc-status"><span class="dsc-spinner"></span> Saving…</div>
      {:else if status === 'accepted'}
        <div class="dsc-status dsc-status-ok"><i class="las la-check-circle"></i> Added</div>
      {:else if status === 'error'}
        <div class="dsc-actions">
          <span class="dsc-status dsc-status-error">Failed to save.</span>
          <button class="dsc-btn dsc-btn-accept" on:click={accept}>Retry</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .dsc {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.5rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-white);
    border: 1px solid var(--color-primary-200);
    border-radius: 8px;
  }
  .dsc-icon {
    flex-shrink: 0;
    color: var(--color-primary-600);
    font-size: 1.1rem;
    line-height: 1.4;
  }
  .dsc-body { flex: 1; min-width: 0; }
  .dsc-label { font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.4; }
  .dsc-reason { margin-top: 0.15rem; font-size: 0.76rem; color: var(--color-slate-500); }

  .dsc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .dsc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .dsc-btn-accept {
    border: 1px solid var(--color-primary-600);
    background: var(--color-primary-600);
    color: var(--color-white);
  }
  .dsc-btn-accept:hover { background: var(--color-primary-700); border-color: var(--color-primary-700); }
  .dsc-btn-dismiss {
    border: 1px solid var(--color-slate-200);
    background: var(--color-white);
    color: var(--color-slate-500);
  }
  .dsc-btn-dismiss:hover { background: var(--color-slate-50); }

  .dsc-status { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--color-slate-500); }
  .dsc-status-ok { color: var(--color-emerald-600); font-weight: 600; }
  .dsc-status-error { color: var(--color-red-600); }

  .dsc-spinner {
    display: inline-block;
    width: 0.75rem; height: 0.75rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: dsc-spin 0.7s linear infinite;
  }
  @keyframes dsc-spin { to { transform: rotate(360deg); } }

  /* Compact scale for the Overview widget */
  .dsc-compact { padding: 0.5rem 0.6rem; gap: 0.5rem; }
  .dsc-compact .dsc-icon { font-size: 0.95rem; }
  .dsc-compact .dsc-label { font-size: 0.75rem; }
  .dsc-compact .dsc-reason { font-size: 0.68rem; }
  .dsc-compact .dsc-btn { padding: 0.22rem 0.55rem; font-size: 0.7rem; }
  .dsc-compact .dsc-status { font-size: 0.7rem; }
</style>
