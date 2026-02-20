<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let lineItems = [];
  export let discipline = '';
  export let organisation = '';
  export let instructionStatus = '';

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

  $: total = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  $: instructedTotal = lineItems.filter(item => item.is_instructed).reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  $: isPartiallyInstructed = instructionStatus === 'partially instructed';
  $: hasInstructedItems = lineItems.some(item => item.is_instructed);
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>Quote Line Items</h2>
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
                {#if isPartiallyInstructed}
                  <th class="status-column">Status</th>
                {/if}
                <th>Item</th>
                <th>Description</th>
                <th class="cost-column">Cost</th>
              </tr>
            </thead>
            <tbody>
              {#each lineItems as item}
                <tr class:not-instructed={isPartiallyInstructed && !item.is_instructed}>
                  {#if isPartiallyInstructed}
                    <td class="status-column">
                      {#if item.is_instructed}
                        <span class="status-badge instructed">
                          <i class="las la-check"></i> Instructed
                        </span>
                      {:else}
                        <span class="status-badge not-instructed">
                          Not Instructed
                        </span>
                      {/if}
                    </td>
                  {/if}
                  <td class="item-name">{item.item}</td>
                  <td class="item-description">{item.description || '-'}</td>
                  <td class="cost-column">{formatCurrency(item.cost)}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              {#if isPartiallyInstructed}
                <tr class="subtotal-row">
                  <td colspan={isPartiallyInstructed ? 3 : 2} class="total-label">Instructed Total</td>
                  <td class="cost-column subtotal-amount">{formatCurrency(instructedTotal)}</td>
                </tr>
              {/if}
              <tr class="total-row">
                <td colspan={isPartiallyInstructed ? 3 : 2} class="total-label">Quote Total (excl. VAT)</td>
                <td class="cost-column total-amount">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        {:else}
          <p class="no-items">No line items available</p>
        {/if}
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
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
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
  
  .line-items-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
  }
  
  .line-items-table tbody tr:hover {
    background: #f8fafc;
  }
  
  .line-items-table td {
    padding: 0.875rem 0.75rem;
    color: #1e293b;
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

  .status-column {
    width: 120px;
    white-space: nowrap;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.instructed {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.instructed i {
    font-size: 0.875rem;
  }

  .status-badge.not-instructed {
    background: #f1f5f9;
    color: #64748b;
  }

  tr.not-instructed {
    opacity: 0.6;
  }

  tr.not-instructed td {
    color: #94a3b8;
  }

  .subtotal-row {
    background: #ecfdf5;
  }

  .subtotal-row td {
    padding: 0.75rem;
    font-weight: 500;
  }

  .subtotal-amount {
    color: #065f46;
    font-weight: 600;
  }
</style>
