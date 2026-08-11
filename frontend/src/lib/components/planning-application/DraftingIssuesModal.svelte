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
    background: rgba(0,0,0,0.45);
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
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-drafting-issues { max-width: 900px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: #1e293b; }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
    font-size: 1.1rem;
  }
  .modal-close:hover { background: #f1f5f9; color: #374151; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }
</style>
