<script>
  import {
    sectionExampleModalOpen,
    sectionExampleId,
    sectionExampleSaving,
    sectionExampleSaved,
    sections,
    handleSaveSectionExample,
    setSectionExampleEditor,
  } from '$lib/stores/planning-drafts.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';

  let sectionExampleEditor;
  $: setSectionExampleEditor(sectionExampleEditor);

  $: exSection = $sections.find(s => s.id === $sectionExampleId);
</script>

<div class="modal-overlay" on:click|self={() => $sectionExampleModalOpen = false} role="dialog" aria-modal="true">
  <div class="modal modal-wide">
    <div class="modal-header">
      <span class="modal-title">Style Example: {exSection?.name}</span>
      <button class="modal-close" on:click={() => $sectionExampleModalOpen = false}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body">
      <p class="prompt-hint">Paste an example of how this section should read. The AI will match its tone and format.</p>
      <div class="example-editor-wrap">
        <RichTextEditor bind:this={sectionExampleEditor} placeholder="Paste an example here..." />
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="modal-cancel" on:click={() => $sectionExampleModalOpen = false}>Cancel</button>
        <button class="modal-save" disabled={$sectionExampleSaving} on:click={handleSaveSectionExample}>
          {#if $sectionExampleSaving}Saving...{:else if $sectionExampleSaved}<i class="las la-check"></i> Saved{:else}Save example{/if}
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

  .modal-wide { max-width: 900px; }

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

  .prompt-hint {
    margin: 0 0 0.625rem;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    flex-shrink: 0;
  }

  .example-editor-wrap {
    flex: 1;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    overflow: hidden;
    min-height: 400px;
  }

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
</style>
