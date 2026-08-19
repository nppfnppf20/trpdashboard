<script>
  import { createEventDispatcher } from 'svelte';
  import LineItemsTable from './LineItemsTable.svelte';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let lineItems = [];
  export let discipline = '';
  export let organisation = '';
  export let instructionStatus = '';
  // Optional: enables compare mode. Pass the project's quotes (with line_items)
  // and the id of the quote being viewed.
  export let allQuotes = [];
  export let quoteId = null;

  // Compare slots: each entry is a chosen quote id, or '' while unpicked.
  let compareSlots = [];
  $: comparing = compareSlots.length > 0;

  // Other quotes to offer: same discipline first, then the rest
  $: otherQuotes = allQuotes
    .filter(q => q.id !== quoteId)
    .sort((a, b) => {
      const sameA = (a.discipline || '') === discipline ? 0 : 1;
      const sameB = (b.discipline || '') === discipline ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      return (a.discipline || '').localeCompare(b.discipline || '')
        || (a.surveyor_organisation || '').localeCompare(b.surveyor_organisation || '');
    });

  // Quotes still available to add to a new slot
  $: unchosenQuotes = otherQuotes.filter(q => !compareSlots.includes(q.id));

  function optionsForSlot(index) {
    // Exclude quotes picked in the other slots, keep this slot's own pick
    return otherQuotes.filter(q => q.id === compareSlots[index] || !compareSlots.includes(q.id));
  }

  function slotQuote(id) {
    return otherQuotes.find(q => q.id === id) || null;
  }

  function quoteLabel(q) {
    const fee = q.total != null ? ` - £${Number(q.total).toLocaleString('en-GB')}` : '';
    return `${q.discipline || 'Unknown discipline'} · ${q.surveyor_organisation || 'Unknown surveyor'}${fee}`;
  }

  function startCompare() {
    // Preselect the first same-discipline quote if there is one
    const first = otherQuotes.length && (otherQuotes[0].discipline || '') === discipline
      ? otherQuotes[0].id
      : '';
    compareSlots = [first];
  }

  function addSlot() {
    compareSlots = [...compareSlots, ''];
  }

  function removeSlot(index) {
    compareSlots = compareSlots.filter((_, i) => i !== index);
  }

  function stopCompare() {
    compareSlots = [];
  }

  function handleClose() {
    show = false;
    stopCompare();
    dispatch('close');
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-content" class:wide={comparing} on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>{comparing ? 'Compare Quotes' : 'Quote Line Items'}</h2>
          {#if !comparing}
            <p class="modal-subtitle">{discipline} - {organisation}</p>
          {/if}
        </div>
        <div class="header-actions">
          {#if !comparing && otherQuotes.length}
            <button class="compare-btn" on:click={startCompare} title="Open another quote alongside to compare">
              <i class="las la-columns"></i> Compare
            </button>
          {/if}
          {#if comparing && unchosenQuotes.length && !compareSlots.includes('')}
            <button class="compare-btn" on:click={addSlot} title="Add another quote to the comparison">
              <i class="las la-plus"></i> Add quote
            </button>
          {/if}
          <button class="close-btn" on:click={handleClose} aria-label="Close">
            <i class="las la-times"></i>
          </button>
        </div>
      </div>

      <div class="modal-body" class:comparing>
        {#if comparing}
          <div class="compare-grid">
            <div class="compare-col">
              <div class="compare-col-header">
                <span class="compare-col-title" title="{discipline} · {organisation}">{discipline} · {organisation}</span>
              </div>
              <div class="compare-col-body">
                <LineItemsTable {lineItems} {instructionStatus} compact />
              </div>
            </div>

            {#each compareSlots as slotId, i (i)}
              {@const q = slotQuote(slotId)}
              <div class="compare-col">
                <div class="compare-col-header">
                  <select class="compare-select" bind:value={compareSlots[i]}>
                    <option value="">Choose a quote to compare…</option>
                    {#each optionsForSlot(i) as opt (opt.id)}
                      <option value={opt.id}>{quoteLabel(opt)}</option>
                    {/each}
                  </select>
                  <button class="compare-close" on:click={() => removeSlot(i)} title="Remove this quote from the comparison">
                    <i class="las la-times"></i>
                  </button>
                </div>
                <div class="compare-col-body">
                  {#if q}
                    <LineItemsTable
                      lineItems={q.line_items || []}
                      instructionStatus={q.instruction_status || ''}
                      compact
                    />
                  {:else}
                    <p class="compare-placeholder">
                      <i class="las la-columns"></i><br />
                      Pick a quote above to see its line items here.
                    </p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <LineItemsTable {lineItems} {instructionStatus} />
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
    transition: max-width 0.2s ease;
  }

  .modal-content.wide {
    max-width: 1600px;
    width: 96%;
    max-height: 90vh;
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .compare-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid #cbd5e1;
    background: white;
    color: #475569;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .compare-btn:hover {
    border-color: #3b82f6;
    color: #2563eb;
    background: #eff6ff;
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

  /* In compare mode the body also scrolls horizontally when panes overflow */
  .modal-body.comparing {
    overflow-x: auto;
  }

  /* Compare mode */
  .compare-grid {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .compare-col {
    flex: 1 1 0;
    min-width: 380px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .compare-col-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    min-height: 2.9rem;
    box-sizing: border-box;
  }

  .compare-col-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Each pane scrolls its own table sideways rather than squashing text */
  .compare-col-body {
    overflow-x: auto;
    padding: 0.25rem;
  }

  .compare-select {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.82rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
  }

  .compare-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px #dbeafe;
  }

  .compare-close {
    background: none;
    border: none;
    color: #64748b;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    line-height: 1;
    flex-shrink: 0;
  }

  .compare-close:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .compare-placeholder {
    margin: 0;
    padding: 3rem 1rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.875rem;
    line-height: 1.8;
  }

  .compare-placeholder i {
    font-size: 2rem;
    color: #cbd5e1;
  }
</style>
