<script>
  import { createEventDispatcher } from 'svelte';
  import { md } from '$lib/utils/markdown.js';

  export let open = false;
  export let title = 'Edit Prompt';
  export let promptText = '';
  export let contextTemplate = null;
  export let loading = false;
  export let saving = false;
  export let saved = false;

  let activeTab = 'preview';
  $: if (!open) activeTab = 'preview';

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
          <div class="prompt-tabs">
            <button class="prompt-tab" class:active={activeTab === 'edit'} on:click={() => activeTab = 'edit'}>Edit</button>
            <button class="prompt-tab" class:active={activeTab === 'preview'} on:click={() => activeTab = 'preview'}>Preview</button>
          </div>
        </div>
        <button class="modal-close" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
        {:else if activeTab === 'edit'}
          <textarea
            class="prompt-editor"
            value={promptText}
            use:autoresize={promptText}
            on:input={(e) => dispatch('change', e.target.value)}
          ></textarea>
          {#if contextTemplate}
            <div class="context-template">
              <div class="context-template-label">
                <i class="las la-code"></i> Dynamic context injected by the system (read-only)
              </div>
              <pre class="context-template-body">{contextTemplate}</pre>
            </div>
          {/if}
        {:else}
          <div class="prompt-preview md-body">{@html md(promptText)}</div>
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
    max-width: 720px;
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

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .prompt-tabs { display: flex; gap: 2px; background: var(--color-slate-100); border-radius: 6px; padding: 2px; }
  .prompt-tab {
    padding: 0.25rem 0.75rem;
    border: none;
    background: transparent;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.12s;
  }
  .prompt-tab:hover { color: var(--color-slate-700); }
  .prompt-tab.active { background: var(--color-white); color: var(--color-slate-800); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }

  .prompt-preview {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    min-height: 400px;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-400);
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }
  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

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
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Menlo', 'Consolas', monospace;
    line-height: 1.6;
    color: var(--color-slate-800);
    background: var(--color-slate-50);
    resize: vertical;
  }
  .prompt-editor:focus { outline: none; border-color: var(--color-primary-500); background: var(--color-white); }

  .prompt-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
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
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

  .modal-reset {
    padding: 0.5rem 1rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--color-slate-400);
    cursor: pointer;
    font-family: inherit;
  }
  .modal-reset:hover:not(:disabled) { background: var(--color-slate-100); color: var(--color-slate-500); }
  .modal-reset:disabled { opacity: 0.4; cursor: not-allowed; }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
  }
  .modal-cancel:hover { background: var(--color-slate-100); }

  .modal-save {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .modal-save:hover:not(:disabled) { background: var(--color-slate-100); border-color: var(--color-slate-300); }
  .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .context-template {
    margin-top: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .context-template-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .context-template-body {
    margin: 0;
    padding: 0.75rem;
    font-family: 'Menlo', 'Consolas', monospace;
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--color-slate-600);
    background: var(--color-slate-50);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 260px;
    overflow-y: auto;
  }

  .prompt-custom-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: var(--color-violet-100);
    color: var(--color-violet-700);
  }

  .prompt-default-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }
</style>
