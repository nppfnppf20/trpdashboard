<script>
  import { createEventDispatcher } from 'svelte';
  import NotesModal from '$lib/components/shared/NotesModal.svelte';
  import ContactModal from '$lib/components/admin-console/ContactModal.svelte';
  import LineItemsModal from '$lib/components/admin-console/LineItemsModal.svelte';
  import AddQuoteModal from '$lib/components/quotes/AddQuoteModal.svelte';
  import LinkTrackerItemsModal from '$lib/components/quotes/LinkTrackerItemsModal.svelte';
  import EditProjectModal from '$lib/components/surveyor-management/EditProjectModal.svelte';
  import InstructedModal from '$lib/components/surveyor-briefings/InstructedModal.svelte';
  import NotInstructedModal from '$lib/components/surveyor-briefings/NotInstructedModal.svelte';
  import PartiallyInstructedModal from '$lib/components/surveyor-briefings/PartiallyInstructedModal.svelte';
  import AddActionModal from './AddActionModal.svelte';
  import SurveyActionsDrawer from './SurveyActionsDrawer.svelte';
  import { updateQuoteNotes } from '$lib/api/quotes.js';
  import { getQuoteActions } from '$lib/api/quoteActions.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import { exportQuotesPdf } from '$lib/services/quotesPdfExport.js';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';

  export let quotes = [];
  export let loading = false;
  export let projectId = null;
  export let project = null;

  let sentRequests = [];
  let exporting = false;

  $: if (projectId) loadSentRequests(projectId); else sentRequests = [];

  async function loadSentRequests(pid) {
    try {
      sentRequests = await getSentRequestsForProject(pid);
    } catch (err) {
      console.error('Failed to load sent quote requests:', err);
      sentRequests = [];
    }
  }

  const dispatch = createEventDispatcher();

  // Internal modal state
  let showNotesModal = false;
  let showContactModal = false;
  let showLineItemsModal = false;
  let showAddQuoteModal = false;
  let showEditProjectModal = false;
  let showInstructedModal = false;
  let showNotInstructedModal = false;
  let showPartiallyInstructedModal = false;
  let selectedQuote = null;
  let editingQuote = null;
  let selectedContact = null;
  let pendingStatusChange = null;

  // Actions tracker state — full timeline per quote (quote + instructed stages)
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

  function getStatusClass(status) {
    return status ? status.replace(/\s+/g, '-') : 'pending';
  }

  // Sum of line item costs (always stored excl. VAT), excluding optional items.
  // Falls back to the stored total for quotes without line items.
  function exclVatTotal(quote) {
    if (quote.line_items && quote.line_items.length > 0) {
      return quote.line_items.reduce((sum, item) => sum + (item.is_optional ? 0 : (parseFloat(item.cost) || 0)), 0);
    }
    return parseFloat(quote.total) || 0;
  }

  // Single line item total: cost plus 20% VAT when the line has VAT included
  function lineTotal(item) {
    const cost = parseFloat(item.cost) || 0;
    return item.vat_included ? cost * 1.2 : cost;
  }

  // ── Column sorting — default: discipline A→Z ───────────────────────────────
  let sortKey = 'discipline';
  let sortDir = 1;   // 1 asc, -1 desc

  function setSort(key) {
    if (sortKey === key) {
      sortDir = -sortDir;
    } else {
      sortKey = key;
      sortDir = 1;
    }
  }

  function sortValue(quote, key) {
    switch (key) {
      case 'discipline': return (quote.discipline || '').toLowerCase();
      case 'organisation': return (quote.surveyor_organisation || '').toLowerCase();
      case 'exclVat': return exclVatTotal(quote);
      case 'total': return parseFloat(quote.total) || 0;
      case 'status': return (quote.instruction_status || '').toLowerCase();
      default: return '';
    }
  }

  $: sortedQuotes = [...quotes].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    let cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
    if (cmp === 0) {
      // Stable tiebreak: discipline, then organisation
      cmp = (a.discipline || '').localeCompare(b.discipline || '')
        || (a.surveyor_organisation || '').localeCompare(b.surveyor_organisation || '');
    }
    return cmp * sortDir;
  });

  function sortIcon(key) {
    if (sortKey !== key) return 'la-sort';
    return sortDir === 1 ? 'la-sort-up' : 'la-sort-down';
  }

  // Alternate subtle shading each time the discipline changes down the table,
  // so quotes for the same discipline read as one visual group
  $: rowBands = sortedQuotes.reduce((bands, q, i) => {
    const d = (q.discipline || '').toLowerCase();
    const prev = i ? (sortedQuotes[i - 1].discipline || '').toLowerCase() : null;
    bands.push(i === 0 ? 0 : (d === prev ? bands[i - 1] : 1 - bands[i - 1]));
    return bands;
  }, []);

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

  function openNotesModal(quote) {
    selectedQuote = quote;
    showNotesModal = true;
  }

  async function handleSaveNotes(event) {
    if (selectedQuote) {
      try {
        // Call API to update notes
        await updateQuoteNotes(selectedQuote.id, event.detail.notes);
        
        // Update local data on success
        const index = quotes.findIndex(q => q.id === selectedQuote.id);
        if (index !== -1) {
          quotes[index].quote_notes = event.detail.notes;
          quotes = quotes; // Trigger reactivity
        }
      } catch (error) {
        console.error('Failed to save notes:', error);
        alert('Failed to save notes: ' + error.message);
        return; // Don't close modal on error
      }
    }
    showNotesModal = false;
    selectedQuote = null;
  }

  function handleStatusChange(quoteId, newStatus) {
    const quote = quotes.find(q => q.id === quoteId);
    
    // If changing to "instructed", show confirmation modal
    if (newStatus === 'instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // If changing to "will not be instructed", show not instructed modal
    if (newStatus === 'will not be instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showNotInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // If changing to "partially instructed", show line items selection modal
    if (newStatus === 'partially instructed' && quote) {
      selectedQuote = quote;
      pendingStatusChange = { quoteId, newStatus };
      showPartiallyInstructedModal = true;
      return; // Don't dispatch yet, wait for confirmation
    }
    
    // For other statuses, dispatch immediately
    dispatch('statusChange', { quoteId, newStatus });
  }

  function handleInstructedConfirm() {
    if (pendingStatusChange) {
      dispatch('statusChange', pendingStatusChange);
      pendingStatusChange = null;
    }
    maybePromptLinking(selectedQuote);
    showInstructedModal = false;
    selectedQuote = null;
  }

  function handleInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showInstructedModal = false;
    selectedQuote = null;
  }

  function handleNotInstructedConfirm() {
    if (pendingStatusChange) {
      dispatch('statusChange', pendingStatusChange);
      pendingStatusChange = null;
    }
    showNotInstructedModal = false;
    selectedQuote = null;
  }

  function handleNotInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showNotInstructedModal = false;
    selectedQuote = null;
  }

  function handlePartiallyInstructedConfirm(event) {
    if (pendingStatusChange) {
      // Include the selected line items in the dispatch
      dispatch('statusChange', {
        ...pendingStatusChange,
        selectedLineItems: event.detail.selectedItems
      });
      pendingStatusChange = null;
    }
    maybePromptLinking(selectedQuote);
    showPartiallyInstructedModal = false;
    selectedQuote = null;
  }

  function handlePartiallyInstructedClose() {
    // Reset the dropdown to previous value
    if (pendingStatusChange && selectedQuote) {
      const index = quotes.findIndex(q => q.id === selectedQuote.id);
      if (index !== -1) {
        // Force reactivity by creating new array
        quotes = quotes;
      }
    }
    pendingStatusChange = null;
    showPartiallyInstructedModal = false;
    selectedQuote = null;
  }

  function handleEdit(quote) {
    editingQuote = quote;
    showEditProjectModal = true;
  }

  function handleEditQuoteUpdate(event) {
    // Dispatch the update event to parent for API call
    dispatch('updateQuote', { quote: event.detail.quote });
    showEditProjectModal = false;
    editingQuote = null;
  }

  function handleEditQuoteClose() {
    showEditProjectModal = false;
    editingQuote = null;
  }

  function handleDelete(quote) {
    dispatch('deleteQuote', { quote });
  }

  let showLinkConditions = false;
  let linkingQuote = null;
  let justInstructedLink = false;

  function openLinkConditions(quote) {
    linkingQuote = quote;
    justInstructedLink = false;
    showLinkConditions = true;
  }

  // Prompt to tag a survey against a condition/issue right after it's
  // instructed — but only the first time, so re-instructing an already
  // linked quote (e.g. changing which line items are instructed) doesn't nag.
  function maybePromptLinking(quote) {
    if (!quote) return;
    const hasLinks = (quote.linked_conditions?.length || 0) > 0 || (quote.linked_issues?.length || 0) > 0;
    if (!hasLinks) {
      linkingQuote = quote;
      justInstructedLink = true;
      showLinkConditions = true;
    }
  }

  function openAddQuoteModal() {
    if (!projectId) {
      alert('Please select a project first');
      return;
    }
    showAddQuoteModal = true;
  }

  function handleAddQuote(event) {
    const newQuote = event.detail.quote;
    // Dispatch to parent so it updates its quotes array
    dispatch('addQuote', { quote: newQuote });
  }

  // ── Export: PDF and Word summaries of quote requests sent + quotes in ──────

  function handleExportPdf() {
    exportQuotesPdf(project, sortedQuotes, sentRequests);
  }

  async function handleExportWord() {
    exporting = true;
    try {
      const html = buildExportHtml();
      await exportHtmlToWord(html, buildExportFilename(project, 'Surveyor Fee Quotes'));
    } finally {
      exporting = false;
    }
  }

  // Mirrors the status pill colours from badges.css (badge-select-*)
  const STATUS_COLORS = {
    'pending': { bg: '#fef3c7', text: '#92400e' },
    'instructed': { bg: '#d1fae5', text: '#065f46' },
    'partially instructed': { bg: '#d1fae5', text: '#065f46' },
    'will not be instructed': { bg: '#fee2e2', text: '#991b1b' },
  };

  function statusColors(status) {
    return STATUS_COLORS[(status || 'pending').toLowerCase()] || STATUS_COLORS.pending;
  }

  function buildExportHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t ?? ''}</td>`;
    const statusTd = (status) => {
      const text = status || 'pending';
      const { bg, text: color } = statusColors(text);
      return `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;background:${bg};color:${color};font-weight:600;">${text}</td>`;
    };

    const requestRows = sentRequests.map(r => {
      const recipients = (r.recipients || [])
        .map(rc => `${rc.organisation}${rc.contact_name ? ` (${rc.contact_name})` : ''}`)
        .join('<br>');
      return `<tr>
        ${td(new Date(r.sent_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}
        ${td(r.template_discipline || '')}
        ${td(recipients)}
      </tr>`;
    }).join('');

    // The Word converter has no rowspan support, so quote-level cells are
    // repeated on every line-item row rather than merged, keeping every row
    // the same width and the columns aligned under the header.
    const quoteRows = sortedQuotes.map(q => {
      const items = q.line_items?.length ? q.line_items : [null];
      return items.map(item => `<tr>
        ${td(q.discipline || '')}
        ${td(q.surveyor_organisation || '')}
        ${td(q.contact_name || '')}
        ${statusTd(q.instruction_status)}
        ${td(item ? (item.item || '') : 'No line items')}
        ${td(item ? formatCurrency(item.cost) : '')}
        ${td(item ? (item.vat_included ? 'Y' : 'N') : '')}
        ${td(item ? formatCurrency(lineTotal(item)) : '')}
        ${td(formatCurrency(q.total))}
      </tr>`).join('');
    }).join('');

    const projectLine = [project?.project_code, project?.site_name || project?.project_name].filter(Boolean).join(' - ');
    const exportedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return `<h2>Surveyor Quotes Summary</h2>
<p>Project: ${projectLine} | Exported: ${exportedDate}</p>
${sentRequests.length ? `<h3>Quote Requests Sent</h3>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Sent Date')}${th('Discipline')}${th('Recipients')}</tr></thead>
  <tbody>${requestRows}</tbody>
</table>` : ''}
<h3>Quotes Received</h3>
${sortedQuotes.length ? `<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Discipline')}${th('Organisation')}${th('Contact')}${th('Status')}${th('Item')}${th('Cost (excl. VAT)')}${th('VAT')}${th('Line Total')}${th('Quote Total (incl. VAT)')}</tr></thead>
  <tbody>${quoteRows}</tbody>
</table>` : '<p>No quotes received for this project.</p>'}`;
  }
</script>

<div class="content-panel">
  <div class="panel-header">
    <h2>Surveyor Quotes</h2>
    <div class="panel-header-actions">
      <button class="btn-add-action" on:click={() => openAddAction()} disabled={!quotes.length || !projectId}>
        <i class="las la-history"></i> Add Progress
      </button>
      <button class="btn btn-secondary" on:click={handleExportWord} disabled={exporting || (!quotes.length && !sentRequests.length)} title="Export a Word summary of quote requests sent and quotes received">
        <i class="las la-file-word"></i> Word
      </button>
      <button class="btn btn-secondary" on:click={handleExportPdf} disabled={!quotes.length && !sentRequests.length} title="Export a PDF summary of quote requests sent and quotes received">
        <i class="las la-file-pdf"></i> PDF
      </button>
      <button class="btn btn-primary" on:click={openAddQuoteModal}>
        <i class="las la-plus"></i>
        New Quote
      </button>
    </div>
  </div>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading quotes...</p>
    </div>
  {:else if quotes.length === 0}
    <p class="empty">No quotes for this project yet</p>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" on:click={() => setSort('discipline')}>
              Discipline <i class="las {sortIcon('discipline')}" class:sort-active={sortKey === 'discipline'}></i>
            </th>
            <th class="sortable" on:click={() => setSort('organisation')}>
              Organisation <i class="las {sortIcon('organisation')}" class:sort-active={sortKey === 'organisation'}></i>
            </th>
            <th>Contact Name</th>
            <th>Line Items</th>
            <th class="sortable" on:click={() => setSort('exclVat')}>
              Total (excl. VAT) <i class="las {sortIcon('exclVat')}" class:sort-active={sortKey === 'exclVat'}></i>
            </th>
            <th class="sortable" on:click={() => setSort('total')}>
              Total (incl. VAT) <i class="las {sortIcon('total')}" class:sort-active={sortKey === 'total'}></i>
            </th>
            <th class="sortable" on:click={() => setSort('status')}>
              Instruction Status <i class="las {sortIcon('status')}" class:sort-active={sortKey === 'status'}></i>
            </th>
            <th>Notes</th>
            <th>Progress</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedQuotes as quote, i (quote.id)}
            <tr class:discipline-band={rowBands[i] === 1}>
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
              <td>{formatCurrency(exclVatTotal(quote))}</td>
              <td class="text-bold">{formatCurrency(quote.total)}</td>
              <td>
                <select
                  class="badge-select badge-select-{getStatusClass(quote.instruction_status)}"
                  value={quote.instruction_status}
                  on:change={(e) => handleStatusChange(quote.id, e.target.value)}
                >
                  <option value="pending">pending</option>
                  <option value="instructed">instructed</option>
                  <option value="partially instructed">partially instructed</option>
                  <option value="will not be instructed">will not be instructed</option>
                </select>
              </td>
              <td class="notes-cell-compact">
                {#if quote.quote_notes}
                  <button class="notes-link" on:click={() => openNotesModal(quote)} title={quote.quote_notes}>
                    <span class="notes-preview">{quote.quote_notes}</span>
                  </button>
                {:else}
                  <button class="notes-link empty" on:click={() => openNotesModal(quote)}>
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
              <td class="actions-cell">
                <button
                  class="action-btn"
                  on:click={() => openLinkConditions(quote)}
                  title="Link to conditions / issues"
                >
                  <i class="las la-link"></i>
                </button>
                <button
                  class="action-btn edit-btn"
                  on:click={() => handleEdit(quote)}
                  title="Edit quote"
                >
                  <i class="las la-edit"></i>
                </button>
                <button
                  class="action-btn delete-btn"
                  on:click={() => handleDelete(quote)}
                  title="Delete quote"
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

<!-- Add Progress Modal (fan-out to ticked quotes) -->
<AddActionModal
  bind:show={showAddAction}
  {projectId}
  {quotes}
  stage="quote"
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
    stage="quote"
    on:done={handleActionsDone}
    on:updated={handleActionUpdated}
    on:deleted={handleActionDeleted}
    on:close={() => actionsQuote = null}
  />
{/if}

<!-- Notes Modal -->
<NotesModal
  show={showNotesModal}
  title="Quote Notes - {selectedQuote?.surveyor_organisation || ''}"
  notes={selectedQuote?.quote_notes || ''}
  on:save={handleSaveNotes}
  on:close={() => { showNotesModal = false; selectedQuote = null; }}
/>

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
  quoteId={selectedQuote?.id || null}
  allQuotes={quotes}
  on:close={() => { showLineItemsModal = false; selectedQuote = null; }}
/>

<!-- Add Quote Modal -->
<AddQuoteModal
  show={showAddQuoteModal}
  {projectId}
  projectPk={project?.id}
  on:save={handleAddQuote}
  on:close={() => showAddQuoteModal = false}
/>

<LinkTrackerItemsModal
  bind:show={showLinkConditions}
  projectPk={project?.id}
  quote={linkingQuote}
  justInstructed={justInstructedLink}
  on:done={() => { showLinkConditions = false; linkingQuote = null; justInstructedLink = false; }}
  on:close={() => { showLinkConditions = false; linkingQuote = null; justInstructedLink = false; }}
/>

<!-- Edit Quote Modal -->
<EditProjectModal
  show={showEditProjectModal}
  quote={editingQuote}
  on:update={handleEditQuoteUpdate}
  on:close={handleEditQuoteClose}
/>

<!-- Instructed Confirmation Modal -->
<InstructedModal
  show={showInstructedModal}
  quote={selectedQuote}
  on:confirm={handleInstructedConfirm}
  on:close={handleInstructedClose}
/>

<!-- Not Instructed Modal -->
<NotInstructedModal
  show={showNotInstructedModal}
  quote={selectedQuote}
  on:confirm={handleNotInstructedConfirm}
  on:close={handleNotInstructedClose}
/>

<!-- Partially Instructed Modal -->
<PartiallyInstructedModal
  show={showPartiallyInstructedModal}
  lineItems={selectedQuote?.line_items || []}
  discipline={selectedQuote?.discipline || ''}
  organisation={selectedQuote?.surveyor_organisation || ''}
  on:confirm={handlePartiallyInstructedConfirm}
  on:close={handlePartiallyInstructedClose}
/>

<style>
  .content-panel {
    background: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-add-action {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-300);
    border-radius: var(--radius-md);
    color: var(--color-violet-600);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-add-action:hover:not(:disabled) { background: var(--color-violet-100); border-color: var(--color-purple-600); }
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
    border-radius: var(--radius-md);
    padding: 4px 6px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
  }
  .qa-progress-cell:hover { border-color: var(--color-violet-300); background: var(--color-purple-50); }
  .qa-progress-date {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-purple-600);
  }
  .qa-progress-summary {
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--color-slate-700);
  }
  .qa-progress-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border-radius: var(--radius-pill);
    padding: 1px 7px;
    margin-top: 2px;
  }
  .qa-progress-empty {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-slate-400);
    background: white;
    border: 1px dashed var(--color-slate-300);
    border-radius: var(--radius-md);
    padding: 4px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .qa-progress-empty:hover { color: var(--color-purple-600); border-color: var(--color-violet-300); background: var(--color-purple-50); }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .contact-link {
    background: none;
    border: none;
    color: var(--color-primary-500);
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
    color: var(--color-primary-600);
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
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    border: none;
    border-radius: var(--radius-md);
    font-weight: normal;
    font-size: inherit;
  }

  .count-badge.clickable {
    cursor: pointer;
    transition: all 0.2s;
  }

  .count-badge.clickable:hover {
    background: var(--color-slate-200);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-slate-400);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .text-muted {
    color: var(--color-slate-400);
  }

  .notes-cell-compact {
    padding: 0.75rem 0.5rem !important;
  }

  .notes-link {
    background: white;
    border: 1px solid var(--color-slate-200);
    color: var(--color-slate-800);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 250px;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .notes-link:hover {
    background: var(--color-slate-50);
    border-color: var(--color-primary-500);
    color: var(--color-primary-500);
  }

  .notes-link.empty {
    color: var(--color-slate-400);
    font-style: italic;
    border-style: dashed;
  }

  .notes-link.empty:hover {
    background: var(--color-slate-50);
    color: var(--color-primary-500);
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

  /* Sortable column headers */
  th.sortable {
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  th.sortable:hover {
    color: var(--color-slate-800);
  }

  th.sortable i {
    font-size: 0.85rem;
    color: var(--color-slate-300);
    vertical-align: middle;
  }

  th.sortable i.sort-active {
    color: var(--color-primary-500);
  }

  /* Alternating discipline-group shading */
  tbody tr.discipline-band {
    background: var(--color-slate-100);
  }

  tbody tr.discipline-band:hover {
    background: var(--color-slate-200);
  }
</style>
