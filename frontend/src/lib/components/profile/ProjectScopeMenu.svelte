<script>
  // The profile page's "Select projects" menu: a tick-list of the person's
  // projects, and below it a tick-list of colleagues to narrow to projects shared
  // with them. The parent supplies the pill that opens it (slot "trigger") so the
  // menu hangs directly beneath that pill.
  import { createEventDispatcher } from 'svelte';

  export let projectOptions = [];  // [{ id, label }]
  export let selected = [];        // ticked project labels, bind:selected
  export let sharedOptions = [];   // [{ id, label }] colleagues on at least one of these projects
  export let shared = [];          // ticked colleague labels. Read-only here: the parent decides what a
                                   // change means (it re-ticks the projects) and passes the result back.

  const dispatch = createEventDispatcher();

  let open = false;
  let wrapperEl;

  function toggle() {
    open = !open;
    if (open) dispatch('open');
  }

  function flip(list, label) {
    return list.includes(label) ? list.filter(l => l !== label) : [...list, label];
  }
</script>

<svelte:window on:mousedown={(e) => { if (open && wrapperEl && !wrapperEl.contains(e.target)) open = false; }} />

<div class="psm-wrapper" bind:this={wrapperEl}>
  <slot name="trigger" {open} {toggle} />

  {#if open}
    <div class="psm-panel" role="dialog" aria-label="Select projects">
      <div class="psm-section-head">
        <span>Projects</span>
        <span class="psm-links">
          <button type="button" on:click={() => (selected = projectOptions.map(o => o.label))}>All</button>
          <button type="button" on:click={() => (selected = [])}>None</button>
        </span>
      </div>
      <div class="psm-list">
        {#each projectOptions as o (o.id)}
          <label class="psm-option">
            <input type="checkbox" checked={selected.includes(o.label)} on:change={() => (selected = flip(selected, o.label))} />
            <span>{o.label}</span>
          </label>
        {/each}
      </div>

      {#if sharedOptions.length}
        <div class="psm-section-head psm-divider">
          <span>Shared with</span>
          {#if shared.length}
            <span class="psm-links"><button type="button" on:click={() => dispatch('sharedChange', [])}>Clear</button></span>
          {/if}
        </div>
        <p class="psm-hint">Ticks the projects you're on together{shared.length > 1 ? ' with all of them' : ''}. Adjust above if needed.</p>
        <div class="psm-list">
          {#each sharedOptions as o (o.id)}
            <label class="psm-option">
              <input type="checkbox" checked={shared.includes(o.label)} on:change={() => dispatch('sharedChange', flip(shared, o.label))} />
              <span>{o.label}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .psm-wrapper { position: relative; }

  .psm-panel {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 100;
    width: max-content; min-width: 240px; max-width: 340px; padding: 4px 0;
    background: var(--color-white); border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md); box-shadow: var(--shadow-dropdown);
  }

  .psm-section-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px 2px; font-size: 0.625rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-400);
  }
  .psm-divider { margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--color-slate-100); }
  .psm-links { display: flex; gap: 10px; text-transform: none; letter-spacing: 0; }
  .psm-links button {
    background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
    font-size: 0.6875rem; font-weight: 600; color: var(--color-primary-600);
  }
  .psm-links button:hover { text-decoration: underline; }
  .psm-hint { margin: 0; padding: 0 12px 2px; font-size: 0.6875rem; color: var(--color-slate-400); }

  .psm-list { max-height: 200px; overflow-y: auto; }
  .psm-option {
    display: flex; align-items: center; gap: 8px; padding: 5px 12px;
    font-size: 0.8125rem; color: var(--color-slate-800); cursor: pointer;
  }
  .psm-option:hover { background: var(--color-slate-50); }
  .psm-option input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--color-primary-500); cursor: pointer; flex-shrink: 0; }
</style>
