<script>
  import { createEventDispatcher } from 'svelte';
  import { deleteSentRequest } from '$lib/api/quoteRequests.js';

  export let sentRequests = [];

  const dispatch = createEventDispatcher();

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatRecipients(recipients) {
    if (!recipients || recipients.length === 0) return '-';
    return recipients.map(r => r.organisation).join(', ');
  }

  function getDisciplines(recipients) {
    if (!recipients || recipients.length === 0) return '';
    const disciplines = [...new Set(recipients.map(r => r.discipline))];
    return disciplines.join(', ');
  }

  async function copyToClipboard(emailContent) {
    try {
      await navigator.clipboard.writeText(emailContent);
      alert('Email content copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      fallbackCopy(emailContent);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('Email content copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard');
    }
    document.body.removeChild(textArea);
  }

  async function handleDelete(request) {
    const confirmed = confirm(`Delete this quote request sent on ${formatDate(request.sent_date)}?`);
    if (!confirmed) return;

    try {
      await deleteSentRequest(request.id);
      dispatch('deleted', { id: request.id });
    } catch (err) {
      console.error('Error deleting sent request:', err);
      alert('Failed to delete: ' + err.message);
    }
  }
</script>

<div class="history-container">
  {#if sentRequests.length === 0}
    <div class="empty">
      <i class="las la-inbox"></i>
      <p>No quote requests sent yet</p>
    </div>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Surveyors</th>
            <th>Disciplines</th>
            <th>Template</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each sentRequests as request}
            <tr>
              <td>{formatDate(request.sent_date)}</td>
              <td>
                <div class="recipients">
                  {formatRecipients(request.recipients)}
                </div>
              </td>
              <td>
                <div class="disciplines">
                  {#each [...new Set((request.recipients || []).map(r => r.discipline))] as discipline}
                    <span class="discipline-tag">{discipline}</span>
                  {/each}
                </div>
              </td>
              <td>{request.template_name || 'Custom'}</td>
              <td class="actions-cell">
                <button
                  class="action-btn view-btn"
                  on:click={() => copyToClipboard(request.email_content)}
                  title="Copy email content to clipboard"
                >
                  <i class="las la-copy"></i>
                </button>
                <button
                  class="action-btn delete-btn"
                  on:click={() => handleDelete(request)}
                  title="Delete"
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

<style>
  .history-container {
    width: 100%;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-slate-400);
  }

  .empty i {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .table-wrapper {
    overflow-x: auto;
    /* Cap long histories with their own scrollbar so the Master Templates
       section below stays reachable */
    max-height: 420px;
    overflow-y: auto;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
  }

  .data-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    color: var(--color-slate-600);
    font-weight: 600;
    border-bottom: 2px solid var(--color-slate-200);
    white-space: nowrap;
  }

  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
    color: var(--color-slate-800);
  }

  .data-table tbody tr:hover {
    background: var(--color-slate-50);
  }

  .recipients {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .disciplines {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .discipline-tag {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

</style>
