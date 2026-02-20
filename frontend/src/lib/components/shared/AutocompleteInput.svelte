<script>
  import { createEventDispatcher, tick } from 'svelte';

  export let suggestions = []; // Array of { id, label } objects
  export let value = ''; // The text value (free text allowed)
  export let placeholder = '';
  export let disabled = false;
  export let id = '';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let inputElement;
  let containerElement;
  let highlightedIndex = -1;
  let userTypedValue = ''; // Track what the user actually typed
  let isAutofilling = false;

  // Filter suggestions that START with what user typed (for inline autofill)
  $: matchingSuggestions = userTypedValue
    ? suggestions.filter(s =>
        s.label.toLowerCase().startsWith(userTypedValue.toLowerCase()) &&
        s.label.toLowerCase() !== userTypedValue.toLowerCase()
      )
    : [];

  // Also show suggestions that contain (but don't start with) the typed value
  $: containsSuggestions = userTypedValue
    ? suggestions.filter(s =>
        s.label.toLowerCase().includes(userTypedValue.toLowerCase()) &&
        !s.label.toLowerCase().startsWith(userTypedValue.toLowerCase())
      )
    : [];

  // Combined filtered suggestions - starts with first, then contains
  $: filteredSuggestions = [...matchingSuggestions, ...containsSuggestions];

  // Reset highlight when filtered suggestions change
  $: if (filteredSuggestions) highlightedIndex = -1;

  // Show dropdown when there are matching suggestions
  $: if (filteredSuggestions.length > 0 && userTypedValue) {
    isOpen = true;
  }

  function handleClickOutside(event) {
    if (isOpen && containerElement && !containerElement.contains(event.target)) {
      isOpen = false;
      highlightedIndex = -1;
    }
  }

  async function handleInput(e) {
    const inputVal = e.target.value;
    userTypedValue = inputVal;

    // Don't autofill when user is deleting
    const isDeleting = e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward';

    if (isDeleting) {
      value = inputVal;
      isAutofilling = false;
      dispatch('input', { value: inputVal });
      return;
    }

    // Find best matching suggestion that starts with current value
    const bestMatch = suggestions.find(s =>
      s.label.toLowerCase().startsWith(inputVal.toLowerCase()) &&
      inputVal.length > 0 &&
      s.label.toLowerCase() !== inputVal.toLowerCase()
    );

    if (bestMatch && inputVal.length > 0) {
      isAutofilling = true;

      // Set value directly on the input element to avoid reactivity issues
      inputElement.value = bestMatch.label;
      value = bestMatch.label;

      // Use requestAnimationFrame to ensure DOM is updated before setting selection
      requestAnimationFrame(() => {
        if (inputElement && document.activeElement === inputElement) {
          inputElement.setSelectionRange(inputVal.length, bestMatch.label.length);
        }
      });
    } else {
      value = inputVal;
      isAutofilling = false;
    }

    dispatch('input', { value: inputVal });
  }

  function handleFocus() {
    if (filteredSuggestions.length > 0) {
      isOpen = true;
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      isOpen = false;
      highlightedIndex = -1;
      // On blur, commit whatever is in the input (including any accepted autofill)
      if (isAutofilling) {
        // Revert to what user typed if they didn't explicitly accept
        value = userTypedValue;
        isAutofilling = false;
      }
    }, 150);
  }

  function selectSuggestion(suggestion) {
    value = suggestion.label;
    userTypedValue = suggestion.label;
    isOpen = false;
    highlightedIndex = -1;
    isAutofilling = false;
    dispatch('input', { value });
    dispatch('select', { value: suggestion.label });
  }

  function handleKeydown(e) {
    // Tab or Right arrow accepts the autofill
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && isAutofilling) {
      const selEnd = inputElement?.selectionEnd;
      if (selEnd === value.length && inputElement?.selectionStart !== selEnd) {
        // Accept the autofill
        userTypedValue = value;
        isAutofilling = false;
        inputElement?.setSelectionRange(value.length, value.length);
        if (e.key === 'ArrowRight') {
          e.preventDefault();
        }
        return;
      }
    }

    if (!isOpen || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredSuggestions.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          e.preventDefault();
          selectSuggestion(filteredSuggestions[highlightedIndex]);
        } else if (isAutofilling) {
          // Accept the current autofill
          e.preventDefault();
          userTypedValue = value;
          isAutofilling = false;
          isOpen = false;
        }
        break;
      case 'Escape':
        isOpen = false;
        highlightedIndex = -1;
        // Revert to typed value
        value = userTypedValue;
        isAutofilling = false;
        break;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="autocomplete-input" bind:this={containerElement}>
  <input
    {id}
    type="text"
    bind:this={inputElement}
    {value}
    {placeholder}
    {disabled}
    on:input={handleInput}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown={handleKeydown}
    autocomplete="off"
  />

  {#if isOpen && filteredSuggestions.length > 0}
    <div class="suggestions-menu">
      {#each filteredSuggestions as suggestion, index}
        <button
          type="button"
          class="suggestion-item"
          class:highlighted={index === highlightedIndex}
          on:mousedown|preventDefault={() => selectSuggestion(suggestion)}
          on:mouseenter={() => highlightedIndex = index}
        >
          {suggestion.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete-input {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.2s;
    background: white;
    color: #1e293b;
  }

  input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  input:disabled {
    background: #f1f5f9;
    cursor: not-allowed;
  }

  .suggestions-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
  }

  .suggestion-item {
    width: 100%;
    padding: 0.625rem 0.875rem;
    text-align: left;
    background: none;
    border: none;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s;
    color: #1e293b;
  }

  .suggestion-item:hover,
  .suggestion-item.highlighted {
    background: #eff6ff;
  }
</style>
