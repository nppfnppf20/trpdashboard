<script>
  import { onMount } from 'svelte';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import GanttChart from '$lib/components/admin-console/GanttChart.svelte';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import WorkflowNotificationCentre from '$lib/components/workflow/WorkflowNotificationCentre.svelte';
  import { user } from '$lib/stores/auth.js';
  import { getQuotes, getQuoteKeyDates, getProgrammeEvents } from '$lib/api/quotes.js';

  let selectedProjectId = '';
  let selectedProject = null;
  let activeTab = 'general';
  let quotes = [];
  let quoteKeyDates = [];
  let programmeEvents = [];
  let loading = false;
  let error = null;
  let showAddKeyDateModal = false;
  let keyDateType = 'quote'; // 'quote' or 'project'
  
  const tabs = [
    { id: 'general', label: 'General', icon: 'la-info-circle' },
    { id: 'briefings', label: 'Briefings', icon: 'la-clipboard-list' },
    { id: 'quotes', label: 'Quotes', icon: 'la-file-invoice-dollar' },
    { id: 'instructed', label: 'Instructed', icon: 'la-tasks' },
    { id: 'programme', label: 'Programme', icon: 'la-calendar-alt' },
    { id: 'reviews', label: 'Reviews', icon: 'la-star' },
    { id: 'notifications', label: 'Notifications', icon: 'la-bell' }
  ];
  
  async function handleProjectSelected(event) {
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
  
  function openAddKeyDateModal(type) {
    keyDateType = type;
    showAddKeyDateModal = true;
  }
  
  async function handleAddKeyDate(event) {
    const { type, data } = event.detail;
    
    console.log('Adding key date:', type, data);
    
    // TODO: Implement API call to save the key date
    // For now, just refresh the data
    if (selectedProject) {
      if (type === 'quote') {
        await loadQuoteKeyDates(selectedProject.unique_id);
      } else {
        await loadProgrammeEvents(selectedProject.unique_id);
      }
    }
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
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
    <div class="project-selector-wrapper">
      <ProjectSelector
        bind:selectedProjectId
        hideOneOffOption={true}
        on:projectSelected={handleProjectSelected}
      />
    </div>
    {#if selectedProject}
      <div class="project-info">
        <h1>{selectedProject.project_name}</h1>
        <span class="project-code">{selectedProject.project_code}</span>
      </div>
    {/if}
  </div>

  <!-- Always show tabs -->
  <div class="tabs-bar">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        on:click={() => activeTab = tab.id}
      >
        <i class="las {tab.icon}"></i>
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  {#if activeTab === 'notifications'}
    <div class="content-area">
      <div class="content-panel">
        <div class="panel-header">
          <h2>Notification Centre</h2>
        </div>
        <div style="padding: 1.5rem;">
          <WorkflowNotificationCentre currentUserName={$user?.user_metadata?.full_name || $user?.email || null} />
        </div>
      </div>
    </div>
  {:else if selectedProject}
    <!-- Content area -->
    <div class="content-area">
      {#if activeTab === 'general'}
        <div class="content-panel">
          <div class="panel-header">
            <h2>General Project Information</h2>
          </div>
          <div class="info-grid">
            <div class="info-card">
              <h3>Basic Information</h3>
              <div class="info-rows">
                <div class="info-row">
                  <span class="label">Project Code:</span>
                  <span class="value project-code">{selectedProject.project_id || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Project Name:</span>
                  <span class="value">{selectedProject.project_name}</span>
                </div>
                <div class="info-row">
                  <span class="label">Client:</span>
                  <span class="value">{selectedProject.client || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Address:</span>
                  <span class="value">{selectedProject.address || '-'}</span>
                </div>
              </div>
            </div>

            <div class="info-card">
              <h3>Site Details</h3>
              <div class="info-rows">
                <div class="info-row">
                  <span class="label">Site Area:</span>
                  <span class="value">{selectedProject.site_area || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Designations:</span>
                  <span class="value">{selectedProject.designations_on_site || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Nearby Designations:</span>
                  <span class="value">{selectedProject.relevant_nearby_designations || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {:else if activeTab === 'briefings'}
        <div class="content-panel">
          <div class="panel-header">
            <h2>Surveyor Briefings</h2>
          </div>
          <p class="placeholder">Surveyor briefing documents will be available here</p>
        </div>

      {:else if activeTab === 'quotes'}
        <div class="content-panel">
          <div class="panel-header">
            <h2>Surveyor Quotes</h2>
          </div>
          {#if loading}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading quotes...</p>
            </div>
          {:else if allQuotes.length === 0}
            <p class="empty">No quotes for this project yet</p>
          {:else}
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Discipline</th>
                    <th>Surveyor</th>
                    <th>Contact</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Work Status</th>
                  </tr>
                </thead>
                <tbody>
                  {#each allQuotes as quote}
                    <tr>
                      <td>{quote.discipline}</td>
                      <td>{quote.surveyor_organisation}</td>
                      <td>{quote.contact_name || '-'}</td>
                      <td>{formatCurrency(quote.total)}</td>
                      <td><span class="badge badge-{quote.instruction_status}">{quote.instruction_status}</span></td>
                      <td><span class="badge badge-{quote.work_status}">{quote.work_status || '-'}</span></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'instructed'}
        <div class="content-panel">
          <div class="panel-header">
            <h2>Instructed Surveyors</h2>
          </div>
          {#if loading}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading...</p>
            </div>
          {:else if instructedQuotes.length === 0}
            <p class="empty">No instructed surveyors yet</p>
          {:else}
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Discipline</th>
                    <th>Surveyor</th>
                    <th>Instructed Amount</th>
                    <th>Site Visit</th>
                    <th>Draft Report</th>
                    <th>Final Report</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {#each instructedQuotes as quote}
                    <tr>
                      <td>{quote.discipline}</td>
                      <td>{quote.surveyor_organisation}</td>
                      <td>{formatCurrency(quote.instructed_amount)}</td>
                      <td>{quote.site_visit_date || '-'}</td>
                      <td>{quote.report_draft_date || '-'}</td>
                      <td>{quote.report_final_date || '-'}</td>
                      <td><span class="badge badge-{quote.work_status}">{quote.work_status || '-'}</span></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'programme'}
        <div class="content-panel fullheight">
          <div class="panel-header">
            <h2>Programme</h2>
            <div class="panel-actions">
              <button 
                class="btn btn-primary"
                on:click={() => openAddKeyDateModal('project')}
                disabled={!selectedProject}
              >
                <i class="las la-calendar-plus"></i>
                Add Milestone
              </button>
              <button 
                class="btn btn-secondary"
                on:click={() => openAddKeyDateModal('quote')}
                disabled={!selectedProject || instructedQuotes.length === 0}
              >
                <i class="las la-calendar-plus"></i>
                Add Quote Date
              </button>
            </div>
          </div>
          
          {#if loading}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading programme...</p>
            </div>
          {:else if instructedQuotes.length === 0 && programmeEvents.length === 0}
            <p class="empty">No instructed work or programme events yet</p>
          {:else}
            <div class="gantt-wrapper">
              <GanttChart 
                quotes={instructedQuotes}
                {quoteKeyDates}
                {programmeEvents}
              />
            </div>
          {/if}
        </div>

      {:else if activeTab === 'reviews'}
        <div class="content-panel">
          <div class="panel-header">
            <h2>Surveyor Reviews</h2>
          </div>
          {#if loading}
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading...</p>
            </div>
          {:else if completedQuotes.length === 0}
            <p class="empty">No completed work to review yet</p>
          {:else}
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Discipline</th>
                    <th>Surveyor</th>
                    <th>Quality</th>
                    <th>Responsiveness</th>
                    <th>On Time</th>
                    <th>Overall</th>
                    <th>Review Date</th>
                  </tr>
                </thead>
                <tbody>
                  {#each completedQuotes as quote}
                    <tr>
                      <td>{quote.discipline}</td>
                      <td>{quote.surveyor_organisation}</td>
                      <td>{quote.quality ? `${quote.quality}/5` : '-'}</td>
                      <td>{quote.responsiveness ? `${quote.responsiveness}/5` : '-'}</td>
                      <td>{quote.delivered_on_time ? `${quote.delivered_on_time}/5` : '-'}</td>
                      <td>{quote.overall_review ? `${quote.overall_review}/5` : '-'}</td>
                      <td>{quote.review_date || '-'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
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

<AddKeyDateModal 
  bind:show={showAddKeyDateModal}
  quotes={instructedQuotes}
  projectId={selectedProjectId}
  type={keyDateType}
  on:submit={handleAddKeyDate}
  on:close={() => showAddKeyDateModal = false}
/>

<style>
  .fullscreen-page {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-slate-100);
    overflow: hidden;
    z-index: 100;
  }

  .compact-header {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 2px solid var(--color-slate-200);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }
  
  .project-selector-wrapper {
    width: 350px;
  }
  
  .project-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }
  
  .project-info h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .project-code {
    font-family: 'Courier New', monospace;
    color: var(--color-primary-500);
    font-weight: 600;
    background: var(--color-primary-100);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
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
  
  .content-panel.fullheight {
    min-height: 100%;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  
  .panel-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }
  
  .info-card {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .info-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-600);
    border-bottom: 2px solid var(--color-slate-300);
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
    color: var(--color-slate-500);
    min-width: 150px;
  }

  .info-row .value {
    color: var(--color-slate-800);
    flex: 1;
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
    background: var(--color-slate-50);
    color: var(--color-slate-600);
    font-weight: 600;
    border-bottom: 2px solid var(--color-slate-200);
    position: sticky;
    top: 0;
  }

  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
    color: var(--color-slate-800);
  }

  .data-table tbody tr:hover {
    background: var(--color-slate-50);
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }
  
  .badge-pending {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .badge-instructed {
    background: var(--color-badge-info-bg);
    color: var(--color-badge-info-fg);
  }

  .badge-in-progress {
    background: var(--color-badge-indigo-bg);
    color: var(--color-badge-indigo-fg);
  }

  .badge-completed {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }
  
  .gantt-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }
  
  .loading, .empty, .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-slate-400);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
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
