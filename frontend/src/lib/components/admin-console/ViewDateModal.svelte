<script>
  import { createEventDispatcher } from 'svelte';
  import '$lib/styles/buttons.css';

  export let show = false;
  export let date = null;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleEdit() {
    dispatch('edit', date);
    handleClose();
  }

  function handleDelete() {
    if (confirm('Are you sure you want to delete this key date?')) {
      dispatch('delete', date);
      handleClose();
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
</script>

{#if show && date}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" style="border-top: 4px solid {date.colour || date.color || '#3b82f6'}" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{date.title}</h3>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-row">
          <span class="label">Date</span>
          <span class="value">{formatDate(date.date)}</span>
        </div>

        {#if date.discipline}
          <div class="info-row">
            <span class="label">Discipline</span>
            <span class="value">{date.discipline}</span>
          </div>
        {/if}

        {#if date.surveyor_organisation}
          <div class="info-row">
            <span class="label">Organisation</span>
            <span class="value">{date.surveyor_organisation}</span>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary btn-modal" on:click={handleEdit}>
          <i class="las la-edit"></i>
          Edit
        </button>
        <button class="btn btn-secondary btn-modal" on:click={handleDelete}>
          <i class="las la-trash"></i>
          Delete
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
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 10px;
    max-width: 320px;
    width: 100%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    padding: 1rem 1.25rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .value {
    font-size: 0.875rem;
    color: #1e293b;
    text-align: right;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .btn-modal {
    padding: 0.4rem 0.875rem;
    font-size: 0.8125rem;
  }
</style>
