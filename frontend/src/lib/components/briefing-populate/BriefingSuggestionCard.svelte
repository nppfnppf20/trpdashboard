<script>
  export let suggestion;
  export let onAccept;
  export let onReject;
  export let issueTypes = [];
  export let onMatchChange;

  let expanded = false;

  // Strip HTML for plain text preview
  function stripHtml(html) {
    return html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
  }

  $: preview = stripHtml(suggestion.suggested_content);
  $: previewShort = preview.length > 200 ? preview.slice(0, 200) + '…' : preview;

  const TYPE_LABELS = {
    document_summary: 'Document summary',
    issue_summary:     'Issue working note',
    new_issue:         'New issue',
  };
</script>

<div class="card" class:card-accepted={suggestion._state === 'accepted'} class:card-skipped={suggestion._state === 'skipped'}>
  <div class="card-header">
    <div class="card-title">
      <span class="label">{suggestion.label}</span>
      <span class="type-tag">{TYPE_LABELS[suggestion.type] ?? suggestion.type}</span>
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

  {#if suggestion.type === 'new_issue' && onMatchChange}
    <div class="match-row">
      <i class="las la-tag"></i>
      <span class="match-label">Link to template:</span>
      <select
        class="match-select"
        value={suggestion.matched_issue_type_id ?? ''}
        on:change={e => onMatchChange(suggestion, e.target.value)}
      >
        <option value="">No template</option>
        {#each issueTypes as it}
          <option value={it.id}>{it.label}{it.development_type ? ` - ${it.development_type}` : ' - generic'}</option>
        {/each}
      </select>
    </div>
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
    border: 1.5px solid var(--color-slate-200);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .card-accepted { border-color: var(--color-emerald-100); background: var(--color-slate-100); }
  .card-skipped  { opacity: 0.5; background: var(--color-slate-50); }

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
    color: var(--color-slate-800);
  }

  .type-tag {
    font-size: 0.7rem;
    color: var(--color-slate-400);
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
    background: var(--color-emerald-500);
    color: white;
    border-color: var(--color-emerald-500);
  }

  .btn-accept:hover { background: var(--color-emerald-600); }

  .btn-skip {
    background: white;
    color: var(--color-slate-500);
    border-color: var(--color-slate-300);
  }

  .btn-skip:hover { background: var(--color-slate-50); }

  .state-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
  }

  .state-badge.accepted { background: var(--color-emerald-100); color: var(--color-emerald-800); }
  .state-badge.skipped  { background: var(--color-slate-100); color: var(--color-slate-400); }

  .reason {
    margin: 0;
    padding: 0 1rem 0.5rem;
    font-size: 0.775rem;
    color: var(--color-slate-500);
    display: flex;
    align-items: flex-start;
    gap: 0.3rem;
    line-height: 1.45;
  }

  .reason i { flex-shrink: 0; margin-top: 0.05rem; }

  .match-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 1rem 0.625rem;
    font-size: 0.775rem;
    color: var(--color-slate-500);
  }

  .match-row i { color: var(--color-violet-600); }

  .match-label { flex-shrink: 0; }

  .match-select {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 5px;
    font-size: 0.775rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
  }

  .preview {
    padding: 0.5rem 1rem 0.875rem;
    border-top: 1px solid var(--color-slate-100);
  }

  .preview-text {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-slate-600);
    line-height: 1.55;
  }

  .expand-btn {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: var(--color-violet-600);
    cursor: pointer;
    padding: 0.25rem 0;
    margin-top: 0.25rem;
  }

  .expand-btn:hover { text-decoration: underline; }
</style>
