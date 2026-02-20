<script>
  import SurveyorProjectSelector from '$lib/components/admin-console/SurveyorProjectSelector.svelte';
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
  import '../../lib/styles/tables.css';
  import '../../lib/styles/badges.css';
  import '../../lib/styles/buttons.css';

  let selectedProjectId = '';
  let selectedProject = null;
  let activeTab = 'general';
  let quotes = [];
  let quoteKeyDates = [];
  let programmeEvents = [];
  let loading = false;
  let error = null;
  let generalInfoComponent = null;
  
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

  async function handleProjectSelected(event) {
    // Check for unsaved changes before switching projects
    if (hasAnyUnsavedChanges()) {
      if (!confirm('You have unsaved changes. Are you sure you want to switch projects?')) {
        return;
      }
    }

    const { project } = event.detail;
    selectedProject = project;
    
    if (project) {
      await Promise.all([
        loadQuotes(project.unique_id),
        loadQuoteKeyDates(project.unique_id),
        loadProgrammeEvents(project.unique_id)
      ]);
    } else {
      quotes = [];
      quoteKeyDates = [];
      programmeEvents = [];
    }
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
    // Update the selected project with the new data
    // Exclude project_id from the update as it's a foreign key, not the project code
    const { project_id, ...projectInfoData } = event.detail;
    selectedProject = {
      ...selectedProject,
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
  $: completedQuotes = quotes.filter(q => q.work_status === 'completed');
</script>

<div class="fullscreen-page">
  <!-- Compact header with project selector -->
  <div class="compact-header">
    <div class="header-left">
      <a href="/" class="home-button" title="Back to Home">
        <i class="las la-home"></i>
        <span>Home</span>
      </a>
      <h1 class="page-title">Surveyor Management</h1>
    </div>
    <div class="header-center">
      <SurveyorProjectSelector
        bind:selectedProjectId
        on:projectSelected={handleProjectSelected}
      />
    </div>
    <div class="header-right">
      {#if selectedProject}
        <span class="project-code">{selectedProject.project_code}</span>
      {/if}
    </div>
  </div>

  {#if selectedProject}
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
            project={selectedProject}
            on:updated={handleProjectInfoUpdated}
          />
        </div>

      {:else if activeTab === 'briefings'}
        <div class="content-panel">
          <SurveyorBriefingPanel selectedProject={selectedProject} />
        </div>

      {:else if activeTab === 'quotes'}
        <QuotesPanel
          quotes={allQuotes}
          {loading}
          projectId={selectedProject?.unique_id}
          on:statusChange={handleStatusChange}
          on:updateQuote={handleUpdateQuoteEvent}
          on:deleteQuote={handleDeleteQuoteEvent}
          on:addQuote={handleAddQuoteEvent}
        />

      {:else if activeTab === 'instructed'}
        <InstructedSurveyorsPanel
          quotes={instructedQuotes}
          {loading}
          on:workStatusChange={handleWorkStatusChange}
        />

      {:else if activeTab === 'programme'}
        <ProgrammePanel
          quotes={instructedQuotes}
          {quoteKeyDates}
          {programmeEvents}
          {loading}
          hasSelectedProject={!!selectedProject}
          projectId={selectedProject?.unique_id}
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
      <h2>Select a Project</h2>
      <p>Choose a project from the selector above to manage surveyor information</p>
    </div>
  {/if}
</div>

<style>
  .fullscreen-page {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f1f5f9;
    overflow: hidden;
    z-index: 100;
  }
  
  .compact-header {
    display: grid;
    grid-template-columns: auto 1fr 150px;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 2px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    flex-shrink: 0;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .home-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #1e293b;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .home-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .home-button i {
    font-size: 1.125rem;
  }
  
  .page-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: #1e293b;
  }
  
  .header-center {
    display: flex;
    align-items: center;
    max-width: 400px;
  }
  
  .header-right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  
  .project-code {
    font-family: 'Courier New', monospace;
    color: #9333ea;
    font-weight: 600;
    background: #f3e8ff;
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .tabs-bar {
    display: flex;
    background: white;
    border-bottom: 1px solid #e2e8f0;
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
    color: #64748b;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tab-btn i {
    font-size: 1.125rem;
  }
  
  .tab-btn:hover {
    color: #3b82f6;
    background: #f8fafc;
  }
  
  .tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: #f8fafc;
  }
  
  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }
  
  .content-panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .content-panel.fullheight {
    min-height: 100%;
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
  
  .panel-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
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
    background: #f8fafc;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }
  
  .info-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
  }
  
  .info-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 0.5rem;
  }
  
  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .info-row {
    display: flex;
    gap: 1rem;
  }
  
  .info-row .label {
    font-weight: 600;
    color: #64748b;
    min-width: 150px;
  }
  
  .info-row .value {
    color: #1e293b;
    flex: 1;
  }
  
  .info-row.full-width {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .info-row.full-width .label {
    min-width: auto;
  }
  
  .info-row.full-width .value {
    padding-left: 0;
  }
  
  .info-row .value a {
    color: #3b82f6;
    text-decoration: none;
    word-break: break-all;
  }
  
  .info-row .value a:hover {
    text-decoration: underline;
  }
  
  .table-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }
  
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .data-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    position: sticky;
    top: 0;
  }
  
  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    color: #1e293b;
  }
  
  .data-table tbody tr:hover {
    background: #f8fafc;
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
  
  .text-muted {
    color: #94a3b8;
  }
  
  .text-bold {
    font-weight: 600;
    color: #1e293b;
  }
  
  .text-small {
    font-size: 0.75rem;
    font-weight: 400;
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
  
  .count-badge.clickable:active {
    transform: translateY(0);
    background: #cbd5e1;
  }
  
  .grid-wrapper {
    flex: 1;
    overflow: hidden;
    padding: 1.5rem;
  }
  
  .loading, .empty, .placeholder {
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
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
  }
  
  .empty-state i {
    font-size: 5rem;
    margin-bottom: 1rem;
  }
  
  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: #64748b;
  }
  
  .empty-state p {
    margin: 0;
  }
</style>

