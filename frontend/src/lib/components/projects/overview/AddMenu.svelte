<script>
  // A "+ Add" button for a widget header that opens a small menu of ways to add something. The menu is
  // fixed-position so it is not clipped by the widget's overflow: hidden. Menu rows go in the default slot
  // (use the .am-item class); call the slot's `close` after a choice.
  export let label = 'Add';
  export let title = '';
  // 'primary' is the labelled "+ Add" button; 'icon' is a small icon-only button (e.g. a "more" menu) using `icon`.
  export let variant = 'primary';
  export let icon = 'la-plus';

  let open = false;
  let btn;
  let style = '';

  function toggle() {
    open = !open;
    if (open && btn) {
      const r = btn.getBoundingClientRect();
      style = `top:${r.bottom + 4}px;right:${Math.max(8, window.innerWidth - r.right)}px;`;
    }
  }
  function close() { open = false; }
</script>

<svelte:window on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} on:resize={close} />

{#if variant === 'icon'}
  <button bind:this={btn} class="widget-icon-btn" class:active={open} {title} aria-label={title || label} aria-haspopup="menu" aria-expanded={open} on:click|stopPropagation={toggle}>
    <i class="las {icon}"></i>
  </button>
{:else}
  <button bind:this={btn} class="btn btn-primary btn-sm" {title} aria-haspopup="menu" aria-expanded={open} on:click|stopPropagation={toggle}>
    <i class="las {icon}"></i> {label}
  </button>
{/if}

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="am-pop" role="menu" {style} on:click|stopPropagation>
    <slot {close} />
  </div>
{/if}

<style>
  .am-pop {
    position: fixed;
    z-index: 60;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 10px;
    box-shadow: var(--shadow-dropdown);
  }
  .am-pop :global(.am-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-800);
    text-align: left;
    cursor: pointer;
  }
  .am-pop :global(.am-item:hover) { background: var(--color-slate-50); }
  .am-pop :global(.am-item:disabled) { color: var(--color-slate-400); cursor: default; background: none; }
  .am-pop :global(.am-check) { font-weight: 500; color: var(--color-slate-600); }
  .am-pop :global(.am-sep) { height: 1px; background: var(--color-slate-100); margin: 3px 0; }
</style>
