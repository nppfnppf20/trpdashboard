<script>
  import SurveyorBriefingPanel from '$lib/components/surveyor-briefings/SurveyorBriefingPanel.svelte';
  import InstructedSurveyorsPanel from '$lib/components/surveyor-management/InstructedSurveyorsPanel.svelte';
  import QuotesPanel from '$lib/components/surveyor-management/QuotesPanel.svelte';
  import ProgrammePanel from '$lib/components/surveyor-management/ProgrammePanel.svelte';
  import ReviewsPanel from '$lib/components/surveyor-management/ReviewsPanel.svelte';
  import EditableGeneralInfo from '$lib/components/admin-console/EditableGeneralInfo.svelte';
  import {
    getQuotes,
    getQuoteKeyDates,
    getProgrammeEvents,
    updateQuoteInstructionStatus,
    updateQuoteWorkStatus,
    updateQuote,
    deleteQuote
  } from '$lib/api/quotes.js';

  export let project;

  let activeTab = 'general';
  let quotes = [];
  let quoteKeyDates = [];
  let programmeEvents = [];
  let loading = false;
  let error = null;
  let generalInfoComponent = null;
  let loadedForId = null;

  const tabs = [
    { id: 'general', label: 'General', icon: 'la-info-circle' },
    { id: 'briefings', label: 'Briefings', icon: 'la-clipboard-list' },
    { id: 'quotes', label: 'Quotes', icon: 'la-file-invoice-dollar' },
    { id: 'instructed', label: 'Instructed', icon: 'la-tasks' },
    { id: 'programme', label: 'Programme', icon: 'la-calendar-alt' },
    { id: 'reviews', label: 'Reviews', icon: 'la-star' }
  ];

  function hasAnyUnsavedChanges() {
    return generalInfoComponent?.hasUnsaved();
  }

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

  function handleTabChange(newTab) {
    // Check for unsaved changes before switching tabs
    if (hasAnyUnsavedChanges()) {
      if (!confirm('You have unsaved changes. Are you sure you want to leave this tab?')) {
        return;
      }
    }
    activeTab = newTab;
  }

  function handleProjectInfoUpdated(event) {
    // Update the local project view with the new data (optimistic UI only —
    // exclude project_id from the update as it's a foreign key, not the project code)
    const { project_id, ...projectInfoData } = event.detail;
    project = {
      ...project,
      ...projectInfoData
    };
  }

  async function loadQuotes(projectId) {
    loading = true;
    error = null;
    try {
      quotes = await getQuotes({ projectId });
    } catch (err) {
      console.error('Error loading quotes:', err);
      error = err.message;
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

  $: allQuotes = quotes;
  $: instructedQuotes = quotes.filter(
    q => q.instruction_status === 'instructed' || q.instruction_status === 'partially instructed'
  );
</script>

<div class="workspace">
  {#if project}
    <div class="workspace-header">
      <div class="header-info">
        <h1>{project.project_name}</h1>
        {#if project.project_id}<span class="project-ref">{project.project_id}</span>{/if}
      </div>
    </div>

    <!-- Tabs navigation -->
    <div class="tabs-bar">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          on:click={() => handleTabChange(tab.id)}
        >
          <i class="las {tab.icon}"></i>
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    <!-- Content area -->
    <div class="content-area">
      {#if activeTab === 'general'}
        <div class="content-panel">
          <EditableGeneralInfo
            bind:this={generalInfoComponent}
            {project}
            on:updated={handleProjectInfoUpdated}
          />
        </div>

      {:else if activeTab === 'briefings'}
        <div class="content-panel">
          <SurveyorBriefingPanel selectedProject={project} />
        </div>

      {:else if activeTab === 'quotes'}
        <QuotesPanel
          quotes={allQuotes}
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

      {:else if activeTab === 'programme'}
        <ProgrammePanel
          quotes={instructedQuotes}
          {quoteKeyDates}
          {programmeEvents}
          {loading}
          hasSelectedProject={!!project}
          projectId={project?.unique_id}
        />

      {:else if activeTab === 'reviews'}
        <ReviewsPanel
          quotes={instructedQuotes}
          {loading}
        />
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-project-diagram"></i>
      <h2>No project selected</h2>
      <p>Select a project from the sidebar to manage surveyor information</p>
    </div>
  {/if}
</div>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-slate-100);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-info h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .project-ref {
    font-size: 0.8rem;
    color: var(--color-slate-400);
    background: var(--color-slate-100);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .tabs-bar {
    display: flex;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    padding: 0 1.5rem;
    gap: 0.25rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--color-slate-500);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-btn i {
    font-size: 1.125rem;
  }

  .tab-btn:hover {
    color: var(--color-primary-500);
    background: var(--color-slate-50);
  }

  .tab-btn.active {
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
    background: var(--color-slate-50);
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .content-panel {
    background: white;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-slate-400);
  }

  .empty-state i {
    font-size: 5rem;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: var(--color-slate-500);
  }

  .empty-state p {
    margin: 0;
  }
</style>
