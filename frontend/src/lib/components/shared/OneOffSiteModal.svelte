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
    background: var(--overlay-bg);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--color-white);
    border-radius: 12px;
    box-shadow: var(--shadow-modal);
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
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--color-slate-800);
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    color: var(--color-slate-700);
    background: var(--color-slate-100);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    color: var(--color-slate-500);
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--color-slate-700);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .site-name-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .site-name-input:focus {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: var(--focus-ring-blue);
  }

  .site-name-input:disabled {
    background: var(--color-slate-50);
    color: var(--color-slate-500);
  }

  .error-message {
    color: var(--color-red-600);
    font-size: 0.875rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 4px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
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
    background: var(--color-white);
    color: var(--color-slate-700);
    border-color: var(--color-slate-300);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-slate-50);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-blue-500);
    color: var(--color-white);
    border-color: var(--color-blue-500);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-blue-600);
    border-color: var(--color-blue-600);
  }

  .btn-primary:disabled {
    background: var(--color-slate-400);
    border-color: var(--color-slate-400);
    cursor: not-allowed;
  }
</style>
