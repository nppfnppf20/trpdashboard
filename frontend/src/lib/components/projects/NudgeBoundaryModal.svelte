<script>
  export let isOpen = false;
  export let onDrawBoundary = () => {};
  export let onContinueWithout = () => {};
</script>

{#if isOpen}
  <div class="nudge-backdrop" role="presentation">
    <div class="nudge-container" role="dialog" aria-modal="true" aria-labelledby="nudge-title">
      <div class="nudge-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-1 -1 26 26" fill="currentColor">
          <path d="M 24,6.565 21.904,21.395 7.07,24 0,10.773 10.463,0 Z"/>
        </svg>
      </div>

      <h3 id="nudge-title">No site boundary drawn</h3>

      <p class="nudge-body">
        You haven't drawn a site boundary yet. Use the polygon tool
        <span class="tool-hint">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="-1 -1 26 26" fill="currentColor"><path d="M 24,6.565 21.904,21.395 7.07,24 0,10.773 10.463,0 Z"/></svg>
        </span>
        on the map to draw a boundary around the site. You can always add or edit it later.
      </p>

      <div class="nudge-actions">
        <button class="btn-draw" on:click={onDrawBoundary}>
          Draw boundary
        </button>
        <button class="btn-skip" on:click={onContinueWithout}>
          Save without boundary
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .nudge-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .nudge-container {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .nudge-icon {
    width: 56px;
    height: 56px;
    background: var(--color-violet-100);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-purple-600);
    margin-bottom: 0.25rem;
  }

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .nudge-body {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    line-height: 1.6;
  }

  .tool-hint {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-200);
    border-radius: 4px;
    padding: 1px 5px;
    margin: 0 2px;
    color: var(--color-slate-600);
  }

  .nudge-actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .btn-draw {
    padding: 0.75rem 1.5rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-draw:hover {
    background: var(--color-purple-700);
  }

  .btn-skip {
    padding: 0.75rem 1.5rem;
    background: white;
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-skip:hover {
    background: var(--color-slate-50);
    border-color: var(--color-slate-400);
  }
</style>
