<script>
  export let status; // 'complete' | 'partial' | 'missing'
</script>

<span class="badge badge-{status}">
  {#if status === 'complete'}
    <i class="las la-check-circle"></i> Complete
  {:else if status === 'partial'}
    <i class="las la-adjust"></i> Partial
  {:else}
    <i class="las la-times-circle"></i> Missing
  {/if}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  .badge-complete {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .badge-partial {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .badge-missing {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }
</style>
