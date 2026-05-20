<script>
  import { onMount } from 'svelte';
  import { getRenewables, toggleRenewableDismissed, getScraperFilterPrompts, updateScraperFilterPrompt, applyScraperFilter } from '$lib/services/projectmap/projectMapApi.js';

  let renewablesData = [];
  let loading = true;
  let errorMsg = '';

  // AI filter state
  let filterPrompt = '';
  let filterResults = null; // Map<id, {relevant, reason}> or null when inactive
  let filterLoading = false;
  let filterError = '';
  let showOnlyRelevant = false;
  let editingPrompt = false;
  let draftPrompt = '';

  $: relevantCount = filterResults ? [...filterResults.values()].filter(r => r.relevant).length : 0;

  $: displayData = (() => {
    if (!filterResults) return renewablesData;
    if (showOnlyRelevant) return renewablesData.filter(item => filterResults.get(item.id)?.relevant);
    return renewablesData;
  })();

  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async function handleDismissToggle(item) {
    try {
      const newDismissed = !item.dismissed;
      await toggleRenewableDismissed(item.id, newDismissed);
      renewablesData = renewablesData.map(r => r.id === item.id ? { ...r, dismissed: newDismissed } : r);
    } catch (error) {
      console.error('Failed to toggle dismissed status:', error);
      alert('Failed to update dismissed status');
    }
  }

  async function handleApplyFilter() {
    filterLoading = true;
    filterError = '';
    try {
      const { results } = await applyScraperFilter('renewables');
      filterResults = new Map(results.map(r => [r.id, r]));
    } catch (err) {
      filterError = 'Filter failed — ' + err.message;
    } finally {
      filterLoading = false;
    }
  }

  function clearFilter() {
    filterResults = null;
    showOnlyRelevant = false;
    filterError = '';
  }

  function startEditPrompt() {
    draftPrompt = filterPrompt;
    editingPrompt = true;
  }

  async function savePrompt() {
    if (!draftPrompt.trim()) return;
    try {
      await updateScraperFilterPrompt('renewables', draftPrompt.trim());
      filterPrompt = draftPrompt.trim();
      editingPrompt = false;
    } catch (err) {
      alert('Failed to save prompt: ' + err.message);
    }
  }

  onMount(async () => {
    try {
      loading = true;
      const [result, prompts] = await Promise.all([getRenewables(), getScraperFilterPrompts()]);
      renewablesData = result.features.map(f => f.properties);
      const row = prompts.find(p => p.category === 'renewables');
      if (row) filterPrompt = row.prompt;
    } catch (error) {
      console.error('Failed to load renewables:', error);
      errorMsg = 'Failed to load renewables data';
    } finally {
      loading = false;
    }
  });
</script>

<div class="renewables-tab">
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
  {:else if renewablesData && renewablesData.length > 0}
    <div class="table-header">
      <div class="header-top">
        <h3>Renewables</h3>
        <span class="record-count">
          {#if filterResults}
            {relevantCount} relevant / {renewablesData.length} total
          {:else}
            {renewablesData.length} {renewablesData.length === 1 ? 'record' : 'records'}
          {/if}
        </span>
      </div>

      <div class="filter-toolbar">
        {#if !filterResults}
          <button class="btn-filter" on:click={handleApplyFilter} disabled={filterLoading}>
            {#if filterLoading}
              <div class="spinner-small"></div> Filtering…
            {:else}
              <i class="las la-magic"></i> AI Filter
            {/if}
          </button>
        {:else}
          <label class="toggle-label">
            <input type="checkbox" bind:checked={showOnlyRelevant} />
            Show relevant only
          </label>
          <button class="btn-clear" on:click={clearFilter}>
            <i class="las la-times"></i> Clear filter
          </button>
        {/if}
        <button class="btn-edit-prompt" on:click={startEditPrompt} title="Edit AI filter prompt">
          <i class="las la-pen"></i> Edit prompt
        </button>
      </div>

      {#if filterError}
        <p class="filter-error">{filterError}</p>
      {/if}

      {#if editingPrompt}
        <div class="prompt-editor">
          <textarea bind:value={draftPrompt} rows="4" placeholder="Describe what is relevant…"></textarea>
          <div class="prompt-editor-actions">
            <button class="btn-save" on:click={savePrompt}>Save</button>
            <button class="btn-cancel" on:click={() => editingPrompt = false}>Cancel</button>
          </div>
        </div>
      {/if}
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
          {#each displayData as item}
            {@const filterResult = filterResults?.get(item.id)}
            <tr
              class:dismissed={item.dismissed}
              class:relevant={filterResult?.relevant === true}
              class:not-relevant={filterResults && filterResult?.relevant === false}
              title={filterResult ? filterResult.reason : ''}
            >
              <td class="cell-name">{item.uid || '-'}</td>
              <td class="cell-description"><span title={item.description || ''}>{item.description || '-'}</span></td>
              <td class="cell-dismiss">
                <input type="checkbox" checked={item.dismissed} on:change={() => handleDismissToggle(item)} />
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
      <p>No renewables found</p>
    </div>
  {/if}
</div>

<style>
  .renewables-tab {
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

  .spinner-small {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid #d1d5db;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
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

  .error-state i { font-size: 3rem; margin-bottom: 1rem; }
  .error-state h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; }
  .error-state p { margin: 0; font-size: 0.875rem; }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
  }

  .empty-state i { font-size: 3rem; margin-bottom: 1rem; }

  .table-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .record-count { font-size: 0.875rem; color: #64748b; }

  .filter-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-filter, .btn-clear, .btn-edit-prompt, .btn-save, .btn-cancel {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s, color 0.15s;
  }

  .btn-filter {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
  }
  .btn-filter:hover:not(:disabled) { background: #4f46e5; }
  .btn-filter:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-clear {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }
  .btn-clear:hover { background: #e2e8f0; }

  .btn-edit-prompt {
    background: white;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .btn-edit-prompt:hover { background: #f8fafc; color: #334155; }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: #475569;
    cursor: pointer;
  }

  .filter-error {
    margin: 0;
    font-size: 0.8rem;
    color: #991b1b;
  }

  .prompt-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .prompt-editor textarea {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: #1e293b;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .prompt-editor-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-save { background: #10b981; color: white; border-color: #10b981; }
  .btn-save:hover { background: #059669; }
  .btn-cancel { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
  .btn-cancel:hover { background: #e2e8f0; }

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

  .data-table tbody tr:hover { background-color: #f8fafc; }

  .data-table tbody tr.dismissed {
    background-color: #f1f5f9;
    opacity: 0.6;
  }

  .data-table tbody tr.relevant {
    border-left: 3px solid #10b981;
    background-color: #f0fdf4;
  }

  .data-table tbody tr.relevant:hover { background-color: #dcfce7; }

  .data-table tbody tr.not-relevant {
    opacity: 0.35;
  }

  .data-table td {
    padding: 0.4rem 0.75rem;
    color: #334155;
  }

  .cell-dismiss { width: 80px; text-align: center; }
  .cell-dismiss input[type="checkbox"] { cursor: pointer; width: 16px; height: 16px; }

  .cell-name { font-weight: 500; color: #1e293b; max-width: 200px; }

  .cell-description { max-width: 500px; }
  .cell-description span {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    cursor: help;
  }

  .cell-address { max-width: 150px; }
  .cell-address span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: help;
  }

  .cell-date { white-space: nowrap; color: #64748b; }

  .cell-link { text-align: center; width: 60px; }

  .link-button { color: #3b82f6; text-decoration: none; font-size: 1.125rem; transition: color 0.15s; }
  .link-button:hover { color: #2563eb; }
</style>
