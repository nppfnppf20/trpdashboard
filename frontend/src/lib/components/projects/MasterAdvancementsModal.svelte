<script>
  // Read-focused "all advancements across every row" view for a tracker table.
  // Sits alongside the per-row timeline drawer (ConditionsTrackerTab,
  // ConsultationTrackerTab, ProgressTrackerTab each keep their own drawer) —
  // this just flattens every row's advancement history into one
  // newest-first list, tagged with which row each entry came from. Clicking
  // a row title jumps to that row's own timeline drawer for editing.
  //
  // `items` must already be normalized and sorted newest-first:
  //   { id, date, summary, fullText, sourceType, meetingNoteTitle, kindBadge, rowId, rowTitle, rowSubtitle }
  // kindBadge (optional): { icon, label } for entries merged in from a linked
  // quote's own log (survey update / key date / instruction status change) —
  // these aren't directly editable here, so no source badge is shown for them.

  import AdvancementSourceBadge from './AdvancementSourceBadge.svelte';

  export let show = false;
  export let title = 'All Advancements';
  export let items = [];
  export let onClose = () => {};
  export let onJumpToRow = null; // (rowId) => void

  let expandedId = null;

  function close() {
    show = false;
    onClose();
  }

  function jumpTo(rowId) {
    if (!onJumpToRow) return;
    close();
    onJumpToRow(rowId);
  }

  function toggleExpand(id) {
    expandedId = expandedId === id ? null : id;
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Bucket by date rather than repeating it on every row. Buckets are then
  // ordered newest-first — items within a bucket keep whatever order they
  // arrived in (already newest-first from the caller's sort).
  function groupByDate(list) {
    const map = new Map();
    for (const item of list) {
      const key = item.date || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()]
      .map(([date, groupItems]) => ({ date, items: groupItems }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  $: groups = groupByDate(items);
</script>

{#if show}
  <div class="mam-backdrop" on:click|self={close} role="presentation">
    <div class="mam-modal">
      <div class="mam-header">
        <div class="mam-header-text">
          <h3>{title}</h3>
          <p class="mam-count">{items.length} entr{items.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button class="mam-close-btn" on:click={close}>&times;</button>
      </div>

      <div class="mam-body">
        {#if !items.length}
          <p class="mam-empty">No advancements recorded yet.</p>
        {:else}
          <div class="mam-groups">
            {#each groups as group (group.date)}
              <div class="mam-group">
                <div class="mam-group-header">{formatDate(group.date)}</div>
                <div class="mam-list">
                  {#each group.items as item (item.id)}
                    <div class="mam-row">
                      <div class="mam-row-head">
                        {#if item.sourceType}
                          <AdvancementSourceBadge sourceType={item.sourceType} meetingNoteTitle={item.meetingNoteTitle} />
                        {:else if item.kindBadge}
                          <span class="mam-kind-badge" title={item.kindBadge.title || ''}>
                            {#if item.kindBadge.icon}<i class="las {item.kindBadge.icon}"></i>{/if}
                            {item.kindBadge.label}
                          </span>
                        {/if}
                        {#if item.rowTitle}
                          <button
                            class="mam-row-title"
                            class:mam-row-title-static={!onJumpToRow}
                            on:click={() => jumpTo(item.rowId)}
                            disabled={!onJumpToRow}
                            title={onJumpToRow ? 'Open this row\'s full timeline' : ''}
                          >{item.rowTitle}</button>
                        {/if}
                        {#if item.rowSubtitle}<span class="mam-row-subtitle">{item.rowSubtitle}</span>{/if}
                      </div>
                      <p class="mam-row-summary">{item.summary}</p>
                      {#if item.fullText}
                        <button class="mam-expand-btn" on:click={() => toggleExpand(item.id)}>
                          {expandedId === item.id ? 'Hide detail' : 'Show detail'}
                        </button>
                        {#if expandedId === item.id}
                          <pre class="mam-fulltext">{item.fullText}</pre>
                        {/if}
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .mam-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .mam-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 95%;
    max-width: 720px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
    overflow: hidden;
  }
  .mam-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .mam-header-text h3 { margin: 0; font-size: 1.02rem; font-weight: 700; color: var(--color-slate-900); }
  .mam-count { margin: 0.15rem 0 0; font-size: 0.78rem; color: var(--color-slate-500); }
  .mam-close-btn {
    background: none; border: none; font-size: 1.6rem; color: var(--color-slate-500);
    cursor: pointer; line-height: 1; padding: 0; width: 2rem; height: 2rem; flex-shrink: 0;
  }
  .mam-close-btn:hover { color: var(--color-slate-800); }

  .mam-body { flex: 1; overflow-y: auto; padding: 1.1rem 1.4rem; }

  .mam-groups { display: flex; flex-direction: column; gap: 1rem; }
  .mam-group-header {
    font-size: 0.72rem; font-weight: 700; color: var(--color-slate-500); text-transform: uppercase;
    letter-spacing: 0.03em; margin-bottom: 0.35rem;
  }

  .mam-list { display: flex; flex-direction: column; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); overflow: hidden; }
  .mam-row { padding: 0.7rem 0.9rem; border-bottom: 1px solid var(--color-slate-100); }
  .mam-row:last-child { border-bottom: none; }
  .mam-row-head { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; }

  .mam-row-title {
    background: var(--color-primary-50); color: var(--color-primary-600); border: none;
    border-radius: 999px; padding: 1px 9px; font-size: 0.72rem; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }
  .mam-row-title:hover:not(:disabled) { background: var(--color-primary-100); }
  .mam-row-title-static { cursor: default; }
  .mam-row-title:disabled { cursor: default; }

  .mam-row-subtitle { font-size: 0.72rem; color: var(--color-slate-400); }

  .mam-kind-badge {
    display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.68rem; font-weight: 700;
    color: var(--color-slate-600); background: var(--color-slate-100); border-radius: 999px; padding: 1px 8px;
  }

  .mam-row-summary { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.45; }

  .mam-expand-btn {
    margin-top: 0.3rem; background: none; border: none; padding: 0; font-size: 0.72rem;
    font-weight: 600; color: var(--color-primary-600); cursor: pointer; font-family: inherit;
  }
  .mam-expand-btn:hover { text-decoration: underline; }

  .mam-fulltext {
    margin: 0.4rem 0 0; padding: 0.6rem 0.75rem; background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.78rem;
    color: var(--color-slate-600); white-space: pre-wrap; font-family: inherit; line-height: 1.5;
  }

  .mam-empty { margin: 0; padding: 1.5rem; text-align: center; font-size: 0.85rem; color: var(--color-slate-400); }
</style>
