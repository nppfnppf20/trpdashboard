<script>
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { narratives, updateNarrative } from '$lib/stores/hlpv-narrative.js';

  export let disciplineName = '';

  $: content = $narratives[disciplineName] ?? '';
  $: hasContent = Boolean(content);

  function handleChange(e) {
    updateNarrative(disciplineName, e.detail.html);
  }
</script>

{#if hasContent}
  <div class="narrative-panel">
    <div class="narrative-header">
      <span class="narrative-tag">AI Draft</span>
      <span class="narrative-hint">Edit as needed before use</span>
    </div>
    <RichTextEditor {content} on:change={handleChange} placeholder="Generated narrative will appear here..." />
  </div>
{/if}

<style>
  .narrative-panel {
    margin-top: 1.25rem;
    border: 1px solid var(--color-indigo-100);
    border-radius: 8px;
    overflow: hidden;
  }

  .narrative-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0.75rem;
    background: var(--color-primary-50);
    border-bottom: 1px solid var(--color-indigo-100);
  }

  .narrative-tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-violet-700);
  }

  .narrative-hint {
    font-size: 0.72rem;
    color: var(--color-slate-400);
  }
</style>
