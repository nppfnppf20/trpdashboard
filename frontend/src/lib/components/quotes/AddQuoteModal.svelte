<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { createQuote, extractQuoteFromDocument } from '$lib/api/quotes.js';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SearchableDropdown from '$lib/components/shared/SearchableDropdown.svelte';
  import AutocompleteInput from '$lib/components/shared/AutocompleteInput.svelte';

  export let show = false;
  export let projectId = null;

  const dispatch = createEventDispatcher();

  // ── Active form fields — reflect either the queue item currently being
  // reviewed (batch mode) or a blank/manual entry (queue.length === 0) ──────
  let discipline = '';
  let organisation = '';
  let contact = '';
  let lineItems = [blankLineItem()];
  let additionalNotes = '';

  let organisations = [];
  let availableContacts = [];
  let disciplineOptions = [];
  let lineItemSuggestions = [];

  let dragOver = false;
  let fileInput;

  // Transform organisations to SearchableDropdown format
  $: organisationOptions = organisations.map(org => ({
    id: org.id,
    label: `${org.organisation} - ${org.discipline}`
  }));

  onMount(async () => {
    try {
      const [orgs, disciplines, itemSuggestions] = await Promise.all([
        getAllSurveyorOrganisations(),
        getLookupOptions('surveyor_disciplines'),
        getLookupOptions('line_item_suggestions')
      ]);
      organisations = orgs;
      disciplineOptions = disciplines;
      lineItemSuggestions = itemSuggestions;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  });

  // When organisation changes, update available contacts
  $: {
    if (organisation) {
      const selectedOrg = organisations.find(org => org.id === organisation);
      availableContacts = selectedOrg?.contacts || [];
      // Reset contact if it's not in the new org
      if (contact && !availableContacts.find(c => c.id === contact)) {
        contact = '';
      }
    } else {
      availableContacts = [];
      contact = '';
    }
  }

  // Line total: cost plus 20% VAT when VAT included is ticked
  function lineTotal(item) {
    const cost = parseFloat(item.cost) || 0;
    return item.vatIncluded ? cost * 1.2 : cost;
  }

  // Reactive total calculation - updates automatically when lineItems change (optional items excluded)
  $: total = lineItems.reduce((sum, item) => sum + (item.optional ? 0 : lineTotal(item)), 0);

  function blankLineItem() {
    return { stage: '', item: '', description: '', cost: '', vatIncluded: true, optional: false, tbc: false };
  }

  function addLineItem() {
    lineItems = [...lineItems, blankLineItem()];
  }

  function removeLineItem(index) {
    lineItems = lineItems.filter((_, i) => i !== index);
  }

  // ── Batch upload queue ─────────────────────────────────────────────────────
  // Each uploaded file becomes a queue entry that goes through extraction and
  // review independently. The active entry's fields are copied into the
  // top-level form variables above; edits are captured back into the entry
  // when navigating away (goToIndex), the same prev/next pattern used by the
  // surveyor-briefing drafts flow (see BriefingEditor / SurveyorBriefingPanel).
  const CONCURRENCY = 3;
  let queue = []; // [{ id, file, name, status: 'queued'|'extracting'|'ready'|'error'|'saved', error, extractNotice, form }]
  let currentIndex = null;
  let activeCount = 0;

  $: currentItem = currentIndex !== null ? queue[currentIndex] : null;
  $: savedCount = queue.filter(q => q.status === 'saved').length;
  $: allSaved = queue.length > 0 && savedCount === queue.length;
  $: canSave = (currentItem && (currentItem.status === 'ready' || currentItem.status === 'error'))
    || (!currentItem && queue.length === 0);

  function blankForm() {
    return { discipline: '', organisation: '', contact: '', lineItems: [blankLineItem()], additionalNotes: '' };
  }

  function captureFormInto(item) {
    if (!item || item.status === 'saved') return;
    item.form = { discipline, organisation, contact, lineItems, additionalNotes };
  }

  function loadFormFrom(item) {
    const form = item?.form || blankForm();
    discipline = form.discipline;
    organisation = form.organisation;
    contact = form.contact;
    lineItems = form.lineItems;
    additionalNotes = form.additionalNotes;
  }

  function goToIndex(index) {
    if (index === currentIndex || index === null || index < 0 || index >= queue.length) return;
    captureFormInto(queue[currentIndex]);
    currentIndex = index;
    loadFormFrom(queue[currentIndex]);
  }

  function statusLabel(status) {
    return {
      queued: 'waiting',
      extracting: 'reading…',
      ready: 'ready to review',
      error: 'failed to read',
      saved: 'saved'
    }[status] || status;
  }

  function enqueueFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const items = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      status: 'queued',
      error: null,
      extractNotice: null,
      form: blankForm()
    }));
    queue = [...queue, ...items];
    pumpQueue();
  }

  function pumpQueue() {
    while (activeCount < CONCURRENCY) {
      const next = queue.find(q => q.status === 'queued');
      if (!next) break;
      startExtraction(next);
    }
  }

  function onItemSettled(item, idx) {
    if (currentIndex === null) {
      goToIndex(idx);
    } else if (currentIndex === idx) {
      loadFormFrom(item);
    }
  }

  // Loose match: strip common suffixes/punctuation so "Acme Ecology Ltd" matches "Acme Ecology"
  function normaliseOrgName(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[.,]/g, '')
      .replace(/\b(ltd|limited|llp|plc|consultants?|consulting|associates?)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findMatchingOrganisation(name, disciplineLabel) {
    const target = normaliseOrgName(name);
    if (!target) return null;
    const candidates = organisations.filter(org => {
      const orgName = normaliseOrgName(org.organisation);
      return orgName && (orgName === target || orgName.includes(target) || target.includes(orgName));
    });
    if (candidates.length <= 1) return candidates[0] || null;
    // Same organisation name can appear once per discipline — prefer the row matching the extracted discipline
    if (disciplineLabel) {
      const disciplineMatch = candidates.find(o => (o.discipline || '').toLowerCase() === disciplineLabel.toLowerCase());
      if (disciplineMatch) return disciplineMatch;
    }
    return candidates[0];
  }

  async function startExtraction(item) {
    activeCount++;
    item.status = 'extracting';
    queue = queue;
    try {
      if (!/\.(pdf|docx?|txt)$/i.test(item.file.name)) {
        throw new Error('Please upload a PDF or Word document.');
      }
      const { extraction, warning } = await extractQuoteFromDocument(item.file);
      const form = blankForm();

      // Discipline: only set if it matches an existing option
      if (extraction.discipline) {
        const match = disciplineOptions.find(
          o => o.label.toLowerCase() === extraction.discipline.toLowerCase()
        );
        if (match) form.discipline = match.label;
      }

      // Organisation: auto-select on a confident match; contact is always left for the user
      let matchedOrg = null;
      if (extraction.organisation_name) {
        matchedOrg = findMatchingOrganisation(extraction.organisation_name, form.discipline);
        if (matchedOrg) form.organisation = matchedOrg.id;
      }

      if (extraction.line_items?.length) {
        form.lineItems = extraction.line_items.map(li => ({
          stage: li.stage || '',
          item: li.item || '',
          description: li.description || '',
          cost: li.cost != null ? String(li.cost) : '',
          vatIncluded: li.vat_included === true,
          optional: li.is_optional === true,
          tbc: li.is_tbc === true
        }));
      }

      if (extraction.notes) form.additionalNotes = extraction.notes;

      item.status = 'ready';
      item.form = form;
      item.extractNotice = {
        organisation: matchedOrg ? null : (extraction.organisation_name || null),
        warning: warning || null
      };
      item.error = null;
    } catch (err) {
      item.status = 'error';
      item.error = err.message;
    } finally {
      activeCount--;
      queue = queue;
      const idx = queue.findIndex(q => q.id === item.id);
      onItemSettled(item, idx);
      pumpQueue();
    }
  }

  function nextReviewableIndex(fromExclusive) {
    for (let i = fromExclusive + 1; i < queue.length; i++) {
      if (queue[i].status === 'ready' || queue[i].status === 'error') return i;
    }
    for (let i = 0; i <= fromExclusive; i++) {
      if (queue[i].status === 'ready' || queue[i].status === 'error') return i;
    }
    return -1;
  }

  function advanceAfterSave() {
    const next = nextReviewableIndex(currentIndex);
    if (next !== -1) {
      currentIndex = next;
      loadFormFrom(queue[currentIndex]);
      return;
    }
    const processingIdx = queue.findIndex(q => q.status === 'queued' || q.status === 'extracting');
    if (processingIdx !== -1) {
      currentIndex = processingIdx;
      loadFormFrom(queue[currentIndex]);
    } else {
      currentIndex = null;
    }
  }

  function handleDrop(e) {
    dragOver = false;
    enqueueFiles(e.dataTransfer?.files);
  }

  function handleFilePick(e) {
    enqueueFiles(e.target.files);
    e.target.value = '';
  }

  async function saveCurrent() {
    // Validation
    if (!discipline) {
      alert('Please select a discipline');
      return;
    }
    if (!organisation) {
      alert('Please select an organisation');
      return;
    }

    try {
      const filteredLineItems = lineItems
        .filter(item => item.item || item.description || item.cost)
        .map(item => ({
          item: item.item,
          description: item.description,
          cost: parseFloat(item.cost) || 0,
          stage: item.stage?.trim() || null,
          is_optional: item.optional === true,
          is_tbc: item.tbc === true,
          vat_included: item.vatIncluded !== false
        }));

      const quoteData = {
        project_id: projectId,
        surveyor_organisation_id: organisation,
        contact_id: contact || null,
        discipline: discipline,
        total: total,
        quote_notes: additionalNotes || null,
        line_items: filteredLineItems
      };

      const newQuote = await createQuote(quoteData);
      dispatch('save', { quote: newQuote });

      if (currentIndex !== null && queue[currentIndex]) {
        // Batch mode: mark this entry saved and move on to the next one to review
        queue[currentIndex].status = 'saved';
        queue[currentIndex].form = { discipline, organisation, contact, lineItems, additionalNotes };
        queue = queue;
        advanceAfterSave();
      } else {
        // Pure manual entry (no files uploaded): reset and close, as before
        loadFormFrom(null);
        dispatch('close');
      }
    } catch (error) {
      console.error('Failed to create quote:', error);
      alert('Failed to create quote: ' + error.message);
    }
  }

  function resetAll() {
    queue = [];
    currentIndex = null;
    activeCount = 0;
    loadFormFrom(null);
  }

  function handleClose() {
    const unsaved = queue.filter(q => q.status !== 'saved').length;
    if (unsaved > 0 && !confirm(`You have ${unsaved} quote${unsaved === 1 ? '' : 's'} from this upload that haven't been saved yet. Close anyway?`)) {
      return;
    }
    resetAll();
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>
          <i class="las la-file-invoice-dollar"></i>
          Add New Quote
        </h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Prefill from document(s) -->
        {#if queue.length === 0}
          <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
          <div
            class="extract-dropzone"
            class:drag-over={dragOver}
            on:click={() => fileInput.click()}
            on:dragover|preventDefault={() => dragOver = true}
            on:dragleave={() => dragOver = false}
            on:drop|preventDefault={handleDrop}
          >
            <i class="las la-file-upload"></i>
            Drag &amp; drop one or more quote PDFs here to prefill the form, or click to browse
          </div>
        {:else}
          <div class="batch-strip">
            <div class="batch-dots">
              {#each queue as q, i (q.id)}
                <button
                  type="button"
                  class="batch-dot status-{q.status}"
                  class:active={i === currentIndex}
                  title="{q.name} — {statusLabel(q.status)}"
                  on:click={() => goToIndex(i)}
                >
                  {#if q.status === 'extracting'}
                    <i class="las la-circle-notch la-spin"></i>
                  {:else if q.status === 'saved'}
                    <i class="las la-check"></i>
                  {:else if q.status === 'error'}
                    <i class="las la-exclamation"></i>
                  {:else}
                    {i + 1}
                  {/if}
                </button>
              {/each}
            </div>
            <div class="batch-strip-actions">
              <span class="batch-summary">{savedCount} of {queue.length} saved</span>
              <button type="button" class="batch-add-btn" on:click={() => fileInput.click()}>
                <i class="las la-plus"></i> Add more
              </button>
            </div>
          </div>
        {/if}
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          bind:this={fileInput}
          on:change={handleFilePick}
          style="display: none;"
        />

        {#if currentItem?.status === 'queued' || currentItem?.status === 'extracting'}
          <div class="processing-card">
            <i class="las la-circle-notch la-spin"></i>
            {currentItem.status === 'extracting' ? `Reading ${currentItem.name}…` : `Waiting to process ${currentItem.name}…`}
          </div>
        {:else if currentItem || queue.length === 0}
          {#if currentItem?.status === 'error'}
            <div class="extract-error">Couldn't read {currentItem.name} automatically ({currentItem.error}). Fill in the details manually below.</div>
          {/if}
          {#if currentItem?.extractNotice}
            <div class="extract-notice">
              <i class="las la-magic"></i>
              Fields suggested from the document — review everything before saving.
              {#if currentItem.extractNotice.organisation}
                Quote appears to be from <strong>{currentItem.extractNotice.organisation}</strong>; select the organisation and contact below.
              {/if}
              {#if currentItem.extractNotice.warning}
                <div class="extract-warning">{currentItem.extractNotice.warning}</div>
              {/if}
            </div>
          {/if}

          <!-- Discipline Field -->
          <div class="form-group">
            <label for="discipline">Discipline <span class="required">*</span></label>
            <select id="discipline" bind:value={discipline}>
              <option value="">Select a discipline...</option>
              {#each disciplineOptions as opt}
                <option value={opt.label}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <!-- Organisation Field -->
          <div class="form-group">
            <label for="organisation">Organisation <span class="required">*</span></label>
            <SearchableDropdown
              id="organisation"
              options={organisationOptions}
              bind:value={organisation}
              valueField="id"
              placeholder="Select an organisation..."
            />
          </div>

          <!-- Contact Field -->
          <div class="form-group">
            <label for="contact">Contact</label>
            <select id="contact" bind:value={contact} disabled={!organisation}>
              <option value="">Select a contact...</option>
              {#each availableContacts as c}
                <option value={c.id}>{c.name} {#if c.email}({c.email}){/if}</option>
              {/each}
            </select>
          </div>

          <!-- Line Items Section -->
          <div class="section-divider">
            <h3>Line Items</h3>
          </div>

          <table class="line-items-table">
            <thead>
              <tr>
                <th style="width: 11%;">Stage</th>
                <th style="width: 20%;">Item</th>
                <th style="width: 26%;">Description</th>
                <th style="width: 12%;">Cost (£ excl. VAT)</th>
                <th style="width: 6%;" class="vat-header">VAT</th>
                <th style="width: 6%;" class="vat-header">Opt</th>
                <th style="width: 6%;" class="vat-header">TBC</th>
                <th style="width: 9%;">Total (£)</th>
                <th style="width: 4%;"></th>
              </tr>
            </thead>
            <tbody>
              {#each lineItems as lineItem, index}
                <tr>
                  <td>
                    <input
                      type="text"
                      bind:value={lineItem.stage}
                      placeholder="Stage"
                    />
                  </td>
                  <td>
                    <AutocompleteInput
                      suggestions={lineItemSuggestions}
                      bind:value={lineItem.item}
                      placeholder="e.g., Desk-based assessment"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      bind:value={lineItem.description}
                      placeholder="Detailed description..."
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      bind:value={lineItem.cost}
                      placeholder="0.00"
                      inputmode="decimal"
                      on:input={(e) => {
                        // Only allow numbers and decimal point
                        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                        // Prevent multiple decimal points
                        const parts = e.target.value.split('.');
                        if (parts.length > 2) {
                          e.target.value = parts[0] + '.' + parts.slice(1).join('');
                        }
                        lineItem.cost = e.target.value;
                        // Trigger Svelte reactivity
                        lineItems = lineItems;
                      }}
                    />
                  </td>
                  <td class="vat-cell">
                    <input
                      type="checkbox"
                      bind:checked={lineItem.vatIncluded}
                      title="VAT included (adds 20%)"
                    />
                  </td>
                  <td class="vat-cell">
                    <input
                      type="checkbox"
                      bind:checked={lineItem.optional}
                      title="Optional line item"
                    />
                  </td>
                  <td class="vat-cell">
                    <input
                      type="checkbox"
                      bind:checked={lineItem.tbc}
                      title="To be confirmed"
                    />
                  </td>
                  <td class="line-total-cell">
                    £{lineTotal(lineItem).toFixed(2)}
                  </td>
                  <td class="action-cell">
                    {#if lineItems.length > 1}
                      <button
                        type="button"
                        class="remove-line-btn"
                        on:click={() => removeLineItem(index)}
                        title="Remove this line item"
                      >
                        <i class="las la-trash"></i>
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          <button type="button" class="add-line-btn" on:click={addLineItem}>
            <i class="las la-plus"></i>
            Add Line Item
          </button>

          <!-- Total Display -->
          <div class="total-display">
            <span class="total-label">Total:</span>
            <span class="total-amount">£{total.toFixed(2)}</span>
          </div>

          <!-- Additional Notes Section -->
          <div class="section-divider">
            <h3>Additional Notes</h3>
          </div>

          <div class="form-group">
            <label for="notes">Notes</label>
            <textarea
              id="notes"
              bind:value={additionalNotes}
              placeholder="Any additional information or notes about this quote..."
              rows="4"
            ></textarea>
          </div>
        {:else if allSaved}
          <div class="batch-complete">
            <i class="las la-check-circle"></i>
            All {queue.length} quote{queue.length === 1 ? '' : 's'} saved.
          </div>
        {:else}
          <div class="processing-card">
            <i class="las la-circle-notch la-spin"></i>
            Processing your quotes…
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          {allSaved ? 'Close' : 'Cancel'}
        </button>
        {#if queue.length > 0}
          <button
            class="btn btn-secondary"
            on:click={() => goToIndex(currentIndex - 1)}
            disabled={currentIndex === null || currentIndex === 0}
          >
            <i class="las la-chevron-left"></i> Prev
          </button>
          <button
            class="btn btn-secondary"
            on:click={() => goToIndex(currentIndex + 1)}
            disabled={currentIndex === null || currentIndex >= queue.length - 1}
          >
            Next <i class="las la-chevron-right"></i>
          </button>
        {/if}
        {#if currentItem?.status === 'saved'}
          <span class="saved-badge"><i class="las la-check-circle"></i> Saved</span>
        {:else if canSave}
          <button class="btn btn-primary" on:click={saveCurrent}>
            <i class="las la-save"></i>
            {queue.length > 0 ? 'Save & Next' : 'Add Quote'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-header h2 i {
    font-size: 1.5rem;
    color: #3b82f6;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
  }

  .form-group select,
  .form-group input,
  .form-group textarea {
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
  }

  .form-group select:focus,
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group textarea {
    resize: vertical;
  }

  .section-divider {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid #e2e8f0;
  }

  .section-divider h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .line-items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .line-items-table thead tr {
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }

  .line-items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .line-items-table tbody tr {
    border-bottom: 1px solid #e2e8f0;
  }

  .line-items-table td {
    padding: 0.75rem 0.5rem;
    vertical-align: middle;
  }

  .line-items-table input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
    box-sizing: border-box;
    margin: 0;
  }

  .line-items-table input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Hide number input spinner arrows */
  .line-items-table input[type="number"]::-webkit-inner-spin-button,
  .line-items-table input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .line-items-table input[type="number"] {
    -moz-appearance: textfield;
  }

  .action-cell {
    text-align: center;
  }

  .vat-header,
  .vat-cell {
    text-align: center;
  }

  .line-items-table .vat-cell input[type="checkbox"] {
    width: auto;
    cursor: pointer;
    accent-color: #3b82f6;
    transform: scale(1.2);
  }

  .line-total-cell {
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
  }

  .remove-line-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 1.125rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .remove-line-btn:hover {
    background: #fee2e2;
  }

  .add-line-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .add-line-btn:hover {
    background: #eff6ff;
  }

  .total-display {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
  }

  .total-label {
    font-weight: 600;
    color: #1e40af;
    font-size: 1rem;
  }

  .total-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e40af;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }

  .saved-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #16a34a;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0 0.25rem;
  }

  @media (max-width: 768px) {
    .line-item-fields {
      grid-template-columns: 1fr;
    }

    .cost-field {
      width: 100%;
    }
  }

  /* Prefill-from-document drop zone */
  .extract-dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .extract-dropzone i { font-size: 1.2rem; }
  .extract-dropzone:hover { border-color: #93c5fd; background: #eff6ff; color: #2563eb; }
  .extract-dropzone.drag-over { border-color: #3b82f6; background: #dbeafe; color: #1d4ed8; }

  .extract-notice {
    padding: 0.6rem 0.85rem;
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    border-radius: 8px;
    color: #1e40af;
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .extract-notice i { margin-right: 0.25rem; }
  .extract-warning {
    margin-top: 0.35rem;
    color: #92400e;
  }
  .extract-error {
    padding: 0.6rem 0.85rem;
    border: 1px solid #fecaca;
    background: #fef2f2;
    border-radius: 8px;
    color: #dc2626;
    font-size: 0.8rem;
  }

  /* Batch upload progress strip */
  .batch-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .batch-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .batch-dot {
    width: 2rem;
    height: 2rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
    border-radius: 50%;
    background: white;
    color: #94a3b8;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .batch-dot:hover { border-color: #93c5fd; }
  .batch-dot.active { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25); }
  .batch-dot.status-extracting { border-color: #93c5fd; color: #2563eb; }
  .batch-dot.status-ready { border-color: #93c5fd; color: #2563eb; }
  .batch-dot.status-error { border-color: #fca5a5; background: #fef2f2; color: #dc2626; }
  .batch-dot.status-saved { border-color: #86efac; background: #f0fdf4; color: #16a34a; }

  .batch-strip-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .batch-summary {
    font-size: 0.8rem;
    color: #64748b;
    white-space: nowrap;
  }

  .batch-add-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #3b82f6;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .batch-add-btn:hover { background: #eff6ff; border-color: #93c5fd; }

  .processing-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: #2563eb;
    font-size: 0.9rem;
    background: #eff6ff;
    border: 1px dashed #93c5fd;
    border-radius: 8px;
  }
  .processing-card i { font-size: 1.2rem; }

  .batch-complete {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: #16a34a;
    font-size: 1rem;
    font-weight: 600;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 8px;
  }
  .batch-complete i { font-size: 1.4rem; }
</style>
