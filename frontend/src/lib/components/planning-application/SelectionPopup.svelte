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
  export let defaultDocType = null;

  const dispatch = createEventDispatcher();

  const POPUP_WIDTH = 380;
  $: clampedLeft = Math.min(
    Math.max(left - POPUP_WIDTH / 2, 16),
    (typeof window !== 'undefined' ? window.innerWidth : 1200) - POPUP_WIDTH - 16
  );
  $: clampedTop = Math.min(top + 8, (typeof window !== 'undefined' ? window.innerHeight : 900) - 260);

  const DOC_TYPES = [
    { value: 'project_briefing',  label: 'Project Briefing' },
    { value: 'specialist_report', label: 'Specialist Report' },
    { value: 'expert_evidence',   label: 'Expert Evidence / Proof' },
    { value: 'revised_document',  label: 'Revised Document' },
    { value: 'other',             label: 'Other Document' },
  ];

  let notes = '';
  let micRecording = false;
  let attachOpen = false;
  let docType = defaultDocType ?? DOC_TYPES[0].value;
  let inputTab = 'upload'; // 'upload' | 'paste'
  let dragOver = false;
  let uploadFile = null;
  let pasteText = '';
  let pasteTitle = '';
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

  $: hasAttachment = inputTab === 'upload' ? !!uploadFile : !!pasteText.trim();

  function handleSendToAi() {
    if (!notes.trim() && !hasAttachment) return;
    dispatch('sendtoai', {
      notes: notes.trim(),
      file: inputTab === 'upload' ? uploadFile : null,
      documentText: inputTab === 'paste' ? pasteText.trim() : '',
      documentTitle: inputTab === 'paste' ? (pasteTitle.trim() || null) : (uploadFile?.name ?? null),
      docType: attachOpen && hasAttachment ? docType : null,
    });
  }
</script>

<div class="selection-popup" bind:this={popupEl} style="top:{clampedTop}px; left:{clampedLeft}px; width:{POPUP_WIDTH}px;">
  <div class="selection-popup-quote"><i class="las la-quote-left"></i> {quotedText}</div>

  <div class="selection-popup-input" class:recording={micRecording}>
    <textarea
      class="selection-popup-textarea"
      placeholder="Leave a note, or tell the AI what to do with this..."
      bind:value={notes}
      autofocus
    ></textarea>
    <VoiceDictationButton
      class="selection-popup-mic"
      on:transcript={(e) => notes = notes ? `${notes} ${e.detail}` : e.detail}
      on:statechange={(e) => micRecording = e.detail === 'recording'}
    />
    {#if micRecording}
      <span class="selection-popup-recording-hint">Recording — click the mic to finish</span>
    {/if}
  </div>

  {#if !attachOpen}
    <button class="attach-toggle-btn" type="button" on:click={() => attachOpen = true}>
      <i class="las la-paperclip"></i> Attach a document
    </button>
  {:else}
    <div class="attach-section">
      <select class="attach-doc-type" bind:value={docType}>
        {#each DOC_TYPES as dt}
          <option value={dt.value}>{dt.label}</option>
        {/each}
      </select>

      <div class="attach-tabs">
        <button type="button" class="attach-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>
          <i class="las la-upload"></i> Upload
        </button>
        <button type="button" class="attach-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>
          <i class="las la-paste"></i> Paste text
        </button>
      </div>

      {#if inputTab === 'upload'}
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
      {:else}
        <input class="attach-paste-title" type="text" placeholder="Document title (optional)" bind:value={pasteTitle} />
        <textarea class="attach-paste-textarea" placeholder="Paste the document text here..." bind:value={pasteText}></textarea>
      {/if}
    </div>
  {/if}

  {#if error}<p class="selection-popup-error">{error}</p>{/if}

  <div class="selection-popup-actions">
    <button class="btn-secondary" type="button" on:click={() => dispatch('close')}>Cancel</button>
    <button class="btn-secondary" type="button" disabled={!notes.trim() || commentSaving} on:click={handleComment}>
      {commentSaving ? 'Saving...' : 'Comment'}
    </button>
    <button class="btn-primary" type="button" disabled={!notes.trim() && !hasAttachment} on:click={handleSendToAi}>
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
    width: 1.6rem;
    height: 1.6rem;
    transition: top 0.15s, right 0.15s, left 0.15s, transform 0.15s, background-color 0.15s, color 0.15s;
    z-index: 1;
  }

  /* While recording: pulse the whole field and move the mic front-and-center
     (enlarged, solid color) so it's obvious you have to click it again to
     stop — the button's own subtle corner pulse alone wasn't noticeable
     enough. Give the field extra room so the bigger button + hint text below
     it have space, rather than a short field clipping them. */
  .selection-popup-input.recording {
    min-height: 6.5rem;
  }
  .selection-popup-input.recording .selection-popup-textarea {
    min-height: 6.5rem;
    border-color: var(--color-red-200);
    animation: selection-input-recording-pulse 1.6s ease-in-out infinite;
  }
  .selection-popup-input.recording :global(.selection-popup-mic) {
    top: 40%;
    right: auto;
    left: 50%;
    width: 2.25rem;
    height: 2.25rem;
    transform: translate(-50%, -50%);
    background-color: var(--color-red-500) !important;
    border-color: var(--color-red-500) !important;
    color: white !important;
  }
  .selection-popup-recording-hint {
    position: absolute;
    left: 50%;
    bottom: 0.6rem;
    transform: translateX(-50%);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-red-600);
    white-space: nowrap;
    pointer-events: none;
  }
  @keyframes selection-input-recording-pulse {
    0%, 100% { background-color: white; }
    50% { background-color: var(--color-red-50); }
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

  .attach-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .attach-doc-type {
    width: 100%;
    box-sizing: border-box;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: white;
  }

  .attach-tabs {
    display: flex;
    gap: 0.3rem;
  }
  .attach-tab {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    color: var(--color-slate-500);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
  }
  .attach-tab.active { background: var(--color-primary-50); border-color: var(--color-primary-300); color: var(--color-primary-700); }

  .attach-paste-title {
    width: 100%;
    box-sizing: border-box;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    font-family: inherit;
    color: var(--color-slate-700);
  }
  .attach-paste-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 70px;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    font-family: inherit;
    color: var(--color-slate-700);
    resize: vertical;
    line-height: 1.4;
  }

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
