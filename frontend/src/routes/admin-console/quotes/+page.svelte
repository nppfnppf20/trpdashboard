<script>
  import { onMount } from 'svelte';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import AddQuoteModal from '$lib/components/quotes/AddQuoteModal.svelte';
  import { getQuotes } from '$lib/api/quotes.js';

  let selectedProjectId = '';
  let selectedProject = null;
  let quotes = [];
  let loading = false;
  let error = null;
  let showAddQuoteModal = false;
  
  async function handleProjectSelected(event) {
    const { project } = event.detail;
    selectedProject = project;
    
    if (project) {
      await loadQuotes(project.unique_id);
    } else {
      quotes = [];
    }
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
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  }
  
  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  }
  
  function getStatusColor(status) {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'instructed': return '#3b82f6';
      case 'partially instructed': return '#8b5cf6';
      default: return '#6b7280';
    }
  }
  
  function getWorkStatusColor(status) {
    switch (status) {
      case 'not started': return '#94a3b8';
      case 'in progress': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function handleOpenAddQuote() {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }
    showAddQuoteModal = true;
  }

  function handleCloseAddQuote() {
    showAddQuoteModal = false;
  }
</script>

<div class="quotes-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Quotes</h1>
      <p>View and manage quotes for projects</p>
    </div>
    <button class="btn btn-primary" on:click={handleOpenAddQuote}>
      <i class="las la-plus"></i>
      New Quote
    </button>
  </div>
  
  <ProjectSelector
    bind:selectedProjectId
    hideOneOffOption={true}
    on:projectSelected={handleProjectSelected}
  />
  
  {#if !selectedProject}
    <div class="empty-state">
      <i class="las la-file-invoice-dollar"></i>
      <p>Select a project to view quotes</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading quotes...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>Error loading quotes: {error}</p>
    </div>
  {:else if quotes.length === 0}
    <div class="empty-state">
      <i class="las la-file-invoice-dollar"></i>
      <p>No quotes found for this project</p>
    </div>
  {:else}
    <div class="quotes-summary">
      <div class="summary-card">
        <div class="summary-label">Total Quotes</div>
        <div class="summary-value">{quotes.length}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Pending</div>
        <div class="summary-value">
          {quotes.filter(q => q.instruction_status === 'pending').length}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Instructed</div>
        <div class="summary-value">
          {quotes.filter(q => q.instruction_status === 'instructed').length}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Value</div>
        <div class="summary-value">
          {formatCurrency(quotes.reduce((sum, q) => sum + parseFloat(q.total || 0), 0))}
        </div>
      </div>
    </div>
    
    <div class="quotes-list">
      {#each quotes as quote}
        <div class="quote-card">
          <div class="quote-header">
            <div class="quote-main-info">
              <h3>{quote.surveyor_organisation} - {quote.discipline}</h3>
              <div class="quote-meta">
                <span class="quote-ref">{quote.project_code || 'No code'}</span>
                <span class="quote-date">Quote date: {formatDate(quote.quote_date)}</span>
              </div>
            </div>
            <div class="quote-amount">
              {formatCurrency(quote.total)}
            </div>
          </div>
          
          <div class="quote-body">
            <div class="quote-contact">
              <i class="las la-user"></i>
              <div>
                <div class="contact-name">{quote.contact_name}</div>
                <div class="contact-email">{quote.contact_email}</div>
              </div>
            </div>
            
            <div class="quote-statuses">
              <span 
                class="status-badge" 
                style="background-color: {getStatusColor(quote.instruction_status)}; color: white;"
              >
                {quote.instruction_status}
              </span>
              {#if quote.work_status}
                <span 
                  class="status-badge" 
                  style="background-color: {getWorkStatusColor(quote.work_status)}; color: white;"
                >
                  {quote.work_status}
                </span>
              {/if}
            </div>
          </div>
          
          {#if quote.line_items && quote.line_items.length > 0}
            <div class="quote-line-items">
              <div class="line-items-header">Line Items:</div>
              {#each quote.line_items as item}
                <div class="line-item">
                  <div class="line-item-desc">
                    <div class="line-item-name">{item.item}</div>
                    <div class="line-item-detail">{item.description}</div>
                  </div>
                  <div class="line-item-cost">{formatCurrency(item.cost)}</div>
                </div>
              {/each}
            </div>
          {/if}
          
          {#if quote.operational_notes}
            <div class="quote-notes">
              <i class="las la-sticky-note"></i>
              <span>{quote.operational_notes}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Quote Modal -->
<AddQuoteModal
  show={showAddQuoteModal}
  projectId={selectedProject?.unique_id}
  on:close={handleCloseAddQuote}
/>

<style>
  .quotes-page {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    flex: 1;
  }

  .header-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: #2d3748;
  }

  .header-content p {
    margin: 0;
    color: #718096;
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
    white-space: nowrap;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn i {
    font-size: 1rem;
  }
  
  .empty-state, .loading-state, .error-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-top: 2rem;
  }
  
  .empty-state i, .error-state i {
    font-size: 3rem;
    color: #cbd5e0;
    margin-bottom: 1rem;
  }
  
  .loading-state .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #3182ce;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .quotes-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
  }
  
  .summary-card {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .summary-label {
    font-size: 0.875rem;
    color: #718096;
    margin-bottom: 0.5rem;
  }
  
  .summary-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d3748;
  }
  
  .quotes-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .quote-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  
  .quote-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .quote-main-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    color: #2d3748;
  }
  
  .quote-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: #718096;
  }
  
  .quote-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d3748;
  }
  
  .quote-body {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
  }
  
  .quote-contact {
    display: flex;
    gap: 0.75rem;
    align-items: start;
  }
  
  .quote-contact i {
    font-size: 1.25rem;
    color: #718096;
    margin-top: 0.25rem;
  }
  
  .contact-name {
    font-weight: 600;
    color: #2d3748;
  }
  
  .contact-email {
    font-size: 0.875rem;
    color: #718096;
  }
  
  .quote-statuses {
    display: flex;
    gap: 0.5rem;
  }
  
  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }
  
  .quote-line-items {
    padding: 1rem 1.5rem;
    background: #f7fafc;
    border-top: 1px solid #e2e8f0;
  }
  
  .line-items-header {
    font-size: 0.875rem;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 0.75rem;
  }
  
  .line-item {
    display: flex;
    justify-content: space-between;
    align-items: start;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .line-item:last-child {
    border-bottom: none;
  }
  
  .line-item-name {
    font-weight: 500;
    color: #2d3748;
    margin-bottom: 0.25rem;
  }
  
  .line-item-detail {
    font-size: 0.875rem;
    color: #718096;
  }
  
  .line-item-cost {
    font-weight: 600;
    color: #2d3748;
    white-space: nowrap;
  }
  
  .quote-notes {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #fffbeb;
    border-top: 1px solid #e2e8f0;
    font-size: 0.875rem;
    color: #78350f;
  }
  
  .quote-notes i {
    font-size: 1.125rem;
    margin-top: 0.125rem;
  }
</style>

