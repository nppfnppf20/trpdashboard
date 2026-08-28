<script>
  import { createEventDispatcher } from 'svelte';
  import { createCondition } from '$lib/api/conditions.js';
  import { cleanPastedText } from '$lib/utils/pdfText.js';

  export let show = false;
  export let projectId;
  export let startNumber = 1;   // first condition number for this batch (continues from the tracker)

  const dispatch = createEventDispatcher();

  let bulkRows = [];
  let bulkSaving = false;
  let bulkError = null;

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
      initial_actions: ''
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
    dispatch('close');
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
                  <label>Condition Wording</label>
                  <textarea bind:value={row.wording} rows="3" placeholder="Paste the full wording of the condition here…"></textarea>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>Reason</label>
                  <textarea bind:value={row.reason} rows="2" placeholder="Paste the stated reason for the condition…"></textarea>
                </div>
              </div>
              <div class="bulk-form-row">
                <div class="field">
                  <label>Requirements <span class="label-hint">separate parts that each need discharging</span></label>
                  {#each row.requirements as _, ri}
                    <div class="req-row">
                      <input type="text" bind:value={row.requirements[ri].text} placeholder="e.g. (a) Details of planting species and densities" />
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
</style>
