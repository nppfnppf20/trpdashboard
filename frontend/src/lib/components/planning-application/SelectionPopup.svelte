<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { createDraftComment } from '$lib/api/draftComments.js';
  import VoiceDictationButton from '$lib/components/projects/VoiceDictationButton.svelte';

  export let project;
  export let draftKind;
  export let draftTypeId;
  export let paragraphIds = [];
  export let quotedText = '';
  export let top = 0;
  export let left = 0;

  const dispatch = createEventDispatcher();

  const POPUP_WIDTH = 380;
  $: clampedLeft = Math.min(
    Math.max(left - POPUP_WIDTH / 2, 16),
    (typeof window !== 'undefined' ? window.innerWidth : 1200) - POPUP_WIDTH - 16
  );
  $: clampedTop = Math.min(top + 8, (typeof window !== 'undefined' ? window.innerHeight : 900) - 260);

  let notes = '';
  let attachOpen = false;
  let dragOver = false;
  let uploadFile = null;
  let commentSaving = false;
  let error = null;

  let popupEl;
  let fileInput;

  onMount(() => {
    const handleOutside = (e) => {
      if (popupEl && !popupEl.contains(e.target)) dispatch('close');
    };
    // Skip the mousedown that opened this popup (the mouseup that follows the
    // triggering text selection) so it doesn't close itself immediately.
    const timer = setTimeout(() => window.addEventListener('mousedown', handleOutside), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleOutside);
    };
  });

  function selectFile(file) {
    uploadFile = file;
  }

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) selectFile(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) selectFile(file);
  }

  async function handleComment() {
    if (!notes.trim() || commentSaving) return;
    commentSaving = true;
    error = null;
    try {
      await createDraftComment({
        projectId: project.id,
        draftKind,
        draftTypeId,
        paragraphId: paragraphIds[0],
        quotedText,
        body: notes.trim(),
      });
      dispatch('commented');
    } catch (err) {
      error = err.message;
      commentSaving = false;
    }
  }

  function handleSendToAi() {
    if (!notes.trim() && !uploadFile) return;
    dispatch('sendtoai', { notes: notes.trim(), file: uploadFile });
  }
</script>

<div class="selection-popup" bind:this={popupEl} style="top:{clampedTop}px; left:{clampedLeft}px; width:{POPUP_WIDTH}px;">
  <div class="selection-popup-quote"><i class="las la-quote-left"></i> {quotedText}</div>

  <div class="selection-popup-input">
    <textarea
      class="selection-popup-textarea"
      placeholder="Leave a note, or tell the AI what to do with this..."
      bind:value={notes}
      autofocus
    ></textarea>
    <VoiceDictationButton class="selection-popup-mic" on:transcript={(e) => notes = notes ? `${notes} ${e.detail}` : e.detail} />
  </div>

  {#if !attachOpen}
    <button class="attach-toggle-btn" type="button" on:click={() => attachOpen = true}>
      <i class="las la-paperclip"></i> Attach a document
    </button>
  {:else}
    <div
      class="attach-zone"
      class:drag-over={dragOver}
      class:file-selected={!!uploadFile}
      on:dragover|preventDefault={() => dragOver = true}
      on:dragleave={() => dragOver = false}
      on:drop={onDrop}
      on:click={() => fileInput.click()}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
    >
      {#if uploadFile}
        <i class="las la-file-check" style="color:var(--color-emerald-600)"></i>
        <span>{uploadFile.name}</span>
        <span class="attach-zone-sub">Click to replace</span>
      {:else}
        <i class="las la-cloud-upload-alt"></i>
        <span>Drop a document or click to upload</span>
        <span class="attach-zone-sub">PDF, TXT or MD</span>
      {/if}
    </div>
    <input type="file" accept=".pdf,.txt,.md" bind:this={fileInput} on:change={onFileChange} style="display:none" />
  {/if}

  {#if error}<p class="selection-popup-error">{error}</p>{/if}

  <div class="selection-popup-actions">
    <button class="btn-secondary" type="button" on:click={() => dispatch('close')}>Cancel</button>
    <button class="btn-secondary" type="button" disabled={!notes.trim() || commentSaving} on:click={handleComment}>
      {commentSaving ? 'Saving...' : 'Comment'}
    </button>
    <button class="btn-primary" type="button" disabled={!notes.trim() && !uploadFile} on:click={handleSendToAi}>
      <i class="las la-magic"></i> Send to AI
    </button>
  </div>
</div>

<style>
  .selection-popup {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.65rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
  }

  .selection-popup-quote {
    font-size: 0.7rem;
    font-style: italic;
    color: var(--color-slate-500);
    background: var(--color-slate-50);
    border-left: 2px solid var(--color-slate-300);
    padding: 0.3rem 0.5rem;
    border-radius: 3px;
    max-height: 3.5rem;
    overflow-y: auto;
  }

  .selection-popup-input {
    position: relative;
  }

  .selection-popup-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 60px;
    padding: 0.45rem 2rem 0.45rem 0.55rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--color-slate-700);
    resize: vertical;
    line-height: 1.45;
  }
  .selection-popup-textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .selection-popup-input :global(.selection-popup-mic) {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
  }

  .attach-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--color-slate-500);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.15rem 0;
  }
  .attach-toggle-btn:hover { color: var(--color-primary-600); }

  .attach-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.75rem;
    border: 1.5px dashed var(--color-slate-300);
    border-radius: 6px;
    color: var(--color-slate-500);
    font-size: 0.75rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .attach-zone:hover, .attach-zone.drag-over { border-color: var(--color-primary-400); background: var(--color-primary-50); }
  .attach-zone.file-selected { border-style: solid; border-color: var(--color-emerald-400); }
  .attach-zone i { font-size: 1.1rem; }
  .attach-zone-sub { font-size: 0.65rem; color: var(--color-slate-400); }

  .selection-popup-error {
    font-size: 0.72rem;
    color: var(--color-red-500);
    margin: 0;
  }

  .selection-popup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .selection-popup-actions button {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
  }
</style>
