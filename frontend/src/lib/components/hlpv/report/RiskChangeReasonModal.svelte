<script>
  import { createEventDispatcher } from 'svelte';
  import { resolveRiskSummary } from '$lib/services/reportGenerator.js';

  const dispatch = createEventDispatcher();

  /** @type {boolean} */
  export let isOpen = false;

  /** @type {string} */
  export let discipline = '';

  /** @type {string} */
  export let fieldName = 'Risk Level';

  /** @type {string} */
  export let oldValue = '';

  /** @type {string} */
  export let newValue = '';

  /** @type {string} */
  let reason = '';

  /** @type {boolean} */
  let isSubmitting = false;

  $: oldRiskSummary = oldValue ? resolveRiskSummary(oldValue) : null;
  $: newRiskSummary = newValue ? resolveRiskSummary(newValue) : null;

  function formatRiskLevel(value) {
    if (!value) return 'Not Set';
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  function handleConfirm() {
    if (!reason.trim()) {
      return; // Don't allow empty reasons
    }

    isSubmitting = true;

    dispatch('confirm', {
      discipline,
      fieldPath: 'overallRisk',
      oldValue,
      newValue,
      reason: reason.trim()
    });

    // Reset state
    reason = '';
    isSubmitting = false;
  }

  function handleCancel() {
    dispatch('cancel');
    reason = '';
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="reason-modal-title">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="reason-modal-title">Record Reason for Change</h2>
        <button class="close-button" on:click={handleCancel} aria-label="Cancel change">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="change-summary">
          <p class="change-intro">You are changing the <strong>{fieldName}</strong> for <strong>{discipline}</strong>:</p>

          <div class="change-values">
            <div class="change-item">
              <span class="change-label">From:</span>
              {#if oldRiskSummary}
                <span class="risk-badge" style="background-color: {oldRiskSummary.bgColor}; color: {oldRiskSummary.color};">
                  {oldRiskSummary.label}
                </span>
              {:else}
                <span class="risk-badge not-set">Not Set</span>
              {/if}
            </div>
            <div class="change-arrow">
              <i class="las la-arrow-right"></i>
            </div>
            <div class="change-item">
              <span class="change-label">To:</span>
              {#if newRiskSummary}
                <span class="risk-badge" style="background-color: {newRiskSummary.bgColor}; color: {newRiskSummary.color};">
                  {newRiskSummary.label}
                </span>
              {:else}
                <span class="risk-badge not-set">Not Set</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="reason-input">
          <label for="change-reason">Please explain why you are making this change:</label>
          <textarea
            id="change-reason"
            bind:value={reason}
            placeholder="Enter the reason for changing the risk level..."
            rows="4"
            required
          ></textarea>
          <p class="reason-hint">This will be recorded in the audit log for review.</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={handleCancel}>
          Cancel
        </button>
        <button
          class="btn-confirm"
          on:click={handleConfirm}
          disabled={!reason.trim() || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Confirm Change'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #1f2937;
    font-weight: 500;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .change-summary {
    margin-bottom: 1.5rem;
  }

  .change-intro {
    margin: 0 0 1rem 0;
    color: #374151;
    font-size: 0.95rem;
  }

  .change-values {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
  }

  .change-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .change-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 500;
  }

  .change-arrow {
    color: #9ca3af;
    font-size: 1.25rem;
  }

  .risk-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .risk-badge.not-set {
    background: #f3f4f6;
    color: #6b7280;
  }

  .reason-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reason-input label {
    font-weight: 500;
    color: #374151;
    font-size: 0.95rem;
  }

  .reason-input textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
  }

  .reason-input textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .reason-input textarea::placeholder {
    color: #9ca3af;
  }

  .reason-hint {
    margin: 0;
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-cancel,
  .btn-confirm {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.95rem;
  }

  .btn-cancel {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-cancel:hover {
    background: #e5e7eb;
  }

  .btn-confirm {
    background: #3b82f6;
    color: white;
    border: 1px solid #3b82f6;
  }

  .btn-confirm:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-confirm:disabled {
    background: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }
</style>
