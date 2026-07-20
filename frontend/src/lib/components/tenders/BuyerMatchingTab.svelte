<script>
  import { onMount } from 'svelte';
  import { getUnmatchedBuyers, getAuthorities, matchBuyer } from '$lib/api/tenders.js';

  let buyers = [];
  let authorities = [];
  let loading = true;
  let errorMsg = '';
  let selections = {};
  let matchingBuyer = null;

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async function load() {
    loading = true;
    errorMsg = '';
    try {
      [buyers, authorities] = await Promise.all([getUnmatchedBuyers(), getAuthorities()]);
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleMatch(buyer) {
    const authorityId = selections[buyer.buyer_name];
    if (!authorityId) return;
    matchingBuyer = buyer.buyer_name;
    try {
      const result = await matchBuyer(buyer.buyer_name, authorityId);
      buyers = buyers.filter((b) => b.buyer_name !== buyer.buyer_name);
      delete selections[buyer.buyer_name];
      if (result.notices_updated > 0) {
        console.log(`[tenders] matched ${buyer.buyer_name}: ${result.notices_updated} notices updated`);
      }
    } catch (err) {
      alert(`Failed to match buyer: ${err.message}`);
    } finally {
      matchingBuyer = null;
    }
  }

  onMount(load);
</script>

<div class="matching-tab">
  {#if errorMsg}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <h3>Error loading buyers</h3>
      <p>{errorMsg}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading unmatched buyers…</p>
    </div>
  {:else if buyers.length > 0}
    <p class="tab-intro">
      These buyers couldn't be automatically matched to a council. Many are legitimately not councils
      (NHS trusts, universities, government departments) — leave those unmatched. Where a buyer <em>is</em>
      a council (or a body you want tracked against one, like a development corporation), pick it and match:
      existing and future notices from that buyer will be linked automatically.
    </p>
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Buyer name (as published)</th>
            <th>Notices</th>
            <th>Latest notice</th>
            <th>Match to council</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each buyers as buyer (buyer.buyer_name)}
            <tr>
              <td class="cell-name">{buyer.buyer_name}</td>
              <td class="cell-num">{buyer.notice_count}</td>
              <td class="cell-date">{formatDate(buyer.latest_notice)}</td>
              <td>
                <select bind:value={selections[buyer.buyer_name]}>
                  <option value={undefined}>Select a council…</option>
                  {#each authorities as authority (authority.id)}
                    <option value={authority.id}>{authority.name}</option>
                  {/each}
                </select>
              </td>
              <td class="cell-action">
                <button
                  class="btn-primary"
                  disabled={!selections[buyer.buyer_name] || matchingBuyer === buyer.buyer_name}
                  on:click={() => handleMatch(buyer)}
                >
                  {#if matchingBuyer === buyer.buyer_name}
                    <div class="spinner-small"></div>
                  {:else}
                    <i class="las la-link"></i> Match
                  {/if}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state">
      <i class="las la-check-circle"></i>
      <p>No unmatched buyers — everything stored is linked or intentionally unlinked</p>
    </div>
  {/if}
</div>

<style>
  .matching-tab { display: flex; flex-direction: column; gap: 0.75rem; }

  .tab-intro { margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.5; }

  .loading-state, .empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #64748b;
    text-align: center;
  }

  .empty-state { color: #94a3b8; }
  .empty-state i, .error-state i { font-size: 3rem; margin-bottom: 1rem; }
  .error-state { color: #991b1b; }
  .error-state h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; }
  .error-state p { margin: 0; font-size: 0.875rem; }

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
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  .table-wrapper { overflow: auto; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .data-table thead { position: sticky; top: 0; background: #f8fafc; z-index: 10; }
  .data-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }
  .data-table tbody tr { border-bottom: 1px solid #f1f5f9; }
  .data-table tbody tr:hover { background-color: #f8fafc; }
  .data-table td { padding: 0.5rem 0.75rem; color: #334155; }

  .cell-name { font-weight: 500; color: #1e293b; max-width: 380px; }
  .cell-num { text-align: right; }
  .cell-date { white-space: nowrap; color: #64748b; }
  .cell-action { width: 100px; }

  select {
    padding: 0.35rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #1e293b;
    background: white;
    max-width: 280px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    background: #6366f1;
    color: white;
    border: 1px solid #6366f1;
    transition: background 0.15s;
  }
  .btn-primary:hover:not(:disabled) { background: #4f46e5; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
