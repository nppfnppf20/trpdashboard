<script>
  export let documentCount = 0;
  export let topicTitle = '';
  export let onConfirm = () => {};
  export let onSkip = () => {};
  export let onCancel = () => {};

  // Rough estimate: ~15 seconds per document for a single-topic ingestion call
  $: estimatedMinutes = Math.ceil((documentCount * 15) / 60);
</script>

<div class="backdrop" on:click={onCancel} role="presentation">
  <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
    <div class="modal-icon"><i class="las la-history"></i></div>
    <h3>Backfill previous documents?</h3>
    <p>
      You're adding <strong>"{topicTitle}"</strong> as a new topic. This project has
      <strong>{documentCount}</strong> previously confirmed document{documentCount === 1 ? '' : 's'}.
    </p>
    <p class="warning">
      Running backfill will re-scan all {documentCount} document{documentCount === 1 ? '' : 's'}
      for this topic and may take up to <strong>~{estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'}</strong>.
      The topic will appear in the timeline once complete.
    </p>
    <p class="skip-note">
      If you skip backfill, existing documents will show as "not mentioned" until you re-upload them.
    </p>
    <div class="actions">
      <button class="btn-primary" on:click={onConfirm}>
        <i class="las la-check"></i> Yes, backfill all documents
      </button>
      <button class="btn-secondary" on:click={onSkip}>
        Skip backfill
      </button>
      <button class="btn-ghost" on:click={onCancel}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .modal-icon {
    font-size: 2.5rem;
    color: var(--color-purple-600);
    margin-bottom: 0.75rem;
  }

  h3 { margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--color-slate-800); }

  p {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    color: var(--color-slate-600);
    line-height: 1.5;
  }

  .warning {
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.75rem;
    color: var(--color-amber-800);
  }

  .skip-note {
    font-size: 0.8rem;
    color: var(--color-slate-400);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.65rem 1.25rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-primary:hover { background: var(--color-purple-700); }

  .btn-secondary {
    padding: 0.65rem 1.25rem;
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-secondary:hover { background: var(--color-slate-200); }

  .btn-ghost {
    padding: 0.5rem;
    background: none;
    color: var(--color-slate-400);
    border: none;
    font-size: 0.8rem;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-ghost:hover { color: var(--color-slate-500); }
</style>
