<script>
  import { onMount } from 'svelte';
  import { getMeetingTranscript } from '$lib/api/meetingNotes.js';

  export let note;
  export let onClose;

  let loading = true;
  let text = null;
  let error = null;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onMount(async () => {
    try {
      const data = await getMeetingTranscript(note.id);
      text = data.transcript_text;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="modal-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="mn-modal mn-editor-modal">

    <div class="modal-header">
      <div>
        <h2 class="mn-modal-title">{note.title}</h2>
        <p class="mn-modal-meta">
          Full transcript
          {#if note.meeting_date}&nbsp;&bull; {formatDate(note.meeting_date)}{/if}
          {#if note.attendees_text}&nbsp;&bull; {note.attendees_text}{/if}
        </p>
      </div>
      <button class="btn btn-icon btn-ghost close-btn" on:click={onClose}>
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="mn-loading"><span class="mn-spinner-blue"></span> Loading transcript…</div>
      {:else if error}
        <div class="mn-error">{error}</div>
      {:else if text}
        <pre class="mn-transcript-text mn-transcript-modal-text">{text}</pre>
      {:else}
        <p class="mn-empty">No transcript stored for this meeting.</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" on:click={onClose}>Close</button>
    </div>

  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .mn-modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .mn-editor-modal { max-width: 860px; height: 88vh; }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .mn-modal-title { font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); margin: 0 0 0.2rem; }
  .mn-modal-meta { font-size: 0.8rem; color: var(--color-slate-500); margin: 0; }
  .close-btn { flex-shrink: 0; }
  .modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    flex-shrink: 0;
  }

  .mn-empty { color: var(--color-slate-400); font-size: 0.875rem; padding: 0.5rem 0; margin: 0; }
  .mn-error {
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.6rem 0.85rem;
    color: var(--color-red-800);
    font-size: 0.875rem;
  }
  .mn-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    padding: 2rem 0;
  }
  .mn-spinner-blue {
    display: inline-block;
    width: 0.9rem; height: 0.9rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: mn-spin 0.7s linear infinite;
  }
  @keyframes mn-spin { to { transform: rotate(360deg); } }

  .mn-transcript-text {
    font-family: inherit;
    font-size: 0.8rem;
    color: var(--color-slate-600);
    white-space: pre-wrap;
    line-height: 1.6;
    margin: 0;
    max-height: 360px;
    overflow-y: auto;
    background: var(--color-slate-50);
    border-radius: 4px;
    padding: 0.75rem;
  }
  .mn-transcript-modal-text {
    max-height: none;
    overflow-y: visible;
    font-size: 0.85rem;
  }
</style>
