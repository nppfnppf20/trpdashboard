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
    background: #d1fae5;
    color: #065f46;
  }

  .badge-partial {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-missing {
    background: #fee2e2;
    color: #991b1b;
  }
</style>
