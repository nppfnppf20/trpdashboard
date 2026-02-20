<script>
  import { createEventDispatcher } from 'svelte';
  import NotesModal from '$lib/components/shared/NotesModal.svelte';
  import ContactModal from '$lib/components/admin-console/ContactModal.svelte';
  import LineItemsModal from '$lib/components/admin-console/LineItemsModal.svelte';
  import AddQuoteModal from '$lib/components/quotes/AddQuoteModal.svelte';
  import EditProjectModal from '$lib/components/surveyor-management/EditProjectModal.svelte';
  import InstructedModal from '$lib/components/surveyor-briefings/InstructedModal.svelte';
  import NotInstructedModal from '$lib/components/surveyor-briefings/NotInstructedModal.svelte';
  import PartiallyInstructedModal from '$lib/components/surveyor-briefings/PartiallyInstructedModal.svelte';
  import { updateQuoteNotes } from '$lib/api/quotes.js';
  import '$lib/styles/tables.css';
  import '$lib/styles/badges.css';
  import '$lib/styles/buttons.css';

  export let quotes = [];
  export let loading = false;
  export let projectId = null;

  const dispatch = createEventDispatcher();

  // Internal modal state
  let showNotesModal = false;
  let showContactModal = false;
  let showLineItemsModal = false;
  let showAddQuoteModal = false;
  let showEditProjectModal = false;
  let showInstructedModal = false;
  let showNotInstructedModal = false;
  let showPartiallyInstructedModal = false;
  let selectedQuote = null;
  let editingQuote = null;
  let selectedContact = null;
  let pendingStatusChange = null;

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  }

  function getStatusClass(status) {
    return status ? status.replace(/\s+/g, '-') : 'pending';
  }

  function openContactModal(quote) {
    selectedContact = {
      name: quote.contact_name,
      email: quote.contact_email,
      phone: quote.contact_phone,
      is_primary: quote.is_primary
    };
    showContactModal = true;
  }

  function openLineItemsModal(quote) {
    selectedQuote = quote;
    showLineItemsModal = true;
  }

  function openNotesModal(quote) {
    selectedQuote = quote;
    showNotesModal = true;
  }

  async function handleSaveNotes(event) {
    if (selectedQuote) {
      try {
        // Call API to update notes
        await updateQuoteNotes(selectedQuote.id, event.detail.notes);
        
        // Update local data on success
        const index = quotes.findIndex(q => q.id === selectedQuote.id);
        if (index !== -1) {
          quotes[index].quote_notes = event.detail.notes;
          quotes = quotes; // Trigger reactivity
        }
      } catch (error) {
        console.error('Failed to save notes:', error);
        alert('Failed to save notes: ' + error.message);
        return; // Don't close modal on error
      }
    }
    showNotesModal = false;
    selectedQuote = null;
  }

  function handleStatusChange(quoteId, newStatus) {
    const quote = quotes.find(q => q.id === quoteId);
    
    // If changing to "instructed", show confirmation modal
    if (newStatus === 'instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // If changing to "will not be instructed", show not instructed modal
    if (newStatus === 'will not be instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showNotInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // If changing to "partially instructed", show line items selection modal
    if (newStatus === 'partially instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showPartiallyInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // For other statuses, dispatch immediately
    dispatch('statusChange', { quoteId, newStatus });
  }

  function handleInstructedConfirm() {
    if (pendingStatusChange) {
      dispatch('statusChange', pendingStatusChange);
      pendingStatusChange = null;
    }
    showInstructedModal = false;
    selectedQuote = null;
  }

  function handleInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showInstructedModal = false;
    selectedQuote = null;
  }

  function handleNotInstructedConfirm() {
    if (pendingStatusChange) {
      dispatch('statusChange', pendingStatusChange);
      pendingStatusChange = null;
    }
    showNotInstructedModal = false;
    selectedQuote = null;
  }

  function handleNotInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showNotInstructedModal = false;
    selectedQuote = null;
  }

  function handlePartiallyInstructedConfirm(event) {
    if (pendingStatusChange) {
      // Include the selected line items in the dispatch
      dispatch('statusChange', { 
        ...pendingStatusChange, 
        selectedLineItems: event.detail.selectedItems 
      });
      pendingStatusChange = null;
    }
    showPartiallyInstructedModal = false;
    selectedQuote = null;
  }

  function handlePartiallyInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showPartiallyInstructedModal = false;
    selectedQuote = null;
  }

  function handleEdit(quote) {
    editingQuote = quote;
    showEditProjectModal = true;
  }

  function handleEditQuoteUpdate(event) {
    // Dispatch the update event to parent for API call
    dispatch('updateQuote', { quote: event.detail.quote });
    showEditProjectModal = false;
    editingQuote = null;
  }

  function handleEditQuoteClose() {
    showEditProjectModal = false;
    editingQuote = null;
  }

  function handleDelete(quote) {
    dispatch('deleteQuote', { quote });
  }

  function openAddQuoteModal() {
    if (!projectId) {
      alert('Please select a project first');
      return;
    }
    showAddQuoteModal = true;
  }

  function handleAddQuote(event) {
    const newQuote = event.detail.quote;
    // Dispatch to parent so it updates its quotes array
    dispatch('addQuote', { quote: newQuote });
  }
</script>

<div class="content-panel">
  <div class="panel-header">
    <h2>Surveyor Quotes</h2>
    <button class="btn btn-primary" on:click={openAddQuoteModal}>
      <i class="las la-plus"></i>
      New Quote
    </button>
  </div>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading quotes...</p>
    </div>
  {:else if quotes.length === 0}
    <p class="empty">No quotes for this project yet</p>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Discipline</th>
            <th>Organisation</th>
            <th>Contact Name</th>
            <th>Line Items</th>
            <th>Total (excl. VAT)</th>
            <th>Instruction Status</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each quotes as quote}
            <tr>
              <td>{quote.discipline}</td>
              <td>{quote.surveyor_organisation}</td>
              <td>
                {#if quote.contact_name}
                  <button
                    class="contact-link"
                    on:click={() => openContactModal(quote)}
                    title="View contact details"
                  >
                    {quote.contact_name}
                    <i class="las la-external-link-alt"></i>
                  </button>
                {:else}
                  <span class="text-muted">-</span>
                {/if}
              </td>
              <td>
                {#if quote.line_items && quote.line_items.length > 0}
                  <button
                    class="count-badge clickable"
                    on:click={() => openLineItemsModal(quote)}
                    title="Click to view line items"
                  >
                    {quote.line_items.length}
                  </button>
                {:else}
                  <span class="count-badge">0</span>
                {/if}
              </td>
              <td class="text-bold">{formatCurrency(quote.total)}</td>
              <td>
                <select
                  class="badge-select badge-select-{getStatusClass(quote.instruction_status)}"
                  value={quote.instruction_status}
                  on:change={(e) => handleStatusChange(quote.id, e.target.value)}
                >
                  <option value="pending">pending</option>
                  <option value="instructed">instructed</option>
                  <option value="partially instructed">partially instructed</option>
                  <option value="will not be instructed">will not be instructed</option>
                </select>
              </td>
              <td class="notes-cell-compact">
                {#if quote.quote_notes}
                  <button class="notes-link" on:click={() => openNotesModal(quote)} title={quote.quote_notes}>
                    <span class="notes-preview">{quote.quote_notes}</span>
                  </button>
                {:else}
                  <button class="notes-link empty" on:click={() => openNotesModal(quote)}>
                    Click to add
                  </button>
                {/if}
              </td>
              <td class="actions-cell">
                <button
                  class="action-btn edit-btn"
                  on:click={() => handleEdit(quote)}
                  title="Edit quote"
                >
                  <i class="las la-edit"></i>
                </button>
                <button
                  class="action-btn delete-btn"
                  on:click={() => handleDelete(quote)}
                  title="Delete quote"
                >
                  <i class="las la-trash"></i>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Notes Modal -->
<NotesModal
  show={showNotesModal}
  title="Quote Notes - {selectedQuote?.surveyor_organisation || ''}"
  notes={selectedQuote?.quote_notes || ''}
  on:save={handleSaveNotes}
  on:close={() => { showNotesModal = false; selectedQuote = null; }}
/>

<!-- Contact Modal -->
<ContactModal
  bind:show={showContactModal}
  contact={selectedContact}
  on:close={() => { showContactModal = false; selectedContact = null; }}
/>

<!-- Line Items Modal -->
<LineItemsModal
  bind:show={showLineItemsModal}
  lineItems={selectedQuote?.line_items || []}
  discipline={selectedQuote?.discipline || ''}
  organisation={selectedQuote?.surveyor_organisation || ''}
  on:close={() => { showLineItemsModal = false; selectedQuote = null; }}
/>

<!-- Add Quote Modal -->
<AddQuoteModal
  show={showAddQuoteModal}
  {projectId}
  on:save={handleAddQuote}
  on:close={() => showAddQuoteModal = false}
/>

<!-- Edit Quote Modal -->
<EditProjectModal
  show={showEditProjectModal}
  quote={editingQuote}
  on:update={handleEditQuoteUpdate}
  on:close={handleEditQuoteClose}
/>

<!-- Instructed Confirmation Modal -->
<InstructedModal
  show={showInstructedModal}
  quote={selectedQuote}
  on:confirm={handleInstructedConfirm}
  on:close={handleInstructedClose}
/>

<!-- Not Instructed Modal -->
<NotInstructedModal
  show={showNotInstructedModal}
  quote={selectedQuote}
  on:confirm={handleNotInstructedConfirm}
  on:close={handleNotInstructedClose}
/>

<!-- Partially Instructed Modal -->
<PartiallyInstructedModal
  show={showPartiallyInstructedModal}
  lineItems={selectedQuote?.line_items || []}
  discipline={selectedQuote?.discipline || ''}
  organisation={selectedQuote?.surveyor_organisation || ''}
  on:confirm={handlePartiallyInstructedConfirm}
  on:close={handlePartiallyInstructedClose}
/>

<style>
  .content-panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .contact-link {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .contact-link:hover {
    color: #2563eb;
  }

  .contact-link i {
    font-size: 0.875rem;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    background: #f1f5f9;
    color: #475569;
    border: none;
    border-radius: 6px;
    font-weight: normal;
    font-size: inherit;
  }

  .count-badge.clickable {
    cursor: pointer;
    transition: all 0.2s;
  }

  .count-badge.clickable:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .text-muted {
    color: #94a3b8;
  }

  .notes-cell-compact {
    padding: 0.75rem 0.5rem !important;
  }

  .notes-link {
    background: white;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 250px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .notes-link:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .notes-link.empty {
    color: #94a3b8;
    font-style: italic;
    border-style: dashed;
  }

  .notes-link.empty:hover {
    background: #f8fafc;
    color: #3b82f6;
    font-style: normal;
    border-style: solid;
  }

  .notes-link i {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .notes-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
</style>
