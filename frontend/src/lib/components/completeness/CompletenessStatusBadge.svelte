<script>
  export let status; // 'complete' | 'partial' | 'missing'
</script>

<span class="badge {status === 'complete' ? 'badge-success' : status === 'partial' ? 'badge-warning' : 'badge-danger'}">
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

</style>
