<script>
  import { getDraft, confirmDocument } from '$lib/api/ingestion.js';

  export let documentId;
  export let onConfirmed = () => {};
  export let onCancel = () => {};

  let loading = true;
  let saving = false;
  let error = null;
  let document = null;
  let topicSummaries = [];
  let docSummary = { summary: '', unmatched_content: '', suggested_topics: [] };
  let editedCards = new Set();

  const SENTIMENTS = ['positive', 'neutral', 'negative', 'not_mentioned'];
  const CONFIDENCES = ['high', 'medium', 'low'];

  // Which topic cards are expanded (collapsed by default if not mentioned)
  let expandedCards = new Set();

  $: stageGuidance = document?.stage_user_guidance;
  $: stageName = document?.stage_name;
  $: dateStr = document ? new Date(document.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  async function load() {
    try {
      const data = await getDraft(documentId);
      document = data.document;
      docSummary = {
        summary: data.document_summary?.summary ?? '',
        unmatched_content: data.document_summary?.unmatched_content ?? '',
        suggested_topics: data.document_summary?.suggested_topics ?? []
      };
      topicSummaries = (data.topic_summaries ?? []).map(ts => ({ ...ts }));
      // Auto-expand mentioned topics
      expandedCards = new Set(topicSummaries.filter(ts => ts.mentioned).map(ts => ts.topic_id));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  function markEdited(topicId) {
    editedCards = new Set([...editedCards, topicId]);
  }

  function toggleCard(topicId) {
    const next = new Set(expandedCards);
    next.has(topicId) ? next.delete(topicId) : next.add(topicId);
    expandedCards = next;
  }

  async function handleConfirm() {
    saving = true;
    error = null;
    try {
      await confirmDocument(documentId, {
        topic_summaries: topicSummaries.map(ts => ({
          topic_id: ts.topic_id,
          summary: ts.summary,
          sentiment: ts.sentiment,
          source_quote: ts.source_quote,
          confidence: ts.confidence,
          mentioned: ts.mentioned
        })),
        document_summary: docSummary
      });
      await onConfirmed();
    } catch (err) {
      error = err.message;
      saving = false;
    }
  }

  const SENTIMENT_COLORS = {
    positive:      { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    neutral:       { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    negative:      { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    not_mentioned: { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' }
  };
</script>

<div class="review-overlay">
  <div class="review-container">

    <!-- Header -->
    <div class="review-header">
      <div class="header-left">
        <button class="btn-back" on:click={onCancel}>
          <i class="las la-arrow-left"></i> Back
        </button>
        <div>
          <div class="review-title">Review & Confirm Stage Document</div>
          {#if stageName}
            <div class="review-subtitle">{stageName} · {document?.filename} · {dateStr}</div>
          {/if}
        </div>
      </div>
      <button class="btn-confirm" on:click={handleConfirm} disabled={saving || loading}>
        {#if saving}
          <span class="spinner-sm"></span> Confirming…
        {:else}
          <i class="las la-check-circle"></i> Confirm Stage
        {/if}
      </button>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading LLM output…</p>
      </div>
    {:else if error}
      <div class="error-state">
        <i class="las la-exclamation-circle"></i>
        <p>{error}</p>
        <button on:click={load}>Retry</button>
      </div>
    {:else}
      <div class="review-body">

        <!-- Stage guidance banner -->
        {#if stageGuidance}
          <div class="guidance-banner">
            <i class="las la-info-circle"></i>
            <div>
              <strong>Review guidance for {stageName}</strong>
              <p>{stageGuidance}</p>
            </div>
          </div>
        {/if}

        <!-- Document summary -->
        <div class="review-section">
          <div class="section-title">Document Summary <span class="section-hint">(edit if needed)</span></div>
          <textarea
            class="summary-textarea"
            bind:value={docSummary.summary}
            rows="5"
            placeholder="200-word document summary…"
          ></textarea>
        </div>

        <!-- Per-topic cards -->
        <div class="review-section">
          <div class="section-title">Topic Analysis</div>
          <div class="section-hint-block">
            Cards where the LLM found no mention are collapsed by default, expand to review or override.
          </div>

          <div class="topic-cards">
            {#each topicSummaries as ts (ts.topic_id)}
              {@const isExpanded = expandedCards.has(ts.topic_id)}
              {@const sentColor = SENTIMENT_COLORS[ts.sentiment] ?? SENTIMENT_COLORS.not_mentioned}
              {@const wasEdited = editedCards.has(ts.topic_id)}

              <div class="topic-card" style="border-color: {sentColor.border}">
                <!-- Card header — always visible -->
                <div class="card-header" on:click={() => toggleCard(ts.topic_id)} role="button" tabindex="0"
                  on:keydown={e => e.key === 'Enter' && toggleCard(ts.topic_id)}>
                  <div class="card-header-left">
                    <span class="topic-code">{ts.code}</span>
                    <span class="topic-title">{ts.title}</span>
                    {#if wasEdited}
                      <span class="edited-badge">edited</span>
                    {/if}
                  </div>
                  <div class="card-header-right">
                    <span
                      class="sentiment-pill"
                      style="background:{sentColor.bg}; color:{sentColor.text}; border-color:{sentColor.border}"
                    >
                      {ts.sentiment.replace('_', ' ')}
                    </span>
                    {#if !ts.mentioned}
                      <span class="not-mentioned-hint">not mentioned</span>
                    {/if}
                    <i class="las la-angle-{isExpanded ? 'up' : 'down'} chevron"></i>
                  </div>
                </div>

                {#if isExpanded}
                  <div class="card-body">
                    <!-- Mentioned toggle -->
                    <div class="field-row">
                      <label class="field-label">Mentioned in document</label>
                      <div class="toggle-group">
                        <button
                          class="toggle-btn" class:active={ts.mentioned}
                          on:click={() => { ts.mentioned = true; markEdited(ts.topic_id); }}
                        >Yes</button>
                        <button
                          class="toggle-btn" class:active={!ts.mentioned}
                          on:click={() => { ts.mentioned = false; markEdited(ts.topic_id); }}
                        >No</button>
                      </div>
                    </div>

                    <!-- Sentiment -->
                    <div class="field-row">
                      <label class="field-label">Sentiment</label>
                      <div class="btn-group">
                        {#each SENTIMENTS as s}
                          <button
                            class="group-btn" class:active={ts.sentiment === s}
                            on:click={() => { ts.sentiment = s; markEdited(ts.topic_id); }}
                          >{s.replace('_', ' ')}</button>
                        {/each}
                      </div>
                    </div>

                    <!-- Confidence -->
                    <div class="field-row">
                      <label class="field-label">Confidence</label>
                      <div class="btn-group">
                        {#each CONFIDENCES as c}
                          <button
                            class="group-btn" class:active={ts.confidence === c}
                            on:click={() => { ts.confidence = c; markEdited(ts.topic_id); }}
                          >{c}</button>
                        {/each}
                      </div>
                    </div>

                    <!-- Summary -->
                    <div class="field-col">
                      <label class="field-label">Summary</label>
                      <textarea
                        class="field-textarea"
                        rows="3"
                        bind:value={ts.summary}
                        on:input={() => markEdited(ts.topic_id)}
                        placeholder="LLM summary of how this topic is discussed…"
                      ></textarea>
                    </div>

                    <!-- Source quote -->
                    <div class="field-col">
                      <label class="field-label">Source Quote</label>
                      <textarea
                        class="field-textarea field-textarea--quote"
                        rows="2"
                        bind:value={ts.source_quote}
                        on:input={() => markEdited(ts.topic_id)}
                        placeholder="Verbatim excerpt from the document…"
                      ></textarea>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Unmatched content -->
        <div class="review-section">
          <div class="section-title">Content not captured by existing topics <span class="section-hint">(edit if needed)</span></div>
          <textarea
            class="summary-textarea"
            bind:value={docSummary.unmatched_content}
            rows="3"
            placeholder="Content the LLM found that doesn't map to any topic…"
          ></textarea>
        </div>

        {#if error}
          <div class="error-banner">{error}</div>
        {/if}

        <!-- Bottom confirm -->
        <div class="bottom-bar">
          <button class="btn-confirm-lg" on:click={handleConfirm} disabled={saving}>
            {#if saving}
              <span class="spinner-sm"></span> Confirming…
            {:else}
              <i class="las la-check-circle"></i> Confirm Stage
            {/if}
          </button>
          <button class="btn-cancel" on:click={onCancel}>Cancel, keep as draft</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .review-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1500;
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
  }

  .review-container {
    background: #f8fafc;
    width: 100%;
    max-width: 860px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: -4px 0 24px rgba(0,0,0,0.15);
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    gap: 1rem;
    flex-shrink: 0;
  }

  .header-left { display: flex; align-items: center; gap: 1rem; }
  .review-title { font-size: 1rem; font-weight: 700; color: #1e293b; }
  .review-subtitle { font-size: 0.78rem; color: #64748b; margin-top: 0.15rem; }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .btn-back:hover { background: #f1f5f9; }

  .btn-confirm {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.25rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 7px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn-confirm:hover:not(:disabled) { background: #7e22ce; }
  .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

  .review-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .guidance-banner {
    display: flex;
    gap: 0.75rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 1rem;
    color: #1e40af;
    font-size: 0.875rem;
  }
  .guidance-banner i { font-size: 1.2rem; flex-shrink: 0; margin-top: 1px; }
  .guidance-banner p { margin: 0.35rem 0 0 0; color: #1d4ed8; line-height: 1.5; }

  .review-section {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title { font-size: 0.875rem; font-weight: 700; color: #1e293b; }
  .section-hint { font-weight: 400; font-size: 0.78rem; color: #94a3b8; }
  .section-hint-block { font-size: 0.78rem; color: #94a3b8; }

  .summary-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    color: #1e293b;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .summary-textarea:focus { border-color: #9333ea; }

  .topic-cards { display: flex; flex-direction: column; gap: 0.5rem; }

  .topic-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: white;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    user-select: none;
    gap: 0.5rem;
  }

  .card-header-left { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
  .topic-code {
    font-size: 0.7rem; font-weight: 700;
    background: #f3e8ff; color: #7e22ce;
    padding: 0.15rem 0.45rem; border-radius: 4px;
    flex-shrink: 0;
  }
  .topic-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .edited-badge {
    font-size: 0.65rem; font-weight: 600; color: #7e22ce;
    background: #f3e8ff; padding: 0.1rem 0.4rem; border-radius: 20px;
    flex-shrink: 0;
  }

  .card-header-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .sentiment-pill {
    font-size: 0.7rem; font-weight: 600;
    padding: 0.2rem 0.55rem; border-radius: 20px;
    border: 1px solid;
    text-transform: capitalize;
  }
  .not-mentioned-hint { font-size: 0.7rem; color: #94a3b8; font-style: italic; }
  .chevron { font-size: 0.75rem; color: #94a3b8; }

  .card-body {
    border-top: 1px solid #f1f5f9;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .field-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .field-col { display: flex; flex-direction: column; gap: 0.35rem; }
  .field-label { font-size: 0.75rem; font-weight: 600; color: #475569; min-width: 140px; flex-shrink: 0; }

  .toggle-group, .btn-group { display: flex; gap: 0; }

  .toggle-btn, .group-btn {
    padding: 0.3rem 0.75rem;
    border: 1px solid #e2e8f0;
    background: white;
    color: #475569;
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    line-height: 1;
  }
  .toggle-btn:first-child, .group-btn:first-child { border-radius: 5px 0 0 5px; }
  .toggle-btn:last-child, .group-btn:last-child { border-radius: 0 5px 5px 0; margin-left: -1px; }
  .group-btn:not(:first-child):not(:last-child) { margin-left: -1px; }
  .toggle-btn.active, .group-btn.active { background: #9333ea; color: white; border-color: #9333ea; z-index: 1; }
  .toggle-btn:hover:not(.active), .group-btn:hover:not(.active) { background: #f8fafc; }

  .field-textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    resize: vertical;
    color: #1e293b;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .field-textarea:focus { border-color: #9333ea; }
  .field-textarea--quote { font-style: italic; color: #475569; }

  .bottom-bar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .btn-confirm-lg {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.85rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-confirm-lg:hover:not(:disabled) { background: #7e22ce; }
  .btn-confirm-lg:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-cancel {
    padding: 0.6rem;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.8rem;
    cursor: pointer;
    font-family: inherit;
    text-align: center;
    transition: color 0.15s;
  }
  .btn-cancel:hover { color: #64748b; }

  .error-banner {
    background: #fef2f2; border: 1px solid #fecaca;
    color: #991b1b; padding: 0.75rem; border-radius: 6px; font-size: 0.875rem;
  }

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
    padding: 3rem;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .error-state button {
    padding: 0.5rem 1rem; background: #9333ea; color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }

  .spinner {
    width: 2.5rem; height: 2.5rem;
    border: 3px solid #f3f4f6; border-top-color: #9333ea;
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  .spinner-sm {
    width: 1rem; height: 1rem;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: white;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
