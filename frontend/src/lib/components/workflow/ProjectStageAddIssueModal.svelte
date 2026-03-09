<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let label = '';
  let error = null;

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) { error = 'Label is required'; return; }
    dispatch('add', { label: trimmed });
  }

  function close() {
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') close();
  }
</script>

<div class="modal-backdrop" on:click|self={close} role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <h2><i class="las la-plus-circle"></i> Add Issue Row</h2>
      <button class="close-btn" on:click={close} aria-label="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <label for="issue-label">Label</label>
      <input
        id="issue-label"
        type="text"
        bind:value={label}
        on:keydown={handleKeydown}
        placeholder="e.g. Planning Strategy, Land Control, Grid…"
        class="label-input"
        class:invalid={!!error}
        autofocus
      />
      {#if error}
        <p class="field-error">{error}</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-cancel" on:click={close}>Cancel</button>
      <button class="btn-add" on:click={submit}>
        <i class="las la-plus"></i>
        Add row
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-header h2 i { color: #3b82f6; }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.375rem;
    color: #94a3b8;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.15s;
  }

  .close-btn:hover { color: #1e293b; }

  .modal-body {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .label-input {
    padding: 0.5625rem 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9375rem;
    color: #1e293b;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }

  .label-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }

  .label-input.invalid { border-color: #ef4444; }

  .field-error {
    margin: 0;
    font-size: 0.8125rem;
    color: #ef4444;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn-cancel {
    padding: 0.5rem 1.25rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel:hover { border-color: #94a3b8; color: #1e293b; }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.25rem;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-add:hover { background: #2563eb; }
</style>
