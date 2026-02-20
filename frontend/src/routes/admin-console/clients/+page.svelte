<script>
  import { onMount } from 'svelte';
  import { getAllClientOrganisations } from '$lib/api/clientOrganisations.js';
  import '$lib/styles/tables.css';
  import EditClientModal from '$lib/components/admin-console/EditClientModal.svelte';
  import DeleteClientModal from '$lib/components/admin-console/DeleteClientModal.svelte';

  let clients = [];
  let loading = true;
  let error = null;

  // Modal state
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedClient = null;

  // Search & Sort state
  let searchQuery = '';
  let sortColumn = '';
  let sortDirection = 'asc';

  // Filtered and sorted clients
  $: filteredClients = filterAndSortClients(clients, searchQuery, sortColumn, sortDirection);

  function filterAndSortClients(data, query, column, direction) {
    let result = [...data];

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      result = result.filter(c => {
        const searchableFields = [
          c.organisation_name,
          ...(c.contacts || []).map(ct => ct.name),
          ...(c.contacts || []).map(ct => ct.email)
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
            valA = (a.organisation_name || '').toLowerCase();
            valB = (b.organisation_name || '').toLowerCase();
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
    if (sortColumn !== column) return 'la-chevron-down';
    return sortDirection === 'asc' ? 'la-chevron-up' : 'la-chevron-down';
  }

  function getSortClass(column) {
    if (sortColumn !== column) return 'sortable';
    return `sortable sorted-${sortDirection}`;
  }

  function handleAdd() {
    selectedClient = null;
    showEditModal = true;
  }

  function handleEdit(client) {
    selectedClient = client;
    showEditModal = true;
  }

  function handleDelete(client) {
    selectedClient = client;
    showDeleteModal = true;
  }

  async function refreshClients() {
    try {
      clients = await getAllClientOrganisations();
    } catch (err) {
      console.error('Error refreshing clients:', err);
    }
  }

  function handleSaved() {
    refreshClients();
  }

  function handleDeleted() {
    refreshClients();
  }

  onMount(async () => {
    try {
      clients = await getAllClientOrganisations();
    } catch (err) {
      console.error('Error loading clients:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="clients-page">
  <div class="page-header">
    <div class="page-header-content">
      <div>
        <h1>Client Organisations</h1>
        <p>Manage client organisations and their contacts</p>
      </div>
      <button class="btn btn-primary" on:click={handleAdd}>
        <i class="las la-plus"></i> Add Client
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading clients...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>Error loading clients: {error}</p>
    </div>
  {:else if clients.length === 0}
    <div class="empty-state">
      <i class="las la-building"></i>
      <p>No clients found</p>
      <button class="btn btn-primary" on:click={handleAdd}>
        <i class="las la-plus"></i> Add Client
      </button>
    </div>
  {:else}
    <!-- Search Controls -->
    <div class="table-controls">
      <div class="table-search">
        <i class="las la-search table-search-icon"></i>
        <input
          type="text"
          placeholder="Search clients..."
          bind:value={searchQuery}
        />
      </div>
      <div class="table-results-count">
        Showing <strong>{filteredClients.length}</strong> of <strong>{clients.length}</strong> clients
      </div>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class={getSortClass('organisation')} on:click={() => handleSort('organisation')}>
              Organisation <span class="sort-indicator"><i class="las {getSortIcon('organisation')}"></i></span>
            </th>
            <th class="no-sort">Primary Contact</th>
            <th class="no-sort">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredClients.length === 0}
            <tr class="no-results-row">
              <td colspan="3">No clients match your search</td>
            </tr>
          {:else}
            {#each filteredClients as client}
              <tr>
                <td class="bold-cell">{client.organisation_name}</td>
                <td>
                  {#if client.contacts && client.contacts.length > 0}
                    {@const primary = client.contacts.find(c => c.is_primary) || client.contacts[0]}
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
                <td class="actions-cell">
                  <button class="action-btn edit-btn" on:click={() => handleEdit(client)} title="Edit">
                    <i class="las la-edit"></i>
                  </button>
                  <button class="action-btn delete-btn" on:click={() => handleDelete(client)} title="Delete">
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

<!-- Modals -->
<EditClientModal
  bind:show={showEditModal}
  client={selectedClient}
  on:saved={handleSaved}
/>

<DeleteClientModal
  bind:show={showDeleteModal}
  client={selectedClient}
  on:deleted={handleDeleted}
/>

<style>
  .clients-page {
    max-width: 100%;
  }

  .clients-page :global(.table-controls) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }

  .clients-page :global(.table-search) {
    flex: 0 0 320px;
    max-width: 320px;
  }

  .clients-page :global(.table-results-count) {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
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

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-primary {
    background: #9333ea;
    color: white;
  }

  .btn-primary:hover {
    background: #7e22ce;
  }

  .empty-state .btn {
    margin-top: 1rem;
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

  .actions-cell {
    white-space: nowrap;
    width: 1%;
    text-align: center;
  }

  .action-btn {
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

  .action-btn:last-child {
    margin-right: 0;
  }

  .action-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .edit-btn:hover {
    color: #3b82f6;
    border-color: #3b82f6;
  }

  .delete-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
  }
</style>
