<script>
  import { createEventDispatcher } from 'svelte';

  export let options = []; // Array of { id, label } objects
  export let value = ''; // Selected value (can be id or label depending on valueField)
  export let valueField = 'label'; // Which field to use as the value: 'id' or 'label'
  export let placeholder = 'Select an option...';
  export let disabled = false;
  export let loading = false;
  export let error = false;
  export let id = '';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let searchTerm = '';
  let inputElement;
  let highlightedIndex = -1;
  let clickedChevron = false;
  let containerElement;

  function handleClickOutside(event) {
    if (isOpen && containerElement && !containerElement.contains(event.target)) {
      isOpen = false;
      searchTerm = '';
      highlightedIndex = -1;
    }
  }

  // Get display value for selected item
  $: selectedOption = options.find(opt => opt[valueField] === value);
  $: displayValue = selectedOption ? selectedOption.label : '';

  // Filter options based on search term
  $: filteredOptions = searchTerm
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Reset highlight when filtered options change
  $: if (filteredOptions) highlightedIndex = -1;

  function handleInputFocus() {
    if (!disabled) {
      isOpen = true;
      searchTerm = '';
    }
  }

  function handleInputBlur() {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      if (clickedChevron) {
        clickedChevron = false;
        return;
      }
      isOpen = false;
      searchTerm = '';
      highlightedIndex = -1;
    }, 150);
  }

  function handleInput(e) {
    searchTerm = e.target.value;
    isOpen = true;
  }

  function selectOption(option) {
    value = option[valueField];
    searchTerm = '';
    isOpen = false;
    highlightedIndex = -1;
    dispatch('change', { id: option.id, label: option.label, value: option[valueField] });
  }

  function clearSelection() {
    value = valueField === 'id' ? null : '';
    searchTerm = '';
    dispatch('change', { id: null, label: '', value: null });
    inputElement?.focus();
  }

  function handleKeydown(e) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      isOpen = true;
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        isOpen = false;
        searchTerm = '';
        highlightedIndex = -1;
        break;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="searchable-dropdown" class:disabled class:error bind:this={containerElement}>
  <div class="input-wrapper">
    <input
      {id}
      type="text"
      bind:this={inputElement}
      value={isOpen ? searchTerm : displayValue}
      {placeholder}
      {disabled}
      on:focus={handleInputFocus}
      on:blur={handleInputBlur}
      on:input={handleInput}
      on:keydown={handleKeydown}
      autocomplete="off"
    />
    {#if loading}
      <span class="spinner"></span>
    {:else if value}
      <button type="button" class="clear-btn" on:click={clearSelection} tabindex="-1">
        &times;
      </button>
    {:else}
      <span
        class="chevron"
        class:open={isOpen}
        on:mousedown={() => {
          clickedChevron = true;
          if (isOpen) {
            isOpen = false;
          } else {
            inputElement?.focus();
          }
        }}
        role="button"
        tabindex="-1"
      >&#9662;</span>
    {/if}
  </div>

  {#if isOpen && !disabled}
    <div class="dropdown-menu">
      {#if filteredOptions.length === 0}
        <div class="no-results">
          <span>No items found</span>
          <span class="hint">New items must be added via the Admin Console</span>
        </div>
      {:else}
        {#each filteredOptions as option, index}
          <button
            type="button"
            class="dropdown-item"
            class:highlighted={index === highlightedIndex}
            class:selected={option[valueField] === value}
            on:mousedown|preventDefault={() => selectOption(option)}
            on:mouseenter={() => highlightedIndex = index}
          >
            {option.label}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .searchable-dropdown {
    position: relative;
    width: 100%;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  input {
    width: 100%;
    padding: 0.625rem 2rem 0.625rem 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.2s;
    background: white;
  }

  input:focus {
    outline: none;
    border-color: #9333ea;
  }

  .disabled input {
    background: #f1f5f9;
    cursor: not-allowed;
  }

  .error input {
    border-color: #ef4444;
  }

  .chevron {
    position: absolute;
    right: 0.75rem;
    color: #1e293b;
    cursor: pointer;
    transition: transform 0.2s;
    font-size: 1rem;
    padding: 0.25rem;
  }

  .chevron:hover {
    color: #9333ea;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .clear-btn {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    color: #64748b;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
  }

  .clear-btn:hover {
    color: #1e293b;
  }

  .spinner {
    position: absolute;
    right: 0.75rem;
    width: 1rem;
    height: 1rem;
    border: 2px solid #e2e8f0;
    border-top-color: #9333ea;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
  }

  .dropdown-item {
    width: 100%;
    padding: 0.625rem 0.875rem;
    text-align: left;
    background: none;
    border: none;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }

  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background: #f3e8ff;
  }

  .dropdown-item.selected {
    background: #ede9fe;
    font-weight: 500;
  }

  .no-results {
    padding: 0.625rem 0.875rem;
    color: #64748b;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .no-results .hint {
    font-size: 0.75rem;
    color: #94a3b8;
  }
</style>
