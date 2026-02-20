<script>
  /** @type {Array} */
  export let data = [];
  /** @type {Array<{key: string, label: string, format?: Function}>} */
  export let columns = [];
  export let loading = false;
  export let title = '';
  export let emptyMessage = 'No data found';

  $: recordCount = data?.length || 0;
</script>

<div class="table-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading data...</p>
    </div>
  {:else if data && data.length > 0}
    <div class="table-header">
      <h3>{title}</h3>
      <span class="record-count">{recordCount} {recordCount === 1 ? 'record' : 'records'}</span>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            {#each columns as column}
              <th>{column.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr>
              {#each columns as column}
                <td class={column.cellClass || ''}>
                  {#if column.format}
                    {@html column.format(row[column.key], row)}
                  {:else}
                    {row[column.key] || '-'}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-inbox"></i>
      <p>{emptyMessage}</p>
    </div>
  {/if}
</div>

<style>
  .table-container {
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
    margin-bottom: 0.5rem;
  }

  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
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
    font-weight: 500;
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
    background: white;
    z-index: 10;
  }

  .data-table th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    background: white;
    white-space: nowrap;
    font-size: 0.75rem;
  }

  .data-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: top;
  }

  .data-table tbody tr:hover {
    background: #f8fafc;
  }

  /* Cell type classes that can be applied via cellClass */
  :global(.cell-name) {
    font-weight: 500;
    color: #1e293b;
  }

  :global(.cell-description) {
    max-width: 500px;
    font-size: 0.7rem;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: normal;
  }

  :global(.cell-date) {
    white-space: nowrap;
    color: #64748b;
  }

  :global(.cell-link) {
    text-align: center;
  }

  :global(.link-button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.5rem;
    color: #3b82f6;
    text-decoration: none;
    border-radius: 4px;
    transition: all 0.2s;
  }

  :global(.link-button:hover) {
    background: #dbeafe;
    color: #2563eb;
  }

  :global(.link-button i) {
    font-size: 1rem;
  }
</style>
