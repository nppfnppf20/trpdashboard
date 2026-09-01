<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let quotes = [];
  export let projectId = '';
  export let type = 'quote'; // 'quote', 'project', or a row-owned kind (e.g. 'condition'/'issue'/'consultation') — anything but 'quote' skips the quote picker
  export let preSelectedQuote = null;
  export let preSelectedDate = null;
  export let existingDate = null; // Pass this to edit an existing date
  export let typeLabel = null; // Overrides the header wording for row-owned kinds, e.g. "Key Date" instead of the "quote"/"project" default

  const dispatch = createEventDispatcher();
  
  // Derive edit mode from existingDate
  $: isEditMode = !!existingDate;

  let formData = {
    title: '',
    date: '',
    color: '#3b82f6',
    quoteId: ''
  };

  let previousShow = false;

  // Helper function to format date for input field (YYYY-MM-DD)
  function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Single reactive block to handle modal opening
  $: if (show && !previousShow) {
    // Modal just opened - initialize form
    if (isEditMode && existingDate) {
      // Edit mode - populate with existing data
      // Find the quote ID if this is a quote date
      let quoteId = '';
      if (type === 'quote' && existingDate.discipline && existingDate.surveyor_organisation) {
        const matchingQuote = quotes.find(q => 
          q.discipline === existingDate.discipline && 
          q.surveyor_organisation === existingDate.surveyor_organisation
        );
        if (matchingQuote) {
          quoteId = matchingQuote.id;
        }
      }
      
      formData = {
        title: existingDate.title || '',
        date: formatDateForInput(existingDate.date),
        color: existingDate.color || existingDate.colour || '#3b82f6',
        quoteId: quoteId
      };
    } else {
      // Create mode - initialize empty form
      let defaultQuoteId = '';
      if (type === 'quote') {
        if (preSelectedQuote) {
          defaultQuoteId = preSelectedQuote.id;
        } else if (quotes.length === 1) {
          defaultQuoteId = quotes[0].id;
        }
      }

      formData = {
        title: '',
        date: preSelectedDate || '',
        color: '#3b82f6',
        quoteId: defaultQuoteId
      };
    }
    previousShow = true;
  } else if (!show && previousShow) {
    previousShow = false;
  }

  const colorOptions = [
    { value: '#3b82f6', label: 'Blue', class: 'color-blue' },
    { value: '#8b5cf6', label: 'Purple', class: 'color-purple' },
    { value: '#ec4899', label: 'Pink', class: 'color-pink' },
    { value: '#f59e0b', label: 'Amber', class: 'color-amber' },
    { value: '#10b981', label: 'Green', class: 'color-green' },
    { value: '#ef4444', label: 'Red', class: 'color-red' }
  ];

  function handleClose() {
    show = false;
    dispatch('close');
  }

  function handleSubmit() {
    if (!formData.title || !formData.date) {
      alert('Please fill in title and date');
      return;
    }

    if (type === 'quote' && !formData.quoteId && !isEditMode) {
      alert('Please select a quote');
      return;
    }

    const eventData = {
      type,
      data: {
        ...formData,
        projectId
      }
    };

    // Include ID when editing
    if (isEditMode && existingDate) {
      eventData.data.id = existingDate.id;
      eventData.isEdit = true;
    }

    dispatch('submit', eventData);

    handleClose();
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>
          {#if typeLabel}
            {isEditMode ? 'Edit' : 'Add'} {typeLabel}
          {:else if isEditMode}
            {#if type === 'quote'}
              Edit Quote Key Date
            {:else}
              Edit Project Milestone
            {/if}
          {:else}
            {#if type === 'quote'}
              Add Quote Key Date
            {:else}
              Add Project Milestone
            {/if}
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>
      
      <form on:submit|preventDefault={handleSubmit}>
        <div class="form-body">
          {#if type === 'quote' && !isEditMode}
            <div class="form-group">
              <label for="quoteId">
                Quote / Surveyor
                <span class="required">*</span>
              </label>
              <select id="quoteId" bind:value={formData.quoteId} required>
                <option value="">Select a quote...</option>
                {#each quotes as quote}
                  <option value={quote.id}>
                    {quote.discipline} - {quote.surveyor_organisation}
                  </option>
                {/each}
              </select>
            </div>
          {/if}
          
          {#if type === 'quote' && isEditMode && existingDate}
            <div class="form-group">
              <label>Quote / Surveyor</label>
              <div class="read-only-field">
                {existingDate.discipline} - {existingDate.surveyor_organisation}
              </div>
            </div>
          {/if}
          
          <div class="form-group">
            <label for="title">
              Title
              <span class="required">*</span>
            </label>
            <input 
              type="text" 
              id="title" 
              bind:value={formData.title}
              placeholder="e.g. Report Due, Site Visit, Review Meeting"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="date">
              Date
              <span class="required">*</span>
            </label>
            <input 
              type="date" 
              id="date" 
              bind:value={formData.date}
              required
            />
          </div>
          
          <div class="form-group">
            <label for="color">Color</label>
            <div class="color-picker">
              {#each colorOptions as colorOption}
                <button
                  type="button"
                  class="color-option {colorOption.class} {formData.color === colorOption.value ? 'selected' : ''}"
                  style="background-color: {colorOption.value}"
                  on:click={() => formData.color = colorOption.value}
                  title={colorOption.label}
                >
                  {#if formData.color === colorOption.value}
                    <i class="las la-check"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" on:click={handleClose}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            {#if isEditMode}
              <i class="las la-save"></i>
              Save Changes
            {:else}
              <i class="las la-plus"></i>
              Add Key Date
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-modal);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
  }
  
  .form-body {
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group:last-child {
    margin-bottom: 0;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-slate-700);
    font-size: 0.875rem;
  }

  .required {
    color: var(--color-red-500);
  }

  input[type="text"],
  input[type="date"],
  select,
  textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  input[type="text"]:focus,
  input[type="date"]:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  textarea {
    resize: vertical;
    font-family: inherit;
  }

  .read-only-field {
    padding: 0.625rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }
  
  .color-picker {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .color-option {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.25rem;
  }
  
  .color-option:hover {
    transform: scale(1.1);
  }
  
  .color-option.selected {
    border-color: var(--color-slate-800);
    box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }
  
</style>

