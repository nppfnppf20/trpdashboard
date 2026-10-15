<script>
  // "Linked with" popup: everything attached to a gate question or to a risk / action / issue, grouped by type.
  // Groups fold away, a + beside each heading adds a new linked row, statuses can be changed here, and an action's
  // progress log opens in place.
  import { LK, LINK_ORDER, STATUSES, SOURCES, linksOf, addTypesFor, sortedLog, fmtShort, today, isOpen } from './workbookUtils.js';

  export let gate = [];
  export let items = [];
  export let refs = {};
  export let kind = 'gate';       // 'gate' | 'item'
  export let id = null;
  export let focus = '';          // group to scroll to when opened from a chip
  export let onClose = () => {};
  export let onAddLinked = async () => {};   // (kind, id, type, { subject, owner })
  export let onStatus = () => {};            // (itemId, status)
  export let onAddProgress = async () => {}; // (itemId, { date, source, text })

  let collapsed = new Set();
  let openLogs = new Set();
  let adding = null;
  let newSubject = '';
  let newOwner = '';
  let draftDate = today();
  let draftSource = 'Note';
  let busy = false;
  let body;

  $: owner = kind === 'gate' ? gate.find(g => g.id === id) : items.find(i => i.id === id);
  $: name = !owner ? '' : kind === 'gate' ? `Gate ${owner.ref}` : `${refs[owner.id] || ''} ${owner.subject}`.trim();
  $: links = linksOf(gate, items, kind, id);
  $: addTypes = addTypesFor(items, kind, id);
  $: groups = LINK_ORDER.filter(t => links[t].length || addTypes.includes(t)).map(t => ({ type: t, rows: links[t], canAdd: addTypes.includes(t) }));

  $: if (focus && body) {
    const el = body.querySelector(`[data-group="${focus}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function toggleGroup(t) {
    const next = new Set(collapsed);
    next.has(t) ? next.delete(t) : next.add(t);
    collapsed = next;
  }
  function toggleLog(itemId) {
    const next = new Set(openLogs);
    next.has(itemId) ? next.delete(itemId) : next.add(itemId);
    openLogs = next;
  }
  function startAdding(t) {
    const next = new Set(collapsed);
    next.delete(t);
    collapsed = next;
    adding = t;
    newSubject = '';
  }
  async function submitAdd(e, t) {
    e.preventDefault();
    if (!newSubject.trim() || busy) return;
    busy = true;
    try {
      await onAddLinked(kind, id, t, { subject: newSubject.trim(), owner: newOwner.trim() });
      newSubject = '';
    } finally {
      busy = false;
    }
  }
  async function submitProgress(e, itemId) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = form.elements.text.value.trim();
    if (!text || busy) return;
    busy = true;
    try {
      await onAddProgress(itemId, { date: draftDate || today(), source: draftSource, text });
      form.reset();
    } finally {
      busy = false;
    }
  }
  function statusClass(s) {
    return s === 'completed' ? 'badge-select-completed' : s === 'in progress' ? 'badge-select-client-review' : 'badge-select-pending';
  }
  const scoreClass = n => (n <= 1 ? 'pill-danger' : n <= 3 ? 'pill-warning' : 'pill-success');
  const heading = t => LK[t][1][0].toUpperCase() + LK[t][1].slice(1);
  function onKey(e) { if (e.key === 'Escape') onClose(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wl-backdrop" on:click|self={onClose} role="presentation">
  <div class="wl-modal" role="dialog" aria-modal="true" aria-label="Linked with {name}">
    <div class="wl-head">
      <div>
        <div class="wl-eyebrow">Linked with</div>
        <h2>{name}</h2>
      </div>
      <button class="btn btn-secondary btn-sm" on:click={onClose}>Close</button>
    </div>

    <div class="wl-body" bind:this={body}>
      {#each groups as g (g.type)}
        <section class="wl-group" data-group={g.type}>
          <div class="wl-gh">
            <button class="wl-tog" type="button" aria-expanded={!collapsed.has(g.type)} on:click={() => toggleGroup(g.type)}>
              <i class="las {collapsed.has(g.type) ? 'la-angle-right' : 'la-angle-down'} wl-chev"></i>
              {heading(g.type)} ({g.rows.length})
            </button>
            {#if g.canAdd && adding !== g.type}
              <button class="wl-plus" type="button" aria-label="Add {g.type}" title="Add {g.type}" on:click={() => startAdding(g.type)}>+</button>
            {/if}
          </div>

          {#if !collapsed.has(g.type)}
            {#if adding === g.type}
              <form class="wl-addrow" on:submit={e => submitAdd(e, g.type)}>
                <!-- svelte-ignore a11y-autofocus -->
                <input class="form-input" bind:value={newSubject} placeholder="New {g.type}: what is it?" aria-label="Subject" autocomplete="off" autofocus>
                <input class="form-input" bind:value={newOwner} list="wb-owners" placeholder="Owner" aria-label="Owner" autocomplete="off">
                <button class="btn btn-primary btn-sm" type="submit" disabled={busy || !newSubject.trim()}>Add</button>
                <button class="btn btn-secondary btn-sm" type="button" on:click={() => (adding = null)}>Cancel</button>
              </form>
            {/if}

            {#each g.rows as x (x.id)}
              {#if g.type === 'gate'}
                <div class="wl-row">
                  <span class="wl-ref">{x.ref}</span>
                  <div class="wl-main">{x.question}</div>
                  <span class="wl-side">{x.owner || ''}</span>
                  <span class="wl-pill {scoreClass(x.score)}">{x.score} / 5</span>
                </div>
              {:else}
                {@const log = g.type === 'action' ? sortedLog(x) : []}
                <div class="wl-row" class:wl-done={!isOpen(x) && x.type !== 'decision'}>
                  <span class="wl-ref">{refs[x.id] || ''}</span>
                  <div class="wl-main">
                    <b>{x.subject}</b>
                    {#if x.text && x.text !== x.subject}<small>{x.text}</small>{/if}
                    {#if x.type !== 'action' && x.update}<small>↳ {x.update.split('\n')[0]}</small>{/if}
                    {#if x.type === 'action'}
                      {#if log.length}
                        <ul class="wl-log">
                          {#each (openLogs.has(x.id) ? log : log.slice(0, 3)) as e (e.id)}
                            <li><b>{fmtShort(e.date)}</b>{#if openLogs.has(x.id)} <span class="wl-src">{e.source}</span>{/if} {e.text}</li>
                          {/each}
                        </ul>
                      {:else}
                        <small>No progress logged yet.</small>
                      {/if}
                      <button class="wl-link" type="button" on:click={() => toggleLog(x.id)}>
                        {openLogs.has(x.id) ? 'Hide progress log' : log.length ? `Open progress log (${log.length})` : '+ Add progress'}
                      </button>
                      {#if openLogs.has(x.id)}
                        <form class="wl-logform" on:submit={e => submitProgress(e, x.id)}>
                          <div class="wl-two">
                            <input class="form-input" type="date" bind:value={draftDate} aria-label="Date">
                            <select class="form-input" bind:value={draftSource} aria-label="Source">
                              {#each SOURCES as s (s)}<option value={s}>{s}</option>{/each}
                            </select>
                          </div>
                          <textarea class="form-input" name="text" rows="2" placeholder="What has happened on this?" aria-label="Progress entry"></textarea>
                          <div><button class="btn btn-primary btn-sm" type="submit" disabled={busy}>Add entry</button></div>
                        </form>
                      {/if}
                    {/if}
                  </div>
                  <span class="wl-side">
                    {x.owner || ''}
                    {#if x.type === 'decision'}{#if x.raised}<small>{fmtShort(x.raised)}</small>{/if}
                    {:else if x.target}<small class:wl-late={isOpen(x) && x.target < today()}>{fmtShort(x.target)}</small>{/if}
                  </span>
                  {#if x.type === 'decision'}
                    <span></span>
                  {:else}
                    <select class="badge-select {statusClass(x.status)}" on:change={e => onStatus(x.id, e.target.value)} aria-label="Status">
                      {#each STATUSES as s (s)}<option value={s} selected={s === x.status}>{s}</option>{/each}
                    </select>
                  {/if}
                </div>
              {/if}
            {/each}
          {/if}
        </section>
      {:else}
        <div class="wl-empty">Nothing is linked yet.</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .wl-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
  .wl-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(66rem, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wl-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--color-slate-200); }
  .wl-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wl-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wl-body { padding: 1rem 1.75rem 1.75rem; overflow: auto; display: flex; flex-direction: column; gap: 1rem; }
  .wl-empty { padding: 1rem; text-align: center; color: var(--color-slate-500); }

  .wl-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .wl-gh { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.25rem; }
  .wl-tog { display: flex; align-items: center; gap: 0.375rem; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-slate-500); }
  .wl-tog:hover { color: var(--color-slate-800); }
  .wl-chev { font-size: 0.8125rem; }
  .wl-plus { width: 1.375rem; height: 1.375rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--color-slate-200); border-radius: 50%; background: var(--color-white); color: var(--color-slate-500); font-size: 0.875rem; line-height: 1; cursor: pointer; }
  .wl-plus:hover { border-color: var(--color-primary-500); color: var(--color-primary-600); }

  .wl-addrow { display: grid; grid-template-columns: minmax(0, 1fr) 10rem auto auto; gap: 0.5rem; }
  .wl-row { display: grid; grid-template-columns: 7rem minmax(0, 1fr) 9rem 8.5rem; gap: 0.375rem 1rem; align-items: start; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.75rem 1rem; font-size: 0.875rem; line-height: 1.45; }
  .wl-done { opacity: 0.6; }
  .wl-ref { font-family: 'Courier New', monospace; font-size: 0.8125rem; font-weight: 600; color: var(--color-primary-600); word-break: break-word; }
  .wl-main { min-width: 0; color: var(--color-slate-700); }
  .wl-main b { color: var(--color-slate-800); }
  small { display: block; color: var(--color-slate-500); font-size: 0.78rem; margin-top: 0.125rem; }
  .wl-late { color: var(--color-red-600); font-weight: 600; }
  .wl-side { font-size: 0.8125rem; color: var(--color-slate-600); }
  .wl-pill { padding: 0.15rem 0.6rem; border-radius: var(--radius-pill); font-size: 0.71875rem; font-weight: 600; white-space: nowrap; }
  .pill-danger { background: var(--color-badge-danger-bg); color: var(--color-badge-danger-fg); }
  .pill-warning { background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); }
  .pill-success { background: var(--color-badge-success-bg); color: var(--color-badge-success-fg); }

  .wl-log { margin: 0.375rem 0 0.25rem; padding-left: 1.1rem; font-size: 0.78rem; color: var(--color-slate-600); line-height: 1.4; }
  .wl-log li { margin: 0.2rem 0; }
  .wl-log b { color: var(--color-primary-600); font-weight: 600; }
  .wl-src { display: inline-block; padding: 0 0.3rem; font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-amber-800); background: var(--color-amber-100); border-radius: 3px; }
  .wl-link { background: none; border: none; padding: 0; margin-top: 0.25rem; cursor: pointer; font-family: inherit; font-size: 0.75rem; font-weight: 600; color: var(--color-primary-600); }
  .wl-link:hover { text-decoration: underline; }
  .wl-logform { display: flex; flex-direction: column; gap: 0.5rem; margin: 0.5rem 0 0.25rem; }
  .wl-logform :global(.form-input) { font-size: 0.8125rem; padding: 0.4rem 0.625rem; }
  .wl-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }

  @media (max-width: 36rem) {
    .wl-row { grid-template-columns: 1fr auto; }
    .wl-main { grid-column: 1 / -1; order: 3; }
    .wl-addrow { grid-template-columns: 1fr 1fr; }
  }
  /* status dropdowns: use the page font, not the browser's form-control font */
  .badge-select { font-family: inherit; font-size: 0.71875rem; font-weight: 600; line-height: 1.4; }
</style>
