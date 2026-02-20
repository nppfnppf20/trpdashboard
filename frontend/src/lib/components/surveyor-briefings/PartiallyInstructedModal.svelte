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
  
  // Calculate totals
  $: fullTotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  $: selectedTotal = lineItems
    .filter(item => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
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
                <th class="cost-column">Cost</th>
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
                  <td class="cost-column">{formatCurrency(item.cost)}</td>
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  
  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
    border-bottom: 1px solid #e2e8f0;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
  }
  
  .modal-subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: #64748b;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
  }
  
  .close-btn:hover {
    color: #1e293b;
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
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }
  
  .line-items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .checkbox-column {
    width: 60px;
    text-align: center;
  }
  
  .line-items-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
    transition: background-color 0.15s;
  }
  
  .line-items-table tbody tr:hover {
    background: #f8fafc;
  }
  
  .line-items-table tbody tr.selected {
    background: #eff6ff;
  }
  
  .line-items-table tbody tr.selected:hover {
    background: #dbeafe;
  }
  
  .line-items-table td {
    padding: 0.875rem 0.75rem;
    color: #1e293b;
  }
  
  .item-checkbox {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: #3b82f6;
  }
  
  .item-name {
    font-weight: 600;
  }
  
  .item-description {
    color: #64748b;
    font-size: 0.875rem;
  }
  
  .cost-column {
    text-align: right;
    white-space: nowrap;
  }
  
  .line-items-table tfoot {
    border-top: 2px solid #e2e8f0;
  }
  
  .total-row {
    background: #f8fafc;
  }
  
  .total-row td {
    padding: 1rem 0.75rem;
    font-weight: 600;
  }
  
  .total-label {
    text-align: right;
    color: #64748b;
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
  }
  
  .total-amount {
    font-size: 1.125rem;
    color: #0f172a;
  }
  
  .no-items {
    text-align: center;
    color: #64748b;
    padding: 2rem;
    font-style: italic;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
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
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #f1f5f9;
  }
</style>
