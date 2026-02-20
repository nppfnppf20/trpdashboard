<script>
  import { createEventDispatcher } from 'svelte';
  import { deleteClientOrganisation } from '$lib/api/clientOrganisations.js';

  export let show = false;
  export let client = null;

  const dispatch = createEventDispatcher();

  let deleting = false;
  let error = null;

  function handleClose() {
    if (deleting) return;
    show = false;
    error = null;
    dispatch('close');
  }

  async function handleDelete() {
    if (!client) return;

    deleting = true;
    error = null;

    try {
      await deleteClientOrganisation(client.id);
      show = false;
      dispatch('deleted');
    } catch (err) {
      error = err.message;
    } finally {
      deleting = false;
    }
  }

  $: contactsCount = client?.contacts?.length || 0;
</script>

{#if show && client}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2><i class="las la-exclamation-triangle warning-icon"></i> Delete Client Organisation</h2>
        <button class="close-btn" on:click={handleClose} disabled={deleting}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <p class="confirm-text">
          Are you sure you want to delete <strong>"{client.organisation_name}"</strong>?
        </p>

        {#if contactsCount > 0}
          <div class="warning-box">
            <i class="las la-users"></i>
            <span>This will also delete <strong>{contactsCount}</strong> contact{contactsCount !== 1 ? 's' : ''} associated with this organisation.</span>
          </div>
        {/if}

        <p class="warning-text">
          <i class="las la-exclamation-circle"></i>
          This action cannot be undone.
        </p>

        {#if error}
          <div class="error-box">
            <i class="las la-exclamation-circle"></i>
            {error}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose} disabled={deleting}>
          Cancel
        </button>
        <button class="btn btn-danger" on:click={handleDelete} disabled={deleting}>
          {#if deleting}
            <i class="las la-spinner la-spin"></i> Deleting...
          {:else}
            <i class="las la-trash"></i> Delete
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
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 480px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .warning-icon {
    color: #f59e0b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #1e293b;
  }

  .close-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .confirm-text {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #334155;
  }

  .warning-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 8px;
    color: #92400e;
    margin-bottom: 1rem;
  }

  .warning-box i {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .warning-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
  }

  .warning-text i {
    color: #f59e0b;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #991b1b;
    margin-top: 1rem;
  }

  .error-box i {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }
</style>
