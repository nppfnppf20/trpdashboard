<script>
  // Side drawer: an action's progress log. Add, edit and delete entries, change its status, and optionally see the
  // progress logged on the risks and issues linked to it (read-only, tagged with where it came from).
  import { SOURCES, STATUSES, linksOf, sortedLog, fmtLong, today } from './workbookUtils.js';

  export let item = null;
  export let gate = [];
  export let items = [];
  export let refs = {};
  export let onClose = () => {};
  export let onAddProgress = async () => {};      // (itemId, { date, source, text })
  export let onUpdateProgress = async () => {};   // (itemId, entryId, patch)
  export let onDeleteProgress = async () => {};   // (itemId, entryId)
  export let onStatus = () => {};                 // (itemId, status)
  export let onOpenLog = () => {};                // (itemId)

  let includeLinked = true;
  let draftDate = today();
  let draftSource = 'Note';
  let draftText = '';
  let editingId = null;
  let editDate = '';
  let editSource = 'Note';
  let editText = '';
  let armedId = null;
  let busy = false;

  $: own = item ? sortedLog(item).map(e => ({ ...e, own: true })) : [];
  $: linkedItems = item ? (() => {
    const l = linksOf(gate, items, 'item', item.id);
    const seen = new Set([item.id]);
    return ['risk', 'action', 'issue'].flatMap(t => l[t]).filter(x => !seen.has(x.id) && seen.add(x.id));
  })() : [];
  $: linkedEntries = linkedItems.flatMap(x => (x.log || []).map(e => ({ ...e, from: x })));
  $: all = [...own, ...(includeLinked ? linkedEntries : [])]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);

  async function add(e) {
    e.preventDefault();
    if (!draftText.trim() || busy) return;
    busy = true;
    try {
      await onAddProgress(item.id, { date: draftDate || today(), source: draftSource, text: draftText.trim() });
      draftText = '';
    } finally {
      busy = false;
    }
  }
  function edit(entry) {
    editingId = entry.id;
    editDate = entry.date;
    editSource = entry.source;
    editText = entry.text;
  }
  async function saveEdit() {
    if (!editText.trim()) return;
    await onUpdateProgress(item.id, editingId, { date: editDate, source: editSource, text: editText.trim() });
    editingId = null;
  }
  function arm(entryId) {
    if (armedId === entryId) { armedId = null; onDeleteProgress(item.id, entryId); return; }
    armedId = entryId;
    setTimeout(() => { if (armedId === entryId) armedId = null; }, 3000);
  }
  function statusClass(s) {
    return s === 'completed' ? 'badge-select-completed' : s === 'in progress' ? 'badge-select-client-review' : 'badge-select-pending';
  }
  function onKey(e) { if (e.key === 'Escape') onClose(); }
</script>

<svelte:window on:keydown={onKey} />

{#if item}
  <div class="pd-backdrop" on:click|self={onClose} role="presentation">
    <aside class="pd-drawer" aria-label="Progress log">
      <div class="pd-head">
        <div>
          <div class="pd-eyebrow">Progress log · {refs[item.id] || ''}</div>
          <h2>{item.subject}</h2>
        </div>
        <button class="btn btn-secondary btn-sm" on:click={onClose}>Close</button>
      </div>

      <div class="pd-body">
        <label class="pd-field">
          <span class="form-label">Status</span>
          <select class="badge-select {statusClass(item.status)}" on:change={e => onStatus(item.id, e.target.value)}>
            {#each STATUSES as s (s)}<option value={s} selected={s === item.status}>{s}</option>{/each}
          </select>
        </label>

        <form class="pd-form" on:submit={add}>
          <span class="form-label">Add progress</span>
          <div class="pd-two">
            <input class="form-input" type="date" bind:value={draftDate} aria-label="Date">
            <select class="form-input" bind:value={draftSource} aria-label="Source">
              {#each SOURCES as s (s)}<option value={s}>{s}</option>{/each}
            </select>
          </div>
          <textarea class="form-input" rows="3" bind:value={draftText} placeholder="What has happened on this since the last entry?"></textarea>
          <div><button class="btn btn-primary btn-sm" type="submit" disabled={busy || !draftText.trim()}>Add entry</button></div>
        </form>

        {#if linkedEntries.length}
          <label class="pd-check"><input type="checkbox" bind:checked={includeLinked}> Include progress from linked items ({linkedEntries.length})</label>
        {/if}

        <div class="pd-list">
          {#each all as e (`${e.own ? 'o' : 'l'}${e.id}`)}
            {#if !e.own}
              <div class="pd-entry pd-linked">
                <div class="pd-eh">
                  <span class="pd-date">{fmtLong(e.date)}</span>
                  <span class="pd-src">{e.source}</span>
                  {#if e.from.type === 'action'}
                    <button class="pd-from" on:click={() => onOpenLog(e.from.id)} title="Open this action's progress log">from {refs[e.from.id]} · {e.from.subject}</button>
                  {:else}
                    <span class="pd-from-plain">from {refs[e.from.id]} · {e.from.subject}</span>
                  {/if}
                </div>
                <p>{e.text}</p>
              </div>
            {:else if editingId === e.id}
              <div class="pd-entry">
                <div class="pd-two">
                  <input class="form-input" type="date" bind:value={editDate} aria-label="Date">
                  <select class="form-input" bind:value={editSource} aria-label="Source">
                    {#each SOURCES.includes(editSource) ? SOURCES : [...SOURCES, editSource] as s (s)}<option value={s}>{s}</option>{/each}
                  </select>
                </div>
                <textarea class="form-input" rows="3" bind:value={editText}></textarea>
                <div class="pd-eh">
                  <button class="btn btn-primary btn-sm" on:click={saveEdit}>Save</button>
                  <button class="btn btn-secondary btn-sm" on:click={() => (editingId = null)}>Cancel</button>
                </div>
              </div>
            {:else}
              <div class="pd-entry">
                <div class="pd-eh">
                  <span class="pd-date">{fmtLong(e.date)}</span>
                  <span class="pd-src">{e.source}</span>
                  <span class="pd-grow"></span>
                  <button class="pd-small" on:click={() => edit(e)}>Edit</button>
                  <button class="pd-small" class:armed={armedId === e.id} on:click={() => arm(e.id)}>{armedId === e.id ? 'Sure?' : 'Delete'}</button>
                </div>
                <p>{e.text}</p>
              </div>
            {/if}
          {:else}
            <div class="pd-empty">No progress logged yet.</div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
{/if}

<style>
  .pd-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); z-index: 1900; display: flex; justify-content: flex-end; }
  .pd-drawer { width: min(34rem, 100%); height: 100%; background: var(--color-white); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
  .pd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .pd-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .pd-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .pd-body { padding: 1rem 1.25rem 1.5rem; overflow: auto; display: flex; flex-direction: column; gap: 0.875rem; }
  .pd-field { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start; }
  .pd-form { display: flex; flex-direction: column; gap: 0.375rem; }
  .pd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
  .pd-check { display: flex; gap: 0.5rem; align-items: center; font-size: 0.8125rem; color: var(--color-slate-600); }
  .pd-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .pd-entry { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.375rem; }
  .pd-linked { background: var(--color-slate-50); }
  .pd-entry p { margin: 0; white-space: pre-wrap; font-size: 0.8125rem; color: var(--color-slate-700); }
  .pd-eh { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .pd-grow { flex: 1; }
  .pd-date { font-family: 'Courier New', monospace; font-size: 0.78rem; font-weight: 600; color: var(--color-primary-600); }
  .pd-src { padding: 0 0.35rem; font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-amber-800); background: var(--color-amber-100); border-radius: 3px; }
  .pd-small { background: none; border: none; padding: 0.125rem; font-family: inherit; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; }
  .pd-small.armed { color: var(--color-red-600); }
  .pd-from { background: none; border: none; padding: 0; font-family: inherit; font-size: 0.75rem; font-weight: 600; color: var(--color-primary-600); cursor: pointer; text-align: left; }
  .pd-from:hover { text-decoration: underline; }
  .pd-from-plain { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
  .pd-empty { padding: 0.75rem; text-align: center; color: var(--color-slate-500); }
  /* status dropdowns: use the page font, not the browser's form-control font */
  .badge-select { font-family: inherit; font-size: 0.71875rem; font-weight: 600; line-height: 1.4; }
</style>
