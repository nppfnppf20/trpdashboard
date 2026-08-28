<script>
  export let open = false;
  export let selectedCell = null;   // { doc, topic, topicEntry } or { doc, docOnly: true }
  export let onClose = () => {};

  let activeTab = 'summary';

  $: if (selectedCell) activeTab = 'summary';

  $: doc = selectedCell?.doc;
  $: topic = selectedCell?.topic;
  $: entry = selectedCell?.topicEntry;
  $: stageLabel = doc?.stage_name || doc?.stage_label || 'Standard upload';
  $: docOnly = selectedCell?.docOnly ?? false;

  const SENTIMENT_STYLES = {
    positive:      { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
    neutral:       { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    negative:      { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
    not_mentioned: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' }
  };

  $: sentiment = entry?.sentiment ?? 'not_mentioned';
  $: sentStyle = SENTIMENT_STYLES[sentiment] ?? SENTIMENT_STYLES.not_mentioned;
</script>

<!-- Backdrop -->
{#if open}
  <div class="backdrop" on:click={onClose} role="presentation"></div>
{/if}

<!-- Sidebar drawer -->
<div class="sidebar" class:open>
  {#if selectedCell && doc}
    <div class="sidebar-header">
      <div class="header-info">
        <div class="header-stage">
          {stageLabel}
          {#if doc.is_preset_stage}
            <span class="preset-tag"><i class="las la-bookmark"></i></span>
          {/if}
        </div>
        <div class="header-filename">{doc.filename}</div>
      </div>
      <button class="btn-close" on:click={onClose}><i class="las la-times"></i></button>
    </div>

    <!-- Tabs — hide Issue Detail tab if this is a doc-only cell -->
    <div class="sidebar-tabs">
      <button class="s-tab" class:active={activeTab === 'summary'} on:click={() => activeTab = 'summary'}>
        Summary
      </button>
      {#if !docOnly}
        <button class="s-tab" class:active={activeTab === 'issue'} on:click={() => activeTab = 'issue'}>
          Topic Detail
        </button>
      {/if}
      <button class="s-tab" class:active={activeTab === 'uncaptured'} on:click={() => activeTab = 'uncaptured'}>
        Uncaptured
      </button>
    </div>

    <div class="sidebar-body">
      {#if activeTab === 'summary'}
        <div class="section-label">Document Summary</div>
        <p class="body-text">{doc.summary ?? 'No summary available.'}</p>

      {:else if activeTab === 'issue' && !docOnly}
        {#if topic && entry}
          <div class="topic-header">
            <span class="code-badge">{topic.code}</span>
            <span class="topic-title">{topic.title}</span>
          </div>

          <div class="pill-row">
            <span class="sentiment-pill" style="background:{sentStyle.bg}; color:{sentStyle.color}; border-color:{sentStyle.border}">
              {sentiment.replace('_', ' ')}
            </span>
            {#if entry.confidence}
              <span class="confidence-pill">{entry.confidence} confidence</span>
            {/if}
            {#if !entry.mentioned}
              <span class="not-mentioned">Not mentioned</span>
            {/if}
          </div>

          {#if entry.summary}
            <div class="section-label" style="margin-top:1rem">Summary</div>
            <p class="body-text">{entry.summary}</p>
          {/if}

          {#if entry.source_quote}
            <div class="section-label" style="margin-top:1rem">Source Quote</div>
            <blockquote class="source-quote">"{entry.source_quote}"</blockquote>
          {/if}

          {#if !entry.mentioned && !entry.summary}
            <p class="muted">This topic was not mentioned in the document.</p>
          {/if}
        {:else}
          <p class="muted">No topic data for this cell.</p>
        {/if}

      {:else if activeTab === 'uncaptured'}
        {#if doc.unmatched_content}
          <div class="section-label">Content not captured by topics</div>
          <div class="unmatched-box">{doc.unmatched_content}</div>
        {:else}
          <p class="muted">No uncaptured content flagged for this document.</p>
        {/if}

        {#if (doc.suggested_topics ?? []).length > 0}
          <div class="section-label" style="margin-top:1rem">Suggested topics</div>
          {#each doc.suggested_topics as st}
            <div class="suggested-item">
              <div class="suggested-title">{st.title}</div>
              {#if st.description}<p class="suggested-desc">{st.description}</p>{/if}
              {#if st.reason}<p class="suggested-reason"><em>Why:</em> {st.reason}</p>{/if}
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: transparent;
  }

  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    background: white;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    z-index: 1201;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    overflow: hidden;
  }
  .sidebar.open { transform: translateX(0); }

  .sidebar-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .header-stage {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-purple-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .preset-tag { color: var(--color-purple-700); }
  .header-filename { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); margin-top: 0.2rem; }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.1rem;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .btn-close:hover { color: var(--color-slate-800); }

  .sidebar-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .s-tab {
    flex: 1;
    padding: 0.6rem 0.5rem;
    background: none;
    border: none;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .s-tab.active { color: var(--color-purple-600); border-bottom-color: var(--color-purple-600); }
  .s-tab:hover:not(.active) { color: var(--color-slate-800); }

  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .section-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-slate-400);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.5rem;
  }

  .body-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.65;
  }

  .topic-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .code-badge {
    font-size: 0.7rem; font-weight: 700;
    background: var(--color-violet-100); color: var(--color-purple-700);
    padding: 0.2rem 0.5rem; border-radius: 4px;
    flex-shrink: 0;
  }
  .topic-title { font-size: 0.9rem; font-weight: 600; color: var(--color-slate-800); }

  .pill-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .sentiment-pill {
    font-size: 0.72rem; font-weight: 600;
    padding: 0.25rem 0.6rem; border-radius: 20px;
    border: 1px solid; text-transform: capitalize;
  }
  .confidence-pill {
    font-size: 0.72rem; color: var(--color-slate-500);
    background: var(--color-slate-100); padding: 0.25rem 0.6rem; border-radius: 20px;
  }
  .not-mentioned { font-size: 0.72rem; color: var(--color-slate-400); font-style: italic; }

  .source-quote {
    margin: 0;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--color-violet-300);
    background: var(--color-purple-50);
    font-style: italic;
    font-size: 0.8rem;
    color: var(--color-slate-700);
    line-height: 1.6;
    border-radius: 0 6px 6px 0;
  }

  .unmatched-box {
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-amber-800);
    line-height: 1.5;
  }

  .suggested-item {
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .suggested-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }
  .suggested-desc { margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--color-slate-600); }
  .suggested-reason { margin: 0.25rem 0 0 0; font-size: 0.75rem; color: var(--color-slate-400); }

  .muted { margin: 0; font-size: 0.875rem; color: var(--color-slate-400); font-style: italic; }
</style>
