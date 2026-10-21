<script>
  // A button that opens a short dropdown of actions. The parent decides what
  // each action does: this only reports which one was picked.
  //   items: [{ key, label, icon?, description? }]
  import { createEventDispatcher } from 'svelte';

  export let label;
  export let icon = '';
  export let items = [];
  export let primary = false;
  export let badge = '';

  const dispatch = createEventDispatcher();

  let open = false;
  let root;

  function pick(key) {
    open = false;
    dispatch('select', key);
  }

  function onWindowClick(e) {
    if (open && root && !root.contains(e.target)) open = false;
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={(e) => { if (e.key === 'Escape') open = false; }} />

<div class="action-menu" bind:this={root}>
  <button class="btn {primary ? 'btn-primary' : 'btn-secondary'}" aria-haspopup="menu" aria-expanded={open} on:click={() => open = !open}>
    {#if icon}<i class="las {icon}"></i>{/if}
    {label}
    {#if badge}<span class="badge badge-sm badge-warning">{badge}</span>{/if}
    <i class="las la-angle-down menu-caret" class:open></i>
  </button>

  {#if open}
    <div class="menu-list" role="menu">
      {#each items as item (item.key)}
        <button class="menu-item" role="menuitem" on:click={() => pick(item.key)}>
          {#if item.icon}<i class="las {item.icon}"></i>{/if}
          <span class="menu-item-text">
            <span class="menu-item-label">{item.label}</span>
            {#if item.description}<span class="menu-item-desc">{item.description}</span>{/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .action-menu { position: relative; display: inline-block; }

  .menu-caret { font-size: var(--font-size-xs); transition: transform 0.15s; }
  .menu-caret.open { transform: rotate(180deg); }

  .menu-list {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    z-index: 50;
    min-width: 16rem;
    padding: var(--space-1);
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
  }

  .menu-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    color: var(--color-slate-800);
  }
  .menu-item:hover { background: var(--color-slate-50); }
  .menu-item > i { font-size: 1.1rem; color: var(--color-primary-600); margin-top: 0.1rem; }
  .menu-item-text { display: flex; flex-direction: column; gap: 0.1rem; }
  .menu-item-label { font-size: var(--font-size-sm); font-weight: 500; }
  .menu-item-desc { font-size: var(--font-size-xs); color: var(--color-slate-500); line-height: 1.35; }
</style>
