<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { createQuote } from '$lib/api/quotes.js';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SearchableDropdown from '$lib/components/shared/SearchableDropdown.svelte';
  import AutocompleteInput from '$lib/components/shared/AutocompleteInput.svelte';

  export let show = false;
  export let projectId = null;

  const dispatch = createEventDispatcher();

  let discipline = '';
  let organisation = '';
  let contact = '';
  let lineItems = [{ item: '', description: '', cost: '' }];
  let additionalNotes = '';

  let organisations = [];
  let availableContacts = [];
  let disciplineOptions = [];
  let lineItemSuggestions = [];

  // Transform organisations to SearchableDropdown format
  $: organisationOptions = organisations.map(org => ({
    id: org.id,
    label: `${org.organisation} - ${org.discipline}`
  }));

  onMount(async () => {
    try {
      const [orgs, disciplines, itemSuggestions] = await Promise.all([
        getAllSurveyorOrganisations(),
        getLookupOptions('surveyor_disciplines'),
        getLookupOptions('line_item_suggestions')
      ]);
      organisations = orgs;
      disciplineOptions = disciplines;
      lineItemSuggestions = itemSuggestions;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  });

  // When organisation changes, update available contacts
  $: {
    if (organisation) {
      const selectedOrg = organisations.find(org => org.id === organisation);
      availableContacts = selectedOrg?.contacts || [];
      // Reset contact if it's not in the new org
      if (contact && !availableContacts.find(c => c.id === contact)) {
        contact = '';
      }
    } else {
      availableContacts = [];
      contact = '';
    }
  }

  // Reactive total calculation - updates automatically when lineItems change
  $: total = lineItems.reduce((sum, item) => {
    const cost = parseFloat(item.cost) || 0;
    return sum + cost;
  }, 0);

  function addLineItem() {
    lineItems = [...lineItems, { item: '', description: '', cost: '' }];
  }

  function removeLineItem(index) {
    lineItems = lineItems.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    // Validation
    if (!discipline) {
      alert('Please select a discipline');
      return;
    }
    if (!organisation) {
      alert('Please select an organisation');
      return;
    }

    try {
      // Prepare quote data for API
      const filteredLineItems = lineItems
        .filter(item => item.item || item.description || item.cost)
        .map(item => ({
          item: item.item,
          description: item.description,
          cost: parseFloat(item.cost) || 0
        }));

      const quoteData = {
        project_id: projectId,
        surveyor_organisation_id: organisation,
        contact_id: contact || null,
        discipline: discipline,
        total: total,
        quote_notes: additionalNotes || null,
        line_items: filteredLineItems
      };

      // Call API to create quote
      const newQuote = await createQuote(quoteData);
      
      // Dispatch event with new quote
      dispatch('save', { quote: newQuote });
      
      // Reset form
      discipline = '';
      organisation = '';
      contact = '';
      lineItems = [{ item: '', description: '', cost: '' }];
      additionalNotes = '';
      
      // Close modal
      dispatch('close');
    } catch (error) {
      console.error('Failed to create quote:', error);
      alert('Failed to create quote: ' + error.message);
    }
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>
          <i class="las la-file-invoice-dollar"></i>
          Add New Quote
        </h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Discipline Field -->
        <div class="form-group">
          <label for="discipline">Discipline <span class="required">*</span></label>
          <select id="discipline" bind:value={discipline}>
            <option value="">Select a discipline...</option>
            {#each disciplineOptions as opt}
              <option value={opt.label}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <!-- Organisation Field -->
        <div class="form-group">
          <label for="organisation">Organisation <span class="required">*</span></label>
          <SearchableDropdown
            id="organisation"
            options={organisationOptions}
            bind:value={organisation}
            valueField="id"
            placeholder="Select an organisation..."
          />
        </div>

        <!-- Contact Field -->
        <div class="form-group">
          <label for="contact">Contact</label>
          <select id="contact" bind:value={contact} disabled={!organisation}>
            <option value="">Select a contact...</option>
            {#each availableContacts as c}
              <option value={c.id}>{c.name} {#if c.email}({c.email}){/if}</option>
            {/each}
          </select>
        </div>

        <!-- Line Items Section -->
        <div class="section-divider">
          <h3>Line Items</h3>
        </div>

        <table class="line-items-table">
          <thead>
            <tr>
              <th style="width: 30%;">Item</th>
              <th style="width: 45%;">Description</th>
              <th style="width: 15%;">Cost (£ excl. VAT)</th>
              <th style="width: 10%;"></th>
            </tr>
          </thead>
          <tbody>
            {#each lineItems as lineItem, index}
              <tr>
                <td>
                  <AutocompleteInput
                    suggestions={lineItemSuggestions}
                    bind:value={lineItem.item}
                    placeholder="e.g., Desk-based assessment"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    bind:value={lineItem.description}
                    placeholder="Detailed description..."
                  />
                </td>
                <td>
                  <input
                    type="text"
                    bind:value={lineItem.cost}
                    placeholder="0.00"
                    inputmode="decimal"
                    on:input={(e) => {
                      // Only allow numbers and decimal point
                      e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                      // Prevent multiple decimal points
                      const parts = e.target.value.split('.');
                      if (parts.length > 2) {
                        e.target.value = parts[0] + '.' + parts.slice(1).join('');
                      }
                      lineItem.cost = e.target.value;
                      // Trigger Svelte reactivity
                      lineItems = lineItems;
                    }}
                  />
                </td>
                <td class="action-cell">
                  {#if lineItems.length > 1}
                    <button
                      type="button"
                      class="remove-line-btn"
                      on:click={() => removeLineItem(index)}
                      title="Remove this line item"
                    >
                      <i class="las la-trash"></i>
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <button type="button" class="add-line-btn" on:click={addLineItem}>
          <i class="las la-plus"></i>
          Add Line Item
        </button>

        <!-- Total Display -->
        <div class="total-display">
          <span class="total-label">Total (excl. VAT):</span>
          <span class="total-amount">£{total.toFixed(2)}</span>
        </div>

        <!-- Additional Notes Section -->
        <div class="section-divider">
          <h3>Additional Notes</h3>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            bind:value={additionalNotes}
            placeholder="Any additional information or notes about this quote..."
            rows="4"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleSubmit}>
          <i class="las la-save"></i>
          Add Quote
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-header h2 i {
    font-size: 1.5rem;
    color: #3b82f6;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
  }

  .form-group select,
  .form-group input,
  .form-group textarea {
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
  }

  .form-group select:focus,
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group textarea {
    resize: vertical;
  }

  .section-divider {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid #e2e8f0;
  }

  .section-divider h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .line-items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .line-items-table thead tr {
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }

  .line-items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .line-items-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
  }

  .line-items-table td {
    padding: 0.75rem 0.5rem;
    vertical-align: middle;
  }

  .line-items-table input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
    box-sizing: border-box;
    margin: 0;
  }

  .line-items-table input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Hide number input spinner arrows */
  .line-items-table input[type="number"]::-webkit-inner-spin-button,
  .line-items-table input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .line-items-table input[type="number"] {
    -moz-appearance: textfield;
  }

  .action-cell {
    text-align: center;
  }

  .remove-line-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 1.125rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .remove-line-btn:hover {
    background: #fee2e2;
  }

  .add-line-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .add-line-btn:hover {
    background: #eff6ff;
  }

  .total-display {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
  }

  .total-label {
    font-weight: 600;
    color: #1e40af;
    font-size: 1rem;
  }

  .total-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e40af;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover {
    background: #f8fafc;
  }

  @media (max-width: 768px) {
    .line-item-fields {
      grid-template-columns: 1fr;
    }

    .cost-field {
      width: 100%;
    }
  }
</style>
