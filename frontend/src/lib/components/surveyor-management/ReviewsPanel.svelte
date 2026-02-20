<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import StarRating from '$lib/components/admin-console/StarRating.svelte';
  import ContactModal from '$lib/components/admin-console/ContactModal.svelte';
  import NotesModal from '$lib/components/shared/NotesModal.svelte';
  import { updateQuoteReview } from '$lib/api/quotes.js';
  import '$lib/styles/tables.css';
  import '$lib/styles/buttons.css';

  export let quotes = [];
  export let loading = false;

  const dispatch = createEventDispatcher();

  // Internal modal state
  let showContactModal = false;
  let showReviewNotesModal = false;
  let selectedContact = null;
  let selectedQuote = null;

  // Auto-save state
  let pendingSaves = new Map(); // quoteId -> timeout
  let savingQuoteIds = new Set();
  let lastSaved = null;
  const AUTO_SAVE_DELAY = 2000; // 2 seconds after last change

  $: isSaving = savingQuoteIds.size > 0;

  function openContactModal(quote) {
    selectedContact = {
      name: quote.contact_name,
      email: quote.contact_email,
      phone: quote.contact_phone,
      is_primary: quote.is_primary
    };
    showContactModal = true;
  }

  function openReviewNotesModal(quote) {
    selectedQuote = quote;
    showReviewNotesModal = true;
  }

  function handleSaveReviewNotes(event) {
    if (selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        quotes[index].review_notes = event.detail.notes;
        quotes = quotes;
        scheduleAutoSave(selectedQuote.id);
      }
    }
    showReviewNotesModal = false;
    selectedQuote = null;
  }

  function handleRatingChange(quoteId, field, rating) {
    const index = quotes.findIndex(q => q.id === quoteId);
    if (index !== -1) {
      quotes[index][field] = rating;
      quotes = quotes;
      scheduleAutoSave(quoteId);
    }
  }

  function scheduleAutoSave(quoteId) {
    // Clear existing timer for this quote
    if (pendingSaves.has(quoteId)) {
      clearTimeout(pendingSaves.get(quoteId));
    }

    // Schedule new save
    const timer = setTimeout(() => {
      saveQuoteReview(quoteId);
      pendingSaves.delete(quoteId);
    }, AUTO_SAVE_DELAY);

    pendingSaves.set(quoteId, timer);
    pendingSaves = pendingSaves; // Trigger reactivity
  }

  async function saveQuoteReview(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    savingQuoteIds.add(quoteId);
    savingQuoteIds = savingQuoteIds;

    try {
      await updateQuoteReview(quoteId, {
        quality: quote.quality,
        responsiveness: quote.responsiveness,
        delivered_on_time: quote.delivered_on_time,
        overall_review: quote.overall_review,
        review_notes: quote.review_notes
      });
      lastSaved = new Date();
    } catch (err) {
      console.error(`Error auto-saving review for quote ${quoteId}:`, err);
    } finally {
      savingQuoteIds.delete(quoteId);
      savingQuoteIds = savingQuoteIds;
    }
  }

  async function handleResetReview(quote) {
    const confirmed = confirm(`Reset review for ${quote.discipline} - ${quote.surveyor_organisation}?\n\nThis will clear all ratings and notes.`);
    if (!confirmed) return;

    // Clear any pending save for this quote
    if (pendingSaves.has(quote.id)) {
      clearTimeout(pendingSaves.get(quote.id));
      pendingSaves.delete(quote.id);
    }

    try {
      await updateQuoteReview(quote.id, {
        quality: null,
        responsiveness: null,
        delivered_on_time: null,
        overall_review: null,
        review_notes: null
      });

      // Update local state
      const index = quotes.findIndex(q => q.id === quote.id);
      if (index !== -1) {
        quotes[index].quality = null;
        quotes[index].responsiveness = null;
        quotes[index].delivered_on_time = null;
        quotes[index].overall_review = null;
        quotes[index].review_notes = null;
        quotes = quotes;
      }

      lastSaved = new Date();
    } catch (err) {
      console.error('Error resetting review:', err);
      alert('Failed to reset review: ' + err.message);
    }
  }

  function formatLastSaved() {
    if (!lastSaved) return '';

    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return lastSaved.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // Update "X min ago" display periodically
  let timeUpdateInterval;
  onMount(() => {
    timeUpdateInterval = setInterval(() => {
      if (lastSaved) lastSaved = lastSaved; // Trigger reactivity
    }, 60000);
  });

  // Cleanup pending saves on destroy
  onDestroy(() => {
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    // Save any pending changes immediately
    for (const [quoteId, timer] of pendingSaves) {
      clearTimeout(timer);
      saveQuoteReview(quoteId);
    }
  });
</script>

<div class="content-panel">
  <div class="panel-header">
    <div class="header-left">
      <h2>Surveyor Reviews</h2>
      {#if isSaving}
        <span class="saving-indicator">
          <i class="las la-spinner la-spin"></i>
          Saving...
        </span>
      {:else if lastSaved}
        <span class="last-saved">
          <i class="las la-check-circle"></i>
          Saved {formatLastSaved()}
        </span>
      {/if}
    </div>
  </div>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if quotes.length === 0}
    <p class="empty">No instructed surveyors yet</p>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Discipline</th>
            <th>Organisation</th>
            <th>Contact</th>
            <th>Quality</th>
            <th>Responsiveness</th>
            <th>On Time</th>
            <th>Overall</th>
            <th>Review Notes</th>
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
                <StarRating 
                  rating={parseFloat(quote.quality) || 0} 
                  on:change={(e) => handleRatingChange(quote.id, 'quality', e.detail.rating)}
                />
              </td>
              <td>
                <StarRating 
                  rating={parseFloat(quote.responsiveness) || 0}
                  on:change={(e) => handleRatingChange(quote.id, 'responsiveness', e.detail.rating)}
                />
              </td>
              <td>
                <StarRating 
                  rating={parseFloat(quote.delivered_on_time) || 0}
                  on:change={(e) => handleRatingChange(quote.id, 'delivered_on_time', e.detail.rating)}
                />
              </td>
              <td>
                <StarRating 
                  rating={parseFloat(quote.overall_review) || 0}
                  on:change={(e) => handleRatingChange(quote.id, 'overall_review', e.detail.rating)}
                />
              </td>
              <td class="notes-cell-compact">
                {#if quote.review_notes}
                  <button class="notes-link" on:click={() => openReviewNotesModal(quote)} title={quote.review_notes}>
                    <span class="notes-preview">{quote.review_notes}</span>
                  </button>
                {:else}
                  <button class="notes-link empty" on:click={() => openReviewNotesModal(quote)}>
                    Click to add
                  </button>
                {/if}
              </td>
              <td class="actions-cell">
                <button class="action-btn reset-btn" on:click={() => handleResetReview(quote)} title="Reset Review">
                  <i class="las la-undo-alt"></i>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Review Notes Modal -->
<NotesModal
  show={showReviewNotesModal}
  title="Review Notes - {selectedQuote?.discipline || ''}"
  notes={selectedQuote?.review_notes || ''}
  on:save={handleSaveReviewNotes}
  on:close={() => { showReviewNotesModal = false; selectedQuote = null; }}
/>

<!-- Contact Modal -->
<ContactModal
  bind:show={showContactModal}
  contact={selectedContact}
  on:close={() => { showContactModal = false; selectedContact = null; }}
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .saving-indicator {
    font-size: 0.75rem;
    color: #3b82f6;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .last-saved {
    font-size: 0.75rem;
    color: #10b981;
    display: flex;
    align-items: center;
    gap: 0.25rem;
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

  /* Actions column styling */
  :global(td.actions-cell) {
    white-space: nowrap;
    width: 1%;
    text-align: center;
  }

  :global(.action-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 0.5rem;
    border: 1px solid #e2e8f0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 1rem;
    color: #64748b;
    margin-right: 0.25rem;
  }

  :global(.action-btn:last-child) {
    margin-right: 0;
  }

  :global(.action-btn:hover) {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  :global(.reset-btn:hover) {
    color: #f59e0b;
    border-color: #f59e0b;
  }
</style>
