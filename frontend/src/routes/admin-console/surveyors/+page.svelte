<script>
  import { onMount } from 'svelte';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';
  import AddEditSurveyorModal from '$lib/components/admin-console/AddEditSurveyorModal.svelte';
  import DeleteSurveyorModal from '$lib/components/admin-console/DeleteSurveyorModal.svelte';
  import '$lib/styles/tables.css';

  let surveyors = [];
  let loading = true;
  let error = null;

  // Modal state
  let showAddEditModal = false;
  let showDeleteModal = false;
  let selectedSurveyor = null;

  function openAddModal() {
    selectedSurveyor = null;
    showAddEditModal = true;
  }

  function openEditModal(surveyor) {
    selectedSurveyor = surveyor;
    showAddEditModal = true;
  }

  function openDeleteModal(surveyor) {
    selectedSurveyor = surveyor;
    showDeleteModal = true;
  }

  async function handleSaved() {
    surveyors = await getAllSurveyorOrganisations();
  }

  async function handleDeleted() {
    surveyors = await getAllSurveyorOrganisations();
  }

  // Search & Sort state
  let searchQuery = '';
  let sortColumn = '';
  let sortDirection = 'asc'; // 'asc' or 'desc'

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
      // Toggle direction if same column
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, start with ascending
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(column) {
    if (sortColumn !== column) return 'la-chevron-down';
    return sortDirection === 'asc' ? 'la-chevron-up' : 'la-chevron-down';
  }

  function getSortClass(column) {
    if (sortColumn !== column) return 'sortable';
    return `sortable sorted-${sortDirection}`;
  }

  // Dual scrollbar sync
  let topScroll, topScrollInner, tableWrapper, tableEl;

  function syncFromTop() {
    if (tableWrapper) tableWrapper.scrollLeft = topScroll.scrollLeft;
  }

  function syncFromBottom() {
    if (topScroll) topScroll.scrollLeft = tableWrapper.scrollLeft;
  }

  $: if (tableEl && topScrollInner) {
    topScrollInner.style.width = tableEl.scrollWidth + 'px';
  }

  onMount(async () => {
    console.log('🔍 Mounting surveyors page, fetching data...');
    try {
      console.log('📡 Calling API...');
      surveyors = await getAllSurveyorOrganisations();
      console.log('✅ Got surveyors:', surveyors.length);
    } catch (err) {
      console.error('❌ Error loading surveyors:', err);
      error = err.message;
    } finally {
      loading = false;
      console.log('✔️ Loading complete');
    }
  });

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
</script>

<div class="surveyors-page">
  <div class="page-header">
    <div>
      <h1>Surveyor Organisations</h1>
      <p>Manage external surveyors and view their performance ratings</p>
    </div>
    <button class="btn-add" on:click={openAddModal}>
      <i class="las la-plus"></i> Add Surveyor
    </button>
  </div>
  
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

    <div class="top-scroll" bind:this={topScroll} on:scroll={syncFromTop}>
      <div class="top-scroll-inner" bind:this={topScrollInner}></div>
    </div>
    <div class="table-wrapper" bind:this={tableWrapper} on:scroll={syncFromBottom}>
      <table class="data-table" bind:this={tableEl}>
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
            <th class="no-sort">Primary Contact</th>
            <th class={getSortClass('reviews')} on:click={() => handleSort('reviews')}>
              Reviews <span class="sort-indicator"><i class="las {getSortIcon('reviews')}"></i></span>
            </th>
            <th class={getSortClass('quality')} on:click={() => handleSort('quality')}>
              Quality <span class="sort-indicator"><i class="las {getSortIcon('quality')}"></i></span>
            </th>
            <th class={getSortClass('responsiveness')} on:click={() => handleSort('responsiveness')}>
              Responsiveness <span class="sort-indicator"><i class="las {getSortIcon('responsiveness')}"></i></span>
            </th>
            <th class={getSortClass('ontime')} on:click={() => handleSort('ontime')}>
              On Time <span class="sort-indicator"><i class="las {getSortIcon('ontime')}"></i></span>
            </th>
            <th class={getSortClass('overall')} on:click={() => handleSort('overall')}>
              Overall <span class="sort-indicator"><i class="las {getSortIcon('overall')}"></i></span>
            </th>
            <th class={getSortClass('status')} on:click={() => handleSort('status')}>
              Status <span class="sort-indicator"><i class="las {getSortIcon('status')}"></i></span>
            </th>
            <th class="no-sort">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredSurveyors.length === 0}
            <tr class="no-results-row">
              <td colspan="11">No surveyors match your search</td>
            </tr>
          {:else}
            {#each filteredSurveyors as surveyor}
              <tr>
                <td class="bold-cell">{surveyor.organisation}</td>
                <td><span class="discipline-badge">{surveyor.discipline}</span></td>
                <td>{surveyor.location || '-'}</td>
                <td>
                  {#if surveyor.contacts && surveyor.contacts.length > 0}
                    {@const primary = surveyor.contacts.find(c => c.is_primary) || surveyor.contacts[0]}
                    <div class="contact-info">
                      <div class="contact-name">{primary.name}</div>
                      {#if primary.email}
                        <div class="contact-email">{primary.email}</div>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-muted">No contact</span>
                  {/if}
                </td>
                <td class="text-center">{surveyor.total_reviews || 0}</td>
                <td class="text-center">
                  <span
                    class="rating-badge"
                    style="background-color: {getRatingColor(surveyor.avg_quality)}"
                  >
                    {formatRating(surveyor.avg_quality)}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="rating-badge"
                    style="background-color: {getRatingColor(surveyor.avg_responsiveness)}"
                  >
                    {formatRating(surveyor.avg_responsiveness)}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="rating-badge"
                    style="background-color: {getRatingColor(surveyor.avg_on_time)}"
                  >
                    {formatRating(surveyor.avg_on_time)}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="rating-badge overall"
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
                <td class="actions-cell">
                  <button class="action-btn edit-btn" on:click={() => openEditModal(surveyor)} title="Edit">
                    <i class="las la-pen"></i>
                  </button>
                  <button class="action-btn delete-btn" on:click={() => openDeleteModal(surveyor)} title="Delete">
                    <i class="las la-trash"></i>
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<AddEditSurveyorModal
  bind:show={showAddEditModal}
  surveyor={selectedSurveyor}
  on:saved={handleSaved}
/>

<DeleteSurveyorModal
  bind:show={showDeleteModal}
  surveyor={selectedSurveyor}
  on:deleted={handleDeleted}
/>

<style>
  .surveyors-page {
    max-width: 1400px;
    margin: 0 auto;
  }

  .top-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    height: 12px;
    margin-bottom: 2px;
    border: 1px solid #e2e8f0;
    border-radius: 4px 4px 0 0;
    border-bottom: none;
  }

  .top-scroll-inner {
    height: 1px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: #1e293b;
  }

  .page-header p {
    margin: 0;
    color: #64748b;
  }

  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .btn-add:hover {
    background: #2563eb;
  }

  .actions-cell {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .action-btn {
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
  }

  .edit-btn {
    color: #3b82f6;
  }

  .edit-btn:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .delete-btn {
    color: #ef4444;
  }

  .delete-btn:hover {
    background: #fef2f2;
    border-color: #ef4444;
  }

  /* Surveyor-specific styles */
  .discipline-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #ebf8ff;
    color: #2c5282;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .contact-info {
    font-size: 0.875rem;
  }

  .contact-name {
    font-weight: 500;
    color: #1e293b;
  }

  .contact-email {
    color: #64748b;
    font-size: 0.8125rem;
  }

  .text-center {
    text-align: center;
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

  .rating-badge.overall {
    font-size: 1rem;
    padding: 0.375rem 0.625rem;
  }

  .status-approved {
    background: #d1fae5;
    color: #065f46;
  }

  .status-rejected {
    background: #fee2e2;
    color: #991b1b;
  }

  .status-unknown {
    background: #fef3c7;
    color: #92400e;
  }
</style>

