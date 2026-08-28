<script>
  // Read-only line items table with totals — extracted from LineItemsModal so
  // the modal can render two side by side in compare mode.
  export let lineItems = [];
  export let instructionStatus = '';
  export let compact = false;   // tighter spacing for side-by-side compare panes

  function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  }

  // Line total: cost plus 20% VAT when the line has VAT included
  function lineTotal(item) {
    const cost = parseFloat(item.cost) || 0;
    return item.vat_included ? cost * 1.2 : cost;
  }

  $: total = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  $: instructedTotal = lineItems.filter(item => item.is_instructed).reduce((sum, item) => sum + lineTotal(item), 0);
  $: isPartiallyInstructed = instructionStatus === 'partially instructed';
</script>

{#if lineItems && lineItems.length > 0}
  <table class="line-items-table" class:compact>
    <thead>
      <tr>
        {#if isPartiallyInstructed}
          <th class="status-column">Status</th>
        {/if}
        <th>Stage</th>
        <th>Item</th>
        <th>Description</th>
        <th class="cost-column">Cost (excl. VAT)</th>
        <th class="vat-column">VAT</th>
        <th class="vat-column">Opt</th>
        <th class="vat-column">TBC</th>
        <th class="cost-column">Total</th>
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
          <td class="item-description">{item.stage || '-'}</td>
          <td class="item-name">{item.item}</td>
          <td class="item-description">{item.description || '-'}</td>
          <td class="cost-column">{formatCurrency(item.cost)}</td>
          <td class="vat-column">
            {#if item.vat_included}
              <i class="las la-check"></i>
            {:else}
              -
            {/if}
          </td>
          <td class="vat-column">
            {#if item.is_optional}
              <i class="las la-check"></i>
            {:else}
              -
            {/if}
          </td>
          <td class="vat-column">
            {#if item.is_tbc}
              <i class="las la-check"></i>
            {:else}
              -
            {/if}
          </td>
          <td class="cost-column">{formatCurrency(lineTotal(item))}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      {#if isPartiallyInstructed}
        <tr class="subtotal-row">
          <td colspan={isPartiallyInstructed ? 8 : 7} class="total-label">Instructed Total</td>
          <td class="cost-column subtotal-amount">{formatCurrency(instructedTotal)}</td>
        </tr>
      {/if}
      <tr class="total-row">
        <td colspan={isPartiallyInstructed ? 8 : 7} class="total-label">Quote Total</td>
        <td class="cost-column total-amount">{formatCurrency(total)}</td>
      </tr>
    </tfoot>
  </table>
{:else}
  <p class="no-items">No line items available</p>
{/if}

<style>
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

  .line-items-table tbody tr {
    border-bottom: 1px solid var(--color-slate-200);
  }

  .line-items-table tbody tr:hover {
    background: var(--color-slate-50);
  }

  .line-items-table td {
    padding: 0.875rem 0.75rem;
    color: var(--color-slate-800);
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

  .vat-column {
    text-align: center;
    white-space: nowrap;
    color: var(--color-emerald-600);
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
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .status-badge.instructed i {
    font-size: 0.875rem;
  }

  .status-badge.not-instructed {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }

  tr.not-instructed {
    opacity: 0.6;
  }

  tr.not-instructed td {
    color: var(--color-slate-400);
  }

  .subtotal-row {
    background: var(--color-badge-success-bg);
  }

  .subtotal-row td {
    padding: 0.75rem;
    font-weight: 500;
  }

  .subtotal-amount {
    color: var(--color-badge-success-fg);
    font-weight: 600;
  }

  /* Compact mode for side-by-side compare panes */
  .line-items-table.compact th {
    padding: 0.5rem 0.5rem;
    font-size: 0.72rem;
  }

  .line-items-table.compact td {
    padding: 0.55rem 0.5rem;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .line-items-table.compact .item-description {
    font-size: 0.76rem;
  }

  .line-items-table.compact .total-row td {
    padding: 0.7rem 0.5rem;
  }

  .line-items-table.compact .total-amount {
    font-size: 0.95rem;
  }

  .line-items-table.compact .total-label {
    font-size: 0.72rem;
  }
</style>
