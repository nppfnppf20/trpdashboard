<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';
  import { getSlideshowTemplates, generateSlideshow, downloadPptx } from '$lib/api/slideshows.js';

  // "Create slideshow": pick briefing/meeting notes, describe what you want,
  // get a .pptx. Opened via open() from the project chat's suggestion card.
  export let projectUniqueId;

  const dispatch = createEventDispatcher();

  let show = false;
  let sourcePicker;
  let sources = [];
  let overBudget = false;
  let guidance = '';
  let templates = [];
  let templateId = null;

  let generating = false;
  let error = null;
  let result = null; // { deck_title, slide_titles, filename, file_base64 }

  $: canCreate = sources.length > 0 && !overBudget && !generating;

  onMount(async () => {
    try {
      const res = await getSlideshowTemplates();
      templates = res.templates;
      templateId = res.default;
    } catch {
      templates = [];
    }
  });

  export function open({ guidance: initialGuidance = '' } = {}) {
    sourcePicker?.reset();
    guidance = initialGuidance;
    error = null;
    result = null;
    show = true;
  }

  function close() {
    if (generating) return;
    show = false;
    dispatch('close');
  }

  async function create() {
    if (!canCreate) return;
    generating = true;
    error = null;
    result = null;
    try {
      result = await generateSlideshow(projectUniqueId, { sources, guidance, template: templateId });
      downloadPptx(result.filename, result.file_base64);
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={close}>
    <div class="modal">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-file-powerpoint"></i>
          <h3>Create Slideshow</h3>
        </div>
        <button class="close-btn" on:click={close} disabled={generating}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        <NoteSourcePicker
          bind:this={sourcePicker}
          {projectUniqueId}
          hint="Tick the briefing notes and meeting notes the slides should be built from."
          bind:selectedSources={sources}
          bind:overBudget
        />

        <div class="field">
          <label for="slideshow-guidance">What do you want in it?</label>
          <textarea
            id="slideshow-guidance"
            rows="4"
            bind:value={guidance}
            disabled={generating}
            placeholder="e.g. A 6-slide summary for the client covering key issues, agreed actions and next steps. Keep it high level."
          ></textarea>
        </div>

        {#if templates.length > 1}
          <div class="field">
            <label for="slideshow-template">Template</label>
            <select id="slideshow-template" bind:value={templateId} disabled={generating}>
              {#each templates as t}<option value={t.id}>{t.label}</option>{/each}
            </select>
          </div>
        {/if}

        {#if error}<div class="error-msg">{error}</div>{/if}

        {#if result}
          <div class="result">
            <div class="result-head">
              <i class="las la-check-circle"></i> Downloaded <strong>{result.filename}</strong>
            </div>
            <ol class="result-slides">
              {#each result.slide_titles as title}<li>{title}</li>{/each}
            </ol>
            <button class="btn btn-secondary" on:click={() => downloadPptx(result.filename, result.file_base64)}>
              <i class="las la-download"></i> Download again
            </button>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={close} disabled={generating}>{result ? 'Close' : 'Cancel'}</button>
        <button class="btn-create" on:click={create} disabled={!canCreate}>
          {#if generating}
            <span class="spinner"></span> Creating…
          {:else}
            <i class="las la-magic"></i> {result ? 'Create again' : 'Create'}
          {/if}
        </button>
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
    z-index: 1100;
    padding: 1rem;
  }
  .modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 540px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .header-left { display: flex; align-items: center; gap: 0.5rem; color: var(--color-primary-600); }
  .header-left i { font-size: 1.2rem; }
  .header-left h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--color-slate-800); }
  .close-btn {
    background: none; border: none; font-size: 1.1rem; color: var(--color-slate-400);
    cursor: pointer; padding: 0.25rem; display: flex; align-items: center;
  }
  .close-btn:hover:not(:disabled) { color: var(--color-slate-800); }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }
  .field { display: flex; flex-direction: column; gap: 0.35rem; }
  .field label { font-size: 0.8125rem; font-weight: 600; color: var(--color-slate-700); }
  .field textarea, .field select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: var(--color-white);
  }
  .field textarea { resize: vertical; }
  .field textarea:focus, .field select:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: var(--focus-ring-blue);
  }

  .error-msg { font-size: 0.8125rem; color: var(--color-red-600); }

  .result {
    border: 1px solid var(--color-primary-200);
    background: var(--color-primary-50);
    border-radius: 8px;
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .result-head { font-size: 0.85rem; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.35rem; }
  .result-head i { color: var(--color-emerald-600); font-size: 1.1rem; }
  .result-slides { margin: 0; padding-left: 1.25rem; font-size: 0.8125rem; color: var(--color-slate-600); line-height: 1.5; }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }
  .btn-create {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.25rem;
    background: var(--color-primary-600); color: var(--color-white);
    border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 500; cursor: pointer;
  }
  .btn-create:hover:not(:disabled) { background: var(--color-primary-700); }
  .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    display: inline-block; width: 0.8rem; height: 0.8rem;
    border: 2px solid var(--color-primary-200); border-top-color: var(--color-white);
    border-radius: 50%; animation: ss-spin 0.7s linear infinite;
  }
  @keyframes ss-spin { to { transform: rotate(360deg); } }
</style>
