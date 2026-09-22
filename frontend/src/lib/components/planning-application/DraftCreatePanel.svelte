<script>
  import { createEventDispatcher } from 'svelte';
  import { generateCustomDraft } from '$lib/api/draftCreate.js';

  export let getDraftHtml = () => '';

  const dispatch = createEventDispatcher();

  let prompt = '';
  let provider = '';
  let useHouseStyle = true;
  let generating = false;
  let error = null;

  let reviseNotes = '';

  function isBlank(html) {
    return !html?.replace(/<[^>]+>/g, '').trim();
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;

    const existing = getDraftHtml();
    if (!isBlank(existing)) {
      if (!confirm('This will replace the current document content. Continue?')) return;
    }

    generating = true;
    error = null;
    try {
      const { html } = await generateCustomDraft({ prompt: prompt.trim(), provider, use_house_style: useHouseStyle });
      dispatch('generated', { html });
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }

  // Hands the note off to the same highlight-driven AI edit flow the parent
  // already runs (see handleSendToAi in PlanningWorkspace.svelte), just
  // scoped to every paragraph instead of one highlighted passage — the
  // "as if I'd selected the whole document" shortcut. The parent owns the
  // request/diff/Accept flow; this panel only collects the instruction.
  function handleReviseAll() {
    if (!reviseNotes.trim()) return;
    dispatch('reviseall', { notes: reviseNotes.trim() });
    reviseNotes = '';
  }
</script>

<div class="check-panel">
  <div class="check-panel-header">
    <span class="check-panel-title"><i class="las la-magic"></i> Create Document</span>
    <div class="check-panel-actions">
      <button class="check-panel-close" aria-label="Close create panel" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
    </div>
  </div>

  <div class="check-panel-body">
    <p class="create-panel-hint">Describe the document you want. It will be written in the practice's professional tone and formatting, ready to edit and export like any other draft.</p>

    <textarea
      class="create-prompt-input"
      rows="10"
      placeholder="e.g. Write a short covering letter to the case officer confirming submission of the revised drawings, referencing planning reference..."
      bind:value={prompt}
      disabled={generating}
    ></textarea>

    <label class="create-style-toggle">
      <input type="checkbox" bind:checked={useHouseStyle} disabled={generating} />
      Apply house style (tone, capitalisation, formatting rules)
    </label>

    <div class="create-controls-row">
      <select class="create-llm-select" bind:value={provider} disabled={generating}>
        <option value="">Default</option>
        <option value="anthropic">Claude</option>
        <option value="openai">GPT-5.6</option>
      </select>
      <button class="create-generate-btn" disabled={!prompt.trim() || generating} on:click={handleGenerate}>
        {#if generating}<span class="check-mini-spinner"></span> Generating...{:else}<i class="las la-magic"></i> Generate{/if}
      </button>
    </div>

    {#if error}
      <div class="check-item check-item--missing">
        <span class="check-item-icon"><i class="las la-exclamation-circle"></i></span>
        <div class="check-item-text">
          <span class="check-item-detail">{error}</span>
        </div>
      </div>
    {/if}

    <div class="create-panel-divider"></div>

    <p class="create-panel-hint">Or tell the AI what to change across the whole document — same as highlighting everything and sending a note, with the changes shown for you to review before they're kept.</p>

    <textarea
      class="create-prompt-input"
      rows="4"
      placeholder="e.g. Make the tone more formal throughout, or shorten every section by about a third..."
      bind:value={reviseNotes}
    ></textarea>

    <div class="create-controls-row">
      <button class="create-generate-btn" disabled={!reviseNotes.trim() || isBlank(getDraftHtml())} on:click={handleReviseAll}>
        <i class="las la-magic"></i> Apply to whole document
      </button>
    </div>
  </div>
</div>

<style>
  .check-panel { height: 100%; overflow-y: auto; }

  .check-panel-header {
    position: sticky; top: 0; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-slate-200); background: white;
  }
  .check-panel-title { font-size: 0.8rem; font-weight: 700; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.375rem; }
  .check-panel-actions { display: flex; align-items: center; gap: 0.5rem; }
  .check-panel-close { background: none; border: none; color: var(--color-slate-400); cursor: pointer; padding: 0.2rem; font-size: 1rem; line-height: 1; }
  .check-panel-close:hover { color: var(--color-slate-700); }

  .check-panel-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.625rem; }

  .create-panel-hint { margin: 0; font-size: 0.78rem; color: var(--color-slate-500); line-height: 1.5; }

  .create-panel-divider { height: 1px; background: var(--color-slate-200); margin: 0.25rem 0; }

  .create-prompt-input {
    width: 100%; resize: vertical; font-family: inherit; font-size: 0.8rem;
    padding: 0.625rem; border: 1px solid var(--color-slate-200); border-radius: 7px;
    color: var(--color-slate-800); background: white;
  }
  .create-prompt-input:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }
  .create-prompt-input:disabled { background: var(--color-slate-50); color: var(--color-slate-400); }

  .create-style-toggle {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.78rem; color: var(--color-slate-600); cursor: pointer;
  }

  .create-controls-row { display: flex; align-items: center; gap: 0.5rem; }

  .create-llm-select {
    flex-shrink: 0; padding: 0.4rem 0.5rem; border: 1px solid var(--color-slate-200); border-radius: 6px;
    font-size: 0.78rem; color: var(--color-slate-700); background: white; font-family: inherit;
  }

  .create-generate-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    background: var(--color-primary-500); color: white; border: none; border-radius: 6px;
    padding: 0.5rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: background 0.12s;
  }
  .create-generate-btn:hover:not(:disabled) { background: var(--color-primary-600); }
  .create-generate-btn:disabled { opacity: 0.5; cursor: default; }

  .check-item {
    display: flex; align-items: flex-start; gap: 0.625rem;
    padding: 0.5rem 0.625rem; border-radius: 6px; font-size: 0.78rem;
  }
  .check-item--missing { background: var(--color-red-50); }
  .check-item-icon { flex-shrink: 0; font-size: 1rem; margin-top: 0.05rem; color: var(--color-red-600); }
  .check-item-text { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
  .check-item-detail { color: var(--color-slate-600); line-height: 1.5; }

  .check-mini-spinner {
    width: 13px; height: 13px; flex-shrink: 0;
    border: 2px solid var(--color-primary-200); border-top-color: var(--color-white); border-radius: 50%;
    animation: check-spin 0.7s linear infinite;
  }
  @keyframes check-spin { to { transform: rotate(360deg); } }
</style>
