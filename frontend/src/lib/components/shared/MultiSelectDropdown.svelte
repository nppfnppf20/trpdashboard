<script>
  import { onDestroy } from 'svelte';

  export let options = [];       // [{ id, label }]
  export let selected = [];      // array of selected labels, bind:selected
  export let placeholder = 'Select...';
  export let loading = false;

  let open = false;
  let searchText = '';
  let triggerEl;
  let panelEl;

  $: filtered = searchText.trim()
    ? options.filter(o => o.label.toLowerCase().includes(searchText.toLowerCase()))
    : options;

  $: label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  function toggle() {
    if (!loading) open = !open;
  }

  function toggleOption(optionLabel) {
    if (selected.includes(optionLabel)) {
      selected = selected.filter(s => s !== optionLabel);
    } else {
      selected = [...selected, optionLabel];
    }
  }

  function handleOutsideClick(e) {
    if (open && triggerEl && panelEl && !triggerEl.contains(e.target) && !panelEl.contains(e.target)) {
      open = false;
    }
  }

  // Close on outside click
  $: if (open) {
    document.addEventListener('mousedown', handleOutsideClick);
  } else {
    document.removeEventListener('mousedown', handleOutsideClick);
  }

  onDestroy(() => {
    document.removeEventListener('mousedown', handleOutsideClick);
  });
</script>

<div class="msd-wrapper">
  <button
    type="button"
    class="msd-trigger"
    class:msd-open={open}
    class:msd-has-values={selected.length > 0}
    on:click={toggle}
    bind:this={triggerEl}
    disabled={loading}
  >
    <span class="msd-label">{loading ? 'Loading...' : label}</span>
    <svg class="msd-chevron" class:rotated={open} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {#if open}
    <div class="msd-panel" bind:this={panelEl}>
      {#if options.length > 8}
        <div class="msd-search">
          <input
            type="text"
            bind:value={searchText}
            placeholder="Search..."
            autocomplete="off"
          />
        </div>
      {/if}

      <div class="msd-options">
        {#if filtered.length === 0}
          <div class="msd-empty">No options found</div>
        {:else}
          {#each filtered as option}
            <label class="msd-option">
              <input
                type="checkbox"
                checked={selected.includes(option.label)}
                on:change={() => toggleOption(option.label)}
              />
              <span>{option.label}</span>
            </label>
          {/each}
        {/if}
      </div>

      {#if selected.length > 0}
        <div class="msd-footer">
          <button type="button" class="msd-clear" on:click={() => { selected = []; }}>
            Clear all
          </button>
          <span class="msd-count">{selected.length} selected</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .msd-wrapper {
    position: relative;
  }

  .msd-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    background: var(--color-white);
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s;
    color: var(--color-slate-400);
  }

  .msd-trigger.msd-has-values {
    color: var(--color-slate-800);
  }

  .msd-trigger.msd-open,
  .msd-trigger:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .msd-trigger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .msd-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .msd-chevron {
    flex-shrink: 0;
    margin-left: 0.5rem;
    transition: transform 0.2s;
    color: var(--color-slate-400);
  }

  .msd-chevron.rotated {
    transform: rotate(180deg);
  }

  .msd-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-white);
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 100;
    overflow: hidden;
  }

  .msd-search {
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-slate-100);
  }

  .msd-search input {
    width: 100%;
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .msd-search input:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .msd-options {
    max-height: 220px;
    overflow-y: auto;
  }

  .msd-option {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.875rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-slate-800);
    transition: background 0.1s;
  }

  .msd-option:hover {
    background: var(--color-slate-50);
  }

  .msd-option input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: var(--color-primary-500);
    flex-shrink: 0;
    cursor: pointer;
  }

  .msd-empty {
    padding: 0.75rem 0.875rem;
    font-size: 0.875rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .msd-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.875rem;
    border-top: 1px solid var(--color-slate-100);
    background: var(--color-slate-50);
  }

  .msd-clear {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: var(--color-primary-500);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }

  .msd-clear:hover {
    text-decoration: underline;
  }

  .msd-count {
    font-size: 0.75rem;
    color: var(--color-slate-500);
  }
</style>
