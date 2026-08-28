<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let title = 'Notes';
  export let notes = '';
  export let maxLength = 1000;

  const dispatch = createEventDispatcher();

  let editedNotes = '';

  $: if (show) {
    editedNotes = notes || '';
  }

  function handleSave() {
    dispatch('save', { notes: editedNotes });
    show = false;
  }

  function handleClose() {
    dispatch('close');
    show = false;
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="modal">
      <div class="modal-header">
        <h3>{title}</h3>
        <button class="close-btn" on:click={handleClose} title="Close">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <textarea
          bind:value={editedNotes}
          placeholder="Enter notes..."
          maxlength={maxLength}
        ></textarea>
        <div class="char-count">
          {editedNotes.length} / {maxLength}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleSave}>
          Save
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
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  textarea {
    width: 100%;
    min-height: 150px;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 0.875rem;
    color: var(--color-slate-700);
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-blue-500);
    box-shadow: var(--focus-ring-blue);
  }

  textarea::placeholder {
    color: var(--color-slate-400);
  }

  .char-count {
    text-align: right;
    font-size: 0.75rem;
    color: var(--color-slate-400);
    margin-top: 0.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    border-radius: 0 0 8px 8px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-primary {
    background: var(--color-blue-500);
    color: var(--color-white);
  }

  .btn-primary:hover {
    background: var(--color-blue-600);
  }

  .btn-secondary {
    background: var(--color-white);
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-300);
  }

  .btn-secondary:hover {
    background: var(--color-slate-50);
  }
</style>
