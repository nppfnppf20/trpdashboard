<script>
  import InstructedSurveyorsPanel from '$lib/components/surveyor-management/InstructedSurveyorsPanel.svelte';
  import QuotesPanel from '$lib/components/surveyor-management/QuotesPanel.svelte';
  import ReviewsPanel from '$lib/components/surveyor-management/ReviewsPanel.svelte';
  import {
    getQuotes,
    getQuoteKeyDates,
    getProgrammeEvents,
    updateQuoteInstructionStatus,
    updateQuoteWorkStatus,
    updateQuote,
    deleteQuote
  } from '$lib/api/quotes.js';

  // The Quotes / Instructed / Reviews panels plus the data loading and handlers behind them.
  // Shared by the full Surveyor Management page (SurveyorWorkspace) and the Surveyor Management
  // modal opened from the overview widget, so the logic lives in one place.
  export let project;
  export let activeTab = 'quotes'; // 'quotes' | 'instructed' | 'reviews' — anything else renders nothing

  let quotes = [];
  let quoteKeyDates = [];
  let programmeEvents = [];
  let loading = false;
  let loadedForId = null;

  $: if (project?.unique_id && project.unique_id !== loadedForId) {
    loadedForId = project.unique_id;
    loadQuotes(project.unique_id);
    loadQuoteKeyDates(project.unique_id);
    loadProgrammeEvents(project.unique_id);
  } else if (!project) {
    loadedForId = null;
    quotes = [];
    quoteKeyDates = [];
    programmeEvents = [];
  }

  async function loadQuotes(projectId) {
    loading = true;
    try {
      quotes = await getQuotes({ projectId });
    } catch (err) {
      console.error('Error loading quotes:', err);
    } finally {
      loading = false;
    }
  }

  async function loadQuoteKeyDates(projectId) {
    try {
      quoteKeyDates = await getQuoteKeyDates(projectId);
    } catch (err) {
      console.error('Error loading quote key dates:', err);
    }
  }

  async function loadProgrammeEvents(projectId) {
    try {
      programmeEvents = await getProgrammeEvents(projectId);
    } catch (err) {
      console.error('Error loading programme events:', err);
    }
  }

  // QuotesPanel event handlers
  async function handleStatusChange(event) {
    const { quoteId, newStatus, selectedLineItems } = event.detail;

    try {
      // Call API to update instruction status
      await updateQuoteInstructionStatus(quoteId, newStatus, selectedLineItems);

      // Calculate partially instructed total if applicable
      let partiallyInstructedTotal = null;
      if (newStatus === 'partially instructed' && selectedLineItems) {
        const quote = quotes.find(q => q.id === quoteId);
        if (quote && quote.line_items) {
          partiallyInstructedTotal = quote.line_items
            .filter(item => selectedLineItems.includes(item.id))
            .reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
        }
      }

      // Update local data on success
      quotes = quotes.map(q =>
        q.id === quoteId ? {
          ...q,
          instruction_status: newStatus,
          partially_instructed_total: partiallyInstructedTotal
        } : q
      );

      console.log('Status changed for quote:', quoteId, 'to:', newStatus);
    } catch (error) {
      console.error('Failed to update instruction status:', error);
      alert('Failed to update instruction status: ' + error.message);
    }
  }

  async function handleUpdateQuoteEvent(event) {
    const quoteData = event.detail.quote;

    try {
      // Call API to update quote
      const updatedQuote = await updateQuote(quoteData.id, quoteData);

      // Update local data with the returned quote
      quotes = quotes.map(q => q.id === updatedQuote.id ? updatedQuote : q);

      console.log('Quote updated successfully:', updatedQuote.id);
    } catch (error) {
      console.error('Failed to update quote:', error);
      alert('Failed to update quote: ' + error.message);
    }
  }

  async function handleDeleteQuoteEvent(event) {
    const quote = event.detail.quote;

    if (confirm(`Are you sure you want to delete the quote from ${quote.surveyor_organisation}?`)) {
      try {
        // Call API to delete quote
        await deleteQuote(quote.id);

        // Remove from local data on success
        quotes = quotes.filter(q => q.id !== quote.id);

        console.log('Quote deleted successfully:', quote.id);
      } catch (error) {
        console.error('Failed to delete quote:', error);
        alert('Failed to delete quote: ' + error.message);
      }
    }
  }

  function handleAddQuoteEvent(event) {
    const newQuote = event.detail.quote;
    // Add to the parent's quotes array so it persists through other state changes
    quotes = [newQuote, ...quotes];
  }

  // InstructedSurveyorsPanel event handlers
  async function handleWorkStatusChange(event) {
    const { quoteId, newStatus } = event.detail;

    try {
      await updateQuoteWorkStatus(quoteId, newStatus);

      // Update local data on success
      quotes = quotes.map(q =>
        q.id === quoteId ? { ...q, work_status: newStatus } : q
      );

      console.log('Work status changed for quote:', quoteId, 'to:', newStatus);
    } catch (error) {
      console.error('Failed to update work status:', error);
      alert('Failed to update work status: ' + error.message);
    }
  }

  $: instructedQuotes = quotes.filter(
    q => q.instruction_status === 'instructed' || q.instruction_status === 'partially instructed'
  );
</script>

{#if activeTab === 'quotes'}
  <QuotesPanel
    {quotes}
    {loading}
    projectId={project?.unique_id}
    {project}
    on:statusChange={handleStatusChange}
    on:updateQuote={handleUpdateQuoteEvent}
    on:deleteQuote={handleDeleteQuoteEvent}
    on:addQuote={handleAddQuoteEvent}
  />

{:else if activeTab === 'instructed'}
  <InstructedSurveyorsPanel
    quotes={instructedQuotes}
    {loading}
    projectId={project?.unique_id}
    {project}
    {quoteKeyDates}
    {programmeEvents}
    on:workStatusChange={handleWorkStatusChange}
  />

{:else if activeTab === 'reviews'}
  <ReviewsPanel
    quotes={instructedQuotes}
    {loading}
  />
{/if}
