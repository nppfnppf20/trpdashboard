<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title"><i class="las la-exclamation-triangle warn-icon"></i> Please add sources first</span>
    </div>
    <div class="modal-body">
      <p class="warn-text">You need to add a source before generating, as there aren't any sources for this document yet.</p>
      <p class="warn-text warn-text--hint">The more information, the better.</p>
    </div>
    <div class="modal-footer">
      <button class="modal-cancel" on:click={() => dispatch('generate')}>Generate anyway</button>
      <button class="modal-run" on:click={() => dispatch('addSources')}>
        <i class="las la-file-import"></i> Add Sources
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
  }

  .modal-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }
  .warn-icon { color: var(--color-amber-600); }

  .modal-body { padding: 1rem 1.25rem; }

  .warn-text { margin: 0 0 0.625rem; font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.6; }
  .warn-text:last-child { margin-bottom: 0; }
  .warn-text--hint { color: var(--color-slate-500); }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
  }
  .modal-cancel:hover { background: var(--color-slate-100); }

  .modal-run {
    padding: 0.5rem 1.25rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .modal-run:hover { background: var(--color-primary-700); }
</style>
