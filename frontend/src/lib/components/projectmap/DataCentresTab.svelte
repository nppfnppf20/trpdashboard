<script>
  import { onMount } from 'svelte';
  import { getDataCentres, toggleDataCentreDismissed } from '$lib/services/projectmap/projectMapApi.js';

  let dataCentresData = [];
  let loading = true;
  let errorMsg = '';

  // Helper function to format dates
  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  async function handleDismissToggle(item) {
    try {
      const newDismissed = !item.dismissed;
      await toggleDataCentreDismissed(item.id, newDismissed);

      // Update local data
      dataCentresData = dataCentresData.map(dc =>
        dc.id === item.id ? { ...dc, dismissed: newDismissed } : dc
      );

      console.log(`✅ Toggled data centre ${item.id} dismissed to ${newDismissed}`);
    } catch (error) {
      console.error('Failed to toggle dismissed status:', error);
      alert('Failed to update dismissed status');
    }
  }

  onMount(async () => {
    try {
      loading = true;
      const result = await getDataCentres();
      // Extract properties from GeoJSON features
      dataCentresData = result.features.map(f => f.properties);
      console.log(`✅ Loaded ${dataCentresData.length} data centres for table`);
    } catch (error) {
      console.error('Failed to load data centres:', error);
      errorMsg = 'Failed to load data centres data';
    } finally {
      loading = false;
    }
  });
</script>

<div class="datacentres-tab">
  {#if errorMsg}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <h3>Error Loading Data</h3>
      <p>{errorMsg}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading data...</p>
    </div>
  {:else if dataCentresData && dataCentresData.length > 0}
    <div class="table-header">
      <h3>Data Centres</h3>
      <span class="record-count">{dataCentresData.length} {dataCentresData.length === 1 ? 'record' : 'records'}</span>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Dismiss?</th>
            <th>App Type</th>
            <th>Address</th>
            <th>Start Date</th>
            <th>Postcode</th>
            <th>Area</th>
            <th>App State</th>
            <th>Decision Date</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {#each dataCentresData as item}
            <tr class:dismissed={item.dismissed}>
              <td class="cell-name">{item.name || '-'}</td>
              <td class="cell-description"><span title={item.description || ''}>{item.description || '-'}</span></td>
              <td class="cell-dismiss">
                <input
                  type="checkbox"
                  checked={item.dismissed}
                  on:change={() => handleDismissToggle(item)}
                />
              </td>
              <td>{item.app_type || '-'}</td>
              <td class="cell-address"><span title={item.address || ''}>{item.address || '-'}</span></td>
              <td class="cell-date">{formatDate(item.start_date)}</td>
              <td>{item.postcode || '-'}</td>
              <td>{item.area_name || '-'}</td>
              <td>{item.app_state || '-'}</td>
              <td class="cell-date">{formatDate(item.decided_date)}</td>
              <td class="cell-link">
                {#if item.url}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" class="link-button">
                    <i class="las la-external-link-alt"></i>
                  </a>
                {:else}
                  -
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-inbox"></i>
      <p>No data centres found</p>
    </div>
  {/if}
</div>

<style>
  .datacentres-tab {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: white;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #991b1b;
    padding: 2rem;
  }

  .error-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-state h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .error-state p {
    margin: 0;
    font-size: 0.875rem;
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
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .table-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .record-count {
    font-size: 0.875rem;
    color: #64748b;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }

  .data-table thead {
    position: sticky;
    top: 0;
    background: #f8fafc;
    z-index: 10;
  }

  .data-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
    font-size: 0.75rem;
  }

  .data-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background-color 0.15s;
  }

  .data-table tbody tr:hover {
    background-color: #f8fafc;
  }

  /* Greyed out dismissed rows */
  .data-table tbody tr.dismissed {
    background-color: #f1f5f9;
    opacity: 0.6;
  }

  .data-table tbody tr.dismissed:hover {
    background-color: #e2e8f0;
  }

  .data-table td {
    padding: 0.4rem 0.75rem;
    color: #334155;
  }

  .cell-dismiss {
    width: 80px;
    text-align: center;
  }

  .cell-dismiss input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .cell-name {
    font-weight: 500;
    color: #1e293b;
    max-width: 200px;
  }

  .cell-description {
    max-width: 500px;
  }

  .cell-description span {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    cursor: help;
  }

  .cell-address {
    max-width: 150px;
  }

  .cell-address span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: help;
  }

  .cell-date {
    white-space: nowrap;
    color: #64748b;
  }

  .cell-link {
    text-align: center;
    width: 60px;
  }

  .link-button {
    color: #3b82f6;
    text-decoration: none;
    font-size: 1.125rem;
    transition: color 0.15s;
  }

  .link-button:hover {
    color: #2563eb;
  }
</style>
