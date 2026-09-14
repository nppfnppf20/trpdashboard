<script>
  import {
    suggestPromptOpen,
    suggestPromptText,
    suggestPromptLoading,
    suggestPromptSaving,
    suggestPromptSaved,
    suggestPromptIsCustom,
    saveSuggestPrompt,
    resetSuggestPromptToDefault,
    runSuggestionWithPrompt,
  } from '$lib/stores/planning-suggestion.js';
</script>

<div class="modal-overlay" on:click|self={() => $suggestPromptOpen = false} role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-header-left">
        <span class="modal-title">Suggestion Prompt</span>
        {#if $suggestPromptIsCustom}
          <span class="prompt-custom-badge">Custom saved</span>
        {:else}
          <span class="prompt-default-badge">Default</span>
        {/if}
      </div>
      <button class="modal-close" on:click={() => $suggestPromptOpen = false}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body">
      {#if $suggestPromptLoading}
        <div class="prompt-loading"><div class="spinner"></div><span>Loading prompt...</span></div>
      {:else}
        <p class="prompt-hint"><code>&#123;&#123;DOCUMENT&#125;&#125;</code> is replaced with your document text when running.</p>
        <textarea class="prompt-editor" bind:value={$suggestPromptText}></textarea>
      {/if}
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left">
        {#if $suggestPromptIsCustom}
          <button class="modal-reset" on:click={resetSuggestPromptToDefault} disabled={$suggestPromptLoading}>
            Reset to default
          </button>
        {/if}
      </div>
      <div class="modal-footer-right">
        <button class="modal-cancel" on:click={() => $suggestPromptOpen = false}>Cancel</button>
        <button class="modal-save" disabled={$suggestPromptLoading || $suggestPromptSaving || !$suggestPromptText} on:click={saveSuggestPrompt}>
          {#if $suggestPromptSaving}Saving...{:else if $suggestPromptSaved}<i class="las la-check"></i> Saved{:else}Save as default{/if}
        </button>
        <button class="modal-run" disabled={$suggestPromptLoading || !$suggestPromptText} on:click={runSuggestionWithPrompt}>
          Run suggestion
        </button>
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

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .prompt-custom-badge {
    font-size: 0.72rem; font-weight: 600;
    background: var(--color-primary-100); color: var(--color-blue-700);
    padding: 0.2rem 0.5rem; border-radius: 20px;
  }

  .prompt-default-badge {
    font-size: 0.72rem; font-weight: 600;
    background: var(--color-slate-100); color: var(--color-slate-500);
    padding: 0.2rem 0.5rem; border-radius: 20px;
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
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .prompt-hint {
    margin: 0 0 0.625rem;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    flex-shrink: 0;
  }

  .prompt-hint code {
    background: var(--color-slate-100);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: 0.8rem;
    color: var(--color-violet-600);
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

  .prompt-editor:focus { outline: none; border-color: var(--color-primary-600); background: white; }

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
    background: white;
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
    background: white;
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
    background: white;
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
</style>
