<script>
  // Bold / italic / underline / highlight / reset buttons for a FormattedTextEditor.
  // Pass the editor with bind:this, and its `saving` / `canReset` with bind:.
  export let editor = null;
  export let saving = false;
  export let canReset = false;
</script>

<!-- mousedown is prevented on the formatting buttons so pressing one doesn't shift
     focus off the text and collapse the selection before the command runs. -->
<div class="fmt-toolbar">
  {#if saving}<span class="mini-spinner"></span>{/if}
  <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => editor?.format('bold')} title="Bold (Ctrl+B)"><b>B</b></button>
  <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => editor?.format('italic')} title="Italic (Ctrl+I)"><i>I</i></button>
  <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => editor?.format('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
  <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => editor?.toggleHighlight()} title="Highlight"><i class="las la-highlighter"></i></button>
  <button type="button" class="btn btn-ghost btn-sm tool" on:click={() => editor?.resetFormatting()} disabled={!canReset} title="Remove all formatting"><i class="las la-undo"></i></button>
</div>

<style>
  .fmt-toolbar { display: flex; align-items: center; gap: var(--space-1); }
  .tool { min-width: 1.75rem; padding: 0.25rem 0.4rem; }

  .mini-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
