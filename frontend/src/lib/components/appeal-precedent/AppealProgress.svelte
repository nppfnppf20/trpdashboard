<script>
  import { createEventDispatcher } from 'svelte';

  export let stats = null;
  export let progress = [];
  export let status = 'running';
  export let callCap = 40;
  export let maxRecords = 12;
  export let recordCount = 0;
  export let cancelling = false;

  const dispatch = createEventDispatcher();

  $: running = status === 'running';
  $: recent = progress.slice(-14);
  $: mins = stats ? Math.floor(stats.seconds / 60) : 0;
  $: secs = stats ? stats.seconds % 60 : 0;
</script>

<div class="card progress">
  <div class="head">
    <div>
      <h3>{running ? 'Searching Appealbase...' : status === 'cancelled' ? 'Search cancelled' : status === 'error' ? 'Search stopped' : 'Search finished'}</h3>
      {#if stats}
        <p class="sub">{mins}:{String(secs).padStart(2, '0')} elapsed · about ${stats.estCostUsd.toFixed(2)} of AI usage so far</p>
      {/if}
    </div>
    {#if running}
      <button class="btn btn-secondary btn-sm" on:click={() => dispatch('cancel')} disabled={cancelling}>
        {cancelling ? 'Cancelling...' : 'Cancel'}
      </button>
    {/if}
  </div>

  <div class="counters">
    <div><span class="num">{stats?.appealbaseCalls ?? 0}<small>/{callCap}</small></span><span class="lab">Appealbase calls</span></div>
    <div><span class="num">{stats?.searches ?? 0}</span><span class="lab">Searches</span></div>
    <div><span class="num">{stats?.textsFetched ?? 0}</span><span class="lab">Decisions read</span></div>
    <div><span class="num">{recordCount}<small>/{maxRecords}</small></span><span class="lab">Precedents found</span></div>
  </div>

  {#if recent.length}
    <ul class="log" aria-live="polite">
      {#each recent as p}
        <li class={p.type}>{p.text}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .progress {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-slate-900);
  }

  .sub {
    margin: 0.2rem 0 0;
    font-size: 0.78125rem;
    color: var(--color-slate-500);
  }

  .counters {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .counters > div {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .num {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-900);
    font-variant-numeric: tabular-nums;
  }

  .num small {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-500);
  }

  .lab {
    font-size: 0.71875rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-slate-500);
  }

  .log {
    list-style: none;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78125rem;
    color: var(--color-slate-600);
  }

  .log li.record {
    color: var(--color-slate-900);
    font-weight: 600;
  }

  .log li.error {
    color: var(--color-badge-danger-fg);
  }

  @media (max-width: 560px) {
    .counters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
