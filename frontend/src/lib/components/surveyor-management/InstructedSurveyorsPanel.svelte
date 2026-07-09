<script>
  import { createEventDispatcher } from 'svelte';
  import NotesModal from '$lib/components/shared/NotesModal.svelte';
  import ContactModal from '$lib/components/admin-console/ContactModal.svelte';
  import LineItemsModal from '$lib/components/admin-console/LineItemsModal.svelte';
  import AddActionModal from './AddActionModal.svelte';
  import SurveyActionsDrawer from './SurveyActionsDrawer.svelte';
  import { updateQuoteDependencies } from '$lib/api/quotes.js';
  import { getQuoteActions } from '$lib/api/quoteActions.js';
  import '$lib/styles/tables.css';
  import '$lib/styles/badges.css';
  import '$lib/styles/buttons.css';

  export let quotes = [];
  export let loading = false;
  export let projectId = null;

  const dispatch = createEventDispatcher();

  // Sort quotes by discipline to group same disciplines together
  $: sortedQuotes = [...quotes].sort((a, b) => {
    const disciplineA = (a.discipline || '').toLowerCase();
    const disciplineB = (b.discipline || '').toLowerCase();
    return disciplineA.localeCompare(disciplineB);
  });

  // Internal modal state
  let showDependenciesModal = false;
  let showContactModal = false;
  let showLineItemsModal = false;
  let selectedQuote = null;
  let selectedContact = null;

  // Actions tracker state (replaces operational notes)
  let actionsByQuote = {};      // quote_id -> [actions newest first]
  let showAddAction = false;
  let addActionPreselectId = null;
  let actionsQuote = null;      // quote whose timeline drawer is open

  $: if (projectId) loadActions(projectId);

  async function loadActions(pid) {
    try {
      const rows = await getQuoteActions(pid);
      const grouped = {};
      for (const a of rows) (grouped[a.quote_id] ||= []).push(a);
      actionsByQuote = grouped;
    } catch (err) {
      console.error('Failed to load actions:', err);
      actionsByQuote = {};
    }
  }

  function sortActions(arr) {
    return [...arr].sort(
      (a, b) => (b.action_date || '').localeCompare(a.action_date || '') || b.id - a.id
    );
  }

  function formatActionDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function openAddAction(quoteId = null) {
    addActionPreselectId = quoteId;
    showAddAction = true;
  }

  function handleActionsDone(e) {
    for (const row of e.detail.rows) {
      actionsByQuote = {
        ...actionsByQuote,
        [row.quote_id]: sortActions([...(actionsByQuote[row.quote_id] || []), row]),
      };
    }
  }

  function handleActionUpdated(e) {
    const a = e.detail.action;
    actionsByQuote = {
      ...actionsByQuote,
      [a.quote_id]: sortActions((actionsByQuote[a.quote_id] || []).map(x => x.id === a.id ? a : x)),
    };
  }

  function handleActionDeleted(e) {
    if (!actionsQuote) return;
    const qid = actionsQuote.id;
    actionsByQuote = {
      ...actionsByQuote,
      [qid]: (actionsByQuote[qid] || []).filter(x => x.id !== e.detail.id),
    };
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  }

  function openContactModal(quote) {
    selectedContact = {
      name: quote.contact_name,
      email: quote.contact_email,
      phone: quote.contact_phone,
      is_primary: quote.is_primary
    };
    showContactModal = true;
  }

  function openLineItemsModal(quote) {
    selectedQuote = quote;
    showLineItemsModal = true;
  }

  function getWorkStatusClass(status) {
    if (!status) return 'in-progress';
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  function handleWorkStatusChange(quoteId, newStatus) {
    dispatch('workStatusChange', { quoteId, newStatus });
  }

  function openDependenciesModal(quote) {
    selectedQuote = quote;
    showDependenciesModal = true;
  }

  async function handleSaveDependencies(event) {
    if (selectedQuote) {
      try {
        await updateQuoteDependencies(selectedQuote.id, event.detail.notes);

        // Update local data on success
        const index = quotes.findIndex(q => q.id === selectedQuote.id);
        if (index !== -1) {
          quotes[index].dependencies = event.detail.notes;
          quotes = quotes; // Trigger reactivity
        }
      } catch (error) {
        console.error('Failed to save dependencies:', error);
        alert('Failed to save dependencies: ' + error.message);
        return; // Don't close modal on error
      }
    }
    showDependenciesModal = false;
    selectedQuote = null;
  }

  </script>

<div class="content-panel">
  <div class="panel-header">
    <h2>Instructed Surveyors</h2>
    <button class="btn-add-action" on:click={() => openAddAction()} disabled={!quotes.length || !projectId}>
      <i class="las la-history"></i> Add Progress
    </button>
  </div>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if quotes.length === 0}
    <p class="empty">No instructed surveyors yet</p>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Discipline</th>
            <th>Organisation</th>
            <th>Contact</th>
            <th>Line Items</th>
            <th>Instructed Quote</th>
            <th>Work Status</th>
            <th>Dependencies</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedQuotes as quote}
            <tr>
              <td>{quote.discipline}</td>
              <td>{quote.surveyor_organisation}</td>
              <td>
                {#if quote.contact_name}
                  <button
                    class="contact-link"
                    on:click={() => openContactModal(quote)}
                    title="View contact details"
                  >
                    {quote.contact_name}
                    <i class="las la-external-link-alt"></i>
                  </button>
                {:else}
                  <span class="text-muted">-</span>
                {/if}
              </td>
              <td>
                {#if quote.line_items && quote.line_items.length > 0}
                  <button
                    class="count-badge clickable"
                    on:click={() => openLineItemsModal(quote)}
                    title="Click to view line items"
                  >
                    {quote.line_items.length}
                  </button>
                {:else}
                  <span class="count-badge">0</span>
                {/if}
              </td>
              <td class="text-bold">
                {#if quote.instruction_status === 'partially instructed'}
                  {formatCurrency(quote.partially_instructed_total)}
                  <span class="text-muted text-small">(partial)</span>
                {:else}
                  {formatCurrency(quote.total)}
                {/if}
              </td>
              <td>
                <select
                  class="badge-select badge-select-{getWorkStatusClass(quote.work_status)}"
                  value={quote.work_status || 'In progress'}
                  on:change={(e) => handleWorkStatusChange(quote.id, e.target.value)}
                >
                  <option value="In progress">In progress</option>
                  <option value="TRP Review">TRP Review</option>
                  <option value="Client Review">Client Review</option>
                  <option value="Back with author">Back with author</option>
                  <option value="Completed">Completed</option>
                </select>
              </td>
              <td class="notes-cell-compact">
                {#if quote.dependencies}
                  <button class="notes-link" on:click={() => openDependenciesModal(quote)} title={quote.dependencies}>
                    <span class="notes-preview">{quote.dependencies}</span>
                  </button>
                {:else}
                  <button class="notes-link empty" on:click={() => openDependenciesModal(quote)}>
                    Click to add
                  </button>
                {/if}
              </td>
              <td class="notes-cell-compact">
                {#if actionsByQuote[quote.id]?.length}
                  {@const latest = actionsByQuote[quote.id][0]}
                  <button class="qa-progress-cell" on:click={() => actionsQuote = quote} title="View full progress timeline">
                    <span class="qa-progress-date">{formatActionDate(latest.action_date)}</span>
                    <span class="qa-progress-summary">{latest.summary.length > 90 ? latest.summary.slice(0, 90) + '…' : latest.summary}</span>
                    <span class="qa-progress-count">{actionsByQuote[quote.id].length} update{actionsByQuote[quote.id].length !== 1 ? 's' : ''}</span>
                  </button>
                {:else}
                  <button class="qa-progress-empty" on:click={() => openAddAction(quote.id)} title="Add first update">
                    <i class="las la-plus"></i> Add
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Dependencies Modal -->
<NotesModal
  show={showDependenciesModal}
  title="Dependencies - {selectedQuote?.discipline || ''}"
  notes={selectedQuote?.dependencies || ''}
  on:save={handleSaveDependencies}
  on:close={() => { showDependenciesModal = false; selectedQuote = null; }}
/>

<!-- Add Action Modal (fan-out to ticked surveys) -->
<AddActionModal
  bind:show={showAddAction}
  {projectId}
  quotes={sortedQuotes}
  preselectedQuoteId={addActionPreselectId}
  on:done={handleActionsDone}
  on:close={() => { showAddAction = false; addActionPreselectId = null; }}
/>

<!-- Actions timeline drawer -->
{#if actionsQuote}
  <SurveyActionsDrawer
    quote={actionsQuote}
    actions={actionsByQuote[actionsQuote.id] || []}
    {projectId}
    on:done={handleActionsDone}
    on:updated={handleActionUpdated}
    on:deleted={handleActionDeleted}
    on:close={() => actionsQuote = null}
  />
{/if}

<!-- Contact Modal -->
<ContactModal
  bind:show={showContactModal}
  contact={selectedContact}
  on:close={() => { showContactModal = false; selectedContact = null; }}
/>

<!-- Line Items Modal -->
<LineItemsModal
  bind:show={showLineItemsModal}
  lineItems={selectedQuote?.line_items || []}
  discipline={selectedQuote?.discipline || ''}
  organisation={selectedQuote?.surveyor_organisation || ''}
  instructionStatus={selectedQuote?.instruction_status || ''}
  on:close={() => { showLineItemsModal = false; selectedQuote = null; }}
/>

<style>
  .content-panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .contact-link {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .contact-link:hover {
    color: #2563eb;
  }

  .contact-link i {
    font-size: 0.875rem;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    background: #f1f5f9;
    color: #475569;
    border: none;
    border-radius: 6px;
    font-weight: normal;
    font-size: inherit;
  }

  .count-badge.clickable {
    cursor: pointer;
    transition: all 0.2s;
  }

  .count-badge.clickable:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .text-muted {
    color: #94a3b8;
  }

  .text-small {
    font-size: 0.75rem;
    font-weight: 400;
  }

  .notes-cell-compact {
    padding: 0.75rem 0.5rem !important;
  }

  /* Actions tracker cell (mirrors conditions tracker progress cell) */
  .btn-add-action {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #faf5ff;
    border: 1px solid #d8b4fe;
    border-radius: 6px;
    color: #7c3aed;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-add-action:hover:not(:disabled) { background: #f3e8ff; border-color: #a855f7; }
  .btn-add-action:disabled { opacity: 0.4; cursor: not-allowed; }

  .qa-progress-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    max-width: 280px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 6px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
  }
  .qa-progress-cell:hover { border-color: #c4b5fd; background: #faf5ff; }
  .qa-progress-date {
    font-size: 0.7rem;
    font-weight: 700;
    color: #9333ea;
  }
  .qa-progress-summary {
    font-size: 0.76rem;
    line-height: 1.45;
    color: #334155;
  }
  .qa-progress-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 100px;
    padding: 1px 7px;
    margin-top: 2px;
  }
  .qa-progress-empty {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    background: white;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .qa-progress-empty:hover { color: #9333ea; border-color: #c4b5fd; background: #faf5ff; }

  .notes-link {
    background: white;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 250px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .notes-link:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .notes-link.empty {
    color: #94a3b8;
    font-style: italic;
    border-style: dashed;
  }

  .notes-link.empty:hover {
    background: #f8fafc;
    color: #3b82f6;
    font-style: normal;
    border-style: solid;
  }

  .notes-link i {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .notes-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  /* Actions column styling */
  :global(td.actions-cell) {
    white-space: nowrap;
    width: 1%;
    text-align: center;
  }

  :global(.action-btn) {
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

  :global(.action-btn:last-child) {
    margin-right: 0;
  }

  :global(.action-btn:hover) {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  :global(.edit-btn:hover) {
    color: #9333ea;
    border-color: #9333ea;
  }

  :global(.delete-btn:hover) {
    color: #ef4444;
    border-color: #ef4444;
  }
</style>
