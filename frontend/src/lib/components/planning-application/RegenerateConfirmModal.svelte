<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
  <div class="modal modal-regen-confirm">
    <div class="modal-header">
      <span class="modal-title"><i class="las la-exclamation-triangle" style="color:var(--color-amber-600)"></i> Regenerate document?</span>
    </div>
    <div class="modal-body">
      <p class="regen-confirm-text">This will replace the entire document with a freshly generated version. Any unsaved changes will be lost.</p>
      <p class="regen-confirm-text">Save the document first if you want to keep the current version.</p>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="modal-cancel" on:click={() => dispatch('close')}>Cancel</button>
        <button class="modal-run modal-run--danger" on:click={() => dispatch('confirm')}>Regenerate</button>
      </div>
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
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .regen-confirm-text { margin: 0 0 0.625rem; font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.6; }
  .regen-confirm-text:last-child { margin-bottom: 0; color: var(--color-slate-500); }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

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
    transition: background 0.15s;
  }
  .modal-run:hover:not(:disabled) { background: var(--color-primary-700); }
  .modal-run:disabled { opacity: 0.4; cursor: not-allowed; }

  .modal-run--danger { background: var(--color-red-600) !important; }
  .modal-run--danger:hover { background: var(--color-red-800) !important; }
</style>
