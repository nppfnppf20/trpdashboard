<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';

  export let show = false;
  export let quote = null;

  const dispatch = createEventDispatcher();

  let discipline = '';
  let organisation = '';
  let contact = '';
  let lineItems = [{ stage: '', item: '', description: '', cost: '', vatIncluded: true, optional: false, tbc: false }];
  let additionalNotes = '';

  let organisations = [];
  let availableContacts = [];

  onMount(async () => {
    try {
      organisations = await getAllSurveyorOrganisations();
    } catch (error) {
      console.error('Failed to load organisations:', error);
    }
  });

  // When show becomes true and we have a quote, populate the form
  $: if (show && quote) {
    discipline = quote.discipline || '';
    organisation = quote.surveyor_organisation_id || '';
    contact = quote.contact_id || '';
    additionalNotes = quote.quote_notes || '';

    // Populate line items from quote
    if (quote.line_items && quote.line_items.length > 0) {
      lineItems = quote.line_items.map(item => ({
        id: item.id,
        stage: item.stage || '',
        item: item.item || '',
        description: item.description || '',
        cost: item.cost?.toString() || '',
        vatIncluded: item.vat_included === true,
        optional: item.is_optional === true,
        tbc: item.is_tbc === true
      }));
    } else {
      lineItems = [{ stage: '', item: '', description: '', cost: '', vatIncluded: true, optional: false, tbc: false }];
    }
  }

  // When organisation changes, update available contacts
  $: {
    if (organisation) {
      const selectedOrg = organisations.find(org => org.id === organisation);
      availableContacts = selectedOrg?.contacts || [];
      // Only reset contact if it's not in the new org (and we're not in initial load)
      if (contact && !availableContacts.find(c => c.id === contact)) {
        contact = '';
      }
    } else {
      availableContacts = [];
      contact = '';
    }
  }

  // Line total: cost plus 20% VAT when VAT included is ticked
  function lineTotal(item) {
    const cost = parseFloat(item.cost) || 0;
    return item.vatIncluded ? cost * 1.2 : cost;
  }

  // Reactive total calculation - updates automatically when lineItems change
  $: total = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);

  function addLineItem() {
    lineItems = [...lineItems, { stage: '', item: '', description: '', cost: '', vatIncluded: true, optional: false, tbc: false }];
  }

  function removeLineItem(index) {
    lineItems = lineItems.filter((_, i) => i !== index);
  }

  function handleSubmit() {
    // Validation
    if (!discipline) {
      alert('Please select a discipline');
      return;
    }
    if (!organisation) {
      alert('Please select an organisation');
      return;
    }

    // Prepare quote data for API
    const filteredLineItems = lineItems
      .filter(item => item.item || item.description || item.cost)
      .map(item => ({
        id: item.id, // Include ID for existing line items
        item: item.item,
        description: item.description,
        cost: parseFloat(item.cost) || 0,
        stage: item.stage?.trim() || null,
        is_optional: item.optional === true,
        is_tbc: item.tbc === true,
        vat_included: item.vatIncluded === true
      }));

    const updatedQuoteData = {
      id: quote.id,
      surveyor_organisation_id: organisation,
      contact_id: contact || null,
      discipline: discipline,
      total: total,
      quote_notes: additionalNotes || null,
      line_items: filteredLineItems
    };

    // Dispatch event with updated quote data
    dispatch('update', { quote: updatedQuoteData });
  }

  function handleClose() {
    // Reset form state
    discipline = '';
    organisation = '';
    contact = '';
    lineItems = [{ stage: '', item: '', description: '', cost: '', vatIncluded: true, optional: false, tbc: false }];
    additionalNotes = '';
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>
          <i class="las la-edit"></i>
          Edit Quote
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
            <option value="Heritage">Heritage</option>
            <option value="Landscape and Visual">Landscape and Visual</option>
            <option value="Ecology">Ecology</option>
            <option value="Flood and Drainage">Flood and Drainage</option>
            <option value="Transport">Transport</option>
            <option value="Arboriculture">Arboriculture</option>
            <option value="Noise">Noise</option>
            <option value="Glint & Glare">Glint & Glare</option>
            <option value="Agricultural Land">Agricultural Land</option>
          </select>
        </div>

        <!-- Organisation Field -->
        <div class="form-group">
          <label for="organisation">Organisation <span class="required">*</span></label>
          <select id="organisation" bind:value={organisation}>
            <option value="">Select an organisation...</option>
            {#each organisations as org}
              <option value={org.id}>{org.organisation} - {org.discipline}</option>
            {/each}
          </select>
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
              <th style="width: 11%;">Stage</th>
              <th style="width: 20%;">Item</th>
              <th style="width: 26%;">Description</th>
              <th style="width: 12%;">Cost (£ excl. VAT)</th>
              <th style="width: 6%;" class="vat-header">VAT</th>
              <th style="width: 6%;" class="vat-header">Opt</th>
              <th style="width: 6%;" class="vat-header">TBC</th>
              <th style="width: 9%;">Total (£)</th>
              <th style="width: 4%;"></th>
            </tr>
          </thead>
          <tbody>
            {#each lineItems as lineItem, index}
              <tr>
                <td>
                  <input
                    type="text"
                    bind:value={lineItem.stage}
                    placeholder="Stage"
                  />
                </td>
                <td>
                  <input
                    type="text"
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
                <td class="vat-cell">
                  <input
                    type="checkbox"
                    bind:checked={lineItem.vatIncluded}
                    title="VAT included (adds 20%)"
                  />
                </td>
                <td class="vat-cell">
                  <input
                    type="checkbox"
                    bind:checked={lineItem.optional}
                    title="Optional line item"
                  />
                </td>
                <td class="vat-cell">
                  <input
                    type="checkbox"
                    bind:checked={lineItem.tbc}
                    title="To be confirmed"
                  />
                </td>
                <td class="line-total-cell">
                  £{lineTotal(lineItem).toFixed(2)}
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
          <span class="total-label">Total:</span>
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
          Save Changes
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
    background: var(--overlay-bg);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px var(--overlay-bg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-header h2 i {
    font-size: 1.5rem;
    color: var(--color-primary-500);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
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
    color: var(--color-slate-600);
    font-size: 0.875rem;
  }

  .required {
    color: var(--color-red-500);
  }

  .form-group select,
  .form-group input,
  .form-group textarea {
    padding: 0.625rem;
    border: 1px solid var(--color-slate-300);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--color-slate-800);
    background: white;
    font-family: inherit;
  }

  .form-group select:focus,
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .form-group textarea {
    resize: vertical;
  }

  .section-divider {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid var(--color-slate-200);
  }

  .section-divider h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .line-items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .line-items-table thead tr {
    background: var(--color-slate-50);
    border-bottom: 2px solid var(--color-slate-200);
  }

  .line-items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-slate-600);
    font-size: 0.875rem;
  }

  .line-items-table tbody tr {
    border-bottom: 1px solid var(--color-slate-200);
  }

  .line-items-table td {
    padding: 0.75rem 0.5rem;
    vertical-align: middle;
  }

  .line-items-table input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-slate-300);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--color-slate-800);
    background: white;
    font-family: inherit;
    box-sizing: border-box;
    margin: 0;
  }

  .line-items-table input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
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

  .vat-header,
  .vat-cell {
    text-align: center;
  }

  .line-items-table .vat-cell input[type="checkbox"] {
    width: auto;
    cursor: pointer;
    accent-color: var(--color-primary-500);
    transform: scale(1.2);
  }

  .line-total-cell {
    font-weight: 600;
    color: var(--color-slate-800);
    white-space: nowrap;
  }

  .remove-line-btn {
    background: transparent;
    border: none;
    color: var(--color-red-500);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 1.125rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .remove-line-btn:hover {
    background: var(--color-red-100);
  }

  .add-line-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: var(--color-primary-500);
    border: 1px solid var(--color-primary-500);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .add-line-btn:hover {
    background: var(--color-primary-50);
  }

  .total-display {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-md);
  }

  .total-label {
    font-weight: 600;
    color: var(--color-primary-800);
    font-size: 1rem;
  }

  .total-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary-800);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-slate-200);
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
