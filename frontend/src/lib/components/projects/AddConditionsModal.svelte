<script>
  import { createEventDispatcher } from 'svelte';
  import { createCondition, extractConditionsFromDocument } from '$lib/api/conditions.js';
  import { cleanPastedText } from '$lib/utils/pdfText.js';

  export let show = false;
  export let projectId;
  export let startNumber = 1;   // first condition number for this batch (continues from the tracker)

  const dispatch = createEventDispatcher();

  let bulkRows = [];
  let bulkSaving = false;
  let bulkError = null;

  // ── Extract from decision notice ────────────────────────────────────────
  let fileInput;
  let dragOver = false;
  let extracting = false;
  let extractError = null;
  let extractWarning = null;
  let sourceText = null;       // raw parsed text of the last extracted document, kept for manual comparison
  let sourceFileName = null;
  let showSourceText = false;

  const TYPE_OPTIONS = [
    'Pre-Commencement',
    'Pre-Beneficial Use',
    'Action Required (not Pre-Commencement)',
    'Compliance',
    'Informative',
  ];

  function emptyRow() {
    return {
      title: '',
      condition_type: '',
      wording: '',
      reason: '',
      requirements: [],
      initial_actions: '',
      _verbatim: null,
    };
  }

  // Seed rows whenever the modal opens
  $: if (show && bulkRows.length === 0) {
    bulkRows = Array.from({ length: 4 }, emptyRow);
  }

  function closeBulkModal() {
    if (bulkSaving) return;
    show = false;
    bulkRows = [];
    bulkError = null;
    extractError = null;
    extractWarning = null;
    sourceText = null;
    sourceFileName = null;
    showSourceText = false;
    dispatch('close');
  }

  // Clears a field's stale verbatim-check flag once the user edits it —
  // the check reflects the text as extracted, not whatever they've typed since.
  function clearVerbatim(row, key) {
    if (row._verbatim) row._verbatim = { ...row._verbatim, [key]: null };
  }
  function clearRequirementVerbatim(req) {
    if (req._verbatim) req._verbatim = null;
  }

  async function handleExtractFile(file) {
    if (!file) return;
    extracting = true;
    extractError = null;
    extractWarning = null;
    try {
      const { conditions, warning, sourceText: text } = await extractConditionsFromDocument(projectId, file);
      if (!conditions?.length) {
        extractError = 'Could not find any conditions in this document.';
        return;
      }
      sourceText = text || null;
      sourceFileName = file.name;
      extractWarning = warning || null;
      // Replaces the (empty, unsaved) starter rows entirely with the
      // extracted set — reviewed/edited the same way manually-entered rows are.
      bulkRows = conditions.map(c => ({
        title: c.title || '',
        condition_type: c.condition_type || '',
        wording: c.wording || '',
        reason: c.reason || '',
        requirements: (c.requirements || []).map(r => ({ text: r.requirement_text, type: '', _verbatim: r._verbatim || null })),
        initial_actions: '',
        _verbatim: c._verbatim || null,
      }));
    } catch (err) {
      extractError = err.message;
    } finally {
      extracting = false;
    }
  }

  function handleExtractDrop(e) {
    dragOver = false;
    handleExtractFile(e.dataTransfer?.files?.[0]);
  }

  function handleExtractPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    handleExtractFile(file);
  }

  function addBulkRow() {
    bulkRows = [...bulkRows, emptyRow()];
  }

  function removeBulkRow(i) {
    bulkRows = bulkRows.filter((_, idx) => idx !== i);
  }

  function addRequirement(i) {
    bulkRows = bulkRows.map((r, idx) => idx === i ? { ...r, requirements: [...r.requirements, { text: '', type: '' }] } : r);
  }

  function removeRequirement(i, ri) {
    bulkRows = bulkRows.map((r, idx) => idx === i
      ? { ...r, requirements: r.requirements.filter((_, j) => j !== ri) }
      : r);
  }

  function rowHasContent(r) {
    return !!(r.title.trim() || r.wording.trim());
  }

  async function saveAll() {
    const toSave = bulkRows.filter(rowHasContent);
    if (toSave.length === 0) { bulkError = 'At least one condition needs a title or wording'; return; }
    bulkSaving = true;
    bulkError = null;
    try {
      const saved = [];
      // Sequential so rows keep the order they were entered in;
      // numbers are assigned automatically, continuing from the tracker
      let number = startNumber;
      for (const r of toSave) {
        const row = await createCondition(projectId, {
          condition_number: String(number),
          title:            r.title.trim() || `Condition ${number}`,
          condition_type:   r.condition_type || null,
          status:           (r.condition_type === 'Compliance' || r.condition_type === 'Informative') ? 'N/A' : undefined,
          wording:          cleanPastedText(r.wording.trim()) || null,
          reason:           cleanPastedText(r.reason.trim()) || null,
          initial_actions:  cleanPastedText(r.initial_actions.trim()) || null,
          requirements:     r.requirements
            .filter(q => q.text.trim())
            .map(q => ({ requirement_text: q.text.trim(), requirement_type: q.type || null }))
        });
        saved.push(row);
        number += 1;
      }
      if (saved.length) dispatch('done', { rows: saved });
      bulkSaving = false;
      closeBulkModal();
    } catch (err) {
      bulkError = err.message;
      bulkSaving = false;
    }
  }
</script>

{#if show}
  <div class="bulk-backdrop" on:click|self={closeBulkModal} role="presentation">
    <div class="bulk-modal">
      <div class="bulk-modal-header">
        <h3>Add Conditions</h3>
        <button class="bulk-close-btn" on:click={closeBulkModal}>&times;</button>
      </div>

      <div class="extract-section">
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
        <div
          class="extract-dropzone"
          class:drag-over={dragOver}
          class:extracting
          on:click={() => !extracting && fileInput.click()}
          on:dragover|preventDefault={() => !extracting && (dragOver = true)}
          on:dragleave={() => dragOver = false}
          on:drop|preventDefault={handleExtractDrop}
        >
          {#if extracting}
            <span class="extract-spinner"></span> Reading decision notice…
          {:else}
            <i class="las la-file-upload"></i>
            Drag &amp; drop a decision notice here to prefill the conditions below, or click to browse
          {/if}
        </div>
        <input type="file" accept=".pdf,.docx,.txt" bind:this={fileInput} on:change={handleExtractPick} style="display: none;" />
        {#if extractError}<div class="extract-note extract-note-error">{extractError}</div>{/if}
        {#if extractWarning}<div class="extract-note extract-note-warning">{extractWarning}</div>{/if}
        {#if sourceText}
          <div class="extract-note extract-note-info">
            <i class="las la-info-circle"></i>
            Extracted from {sourceFileName}. Fields flagged <span class="verbatim-badge verbatim-flag"><i class="las la-exclamation-triangle"></i> Check this</span> didn't closely match the source text — compare against the original before trusting them.
            <button type="button" class="source-text-toggle" on:click={() => showSourceText = !showSourceText}>
              {showSourceText ? 'Hide' : 'View'} extracted source text
            </button>
            {#if showSourceText}<pre class="source-text-body">{sourceText}</pre>{/if}
          </div>
        {/if}
      </div>

      <div class="bulk-modal-body">
        {#each bulkRows as row, i (i)}
          <div class="bulk-row-card">
            <div class="bulk-row-number" title="Condition number - assigned automatically">#{startNumber + i}</div>
            <div class="bulk-row-fields">
              <div class="bulk-form-row two-col">
                <div class="field">
                  <label>Title</label>
                  <input type="text" bind:value={row.title} placeholder="e.g. Landscape and Ecological Management Plan" />
                </div>
                <div class="field field--type">
                  <label>Type</label>
                  <select bind:value={row.condition_type}>
                    <option value="">Select type</option>
                    {#each TYPE_OPTIONS as t}<option value={t}>{t}</option>{/each}
                  </select>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>
                    Condition Wording
                    {#if row._verbatim?.wording}
                      <span class="verbatim-badge" class:verbatim-ok={row._verbatim.wording.verified} class:verbatim-flag={!row._verbatim.wording.verified} title={row._verbatim.wording.verified ? 'Closely matches the source document' : `Only ~${Math.round(row._verbatim.wording.score * 100)}% match to the source text — check against the original`}>
                        <i class="las {row._verbatim.wording.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i> {row._verbatim.wording.verified ? 'Verbatim' : 'Check this'}
                      </span>
                    {/if}
                  </label>
                  <textarea bind:value={row.wording} on:input={() => clearVerbatim(row, 'wording')} rows="3" placeholder="Paste the full wording of the condition here…"></textarea>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>
                    Reason
                    {#if row._verbatim?.reason}
                      <span class="verbatim-badge" class:verbatim-ok={row._verbatim.reason.verified} class:verbatim-flag={!row._verbatim.reason.verified} title={row._verbatim.reason.verified ? 'Closely matches the source document' : `Only ~${Math.round(row._verbatim.reason.score * 100)}% match to the source text — check against the original`}>
                        <i class="las {row._verbatim.reason.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i> {row._verbatim.reason.verified ? 'Verbatim' : 'Check this'}
                      </span>
                    {/if}
                  </label>
                  <textarea bind:value={row.reason} on:input={() => clearVerbatim(row, 'reason')} rows="2" placeholder="Paste the stated reason for the condition…"></textarea>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>Requirements <span class="label-hint">separate parts that each need discharging</span></label>
                  {#each row.requirements as _, ri}
                    <div class="req-row">
                      <input type="text" bind:value={row.requirements[ri].text} on:input={() => clearRequirementVerbatim(row.requirements[ri])} placeholder="e.g. (a) Details of planting species and densities" />
                      {#if row.requirements[ri]._verbatim}
                        <span class="verbatim-badge" class:verbatim-ok={row.requirements[ri]._verbatim.verified} class:verbatim-flag={!row.requirements[ri]._verbatim.verified} title={row.requirements[ri]._verbatim.verified ? 'Closely matches the source document' : `Only ~${Math.round(row.requirements[ri]._verbatim.score * 100)}% match to the source text — check against the original`}>
                          <i class="las {row.requirements[ri]._verbatim.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i>
                        </span>
                      {/if}
                      <select class="req-type-select" bind:value={row.requirements[ri].type}>
                        <option value="">Type…</option>
                        {#each TYPE_OPTIONS as t}<option value={t}>{t}</option>{/each}
                      </select>
                      <button class="req-remove-btn" on:click={() => removeRequirement(i, ri)} title="Remove requirement">
                        <i class="las la-times"></i>
                      </button>
                    </div>
                  {/each}
                  <button class="add-req-btn" on:click={() => addRequirement(i)}>
                    <i class="las la-plus"></i> Add requirement
                  </button>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>TRP Internal Notes</label>
                  <textarea bind:value={row.initial_actions} rows="1" placeholder="First steps, who's responsible, anything to note…"></textarea>
                </div>
              </div>
            </div>
            {#if bulkRows.length > 1}
              <button class="bulk-remove-btn" on:click={() => removeBulkRow(i)} title="Remove row">
                <i class="las la-times"></i>
              </button>
            {/if}
          </div>
        {/each}

        <button class="bulk-add-row-btn" on:click={addBulkRow}>
          <i class="las la-plus-circle"></i> Add Row
        </button>
      </div>

      {#if bulkError}
        <div class="bulk-error">{bulkError}</div>
      {/if}

      <div class="bulk-modal-footer">
        <span class="bulk-count-hint">{bulkRows.filter(rowHasContent).length} of {bulkRows.length} rows will be saved</span>
        <div class="bulk-footer-actions">
          <button class="btn-cancel" on:click={closeBulkModal} disabled={bulkSaving}>Cancel</button>
          <button class="btn-save" on:click={saveAll} disabled={bulkSaving}>
            {bulkSaving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .bulk-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .bulk-modal {
    background: var(--color-white);
    border-radius: 12px;
    width: 95%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .bulk-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .bulk-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .bulk-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .bulk-close-btn:hover { color: var(--color-slate-800); }

  .bulk-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bulk-row-card {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    background: var(--color-violet-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 10px;
    padding: 1rem;
    position: relative;
  }

  .bulk-row-number {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-primary-600);
    background: var(--color-primary-100);
    border-radius: 20px;
    padding: 0.15rem 0.5rem;
    flex-shrink: 0;
    margin-top: 0.2rem;
    white-space: nowrap;
  }

  .bulk-row-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  .bulk-remove-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-slate-400);
    border-radius: 6px;
    margin-top: 0.15rem;
  }
  .bulk-remove-btn:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .bulk-form-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bulk-form-row.two-col {
    flex-direction: row;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .bulk-form-row.two-col .field { flex: 1; min-width: 0; }
  .bulk-form-row.two-col .field--type { flex: 0 0 260px; }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .label-hint { font-weight: 400; color: var(--color-slate-400); }
  input[type="text"], select, textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: var(--color-white);
    resize: vertical;
  }
  input[type="text"]:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: var(--focus-ring-blue);
  }

  /* Requirements list within a row */
  .req-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .req-row input { flex: 1; }
  .req-type-select {
    flex: 0 0 190px;
    font-size: 0.8rem;
  }
  .req-remove-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-slate-400);
    border-radius: 6px;
  }
  .req-remove-btn:hover { background: var(--color-red-50); color: var(--color-red-600); }
  .add-req-btn {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    color: var(--color-primary-600);
    font-size: 0.78rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
  }
  .add-req-btn:hover { background: var(--color-primary-100); }

  .bulk-add-row-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1.25rem;
    border: 2px dashed var(--color-violet-300);
    background: var(--color-white);
    color: var(--color-primary-600);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    justify-content: center;
  }
  .bulk-add-row-btn:hover { background: var(--color-violet-50); border-color: var(--color-primary-600); }
  .bulk-add-row-btn i { font-size: 1.1rem; }

  .bulk-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .bulk-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .bulk-count-hint {
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }
  .bulk-footer-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid var(--color-slate-300);
    background: var(--color-white);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-primary-600);
    color: var(--color-white);
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Extract from decision notice ────────────────────────────────────── */
  .extract-section {
    padding: 1rem 1.5rem 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .extract-dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    border: 2px dashed var(--color-slate-300);
    border-radius: 8px;
    background: var(--color-slate-50);
    color: var(--color-slate-500);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .extract-dropzone i { font-size: 1.2rem; }
  .extract-dropzone:hover { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-600); }
  .extract-dropzone.drag-over { border-color: var(--color-primary-500); background: var(--color-primary-100); color: var(--color-primary-700); }
  .extract-dropzone.extracting { cursor: default; }

  .extract-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: extract-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes extract-spin { to { transform: rotate(360deg); } }

  .extract-note {
    font-size: 0.8rem;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .extract-note-error   { color: var(--color-badge-danger-fg); background: var(--color-badge-danger-bg); }
  .extract-note-warning { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }
  .extract-note-info    { color: var(--color-slate-600); background: var(--color-slate-50); }
  .extract-note-info i { margin-right: 0.25rem; }

  .source-text-toggle {
    display: block;
    margin-top: 0.4rem;
    border: none;
    background: none;
    color: var(--color-primary-600);
    font-size: 0.78rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
  }
  .source-text-toggle:hover { text-decoration: underline; }
  .source-text-body {
    margin-top: 0.4rem;
    max-height: 220px;
    overflow-y: auto;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    font-size: 0.75rem;
    color: var(--color-slate-700);
    white-space: pre-wrap;
  }

  .verbatim-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    margin-left: 0.4rem;
    vertical-align: middle;
    white-space: nowrap;
  }
  .verbatim-ok   { color: var(--color-badge-success-fg); background: var(--color-badge-success-bg); }
  .verbatim-flag { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }
</style>
