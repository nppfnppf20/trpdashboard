<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let format = 'pdf';   // 'pdf' | 'word'

  const dispatch = createEventDispatcher();

  let includeStatutory = true;
  let includePublic = false;
  let includeAnalysis = false;

  $: canExport = includeStatutory || includePublic || includeAnalysis;
  $: isWord = format === 'word';
  $: icon = isWord ? 'la-file-word' : 'la-file-pdf';
  $: label = isWord ? 'Word' : 'PDF';

  function handleExport() {
    if (!canExport) return;
    dispatch('export', { includeStatutory, includePublic, includeAnalysis });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal">
      <div class="modal-header" class:modal-header-word={isWord}>
        <h3><i class="las {icon}"></i> Export Consultation Tracker</h3>
        <button class="close-btn" on:click={handleClose}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        <p class="hint">Choose what to include in the {label}.</p>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeStatutory} />
          <span class="option-text">
            <span class="option-title">Statutory Consultee table</span>
            <span class="option-desc">Consultee, date, position, comments, progress and status</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includePublic} />
          <span class="option-text">
            <span class="option-title">Public Comments table</span>
            <span class="option-desc">Name, date, position, comment and further info</span>
          </span>
        </label>

        <label class="option-row">
          <input type="checkbox" bind:checked={includeAnalysis} />
          <span class="option-text">
            <span class="option-title">Public Comments Analysis</span>
            <span class="option-desc">The last-run summary and recurring-theme breakdown - can be included on its own, without the raw table</span>
          </span>
        </label>

        <p class="pair-hint">Tick both tables for the full combined tracker.</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-primary" on:click={handleExport} disabled={!canExport}>
          <i class="las {icon}"></i> Export {label}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
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
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .modal-header h3 i {
    color: #dc2626;
  }
  .modal-header-word h3 i {
    color: #2563eb;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .close-btn:hover { color: #1e293b; }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .hint {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
  }

  .option-row {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .option-row:hover { border-color: #cbd5e1; background: #f8fafc; }

  .pair-hint {
    margin: -0.25rem 0 0;
    font-size: 0.7rem;
    color: #94a3b8;
    font-style: italic;
  }

  .option-row input[type="checkbox"] {
    margin-top: 0.15rem;
    width: 1rem;
    height: 1rem;
    accent-color: #0284c7;
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
    color: #1e293b;
  }

  .option-desc {
    font-size: 0.75rem;
    color: #64748b;
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid #e2e8f0;
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
    background: #0284c7;
    color: white;
  }
  .btn-primary:hover:not(:disabled) { background: #0369a1; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }
  .btn-secondary:hover { background: #f8fafc; }
</style>
