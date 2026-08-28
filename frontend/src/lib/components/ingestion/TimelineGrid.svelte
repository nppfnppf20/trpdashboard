<script>
  import TimelineSidebar from './TimelineSidebar.svelte';

  export let issues = [];    // [{ id, code, title, entries: [...] }]
  export let documents = []; // [{ id, filename, stage_label, stage_name, is_preset_stage, ... }]

  let selectedCell = null;
  let sidebarOpen = false;

  function openDocSummary(doc) {
    selectedCell = { doc, docOnly: true };
    sidebarOpen = true;
  }

  function openTopicCell(doc, topic, entry) {
    selectedCell = { doc, topic, topicEntry: entry };
    sidebarOpen = true;
  }

  function closeSidebar() {
    sidebarOpen = false;
    selectedCell = null;
  }

  const SENTIMENT_STYLES = {
    positive:      { bg: '#f0fdf4', color: '#166534', border: '#86efac', label: 'Positive' },
    neutral:       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Neutral' },
    negative:      { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', label: 'Negative' },
    not_mentioned: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', label: '—' }
  };

  function sentStyle(entry) {
    if (!entry || !entry.mentioned) return SENTIMENT_STYLES.not_mentioned;
    return SENTIMENT_STYLES[entry.sentiment] ?? SENTIMENT_STYLES.not_mentioned;
  }

  // Build a lookup from document_id to each issue's entry
  function getEntry(issue, doc) {
    return issue.entries.find(e => e.document_id === doc.id) ?? null;
  }

  $: stageLabel = (doc) => doc.stage_name || doc.stage_label || 'Upload';
  $: docDate = (doc) => new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
</script>

<div class="timeline-wrapper">
  {#if documents.length === 0}
    <div class="empty-state">
      <i class="las la-chart-bar"></i>
      <p>No confirmed documents yet. Upload and confirm a document to see the timeline.</p>
    </div>
  {:else if issues.length === 0}
    <div class="empty-state">
      <i class="las la-tags"></i>
      <p>No topics defined. Add topics to see them tracked across documents.</p>
    </div>
  {:else}
    <div class="timeline-scroll">
      <table class="timeline-table">
        <thead>
          <!-- Row 1: stage labels -->
          <tr>
            <th class="sticky-col corner-cell">Topic</th>
            {#each documents as doc (doc.id)}
              <th class="stage-header">
                <div class="stage-header-inner">
                  <div class="stage-name">
                    {stageLabel(doc)}
                    {#if doc.is_preset_stage}
                      <i class="las la-bookmark preset-icon" title="Stage document"></i>
                    {/if}
                  </div>
                  <div class="stage-date">{docDate(doc)}</div>
                </div>
              </th>
            {/each}
          </tr>
          <!-- Row 2: doc summary pills -->
          <tr class="summary-row">
            <th class="sticky-col summary-label-cell">Stage Summary</th>
            {#each documents as doc (doc.id)}
              <td class="summary-cell" on:click={() => openDocSummary(doc)} role="button" tabindex="0"
                on:keydown={e => e.key === 'Enter' && openDocSummary(doc)}>
                {#if doc.summary}
                  <span class="summary-snippet">{doc.summary.slice(0, 80)}{doc.summary.length > 80 ? '…' : ''}</span>
                {:else}
                  <span class="no-summary">—</span>
                {/if}
              </td>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each issues as issue (issue.id)}
            <tr>
              <td class="sticky-col issue-label-cell">
                <span class="issue-code">{issue.code}</span>
                <span class="issue-title">{issue.title}</span>
              </td>
              {#each documents as doc (doc.id)}
                {@const entry = getEntry(issue, doc)}
                {@const style = sentStyle(entry)}
                <td
                  class="data-cell"
                  class:clickable={!!entry}
                  on:click={() => entry && openTopicCell(doc, issue, entry)}
                  on:keydown={e => e.key === 'Enter' && entry && openTopicCell(doc, issue, entry)}
                  role={entry ? 'button' : 'cell'}
                  tabindex={entry ? 0 : -1}
                >
                  {#if entry?.mentioned}
                    <span
                      class="sentiment-pill"
                      style="background:{style.bg}; color:{style.color}; border-color:{style.border}"
                    >
                      {style.label}
                    </span>
                  {:else}
                    <span class="not-mentioned-cell"></span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<TimelineSidebar
  open={sidebarOpen}
  selectedCell={selectedCell}
  onClose={closeSidebar}
/>

<style>
  .timeline-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .timeline-scroll {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }

  .timeline-table {
    border-collapse: collapse;
    min-width: 100%;
    white-space: nowrap;
  }

  /* Freeze left column */
  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 2;
    background: white;
    min-width: 180px;
    max-width: 220px;
  }

  .corner-cell {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-slate-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.6rem 0.875rem;
    border-bottom: 2px solid var(--color-slate-200);
    border-right: 1px solid var(--color-slate-200);
  }

  .stage-header {
    padding: 0;
    border-bottom: 2px solid var(--color-slate-200);
    border-right: 1px solid var(--color-slate-100);
    min-width: 160px;
    vertical-align: bottom;
  }

  .stage-header-inner {
    padding: 0.6rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .stage-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .preset-icon { font-size: 0.7rem; color: var(--color-purple-600); }
  .stage-date { font-size: 0.7rem; color: var(--color-slate-400); }

  .summary-row { background: var(--color-purple-50); }

  .summary-label-cell {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-purple-700);
    padding: 0.5rem 0.875rem;
    border-right: 1px solid var(--color-slate-200);
    border-bottom: 1px solid var(--color-slate-200);
  }

  .summary-cell {
    padding: 0.5rem 0.875rem;
    border-right: 1px solid var(--color-slate-100);
    border-bottom: 1px solid var(--color-slate-200);
    cursor: pointer;
    max-width: 200px;
    transition: background 0.1s;
    vertical-align: top;
  }
  .summary-cell:hover { background: var(--color-violet-100); }

  .summary-snippet {
    font-size: 0.75rem;
    color: var(--color-slate-600);
    white-space: normal;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .no-summary { font-size: 0.75rem; color: var(--color-slate-300); }

  .issue-label-cell {
    padding: 0.6rem 0.875rem;
    border-right: 1px solid var(--color-slate-200);
    border-bottom: 1px solid var(--color-slate-100);
    vertical-align: middle;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: normal;
  }

  .issue-code {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--color-violet-100);
    color: var(--color-purple-700);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .issue-title {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-700);
    white-space: normal;
    line-height: 1.3;
  }

  .data-cell {
    padding: 0.5rem 0.875rem;
    border-right: 1px solid var(--color-slate-100);
    border-bottom: 1px solid var(--color-slate-100);
    text-align: center;
    vertical-align: middle;
    min-width: 130px;
  }
  .data-cell.clickable { cursor: pointer; transition: background 0.1s; }
  .data-cell.clickable:hover { background: var(--color-slate-50); }

  .sentiment-pill {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.25rem 0.65rem;
    border-radius: 20px;
    border: 1px solid;
    display: inline-block;
  }

  .not-mentioned-cell {
    display: block;
    width: 24px;
    height: 24px;
    border: 1.5px dashed var(--color-slate-200);
    border-radius: 50%;
    margin: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--color-slate-400);
    text-align: center;
    flex: 1;
  }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; max-width: 300px; }
</style>
