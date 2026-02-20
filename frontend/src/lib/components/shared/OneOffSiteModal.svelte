<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** @type {boolean} */
  export let show = false;

  /** @type {string} */
  let siteName = '';

  /** @type {boolean} */
  let saving = false;

  /** @type {string} */
  let errorMessage = '';

  function closeModal() {
    show = false;
    siteName = '';
    errorMessage = '';
    dispatch('close');
  }

  function saveSite() {
    if (!siteName.trim()) {
      errorMessage = 'Please enter a site name';
      return;
    }

    saving = true;
    errorMessage = '';

    dispatch('save', {
      siteName: siteName.trim()
    });
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'Enter') {
      saveSite();
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={closeModal} on:keydown={handleKeydown}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Save One-Off Report</h3>
        <button class="close-button" on:click={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-description">
          Enter a name for this one-off report:
        </p>

        <div class="form-group">
          <label for="siteName">Site Name</label>
          <input
            id="siteName"
            class="site-name-input"
            type="text"
            bind:value={siteName}
            placeholder="Enter site name..."
            disabled={saving}
            on:keydown={handleKeydown}
            autofocus
          />
        </div>

        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal} disabled={saving}>
          Cancel
        </button>
        <button class="btn-primary" on:click={saveSite} disabled={saving}>
          {#if saving}
            Saving...
          {:else}
            Save Report
          {/if}
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
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 90%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalSlideIn 0.2s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    color: #6b7280;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .site-name-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .site-name-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .site-name-input:disabled {
    background: #f9fafb;
    color: #6b7280;
  }

  .error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
    font-size: 0.875rem;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border-color: #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    border-color: #2563eb;
  }

  .btn-primary:disabled {
    background: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }
</style>
