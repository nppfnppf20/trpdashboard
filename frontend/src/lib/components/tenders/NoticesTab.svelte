<script>
  import { onMount } from 'svelte';
  import { listNotices, triggerSync, triggerClassify, updateNotice, getSyncRuns } from '$lib/api/tenders.js';

  let notices = [];
  let total = 0;
  let page = 1;
  const pageSize = 25;
  let loading = true;
  let errorMsg = '';

  let statusFilter = '';
  let stageFilter = '';
  let search = '';
  let searchDraft = '';

  let lastRun = null;
  let syncing = false;
  let classifying = false;
  let actionMsg = '';

  $: totalPages = Math.max(Math.ceil(total / pageSize), 1);

  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatValue(amount, currency) {
    if (amount === null || amount === undefined) return '-';
    const symbol = !currency || currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${Number(amount).toLocaleString('en-GB')}`;
  }

  async function load() {
    loading = true;
    errorMsg = '';
    try {
      const data = await listNotices({ status: statusFilter, stage: stageFilter, search, page, pageSize });
      notices = data.rows;
      total = data.total;
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadLastRun() {
    try {
      const runs = await getSyncRuns(1);
      lastRun = runs[0] || null;
    } catch {
      lastRun = null;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    page = 1;
    load();
  }

  function changePage(delta) {
    const next = page + delta;
    if (next < 1 || next > totalPages) return;
    page = next;
    load();
  }

  async function handleSync() {
    syncing = true;
    actionMsg = '';
    try {
      const result = await triggerSync({});
      const run = result.run;
      const cls = result.classification;
      actionMsg = `Sync complete: ${run.notices_stored} stored of ${run.notices_seen} seen` +
        (cls ? ` · classified ${cls.processed} (${cls.relevant} relevant)` : '');
      await Promise.all([load(), loadLastRun()]);
    } catch (err) {
      actionMsg = `Sync failed: ${err.message}`;
    } finally {
      syncing = false;
    }
  }

  async function handleClassify() {
    classifying = true;
    actionMsg = '';
    try {
      const result = await triggerClassify(200);
      actionMsg = `Classified ${result.processed} notices (${result.relevant} relevant, ${result.irrelevant} irrelevant)`;
      await load();
    } catch (err) {
      actionMsg = `Classification failed: ${err.message}`;
    } finally {
      classifying = false;
    }
  }

  async function setStatus(item, relevanceStatus) {
    try {
      const updated = await updateNotice(item.id, { relevance_status: relevanceStatus });
      notices = notices.map((n) => (n.id === item.id ? { ...n, ...updated } : n));
    } catch (err) {
      alert(`Failed to update: ${err.message}`);
    }
  }

  async function toggleDismissed(item) {
    try {
      const updated = await updateNotice(item.id, { dismissed: !item.dismissed });
      notices = notices.map((n) => (n.id === item.id ? { ...n, ...updated } : n));
    } catch (err) {
      alert(`Failed to update: ${err.message}`);
    }
  }

  onMount(() => {
    load();
    loadLastRun();
  });
</script>

<div class="notices-tab">
  <div class="toolbar">
    <div class="toolbar-left">
      <select bind:value={statusFilter} on:change={applyFilters}>
        <option value="">All statuses</option>
        <option value="relevant">Relevant</option>
        <option value="candidate">Awaiting review</option>
        <option value="irrelevant">Irrelevant</option>
        <option value="dismissed">Dismissed</option>
      </select>
      <select bind:value={stageFilter} on:change={applyFilters}>
        <option value="">All stages</option>
        <option value="planning">Planning</option>
        <option value="tender">Tender</option>
        <option value="award">Award</option>
      </select>
      <input
        type="text"
        placeholder="Search title, description, buyer…"
        bind:value={searchDraft}
        on:keydown={(e) => e.key === 'Enter' && applyFilters()}
      />
      <button class="btn-secondary" on:click={applyFilters}>
        <i class="las la-search"></i> Search
      </button>
    </div>
    <div class="toolbar-right">
      <button class="btn-secondary" on:click={handleClassify} disabled={classifying || syncing}>
        {#if classifying}<div class="spinner-small"></div> Classifying…{:else}<i class="las la-magic"></i> Run AI review{/if}
      </button>
      <button class="btn-primary" on:click={handleSync} disabled={syncing || classifying}>
        {#if syncing}<div class="spinner-small"></div> Syncing…{:else}<i class="las la-sync"></i> Sync now{/if}
      </button>
    </div>
  </div>

  <div class="status-line">
    {#if lastRun}
      <span>
        Last sync: {formatDate(lastRun.started_at)}
        · {lastRun.status}
        · {lastRun.notices_stored} stored of {lastRun.notices_seen} seen
      </span>
    {/if}
    {#if actionMsg}<span class="action-msg">{actionMsg}</span>{/if}
  </div>

  {#if errorMsg}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <h3>Error loading notices</h3>
      <p>{errorMsg}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading notices…</p>
    </div>
  {:else if notices.length > 0}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Buyer / Council</th>
            <th>Stage</th>
            <th>Published</th>
            <th>Deadline</th>
            <th>Value</th>
            <th>Status</th>
            <th>Actions</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {#each notices as item (item.id)}
            <tr
              class:relevant={item.relevance_status === 'relevant'}
              class:not-relevant={item.relevance_status === 'irrelevant'}
              class:dismissed={item.dismissed}
            >
              <td class="cell-name">
                <span class="notice-title">{item.title || '(no title)'}</span>
                {#if item.description}
                  <span class="notice-description" title={item.description}>{item.description}</span>
                {/if}
              </td>
              <td class="cell-buyer">
                {item.buyer_name || '-'}
                {#if item.authority_name}
                  <span class="authority-badge" title="Matched council">{item.authority_name}</span>
                {/if}
              </td>
              <td class="cell-stage">{item.stage || '-'}</td>
              <td class="cell-date">{formatDate(item.publication_date)}</td>
              <td class="cell-date">{formatDate(item.deadline)}</td>
              <td class="cell-value">{formatValue(item.value_amount, item.value_currency)}</td>
              <td class="cell-status">
                <span class="status-badge status-{item.relevance_status}" title={item.llm_reason || ''}>
                  {item.relevance_status === 'candidate' ? 'awaiting review' : item.relevance_status}
                </span>
                {#if item.classified_by}
                  <span class="classified-by">by {item.classified_by}</span>
                {/if}
              </td>
              <td class="cell-actions">
                <button
                  class="icon-btn icon-btn-green"
                  title="Mark relevant"
                  disabled={item.relevance_status === 'relevant'}
                  on:click={() => setStatus(item, 'relevant')}
                ><i class="las la-check"></i></button>
                <button
                  class="icon-btn icon-btn-red"
                  title="Mark irrelevant"
                  disabled={item.relevance_status === 'irrelevant'}
                  on:click={() => setStatus(item, 'irrelevant')}
                ><i class="las la-times"></i></button>
                <button
                  class="icon-btn"
                  title={item.dismissed ? 'Restore' : 'Dismiss'}
                  on:click={() => toggleDismissed(item)}
                ><i class="las {item.dismissed ? 'la-undo' : 'la-eye-slash'}"></i></button>
              </td>
              <td class="cell-link">
                {#if item.notice_url}
                  <a href={item.notice_url} target="_blank" rel="noopener noreferrer" class="link-button" title="Open on Find a Tender">
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

    <div class="pagination">
      <button class="btn-secondary" on:click={() => changePage(-1)} disabled={page <= 1}>
        <i class="las la-angle-left"></i> Prev
      </button>
      <span>Page {page} of {totalPages} · {total} notices</span>
      <button class="btn-secondary" on:click={() => changePage(1)} disabled={page >= totalPages}>
        Next <i class="las la-angle-right"></i>
      </button>
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-inbox"></i>
      <p>No notices found - try a sync, or loosen the filters</p>
    </div>
  {/if}
</div>

<style>
  .notices-tab { display: flex; flex-direction: column; gap: 0.75rem; }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .toolbar-left, .toolbar-right { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

  .toolbar select, .toolbar input[type="text"] {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: var(--color-slate-800);
    background: white;
  }

  .toolbar input[type="text"] { min-width: 220px; }

  .btn-primary, .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.85rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s;
  }

  .btn-primary { background: var(--color-primary-500); color: white; border-color: var(--color-primary-500); }
  .btn-primary:hover:not(:disabled) { background: var(--color-violet-700); }
  .btn-secondary { background: white; color: var(--color-slate-600); border-color: var(--color-slate-200); }
  .btn-secondary:hover:not(:disabled) { background: var(--color-slate-100); }
  .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

  .status-line {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    min-height: 1rem;
    flex-wrap: wrap;
  }

  .action-msg { color: var(--color-violet-800); font-weight: 500; }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid var(--color-slate-100);
    border-top: 3px solid var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .spinner-small {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid var(--color-slate-300);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  .loading-state, .empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-slate-500);
    text-align: center;
  }

  .empty-state { color: var(--color-slate-400); }
  .empty-state i, .error-state i { font-size: 3rem; margin-bottom: 1rem; }
  .error-state { color: var(--color-red-800); }
  .error-state h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; }
  .error-state p { margin: 0; font-size: 0.875rem; }

  .table-wrapper { overflow: auto; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .data-table thead { position: sticky; top: 0; background: var(--color-slate-50); z-index: 10; }
  .data-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600);
    border-bottom: 2px solid var(--color-slate-200);
    white-space: nowrap;
  }
  .data-table tbody tr { border-bottom: 1px solid var(--color-slate-100); transition: background-color 0.15s; }
  .data-table tbody tr:hover { background-color: var(--color-slate-50); }
  .data-table td { padding: 0.5rem 0.75rem; color: var(--color-slate-700); vertical-align: top; }

  .data-table tbody tr.relevant { border-left: 3px solid var(--color-emerald-500); background-color: var(--color-slate-100); }
  .data-table tbody tr.relevant:hover { background-color: var(--color-emerald-100); }
  .data-table tbody tr.not-relevant { opacity: 0.45; }
  .data-table tbody tr.dismissed { background-color: var(--color-slate-100); opacity: 0.5; }

  .cell-name { max-width: 340px; }
  .notice-title { display: block; font-weight: 500; color: var(--color-slate-800); }
  .notice-description {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--color-slate-500);
    line-height: 1.4;
    margin-top: 0.15rem;
    cursor: help;
  }

  .cell-buyer { max-width: 180px; }
  .authority-badge {
    display: inline-block;
    margin-top: 0.2rem;
    padding: 0.1rem 0.4rem;
    background: var(--color-indigo-100);
    color: var(--color-violet-800);
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .cell-stage { text-transform: capitalize; white-space: nowrap; }
  .cell-date { white-space: nowrap; color: var(--color-slate-500); }
  .cell-value { white-space: nowrap; }

  .status-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-relevant { background: var(--color-emerald-100); color: var(--color-emerald-800); }
  .status-irrelevant { background: var(--color-red-100); color: var(--color-red-800); }
  .status-candidate { background: var(--color-amber-100); color: var(--color-amber-800); }
  .status-dismissed { background: var(--color-slate-200); color: var(--color-slate-600); }

  .classified-by { display: block; font-size: 0.65rem; color: var(--color-slate-400); margin-top: 0.15rem; }

  .cell-actions { white-space: nowrap; }
  .icon-btn {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 0.3rem;
    padding: 0.2rem 0.4rem;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 0.9rem;
    transition: background 0.15s;
  }
  .icon-btn:hover:not(:disabled) { background: var(--color-slate-100); }
  .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .icon-btn-green { color: var(--color-emerald-600); }
  .icon-btn-red { color: var(--color-red-600); }

  .cell-link { text-align: center; width: 50px; }
  .link-button { color: var(--color-primary-500); text-decoration: none; font-size: 1.125rem; }
  .link-button:hover { color: var(--color-primary-600); }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    padding: 0.5rem 0;
  }
</style>
