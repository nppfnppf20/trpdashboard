<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';

  export let show = false;
  export let selectedSurveyors = []; // Array of { surveyorId, contactId } to show which are already selected

  const dispatch = createEventDispatcher();

  let surveyors = [];
  let loading = true;
  let error = null;

  // Search & Sort state
  let searchQuery = '';
  let sortColumn = '';
  let sortDirection = 'asc';

  // Filtered and sorted surveyors
  $: filteredSurveyors = filterAndSortSurveyors(surveyors, searchQuery, sortColumn, sortDirection);

  function filterAndSortSurveyors(data, query, column, direction) {
    let result = [...data];

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      result = result.filter(s => {
        const searchableFields = [
          s.organisation,
          s.discipline,
          s.location,
          s.approval_status,
          ...(s.contacts || []).map(c => c.name),
          ...(s.contacts || []).map(c => c.email)
        ];
        return searchableFields.some(field =>
          field && field.toLowerCase().includes(lowerQuery)
        );
      });
    }

    // Sort by column
    if (column) {
      result.sort((a, b) => {
        let valA, valB;

        switch (column) {
          case 'organisation':
            valA = (a.organisation || '').toLowerCase();
            valB = (b.organisation || '').toLowerCase();
            break;
          case 'discipline':
            valA = (a.discipline || '').toLowerCase();
            valB = (b.discipline || '').toLowerCase();
            break;
          case 'location':
            valA = (a.location || '').toLowerCase();
            valB = (b.location || '').toLowerCase();
            break;
          case 'reviews':
            valA = a.total_reviews || 0;
            valB = b.total_reviews || 0;
            break;
          case 'quality':
            valA = parseFloat(a.avg_quality) || 0;
            valB = parseFloat(b.avg_quality) || 0;
            break;
          case 'responsiveness':
            valA = parseFloat(a.avg_responsiveness) || 0;
            valB = parseFloat(b.avg_responsiveness) || 0;
            break;
          case 'ontime':
            valA = parseFloat(a.avg_on_time) || 0;
            valB = parseFloat(b.avg_on_time) || 0;
            break;
          case 'overall':
            valA = parseFloat(a.avg_overall) || 0;
            valB = parseFloat(b.avg_overall) || 0;
            break;
          case 'status':
            valA = (a.approval_status || '').toLowerCase();
            valB = (b.approval_status || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }

  function handleSort(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(column) {
    if (sortColumn !== column) return 'la-sort';
    return sortDirection === 'asc' ? 'la-sort-up' : 'la-sort-down';
  }

  function getSortClass(column) {
    if (sortColumn !== column) return 'sortable';
    return `sortable sorted-${sortDirection}`;
  }

  $: if (show) {
    loadSurveyors();
  }

  async function loadSurveyors() {
    loading = true;
    error = null;
    try {
      surveyors = await getAllSurveyorOrganisations();
    } catch (err) {
      console.error('Error loading surveyors:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function formatRating(rating) {
    if (!rating) return 'N/A';
    const numRating = parseFloat(rating);
    return isNaN(numRating) ? 'N/A' : numRating.toFixed(1);
  }

  function getRatingColor(rating) {
    if (!rating) return '#94a3b8';
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return '#94a3b8';
    if (numRating >= 4.5) return '#10b981';
    if (numRating >= 4.0) return '#84cc16';
    if (numRating >= 3.5) return '#f59e0b';
    if (numRating >= 3.0) return '#f97316';
    return '#ef4444';
  }

  function isContactSelected(surveyorId, contactId) {
    return selectedSurveyors.some(s => s.surveyorId === surveyorId && s.contactId === contactId);
  }

  function handleSelectContact(surveyor, contact) {
    dispatch('select', {
      surveyorId: surveyor.id,
      surveyorOrganisation: surveyor.organisation,
      discipline: surveyor.discipline,
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email
    });
  }

  function handleClose() {
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
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>Select Surveyor</h2>
          <p class="modal-subtitle">Choose a contact to add to the quote request</p>
        </div>
        <button class="close-btn" on:click={handleClose} aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading surveyors...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <i class="las la-exclamation-circle"></i>
            <p>Error loading surveyors: {error}</p>
          </div>
        {:else if surveyors.length === 0}
          <div class="empty-state">
            <i class="las la-users"></i>
            <p>No surveyors found</p>
          </div>
        {:else}
          <!-- Search Controls -->
          <div class="table-controls">
            <div class="table-search">
              <i class="las la-search table-search-icon"></i>
              <input
                type="text"
                placeholder="Search surveyors..."
                bind:value={searchQuery}
              />
            </div>
            <div class="table-results-count">
              Showing <strong>{filteredSurveyors.length}</strong> of <strong>{surveyors.length}</strong> surveyors
            </div>
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class={getSortClass('organisation')} on:click={() => handleSort('organisation')}>
                    Organisation <span class="sort-indicator"><i class="las {getSortIcon('organisation')}"></i></span>
                  </th>
                  <th class={getSortClass('discipline')} on:click={() => handleSort('discipline')}>
                    Discipline <span class="sort-indicator"><i class="las {getSortIcon('discipline')}"></i></span>
                  </th>
                  <th class={getSortClass('location')} on:click={() => handleSort('location')}>
                    Location <span class="sort-indicator"><i class="las {getSortIcon('location')}"></i></span>
                  </th>
                  <th class="no-sort">Contacts</th>
                  <th class={getSortClass('overall')} on:click={() => handleSort('overall')}>
                    Overall <span class="sort-indicator"><i class="las {getSortIcon('overall')}"></i></span>
                  </th>
                  <th class={getSortClass('status')} on:click={() => handleSort('status')}>
                    Status <span class="sort-indicator"><i class="las {getSortIcon('status')}"></i></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {#if filteredSurveyors.length === 0}
                  <tr class="no-results-row">
                    <td colspan="6">No surveyors match your search</td>
                  </tr>
                {:else}
                  {#each filteredSurveyors as surveyor}
                    <tr>
                      <td class="bold-cell">{surveyor.organisation}</td>
                      <td><span class="discipline-badge">{surveyor.discipline}</span></td>
                      <td>{surveyor.location || '-'}</td>
                      <td class="contacts-cell">
                        {#if surveyor.contacts && surveyor.contacts.length > 0}
                          <div class="contacts-list">
                            {#each surveyor.contacts as contact}
                              <div class="contact-row" class:is-primary={contact.is_primary}>
                                <div class="contact-info">
                                  <span class="contact-name">
                                    {contact.name}
                                    {#if contact.is_primary}
                                      <span class="primary-badge">Primary</span>
                                    {/if}
                                  </span>
                                  {#if contact.email}
                                    <span class="contact-email">{contact.email}</span>
                                  {/if}
                                </div>
                                <button
                                  class="select-btn"
                                  class:selected={isContactSelected(surveyor.id, contact.id)}
                                  on:click={() => handleSelectContact(surveyor, contact)}
                                  disabled={isContactSelected(surveyor.id, contact.id)}
                                >
                                  {#if isContactSelected(surveyor.id, contact.id)}
                                    <i class="las la-check"></i> Selected
                                  {:else}
                                    <i class="las la-plus"></i> Select
                                  {/if}
                                </button>
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <span class="text-muted">No contacts</span>
                        {/if}
                      </td>
                      <td class="text-center">
                        <span
                          class="rating-badge"
                          style="background-color: {getRatingColor(surveyor.avg_overall)}"
                        >
                          {formatRating(surveyor.avg_overall)}
                        </span>
                      </td>
                      <td>
                        {#if !surveyor.total_reviews}
                          <span class="status-badge status-unknown">unknown</span>
                        {:else}
                          <span class="status-badge status-{surveyor.approval_status}">
                            {surveyor.approval_status || 'approved'}
                          </span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Done
        </button>
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
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    /* Always the top-most picker: must sit above the briefing editor (1000)
       and the conditions tracker's fullscreen view (1500) + its modals (10000) */
    z-index: 10500;
    backdrop-filter: blur(2px);
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-modal);
    width: 95%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .modal-subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--color-slate-800);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: white;
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-300);
  }

  .btn-secondary:hover {
    background: var(--color-slate-100);
  }

  /* States */
  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-slate-400);
  }

  .error-state {
    color: var(--color-red-500);
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

  /* Table Controls */
  .table-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .table-search {
    position: relative;
    flex: 1;
    max-width: 400px;
  }

  .table-search input {
    width: 100%;
    padding: 0.625rem 1rem 0.625rem 2.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .table-search input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .table-search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-slate-400);
  }

  .table-results-count {
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
  }

  .contacts-cell {
    min-width: 280px;
  }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .contact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-slate-50);
    border-radius: 6px;
    border: 1px solid var(--color-slate-200);
  }

  .contact-row.is-primary {
    background: var(--color-primary-50);
    border-color: var(--color-primary-200);
  }

  .contact-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    flex: 1;
  }

  .contact-name {
    font-weight: 500;
    color: var(--color-slate-800);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .primary-badge {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .contact-email {
    color: var(--color-slate-500);
    font-size: 0.8125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--color-primary-500);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .select-btn:hover:not(:disabled) {
    background: var(--color-primary-600);
  }

  .select-btn.selected {
    background: var(--color-emerald-500);
    cursor: default;
  }

  .select-btn:disabled {
    opacity: 0.8;
  }

  /* Surveyor-specific styles */
  .discipline-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: var(--color-primary-50);
    color: var(--color-slate-600);
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .text-center {
    text-align: center;
  }

  .text-muted {
    color: var(--color-slate-400);
  }

  .rating-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    color: white;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.875rem;
    min-width: 36px;
    text-align: center;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-approved {
    background: var(--color-emerald-100);
    color: var(--color-emerald-800);
  }

  .status-rejected {
    background: var(--color-red-100);
    color: var(--color-red-800);
  }

  .status-unknown {
    background: var(--color-amber-100);
    color: var(--color-amber-800);
  }

  .bold-cell {
    font-weight: 600;
  }

  .no-results-row td {
    text-align: center;
    padding: 2rem;
    color: var(--color-slate-500);
  }

  /* Sortable headers */
  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    background: var(--color-slate-100);
  }

  .sort-indicator {
    margin-left: 0.25rem;
    opacity: 0.5;
  }

  .sortable:hover .sort-indicator,
  .sortable.sorted-asc .sort-indicator,
  .sortable.sorted-desc .sort-indicator {
    opacity: 1;
  }
</style>
