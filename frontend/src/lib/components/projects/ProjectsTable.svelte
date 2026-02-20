<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import ProjectViewModal from './ProjectViewModal.svelte';
  import EditProjectModal from './EditProjectModal.svelte';
  import '../../styles/buttons.css';
  import { authFetch } from '$lib/api/client.js';

  let projects = [];
  let loading = true;
  let error = null;
  let searchTerm = '';
  let sortColumn = 'created_at';
  let sortDirection = 'desc';

  // Top scrollbar mirror
  let tableWrapper;
  let topScroller;
  let phantomWidth = 0;

  $: if (tableWrapper && sortedProjects) {
    tick().then(() => {
      if (tableWrapper) phantomWidth = tableWrapper.scrollWidth;
    });
  }

  function onTopScroll() {
    if (tableWrapper) tableWrapper.scrollLeft = topScroller.scrollLeft;
  }

  function onBottomScroll() {
    if (topScroller) topScroller.scrollLeft = tableWrapper.scrollLeft;
  }

  // View modal state
  let showViewModal = false;
  let selectedProjectId = null;

  // Edit modal state
  let showEditModal = false;
  let editProjectId = null;

  onMount(async () => {
    await fetchProjects();
  });

  export async function refresh() {
    await fetchProjects();
  }

  async function fetchProjects() {
    loading = true;
    error = null;
    try {
      const response = await authFetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      projects = await response.json();
    } catch (err) {
      console.error('Error fetching projects:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function deleteProject(id, projectName) {
    if (!confirm(`Are you sure you want to delete "${projectName}"?`)) return;

    try {
      const response = await authFetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete project');

      // Refresh the list
      await fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project');
    }
  }

  function openViewModal(projectId) {
    selectedProjectId = projectId;
    showViewModal = true;
  }

  function closeViewModal() {
    showViewModal = false;
    selectedProjectId = null;
  }

  function handleEditFromView() {
    const id = selectedProjectId;
    closeViewModal();
    openEditModal(id);
  }

  function openEditModal(projectId) {
    editProjectId = projectId;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editProjectId = null;
  }

  async function handleProjectUpdated() {
    // Refresh the projects list after update
    await fetchProjects();
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatLPA(lpaArray) {
    if (!lpaArray || !Array.isArray(lpaArray)) return '-';
    if (lpaArray.length === 0) return '-';
    if (lpaArray.length === 1) return lpaArray[0];
    return `${lpaArray[0]} +${lpaArray.length - 1}`;
  }

  function sortTable(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  $: filteredProjects = projects.filter(project => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      project.project_id?.toLowerCase().includes(search) ||
      project.project_name?.toLowerCase().includes(search) ||
      project.client?.toLowerCase().includes(search) ||
      project.project_lead?.toLowerCase().includes(search) ||
      project.sector?.toLowerCase().includes(search)
    );
  });

  $: sortedProjects = [...filteredProjects].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    // Handle null values
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Handle dates
    if (sortColumn === 'created_at' || sortColumn === 'updated_at') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    // Handle arrays (LPA)
    if (Array.isArray(aVal)) aVal = aVal.join(', ');
    if (Array.isArray(bVal)) bVal = bVal.join(', ');

    // String comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
</script>

<div class="projects-table-container">
  <div class="table-header">
    <h2>Projects</h2>
    <div class="table-controls">
      <input
        type="text"
        placeholder="Search projects..."
        bind:value={searchTerm}
        class="search-input"
      />
      <span class="project-count">{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading projects...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>Error loading projects: {error}</p>
      <button on:click={fetchProjects}>Retry</button>
    </div>
  {:else if sortedProjects.length === 0}
    <div class="empty-state">
      <i class="las la-folder-open"></i>
      <p>No projects found</p>
      {#if searchTerm}
        <button on:click={() => searchTerm = ''}>Clear search</button>
      {/if}
    </div>
  {:else}
    <div class="top-scroller" bind:this={topScroller} on:scroll={onTopScroll}>
      <div style="width: {phantomWidth}px; height: 1px;"></div>
    </div>
    <div class="table-wrapper" bind:this={tableWrapper} on:scroll={onBottomScroll}>
      <table class="projects-table">
        <thead>
          <tr>
            <th on:click={() => sortTable('project_id')} class:sorted={sortColumn === 'project_id'}>
              Project ID
              {#if sortColumn === 'project_id'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('project_name')} class:sorted={sortColumn === 'project_name'}>
              Project Name
              {#if sortColumn === 'project_name'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('client')} class:sorted={sortColumn === 'client'}>
              Client
              {#if sortColumn === 'client'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th>Local Planning Authority</th>
            <th on:click={() => sortTable('project_lead')} class:sorted={sortColumn === 'project_lead'}>
              Project Lead
              {#if sortColumn === 'project_lead'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('sector')} class:sorted={sortColumn === 'sector'}>
              Sector
              {#if sortColumn === 'sector'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('sub_sector')} class:sorted={sortColumn === 'sub_sector'}>
              Sub-sector
              {#if sortColumn === 'sub_sector'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th>Area</th>
            <th on:click={() => sortTable('status')} class:sorted={sortColumn === 'status'}>
              Status
              {#if sortColumn === 'status'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('created_at')} class:sorted={sortColumn === 'created_at'}>
              Created
              {#if sortColumn === 'created_at'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('case_officer_name')} class:sorted={sortColumn === 'case_officer_name'}>
              Case Officer Name
              {#if sortColumn === 'case_officer_name'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('case_officer_email')} class:sorted={sortColumn === 'case_officer_email'}>
              Case Officer Email
              {#if sortColumn === 'case_officer_email'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('case_officer_phone_number')} class:sorted={sortColumn === 'case_officer_phone_number'}>
              Case Officer Phone
              {#if sortColumn === 'case_officer_phone_number'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('lpa_reference')} class:sorted={sortColumn === 'lpa_reference'}>
              LPA Reference
              {#if sortColumn === 'lpa_reference'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('submission_date')} class:sorted={sortColumn === 'submission_date'}>
              Submission Date
              {#if sortColumn === 'submission_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('validation_date')} class:sorted={sortColumn === 'validation_date'}>
              Validation Date
              {#if sortColumn === 'validation_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('lpa_consultation_end_date')} class:sorted={sortColumn === 'lpa_consultation_end_date'}>
              LPA Consultation End
              {#if sortColumn === 'lpa_consultation_end_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('committee_date')} class:sorted={sortColumn === 'committee_date'}>
              Committee Date
              {#if sortColumn === 'committee_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('target_determination_date')} class:sorted={sortColumn === 'target_determination_date'}>
              Target Determination
              {#if sortColumn === 'target_determination_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('determined_date')} class:sorted={sortColumn === 'determined_date'}>
              Determined Date
              {#if sortColumn === 'determined_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('expiry_of_1st_stat_period_date')} class:sorted={sortColumn === 'expiry_of_1st_stat_period_date'}>
              1st Stat Period Expiry
              {#if sortColumn === 'expiry_of_1st_stat_period_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('eot_date')} class:sorted={sortColumn === 'eot_date'}>
              EOT Date
              {#if sortColumn === 'eot_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th on:click={() => sortTable('six_months_appeal_window_date')} class:sorted={sortColumn === 'six_months_appeal_window_date'}>
              6-Month Appeal Window
              {#if sortColumn === 'six_months_appeal_window_date'}
                <i class="las la-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
              {/if}
            </th>
            <th>Comments</th>
            <th class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedProjects as project}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <tr on:click={() => openViewModal(project.id)} role="button" tabindex="0">
              <td class="project-id">{project.project_id || '-'}</td>
              <td class="project-name">{project.project_name}</td>
              <td>{project.client || '-'}</td>
              <td class="lpa-cell" title={project.local_planning_authority?.join(', ') || '-'}>
                {formatLPA(project.local_planning_authority)}
              </td>
              <td>{project.project_lead || '-'}</td>
              <td>{project.sector || '-'}</td>
              <td>{project.sub_sector || '-'}</td>
              <td>{project.area || '-'}</td>
              <td class="status-cell">
                <span
                  class="status-badge status-{project.status?.toLowerCase().replace(/\s+/g, '-').replace('post-submission', 'post-sub')}"
                  class:status-not-set={!project.status}
                >
                  {project.status || 'Not set'}
                </span>
              </td>
              <td class="date-cell">{formatDate(project.created_at)}</td>
              <td>{project.case_officer_name || '-'}</td>
              <td>{project.case_officer_email || '-'}</td>
              <td>{project.case_officer_phone_number || '-'}</td>
              <td>{project.lpa_reference || '-'}</td>
              <td class="date-cell">{formatDate(project.submission_date)}</td>
              <td class="date-cell">{formatDate(project.validation_date)}</td>
              <td class="date-cell">{formatDate(project.lpa_consultation_end_date)}</td>
              <td class="date-cell">{formatDate(project.committee_date)}</td>
              <td class="date-cell">{formatDate(project.target_determination_date)}</td>
              <td class="date-cell">{formatDate(project.determined_date)}</td>
              <td class="date-cell">{formatDate(project.expiry_of_1st_stat_period_date)}</td>
              <td class="date-cell">{formatDate(project.eot_date)}</td>
              <td class="date-cell">{formatDate(project.six_months_appeal_window_date)}</td>
              <td class="comments-cell">{project.comments || '-'}</td>
              <td class="actions-cell">
                <button
                  class="action-btn edit-btn"
                  title="Edit project"
                  on:click|stopPropagation={() => openEditModal(project.id)}
                >
                  <i class="las la-edit"></i>
                </button>
                <button
                  class="action-btn delete-btn"
                  title="Delete project"
                  on:click|stopPropagation={() => deleteProject(project.id, project.project_name)}
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

<!-- View Project Modal -->
<ProjectViewModal
  isOpen={showViewModal}
  projectId={selectedProjectId}
  onClose={closeViewModal}
  onEdit={handleEditFromView}
/>

<!-- Edit Project Modal -->
<EditProjectModal
  isOpen={showEditModal}
  projectId={editProjectId}
  onClose={closeEditModal}
  onProjectUpdated={handleProjectUpdated}
/>

<style>
  .projects-table-container {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    min-width: 0;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .table-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .table-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    min-width: 0;
    flex-shrink: 0;
  }

  .search-input {
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    width: 250px;
    max-width: 250px;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
  }

  .project-count {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  .top-scroller {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .projects-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .projects-table thead {
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }

  .projects-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s;
  }

  .projects-table th:hover {
    background: #f1f5f9;
  }

  .projects-table th.sorted {
    color: #9333ea;
  }

  .projects-table th i {
    margin-left: 0.25rem;
    font-size: 0.75rem;
  }

  .projects-table th.actions-column {
    cursor: default;
  }

  .projects-table th.actions-column:hover {
    background: #f8fafc;
  }

  .projects-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
    transition: background-color 0.15s;
    cursor: pointer;
  }

  .projects-table tbody tr:hover {
    background: #f8fafc;
  }

  .projects-table td {
    padding: 0.75rem 1rem;
    color: #334155;
  }

  .project-id {
    font-weight: 500;
  }

  .project-name {
    font-weight: 500;
    color: #1e293b;
  }

  .lpa-cell {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date-cell {
    white-space: nowrap;
    color: #64748b;
  }

  .comments-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-cell {
    white-space: nowrap;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .status-not-set {
    background: #f1f5f9;
    color: #94a3b8;
  }

  .status-prospective {
    background: #fef3c7;
    color: #92400e;
  }

  .status-instructed {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-submitted {
    background: #e0e7ff;
    color: #3730a3;
  }

  .status-post-sub {
    background: #fce7f3;
    color: #9d174d;
  }

  .status-closed {
    background: #dcfce7;
    color: #166534;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .badge-sector {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge-type {
    background: #dcfce7;
    color: #166534;
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .loading-state i,
  .error-state i,
  .empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
    color: #cbd5e1;
  }

  .spinner {
    border: 3px solid #f3f4f6;
    border-top: 3px solid #9333ea;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-state button,
  .empty-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .error-state button:hover,
  .empty-state button:hover {
    background: #7e22ce;
  }
</style>
