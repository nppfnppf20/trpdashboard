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
    background: var(--overlay-bg);
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
    box-shadow: 0 20px 50px var(--overlay-bg);
    text-align: center;
  }

  .modal-icon {
    width: 4rem;
    height: 4rem;
    background: var(--color-amber-100);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .modal-icon i {
    font-size: 2rem;
    color: var(--color-amber-500);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-slate-800);
    margin: 0 0 0.5rem 0;
  }

  .item-name {
    font-size: 1rem;
    color: var(--color-slate-500);
    margin: 0 0 1.5rem 0;
    font-style: italic;
  }

  .modal-message {
    text-align: left;
    background: var(--color-slate-50);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }

  .modal-message p {
    font-size: 0.9375rem;
    color: var(--color-slate-600);
    margin: 0 0 0.75rem 0;
    line-height: 1.5;
  }

  .modal-message ul {
    margin: 0 0 0.75rem 0;
    padding-left: 1.25rem;
  }

  .modal-message li {
    font-size: 0.9375rem;
    color: var(--color-slate-600);
    margin-bottom: 0.375rem;
    line-height: 1.5;
  }

  .modal-message .note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: var(--color-slate-100);
    border-radius: 6px;
    padding: 0.75rem;
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-emerald-800);
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
    background: var(--color-blue-50);
    border-radius: 6px;
    padding: 0.75rem;
    margin: 0.75rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-blue-800);
  }

  .modal-message .hint i {
    font-size: 1.125rem;
    margin-top: 0.0625rem;
    flex-shrink: 0;
    color: var(--color-blue-500);
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
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }

  .btn-cancel:hover {
    background: var(--color-slate-200);
    color: var(--color-slate-600);
  }

  .btn-continue {
    background: var(--color-amber-500);
    color: var(--color-white);
  }

  .btn-continue:hover {
    background: var(--color-amber-600);
  }

  .btn-continue i {
    font-size: 1.125rem;
  }
</style>
