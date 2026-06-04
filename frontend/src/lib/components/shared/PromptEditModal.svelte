<script>
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = 'Edit Prompt';
  export let promptText = '';
  export let loading = false;
  export let saving = false;
  export let saved = false;

  const dispatch = createEventDispatcher();

  function autoresize(node) {
    function resize() { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px'; }
    node.addEventListener('input', resize);
    resize();
    return { update() { resize(); }, destroy() { node.removeEventListener('input', resize); } };
  }
</script>

{#if open}
  <div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
    <div class="modal modal-prompt-edit">
      <div class="modal-header">
        <div class="modal-header-left">
          <span class="modal-title">{title}</span>
        </div>
        <button class="modal-close" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
        {:else}
          <textarea
            class="prompt-editor"
            value={promptText}
            use:autoresize={promptText}
            on:input={(e) => dispatch('change', e.target.value)}
          ></textarea>
        {/if}
      </div>

      <div class="modal-footer">
        <div class="modal-footer-left">
          <button class="modal-reset" disabled={saving} on:click={() => dispatch('reset')}>
            Reset to default
          </button>
        </div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => dispatch('close')}>Close</button>
          <button class="modal-save" disabled={loading || saving || !promptText} on:click={() => dispatch('save')}>
            {#if saving}Saving...{:else if saved}<i class="las la-check"></i> Saved{:else}Save{/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

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
    max-width: 720px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
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
    color: #94a3b8;
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }
  .modal-close:hover { background: #f1f5f9; color: #374151; }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .prompt-editor {
    flex: 1;
    width: 100%;
    min-height: 400px;
    box-sizing: border-box;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Menlo', 'Consolas', monospace;
    line-height: 1.6;
    color: #1e293b;
    background: #f8fafc;
    resize: vertical;
  }
  .prompt-editor:focus { outline: none; border-color: #7c3aed; background: white; }

  .prompt-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

  .modal-reset {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #94a3b8;
    cursor: pointer;
    font-family: inherit;
  }
  .modal-reset:hover:not(:disabled) { background: #f1f5f9; color: #64748b; }
  .modal-reset:disabled { opacity: 0.4; cursor: not-allowed; }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
  }
  .modal-cancel:hover { background: #f1f5f9; }

  .modal-save {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .modal-save:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
  .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .prompt-custom-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: #ede9fe;
    color: #6d28d9;
  }

  .prompt-default-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
  }
</style>
