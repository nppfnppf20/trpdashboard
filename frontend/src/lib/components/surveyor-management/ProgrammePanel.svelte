<script>
  import GanttGrid from '$lib/components/admin-console/GanttGrid.svelte';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import ViewDateModal from '$lib/components/admin-console/ViewDateModal.svelte';
  import { 
    createProgrammeEvent, 
    createQuoteKeyDate,
    updateProgrammeEvent,
    updateQuoteKeyDate,
    deleteProgrammeEvent,
    deleteQuoteKeyDate
  } from '$lib/api/quotes.js';
  import '$lib/styles/buttons.css';

  export let quotes = [];
  export let quoteKeyDates = [];
  export let programmeEvents = [];
  export let loading = false;
  export let hasSelectedProject = false;
  export let projectId = null;

  // Internal modal state
  let showAddKeyDateModal = false;
  let showViewDateModal = false;
  let selectedDate = null;
  let keyDateType = 'quote';
  let preSelectedQuote = null;
  let preSelectedDate = null;
  let existingDateForEdit = null;

  function handleAddProjectDate() {
    keyDateType = 'project';
    preSelectedQuote = null;
    preSelectedDate = null;
    existingDateForEdit = null;
    showAddKeyDateModal = true;
  }

  function handleAddQuoteDate() {
    keyDateType = 'quote';
    preSelectedQuote = null;
    preSelectedDate = null;
    existingDateForEdit = null;
    showAddKeyDateModal = true;
  }

  function handleCellClick(event) {
    const { quote, date } = event.detail;
    keyDateType = 'quote';
    preSelectedQuote = quote;
    preSelectedDate = date;
    existingDateForEdit = null;
    showAddKeyDateModal = true;
  }

  function handleProjectMilestoneClick(event) {
    const { date } = event.detail;
    keyDateType = 'project';
    preSelectedQuote = null;
    preSelectedDate = date;
    existingDateForEdit = null;
    showAddKeyDateModal = true;
  }

  async function handleAddKeyDate(event) {
    const { type, data, isEdit } = event.detail;

    console.log('handleAddKeyDate called:', { type, data, isEdit });

    try {
      if (isEdit) {
        // Edit mode
        console.log('Edit mode - ID being sent:', data.id);
        
        if (type === 'project') {
          // Update programme event
          const updatedEvent = await updateProgrammeEvent(data.id, {
            title: data.title,
            date: data.date,
            colour: data.color
          });
          // Update local state
          programmeEvents = programmeEvents.map(pe => 
            pe.id === data.id ? { ...pe, ...updatedEvent } : pe
          );
        } else {
          // Update quote key date
          console.log('Calling updateQuoteKeyDate with ID:', data.id);
          const updatedKeyDate = await updateQuoteKeyDate(data.id, {
            title: data.title,
            date: data.date,
            colour: data.color
            // Note: notes column doesn't exist in quote_key_dates table yet
          });
          // Update local state
          quoteKeyDates = quoteKeyDates.map(kd => 
            kd.id === data.id ? { ...kd, ...updatedKeyDate } : kd
          );
        }
        alert('Date updated successfully');
      } else {
        // Create mode
        if (type === 'project') {
          // Create programme event (project-level date)
          const newEvent = await createProgrammeEvent(projectId, {
            title: data.title,
            date: data.date,
            colour: data.color
          });
          // Add to local state
          programmeEvents = [...programmeEvents, newEvent];
        } else {
          // Create quote key date
          const newKeyDate = await createQuoteKeyDate(data.quoteId, {
            title: data.title,
            date: data.date,
            colour: data.color
          });
          // Add to local state
          quoteKeyDates = [...quoteKeyDates, newKeyDate];
        }
        alert('Date added successfully');
      }
    } catch (error) {
      console.error('Failed to save key date:', error);
      alert('Failed to save key date: ' + error.message);
    }

    showAddKeyDateModal = false;
    existingDateForEdit = null;
  }

  function handleViewDate(event) {
    selectedDate = event.detail.date;
    showViewDateModal = true;
  }

  async function handleEditDate(event) {
    const date = event.detail;
    
    console.log('Edit date clicked:', date);
    console.log('Date ID:', date.id);
    console.log('Date type:', date.type);
    
    // Don't allow editing built-in quote dates
    if (date.type === 'quote-builtin') {
      alert('Cannot edit built-in quote dates (Site Visit, Draft Report, Final Report). These are managed through the quote itself.');
      return;
    }
    
    // Set up modal for edit mode
    existingDateForEdit = date;
    keyDateType = date.type === 'project' ? 'project' : 'quote';
    preSelectedQuote = null;
    preSelectedDate = null;
    
    // Close view modal and open edit modal
    showViewDateModal = false;
    showAddKeyDateModal = true;
  }

  async function handleDeleteDate(event) {
    const date = event.detail;
    
    try {
      if (date.type === 'project') {
        // Delete programme event
        await deleteProgrammeEvent(date.id);
        // Remove from local state
        programmeEvents = programmeEvents.filter(pe => pe.id !== date.id);
      } else if (date.type === 'quote') {
        // Delete quote key date
        await deleteQuoteKeyDate(date.id);
        // Remove from local state
        quoteKeyDates = quoteKeyDates.filter(kd => kd.id !== date.id);
      } else if (date.type === 'quote-builtin') {
        alert('Cannot delete built-in quote dates (Site Visit, Draft Report, Final Report). These are managed through the quote itself.');
        return;
      }
      
      alert('Date deleted successfully');
    } catch (error) {
      console.error('Failed to delete date:', error);
      alert('Failed to delete date: ' + error.message);
    }
  }
</script>

<div class="content-panel fullheight">
  <div class="panel-header">
    <h2>Programme</h2>
    <div class="panel-actions">
      <button
        class="btn btn-primary"
        on:click={handleAddProjectDate}
        disabled={!hasSelectedProject}
      >
        <i class="las la-calendar-plus"></i>
        Add Project Date
      </button>
      <button
        class="btn btn-secondary"
        on:click={handleAddQuoteDate}
        disabled={!hasSelectedProject || quotes.length === 0}
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
  {:else if quotes.length === 0 && programmeEvents.length === 0}
    <p class="empty">No instructed work or programme events yet</p>
  {:else}
    <div class="grid-wrapper">
      <GanttGrid
        {quotes}
        {quoteKeyDates}
        {programmeEvents}
        on:addQuoteDate={handleCellClick}
        on:addProjectMilestone={handleProjectMilestoneClick}
        on:viewDate={handleViewDate}
      />
    </div>
  {/if}
</div>

<!-- Add/Edit Key Date Modal -->
<AddKeyDateModal
  bind:show={showAddKeyDateModal}
  {quotes}
  {projectId}
  type={keyDateType}
  {preSelectedQuote}
  {preSelectedDate}
  existingDate={existingDateForEdit}
  on:submit={handleAddKeyDate}
  on:close={() => { showAddKeyDateModal = false; existingDateForEdit = null; }}
/>

<!-- View Date Modal -->
<ViewDateModal
  show={showViewDateModal}
  date={selectedDate}
  on:edit={handleEditDate}
  on:delete={handleDeleteDate}
  on:close={() => { showViewDateModal = false; selectedDate = null; }}
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

  .grid-wrapper {
    flex: 1;
    overflow: hidden;
    padding: 1.5rem;
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
</style>
