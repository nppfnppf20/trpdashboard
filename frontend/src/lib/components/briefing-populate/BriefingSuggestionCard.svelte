<script>
  export let suggestion;
  export let onAccept;
  export let onReject;

  let expanded = false;

  // Strip HTML for plain text preview
  function stripHtml(html) {
    return html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
  }

  $: preview = stripHtml(suggestion.suggested_content);
  $: previewShort = preview.length > 200 ? preview.slice(0, 200) + '…' : preview;
</script>

<div class="card" class:card-accepted={suggestion._state === 'accepted'} class:card-skipped={suggestion._state === 'skipped'}>
  <div class="card-header">
    <div class="card-title">
      <span class="label">{suggestion.label}</span>
      <span class="type-tag">{suggestion.type === 'document_summary' ? 'Document summary' : 'Issue working note'}</span>
    </div>
    <div class="card-actions">
      {#if suggestion._state === 'accepted'}
        <span class="state-badge accepted"><i class="las la-check"></i> Accepted</span>
      {:else if suggestion._state === 'skipped'}
        <span class="state-badge skipped"><i class="las la-times"></i> Skipped</span>
      {:else}
        <button class="btn btn-skip" on:click={() => onReject(suggestion)}>Skip</button>
        <button class="btn btn-accept" on:click={() => onAccept(suggestion)}>
          <i class="las la-check"></i> Accept
        </button>
      {/if}
    </div>
  </div>

  {#if suggestion.reason}
    <p class="reason"><i class="las la-info-circle"></i> {suggestion.reason}</p>
  {/if}

  <div class="preview">
    <p class="preview-text">{expanded ? preview : previewShort}</p>
    {#if preview.length > 200}
      <button class="expand-btn" on:click={() => (expanded = !expanded)}>
        {expanded ? 'Show less' : 'Show more'}
      </button>
    {/if}
  </div>
</div>

<style>
  .card {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .card-accepted { border-color: #a7f3d0; background: #f0fdf4; }
  .card-skipped  { opacity: 0.5; background: #f8fafc; }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 1rem 0.5rem;
  }

  .card-title {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .type-tag {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.75rem;
    border-radius: 5px;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .btn-accept {
    background: #10b981;
    color: white;
    border-color: #10b981;
  }

  .btn-accept:hover { background: #059669; }

  .btn-skip {
    background: white;
    color: #64748b;
    border-color: #cbd5e1;
  }

  .btn-skip:hover { background: #f8fafc; }

  .state-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
  }

  .state-badge.accepted { background: #d1fae5; color: #065f46; }
  .state-badge.skipped  { background: #f1f5f9; color: #94a3b8; }

  .reason {
    margin: 0;
    padding: 0 1rem 0.5rem;
    font-size: 0.775rem;
    color: #64748b;
    display: flex;
    align-items: flex-start;
    gap: 0.3rem;
    line-height: 1.45;
  }

  .reason i { flex-shrink: 0; margin-top: 0.05rem; }

  .preview {
    padding: 0.5rem 1rem 0.875rem;
    border-top: 1px solid #f1f5f9;
  }

  .preview-text {
    margin: 0;
    font-size: 0.8rem;
    color: #475569;
    line-height: 1.55;
  }

  .expand-btn {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: #7c3aed;
    cursor: pointer;
    padding: 0.25rem 0;
    margin-top: 0.25rem;
  }

  .expand-btn:hover { text-decoration: underline; }
</style>
