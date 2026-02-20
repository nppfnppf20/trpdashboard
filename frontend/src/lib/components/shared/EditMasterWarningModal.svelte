<script>
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let title = 'Edit Master Template';
  export let itemName = '';
  export let itemType = 'template';
  export let hint = '';

  const dispatch = createEventDispatcher();

  function handleCancel() {
    dispatch('cancel');
  }

  function handleContinue() {
    dispatch('continue');
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }
</script>

{#if isOpen}
  <div class="modal-overlay" on:click={handleOverlayClick}>
    <div class="modal-content">
      <div class="modal-icon">
        <i class="las la-exclamation-triangle"></i>
      </div>

      <h2 class="modal-title">{title}</h2>

      {#if itemName}
        <p class="item-name">"{itemName}"</p>
      {/if}

      <div class="modal-message">
        <p>
          You are about to edit a <strong>master {itemType}</strong>. Any changes you make will affect:
        </p>
        <ul>
          <li>All <strong>new</strong> items created from this {itemType} going forward</li>
          <li>The default content and structure for this {itemType}</li>
        </ul>
        <p class="note">
          <i class="las la-info-circle"></i>
          <span>Existing items that were already created from this {itemType} will <strong>not</strong> be affected.</span>
        </p>
        {#if hint}
          <p class="hint">
            <i class="las la-lightbulb"></i>
            <span>{@html hint}</span>
          </p>
        {/if}
      </div>

      <div class="modal-actions">
        <button class="btn btn-cancel" on:click={handleCancel}>
          Cancel
        </button>
        <button class="btn btn-continue" on:click={handleContinue}>
          <i class="las la-edit"></i>
          Continue to Edit
        </button>
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
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    padding: 2rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .modal-icon {
    width: 4rem;
    height: 4rem;
    background: #fef3c7;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .modal-icon i {
    font-size: 2rem;
    color: #f59e0b;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .item-name {
    font-size: 1rem;
    color: #64748b;
    margin: 0 0 1.5rem 0;
    font-style: italic;
  }

  .modal-message {
    text-align: left;
    background: #f8fafc;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }

  .modal-message p {
    font-size: 0.9375rem;
    color: #475569;
    margin: 0 0 0.75rem 0;
    line-height: 1.5;
  }

  .modal-message ul {
    margin: 0 0 0.75rem 0;
    padding-left: 1.25rem;
  }

  .modal-message li {
    font-size: 0.9375rem;
    color: #475569;
    margin-bottom: 0.375rem;
    line-height: 1.5;
  }

  .modal-message .note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: #ecfdf5;
    border-radius: 6px;
    padding: 0.75rem;
    margin: 0;
    font-size: 0.875rem;
    color: #047857;
  }

  .modal-message .note i {
    font-size: 1.125rem;
    margin-top: 0.0625rem;
    flex-shrink: 0;
  }

  .modal-message .hint {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: #eff6ff;
    border-radius: 6px;
    padding: 0.75rem;
    margin: 0.75rem 0 0 0;
    font-size: 0.875rem;
    color: #1e40af;
  }

  .modal-message .hint i {
    font-size: 1.125rem;
    margin-top: 0.0625rem;
    flex-shrink: 0;
    color: #3b82f6;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: #f1f5f9;
    color: #64748b;
  }

  .btn-cancel:hover {
    background: #e2e8f0;
    color: #475569;
  }

  .btn-continue {
    background: #f59e0b;
    color: white;
  }

  .btn-continue:hover {
    background: #d97706;
  }

  .btn-continue i {
    font-size: 1.125rem;
  }
</style>
