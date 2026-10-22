<script>
  // Full text of a saved meeting transcript or uploaded document, shown with
  // tidied line breaks and bolded headings, and the same light markup tools as
  // the policy viewer (bold / italic / underline / highlight, plus changing line
  // breaks and spacing, never the words). The stored text is never changed; the
  // layout is saved separately.
  //
  // Used for meeting notes and docs (the notes page and the overview widget) with
  // no extra props. The briefing document viewer passes its own load / save.
  import { onMount } from 'svelte';
  import { getMeetingTranscript, saveTranscriptAnnotated } from '$lib/api/meetingNotes.js';
  import { autoFormatDocumentText } from '$lib/utils/policyFormat.js';
  import FormattedTextEditor from '$lib/components/shared/FormattedTextEditor.svelte';
  import FormatToolbar from '$lib/components/shared/FormatToolbar.svelte';

  export let note;
  export let onClose;
  // async () => ({ text, annotated }): where the text comes from
  export let load = async () => {
    const data = await getMeetingTranscript(note.id);
    return { text: data.transcript_text, annotated: data.transcript_text_annotated };
  };
  // async (html | null) => void: where the layout is saved
  export let save = (html) => saveTranscriptAnnotated(note.id, html);
  export let kindLabel = 'Full transcript';

  let loading = true;
  let text = null;
  let annotated = null;
  let error = null;

  let editor;
  let saving = false;
  let canReset = false;

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onMount(async () => {
    try {
      ({ text, annotated } = await load());
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  // Saves anything still waiting, then closes. Used by every way of closing.
  async function close() {
    await editor?.flush();
    onClose();
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="dialog-backdrop" role="dialog" tabindex="-1" on:click|self={close} on:keydown={(e) => e.key === 'Escape' && close()}>
  <div class="dialog dialog-lg">
    <div class="dialog-header">
      <div class="title-block">
        <h3 class="dialog-title">{note.title}</h3>
        <p class="meta">
          {kindLabel}
          {#if note.meeting_date || note.created_at}&nbsp;&bull; {formatDate(note.meeting_date || note.created_at)}{/if}
          {#if note.attendees_text}&nbsp;&bull; {note.attendees_text}{/if}
        </p>
      </div>
      <button class="dialog-close" on:click={close} aria-label="Close">&times;</button>
    </div>

    <!-- The toolbar sits outside the scrolling area, so it is always in view -->
    {#if text}
      <div class="toolbar-bar">
        <p class="section-label">{kindLabel}</p>
        <FormatToolbar {editor} {saving} {canReset} />
      </div>
    {/if}

    <div class="dialog-body">
      {#if loading}
        <p class="dialog-hint">Loading…</p>
      {:else if error}
        <div class="alert alert-error">{error}</div>
      {:else if text}
        <FormattedTextEditor
          bind:this={editor}
          bind:saving
          bind:canReset
          {text}
          savedHtml={annotated}
          startingLayout={autoFormatDocumentText}
          {save}
          resetPrompt="Remove all bold, italic, underline and highlight from this document?"
        />
      {:else}
        <p class="dialog-hint">No text stored for this item.</p>
      {/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">Line breaks tidied for reading. The saved text itself is unchanged.</span>
      <div class="dialog-actions">
        <button class="btn btn-secondary btn-sm" on:click={close}>Close</button>
      </div>
    </div>
  </div>
</div>

<style>
  .title-block { min-width: 0; }
  .title-block .dialog-title { font-size: var(--font-size-base); }
  .meta { margin: 0.15rem 0 0; font-size: var(--font-size-xs); color: var(--color-slate-500); }

  .toolbar-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-6);
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .section-label {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-slate-400);
  }
</style>
