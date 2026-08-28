<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;

  const dispatch = createEventDispatcher();

  let includeTable = true;
  let includeProgress = true;
  let includeProgramme = true;
  let includeKeyDates = true;

  $: canExport = includeTable || includeProgress || includeProgramme || includeKeyDates;

  function handleExport() {
    if (!canExport) return;
    dispatch('export', { includeTable, includeProgress, includeProgramme, includeKeyDates });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal">
      <div class="modal-header">
        <h3><i class="las la-file-pdf"></i> Export Instructed Surveyors</h3>
        <button class="close-btn" on:click={handleClose}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        <p class="hint">Choose what to include in the PDF.</p>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeTable} />
          <span class="option-text">
            <span class="option-title">Instructed table</span>
            <span class="option-desc">Discipline, organisation, contact, instructed total, work status and dependencies</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeProgress} />
          <span class="option-text">
            <span class="option-title">Progress advancements</span>
            <span class="option-desc">Adds a Progress column with the full update history for each instructed quote</span>
          </span>
        </label>

        <div class="option-pair">
          <label class="option-row option-row-half">
            <input type="checkbox" bind:checked={includeProgramme} />
            <span class="option-text">
              <span class="option-title">Programme timeline</span>
              <span class="option-desc">Weekly timeline page from today to the latest programme date</span>
            </span>
          </label>
          <label class="option-row option-row-half">
            <input type="checkbox" bind:checked={includeKeyDates} />
            <span class="option-text">
              <span class="option-title">Key dates column</span>
              <span class="option-desc">Adds a Key Dates column to the table instead, listing each date and its text</span>
            </span>
          </label>
        </div>
        <p class="pair-hint">Same underlying dates - pick either view, or both.</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-primary" on:click={handleExport} disabled={!canExport}>
          <i class="las la-file-pdf"></i> Export PDF
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .modal-header h3 i {
    color: var(--color-red-600);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .close-btn:hover { color: var(--color-slate-800); }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .option-row {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .option-row:hover { border-color: var(--color-slate-300); background: var(--color-slate-50); }

  .option-pair {
    display: flex;
    gap: 0.625rem;
  }

  .option-row-half {
    flex: 1;
    min-width: 0;
  }

  .pair-hint {
    margin: -0.5rem 0 0;
    font-size: 0.7rem;
    color: var(--color-slate-400);
    font-style: italic;
  }

  .option-row input[type="checkbox"] {
    margin-top: 0.15rem;
    width: 1rem;
    height: 1rem;
    accent-color: var(--color-primary-500);
    cursor: pointer;
    flex-shrink: 0;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .option-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .option-desc {
    font-size: 0.75rem;
    color: var(--color-slate-500);
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.125rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn-primary {
    background: var(--color-primary-500);
    color: var(--color-white);
  }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: var(--color-white);
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-300);
  }
  .btn-secondary:hover { background: var(--color-slate-50); }
</style>
