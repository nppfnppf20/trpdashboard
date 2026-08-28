<script>
  import { getBackfillPreview, acceptSuggestedTopic } from '$lib/api/ingestion.js';
  import BackfillConfirmModal from './BackfillConfirmModal.svelte';

  export let doc;
  export let projectId;
  export let onReview = () => {};         // opens review screen for awaiting_review docs
  export let onTopicAdded = () => {};     // re-fetch topics after accept-suggested

  let expanded = false;
  let addingIndex = null;    // index of suggested topic being added
  let addedIndices = new Set();
  let showBackfill = null;   // { index, title, documentCount } when modal is open

  const STATUS_LABELS = {
    pending:          { label: 'Pending',         cls: 'status-pending' },
    processing:       { label: 'Processing…',     cls: 'status-processing' },
    awaiting_review:  { label: 'Awaiting Review', cls: 'status-review' },
    confirmed:        { label: 'Confirmed',        cls: 'status-confirmed' },
    complete:         { label: 'Complete',         cls: 'status-complete' },
    error:            { label: 'Error',            cls: 'status-error' }
  };

  $: status = STATUS_LABELS[doc.status] ?? { label: doc.status, cls: 'status-pending' };
  $: stageDisplay = doc.stage_name || doc.stage_label || 'Standard upload';
  $: suggestedTopics = doc.suggested_topics ?? [];
  $: dateStr = new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  async function handleAddSuggested(index, title) {
    // Check if there are docs to backfill
    const preview = await getBackfillPreview(projectId);
    if (preview.document_count > 0) {
      showBackfill = { index, title, documentCount: preview.document_count };
    } else {
      await doAccept(index, false);
    }
  }

  async function doAccept(index, runBackfill) {
    showBackfill = null;
    addingIndex = index;
    try {
      await acceptSuggestedTopic(projectId, {
        document_id: doc.id,
        suggested_topic_index: index,
        run_backfill: runBackfill
      });
      addedIndices = new Set([...addedIndices, index]);
      await onTopicAdded();
    } catch (err) {
      console.error('Failed to add suggested topic:', err);
    } finally {
      addingIndex = null;
    }
  }
</script>

{#if showBackfill}
  <BackfillConfirmModal
    documentCount={showBackfill.documentCount}
    topicTitle={showBackfill.title}
    onConfirm={() => doAccept(showBackfill.index, true)}
    onSkip={() => doAccept(showBackfill.index, false)}
    onCancel={() => showBackfill = null}
  />
{/if}

<div class="doc-card" class:expanded>
  <div class="doc-header" on:click={() => expanded = !expanded} role="button" tabindex="0"
    on:keydown={e => e.key === 'Enter' && (expanded = !expanded)}>
    <div class="doc-main">
      <i class="las la-file-alt doc-icon"></i>
      <div class="doc-info">
        <div class="doc-filename">{doc.filename}</div>
        <div class="doc-meta">
          <span class="stage-label">{stageDisplay}</span>
          <span class="sep">·</span>
          <span>{dateStr}</span>
          {#if doc.is_preset_stage}
            <span class="sep">·</span>
            <span class="preset-tag"><i class="las la-bookmark"></i> Stage document</span>
          {/if}
        </div>
      </div>
    </div>
    <div class="doc-right">
      {#if doc.status === 'awaiting_review'}
        <button class="btn-review" on:click|stopPropagation={() => onReview(doc)}>
          <i class="las la-eye"></i> Review & Confirm
        </button>
      {/if}
      <span class="status-badge {status.cls}">{status.label}</span>
      <i class="las la-angle-{expanded ? 'up' : 'down'} chevron"></i>
    </div>
  </div>

  {#if expanded}
    <div class="doc-body">
      {#if doc.parse_warning}
        <div class="warning-banner">
          <i class="las la-exclamation-triangle"></i> {doc.parse_warning}
        </div>
      {/if}

      {#if doc.summary}
        <div class="section">
          <div class="section-label">Document Summary</div>
          <p class="summary-text">{doc.summary}</p>
        </div>
      {/if}

      {#if doc.unmatched_content}
        <div class="section">
          <div class="section-label">Content not captured by existing topics</div>
          <div class="unmatched-box">{doc.unmatched_content}</div>
        </div>
      {/if}

      {#if suggestedTopics.length > 0}
        <div class="section">
          <div class="section-label">Suggested new topics</div>
          <div class="suggested-list">
            {#each suggestedTopics as st, i (i)}
              <div class="suggested-card">
                <div class="suggested-info">
                  <div class="suggested-title">{st.title}</div>
                  {#if st.description}
                    <div class="suggested-desc">{st.description}</div>
                  {/if}
                  {#if st.reason}
                    <div class="suggested-reason"><em>Why track this:</em> {st.reason}</div>
                  {/if}
                </div>
                {#if addedIndices.has(i)}
                  <span class="added-tag"><i class="las la-check"></i> Added</span>
                {:else}
                  <button
                    class="btn-add-suggested"
                    on:click={() => handleAddSuggested(i, st.title)}
                    disabled={addingIndex === i}
                  >
                    {addingIndex === i ? 'Adding…' : 'Add as topic'}
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if !doc.summary && doc.status !== 'awaiting_review' && doc.status !== 'processing' && doc.status !== 'pending'}
        <p class="muted">No summary available yet.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .doc-card {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    background: white;
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .doc-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }
  .doc-card.expanded { border-color: var(--color-violet-300); }

  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    cursor: pointer;
    gap: 0.75rem;
    user-select: none;
  }

  .doc-main { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
  .doc-icon { font-size: 1.25rem; color: var(--color-purple-600); flex-shrink: 0; }
  .doc-info { min-width: 0; }
  .doc-filename { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .doc-meta { font-size: 0.75rem; color: var(--color-slate-500); display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.1rem; }
  .sep { color: var(--color-slate-300); }
  .stage-label { color: var(--color-slate-600); }
  .preset-tag { color: var(--color-purple-700); font-weight: 500; }

  .doc-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
  .chevron { color: var(--color-slate-400); font-size: 0.8rem; }

  .status-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 20px;
    white-space: nowrap;
  }
  .status-pending   { background: var(--color-slate-100); color: var(--color-slate-600); }
  .status-processing{ background: var(--color-primary-50); color: var(--color-primary-700); }
  .status-review    { background: var(--color-amber-100); color: var(--color-amber-800); }
  .status-confirmed { background: var(--color-violet-100); color: var(--color-purple-700); }
  .status-complete  { background: var(--color-slate-100); color: var(--color-green-800); }
  .status-error     { background: var(--color-red-50); color: var(--color-red-800); }

  .btn-review {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.9rem;
    background: var(--color-amber-100);
    color: var(--color-amber-800);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn-review:hover { background: var(--color-amber-200); }

  .doc-body {
    border-top: 1px solid var(--color-slate-200);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section { display: flex; flex-direction: column; gap: 0.4rem; }
  .section-label { font-size: 0.75rem; font-weight: 700; color: var(--color-slate-500); text-transform: uppercase; letter-spacing: 0.05em; }

  .summary-text { margin: 0; font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.6; }

  .unmatched-box {
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-amber-800);
    line-height: 1.5;
  }

  .warning-banner {
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    color: var(--color-red-800);
    padding: 0.6rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .suggested-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .suggested-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .suggested-info { flex: 1; min-width: 0; }
  .suggested-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }
  .suggested-desc { font-size: 0.8rem; color: var(--color-slate-600); margin-top: 0.2rem; }
  .suggested-reason { font-size: 0.78rem; color: var(--color-slate-400); margin-top: 0.3rem; }

  .added-tag {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-green-800);
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    padding: 0.3rem 0.7rem;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-add-suggested {
    padding: 0.35rem 0.75rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .btn-add-suggested:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-add-suggested:disabled { opacity: 0.6; cursor: not-allowed; }

  .muted { margin: 0; font-size: 0.8rem; color: var(--color-slate-400); }
</style>
