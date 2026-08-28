<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let lineItems = [];
  export let discipline = '';
  export let organisation = '';
  
  // Track which items are selected
  let selectedItems = [];
  
  // Reset selections when modal opens
  $: if (show) {
    selectedItems = [];
  }
  
  function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
  
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
  
  function toggleItem(itemId) {
    if (selectedItems.includes(itemId)) {
      selectedItems = selectedItems.filter(id => id !== itemId);
    } else {
      selectedItems = [...selectedItems, itemId];
    }
  }
  
  function handleConfirm() {
    if (selectedItems.length === 0) {
      alert('Please select at least one line item to instruct');
      return;
    }
    dispatch('confirm', { selectedItems });
    handleClose();
  }
  
  // Line total: cost plus 20% VAT when the line has VAT included
  function lineTotal(item) {
    const cost = parseFloat(item.cost) || 0;
    return item.vat_included ? cost * 1.2 : cost;
  }

  // Calculate totals
  $: fullTotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  $: selectedTotal = lineItems
    .filter(item => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + lineTotal(item), 0);
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>Select Line Items to Instruct</h2>
          <p class="modal-subtitle">{discipline} - {organisation}</p>
        </div>
        <button class="close-btn" on:click={handleClose} aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>
      
      <div class="modal-body">
        {#if lineItems && lineItems.length > 0}
          <table class="line-items-table">
            <thead>
              <tr>
                <th class="checkbox-column">Select</th>
                <th>Item</th>
                <th>Description</th>
                <th class="cost-column">Total (incl. VAT where applicable)</th>
              </tr>
            </thead>
            <tbody>
              {#each lineItems as item}
                <tr class:selected={selectedItems.includes(item.id)}>
                  <td class="checkbox-column">
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(item.id)}
                      on:change={() => toggleItem(item.id)}
                      class="item-checkbox"
                    />
                  </td>
                  <td class="item-name">{item.item}</td>
                  <td class="item-description">{item.description || '-'}</td>
                  <td class="cost-column">{formatCurrency(lineTotal(item))}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" class="total-label">
                  {#if selectedItems.length > 0}
                    Selected Total ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
                  {:else}
                    Full Total
                  {/if}
                </td>
                <td class="cost-column total-amount">
                  {formatCurrency(selectedItems.length > 0 ? selectedTotal : fullTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        {:else}
          <p class="no-items">No line items available</p>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button 
          class="btn btn-primary" 
          on:click={handleConfirm}
          disabled={selectedItems.length === 0}
        >
          <i class="las la-check"></i>
          Confirm Partial Instruction ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  
  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-modal);
    max-width: 900px;
    width: 90%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }
  
  .modal-subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
  }
  
  .close-btn:hover {
    color: var(--color-slate-800);
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .line-items-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .line-items-table thead tr {
    background: var(--color-slate-50);
    border-bottom: 2px solid var(--color-slate-200);
  }
  
  .line-items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .checkbox-column {
    width: 60px;
    text-align: center;
  }
  
  .line-items-table tbody tr {
    border-bottom: 1px solid var(--color-slate-200);
    transition: background-color 0.15s;
  }
  
  .line-items-table tbody tr:hover {
    background: var(--color-slate-50);
  }
  
  .line-items-table tbody tr.selected {
    background: var(--color-primary-50);
  }
  
  .line-items-table tbody tr.selected:hover {
    background: var(--color-primary-100);
  }
  
  .line-items-table td {
    padding: 0.875rem 0.75rem;
    color: var(--color-slate-800);
  }
  
  .item-checkbox {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary-500);
  }
  
  .item-name {
    font-weight: 600;
  }
  
  .item-description {
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }
  
  .cost-column {
    text-align: right;
    white-space: nowrap;
  }
  
  .line-items-table tfoot {
    border-top: 2px solid var(--color-slate-200);
  }
  
  .total-row {
    background: var(--color-slate-50);
  }
  
  .total-row td {
    padding: 1rem 0.75rem;
    font-weight: 600;
  }
  
  .total-label {
    text-align: right;
    color: var(--color-slate-500);
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
  }
  
  .total-amount {
    font-size: 1.125rem;
    color: var(--color-slate-900);
  }
  
  .no-items {
    text-align: center;
    color: var(--color-slate-500);
    padding: 2rem;
    font-style: italic;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }
  
</style>
