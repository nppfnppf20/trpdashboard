<script>
  import { createEventDispatcher } from 'svelte';
  import DraftingIssuesTab from './DraftingIssuesTab.svelte';

  export let project;

  const dispatch = createEventDispatcher();
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
  <div class="modal modal-drafting-issues">
    <div class="modal-header">
      <span class="modal-title">Drafting Issues</span>
      <button class="modal-close" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
    </div>

    <div class="modal-body">
      <DraftingIssuesTab {project} />
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
    background: var(--color-white);
    border-radius: 10px;
    width: 100%;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    box-shadow: var(--shadow-lg);
  }

  .modal-drafting-issues { max-width: 900px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-500);
    cursor: pointer;
    border-radius: 4px;
    font-size: 1.1rem;
  }
  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }
</style>
