<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;

  const dispatch = createEventDispatcher();

  let includeQuotes = false;
  let includeInstructed = false;
  let includeProgramme = false;

  function handleExport() {
    dispatch('export', { includeQuotes, includeInstructed, includeProgramme });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal">
      <div class="modal-header">
        <h3><i class="las la-file-pdf"></i> Export Conditions Tracker</h3>
        <button class="close-btn" on:click={handleClose}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        <p class="hint">The Conditions Tracker table is always included. Optionally bundle this project's surveyor management data into the same PDF.</p>

        <label class="option-row option-row-locked">
          <input type="checkbox" checked disabled />
          <span class="option-text">
            <span class="option-title">Conditions Tracker</span>
            <span class="option-desc">Conditions, requirements, reasons, consultants and progress</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeQuotes} />
          <span class="option-text">
            <span class="option-title">Surveyor Quotes</span>
            <span class="option-desc">Adds a page with quote requests sent and quotes received</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeInstructed} />
          <span class="option-text">
            <span class="option-title">Instructed Surveyors</span>
            <span class="option-desc">Adds a page with the instructed table, key dates and progress advancements</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeProgramme} />
          <span class="option-text">
            <span class="option-title">Programme Timeline</span>
            <span class="option-desc">Adds a weekly timeline page from today to the latest programme date</span>
          </span>
        </label>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-primary" on:click={handleExport}>
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
    z-index: 2000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
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

  .option-row-locked {
    cursor: default;
    background: var(--color-slate-50);
  }
  .option-row-locked:hover { border-color: var(--color-slate-200); background: var(--color-slate-50); }

  .option-row input[type="checkbox"] {
    margin-top: 0.15rem;
    width: 1rem;
    height: 1rem;
    accent-color: var(--color-primary-500);
    cursor: pointer;
    flex-shrink: 0;
  }

  .option-row-locked input[type="checkbox"] {
    cursor: default;
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

</style>
