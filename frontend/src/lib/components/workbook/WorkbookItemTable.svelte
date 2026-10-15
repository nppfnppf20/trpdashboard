<script>
  // One table for risks, actions, issues or decisions. Edits are reported through onChange so the page owns the data.
  import { fmtShort, isOpen, isOverdue, latestEntry, linkCounts, parentOptions, autosize } from './workbookUtils.js';
  import { STATUSES } from './workbookUtils.js';

  export let type = 'action';
  export let gate = [];
  export let items = [];
  export let refs = {};
  export let owners = [];
  export let onChange = () => {};     // (id, patch)
  export let onOpenLinks = () => {};  // (kind, id, focusType)
  export let onOpenLog = () => {};    // (id)
  export let onAdd = () => {};        // (type)
  export let onDelete = () => {};     // (id)
  export let deleteImpact = () => null;      // (id) => lines to warn about, or null when nothing depends on it
  export let onConfirmDelete = () => {};     // (id) - open the warning

  const LABEL = {
    risk: { text: 'Risk or opportunity', update: 'Update' },
    action: { text: 'Action', update: 'Progress' },
    issue: { text: 'Problem and impact', update: 'Update' },
    decision: { text: 'Decision', update: 'Why' },
  };
  const NOUN = { risk: 'risk', action: 'action', issue: 'issue', decision: 'decision' };

  let ownerFilter = '';
  let armedId = null;

  $: all = items.filter(i => i.type === type).sort((a, b) => a.seq - b.seq);
  $: filtered = ownerFilter ? all.filter(i => (i.owner || '').toLowerCase().includes(ownerFilter.toLowerCase())) : all;
  $: openRows = type === 'decision' ? filtered : filtered.filter(isOpen);
  $: doneRows = type === 'decision' ? [] : filtered.filter(i => !isOpen(i));
  $: rows = [
    ...openRows.map(it => ({ it, done: false })),
    ...(doneRows.length ? [{ divider: true, count: doneRows.length }] : []),
    ...doneRows.map(it => ({ it, done: true })),
  ];
  $: parents = parentOptions(type, items, refs);
  $: hasParent = type === 'action' || type === 'issue';
  $: colCount = 4 + (type !== 'decision' ? 4 : 1) + 1 + 1 + (hasParent ? 1 : 0) + 1;

  function statusClass(s) {
    return s === 'completed' ? 'badge-select-completed' : s === 'in progress' ? 'badge-select-client-review' : 'badge-select-pending';
  }
  const priorityClass = p => (p === 1 ? 'pill-danger' : p === 2 ? 'pill-warning' : 'pill-neutral');

  function text(it, field, e) {
    const v = e.target.value;
    if (v !== (it[field] ?? '')) onChange(it.id, { [field]: v });
  }
  function date(it, field, e) {
    const v = e.target.value || '';
    if (v !== (it[field] ?? '')) onChange(it.id, { [field]: v });
  }
  function refsField(it, e) {
    const next = e.target.value.split(/[\s,;]+/).map(s => s.replace(/^G\d\s*/i, '')).filter(Boolean);
    if (JSON.stringify(next) !== JSON.stringify(it.gate_refs || [])) onChange(it.id, { gate_refs: next });
  }
  function parent(it, e) {
    const v = e.target.value ? parseInt(e.target.value, 10) : null;
    if (v !== (it.parent_id ?? null)) onChange(it.id, { parent_id: v });
  }
  function arm(id) {
    if (deleteImpact(id)) { onConfirmDelete(id); return; }
    if (armedId === id) { armedId = null; onDelete(id); return; }
    armedId = id;
    setTimeout(() => { if (armedId === id) armedId = null; }, 3000);
  }
</script>

<div class="wt-bar">
  <button class="btn btn-primary btn-sm" on:click={() => onAdd(type)}>+ Add {NOUN[type]}</button>
  <label class="wt-filter">Owner
    <select class="form-input wt-owner-select" bind:value={ownerFilter}>
      <option value="">All</option>
      {#each owners as o (o)}<option value={o}>{o}</option>{/each}
    </select>
  </label>
  <span class="wt-grow"></span>
  <span class="wt-count">{filtered.length} shown</span>
</div>

<div class="table-wrapper wt-wrap">
  <table class="wt-table" style="min-width: {type === 'action' ? 1500 : 1400}px">
    <thead>
      <tr>
        <th class="wt-ref-col">Ref</th>
        <th class="wt-w-subject">Subject</th>
        <th class="wt-w-text wt-left">{LABEL[type].text}</th>
        <th class="wt-w-date">{type === 'decision' ? 'Decision date' : 'Raised'}</th>
        {#if type !== 'decision'}<th class="wt-w-date">Target</th>{/if}
        <th class="wt-w-owner">{type === 'decision' ? 'Taken by' : 'Owner'}</th>
        {#if type !== 'decision'}<th class="wt-w-pri">Pri</th><th class="wt-w-status">Status</th>{/if}
        <th class="wt-w-update">{LABEL[type].update}</th>
        <th class="wt-w-gate">Gate ref</th>
        {#if hasParent}<th class="wt-w-parent">{type === 'action' ? 'Under risk' : 'Arising from'}</th>{/if}
        <th class="wt-w-links">Linked with</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.divider ? 'divider' : r.it.id)}
        {#if r.divider}
          <tr class="wt-divider"><td colspan={colCount}>Completed ({r.count})</td></tr>
        {:else}
          {@const it = r.it}
          <tr class:wt-done={r.done}>
            <td class="wt-ref-col">
              <button class="wt-ref" on:click={() => onOpenLinks('item', it.id, '')} title="Open everything linked to {refs[it.id]}">{refs[it.id] || ''}</button>
              <button class="wt-del" class:armed={armedId === it.id} on:click={() => arm(it.id)}>{armedId === it.id ? 'Sure?' : 'Delete'}</button>
            </td>
            <td><textarea class="wt-cell" rows="1" use:autosize={it.subject} value={it.subject} on:change={e => text(it, 'subject', e)} aria-label="Subject"></textarea></td>
            <td><textarea class="wt-cell wt-left" rows="1" use:autosize={it.text} value={it.text} on:change={e => text(it, 'text', e)} aria-label={LABEL[type].text}></textarea></td>
            <td><input class="wt-cell wt-date" type="date" value={it.raised || ''} on:change={e => date(it, 'raised', e)} aria-label="Date"></td>
            {#if type !== 'decision'}
              <td class:wt-late={isOverdue(it)}><input class="wt-cell wt-date" type="date" value={it.target || ''} on:change={e => date(it, 'target', e)} aria-label="Target date"></td>
            {/if}
            <td><input class="wt-cell" list="wb-owners" value={it.owner} on:change={e => text(it, 'owner', e)} aria-label="Owner"></td>
            {#if type !== 'decision'}
              <td>
                <select class="wt-pill {priorityClass(it.priority)}" value={it.priority} on:change={e => onChange(it.id, { priority: parseInt(e.target.value, 10) })} aria-label="Priority">
                  {#each [1, 2, 3] as p (p)}<option value={p} selected={p === it.priority}>{p}</option>{/each}
                </select>
              </td>
              <td class="wt-status-cell">
                <select class="badge-select {statusClass(it.status)}" on:change={e => onChange(it.id, { status: e.target.value })} aria-label="Status">
                  {#each STATUSES as s (s)}<option value={s} selected={s === it.status}>{s}</option>{/each}
                </select>
              </td>
            {/if}
            <td>
              {#if type === 'action'}
                {@const last = latestEntry(it)}
                <button class="wt-prog" on:click={() => onOpenLog(it.id)} title="Open the progress log">
                  {#if last}
                    <span class="wt-prog-date">{fmtShort(last.date)}</span> {last.text}
                    {#if it.log.length > 1}<span class="wt-prog-n">{it.log.length}</span>{/if}
                  {:else}
                    <span class="wt-prog-empty">+ Add progress</span>
                  {/if}
                </button>
              {:else}
                <textarea class="wt-cell" rows="1" use:autosize={it.update} value={it.update} on:change={e => text(it, 'update', e)} aria-label={LABEL[type].update}></textarea>
              {/if}
            </td>
            <td><input class="wt-cell" value={(it.gate_refs || []).join(', ')} placeholder="e.g. 3.8" on:change={e => refsField(it, e)} aria-label="Gate refs"></td>
            {#if hasParent}
              <td>
                <select class="wt-cell wt-select" on:change={e => parent(it, e)} aria-label="Parent">
                  {#each parents as p (p.value)}<option value={p.value} selected={p.value === String(it.parent_id ?? '')}>{p.label}</option>{/each}
                </select>
              </td>
            {/if}
            <td class="wt-linkcell">
              {#each linkCounts(gate, items, 'item', it.id) as c (c.type)}
                <button class="wt-chip" on:click={() => onOpenLinks('item', it.id, c.type)}>{c.label}</button>
              {:else}
                <span class="wt-none">None</span>
              {/each}
            </td>
          </tr>
        {/if}
      {:else}
        <tr><td colspan={colCount} class="wt-empty">Nothing here{ownerFilter ? ' for this owner' : ''}. Add a {NOUN[type]} or use Add advancement with some notes.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

{#if type === 'risk'}
  <p class="wt-hint">Actions sit under a risk and take its reference (G2 3.8.1, then action 3.8.1.1). Issues sit beside actions and can link to either.</p>
{/if}

<style>
  .wt-bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.625rem; }
  .wt-filter { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
  .wt-owner-select { width: auto; padding: 0.3rem 0.6rem; }
  .wt-grow { flex: 1; }
  .wt-count { font-size: 0.75rem; color: var(--color-slate-500); }
  .wt-wrap { background: var(--color-white); }
  .wt-table { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed; font-size: var(--font-size-sm); color: var(--color-slate-700); }
  .wt-table th { text-align: center; padding: 0.6rem 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); background: var(--color-slate-50); border-bottom: 2px solid var(--color-slate-200); position: sticky; top: 0; }
  .wt-table td { padding: 0.25rem 0.375rem; vertical-align: middle; text-align: center; border-bottom: 1px solid var(--color-slate-200); }
  .wt-table tr:hover td { background: var(--color-slate-50); }
  .wt-ref-col { position: sticky; left: 0; width: 6.5rem; background: var(--color-white); border-right: 1px solid var(--color-slate-200); z-index: 1; }
  th.wt-ref-col { background: var(--color-slate-50); z-index: 2; }
  .wt-table tr:hover td.wt-ref-col { background: var(--color-slate-50); }
  .wt-w-subject { width: 10rem; } .wt-w-text { width: 20rem; } .wt-w-date { width: 8.25rem; } .wt-w-owner { width: 6.75rem; }
  .wt-w-pri { width: 4.25rem; } .wt-w-status { width: 8rem; } .wt-w-update { width: 17rem; } .wt-w-gate { width: 5.75rem; }
  .wt-w-parent { width: 11rem; } .wt-w-links { width: 12rem; }

  .wt-ref { display: block; margin-inline: auto; background: none; border: none; padding: 0.375rem 0.125rem 0.125rem; cursor: pointer; font-family: 'Courier New', monospace; font-size: 0.8125rem; font-weight: 600; color: var(--color-primary-600); text-align: center; text-decoration: underline dotted; text-underline-offset: 3px; }
  .wt-ref:hover { text-decoration-style: solid; }
  .wt-del { background: none; border: none; padding: 0.125rem; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; font-family: inherit; }
  .wt-del.armed { color: var(--color-red-600); }

  .wt-cell { text-align: center; text-align-last: center; width: 100%; box-sizing: border-box; border: 1px solid transparent; background: transparent; border-radius: var(--radius-sm); padding: 0.3rem 0.375rem; font-family: inherit; font-size: inherit; color: inherit; resize: none; overflow: hidden; display: block; }
  .wt-cell:hover { border-color: var(--color-slate-200); }
  .wt-cell:focus { outline: none; border-color: var(--color-primary-600); background: var(--color-white); box-shadow: var(--focus-ring-blue); }
  .wt-date { font-size: 0.75rem; padding-inline: 0.2rem; }
  .wt-select { cursor: pointer; }
  .wt-table th.wt-left, .wt-cell.wt-left { text-align: left; text-align-last: auto; }
  .wt-late .wt-date { color: var(--color-red-600); font-weight: 600; }

  .wt-pill { display: block; box-sizing: border-box; width: 2.25rem; margin-inline: auto; border: none; border-radius: var(--radius-pill); padding: 0.2rem 0.25rem; font-family: inherit; font-size: 0.71875rem; font-weight: 600; text-align: center; text-align-last: center; padding-inline: 0; cursor: pointer; appearance: none; -webkit-appearance: none; }
  .pill-danger { background: var(--color-badge-danger-bg); color: var(--color-badge-danger-fg); }
  .pill-warning { background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); }
  .pill-neutral { background: var(--color-slate-100); color: var(--color-slate-600); }

  .wt-prog { display: block; width: 100%; text-align: center; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); padding: 0.3rem 0.375rem; cursor: pointer; font-family: inherit; font-size: inherit; color: inherit; line-height: 1.4; max-height: 5.6em; overflow: hidden; }
  .wt-prog:hover { border-color: var(--color-slate-300); background: var(--color-white); }
  .wt-prog-date { font-weight: 700; font-size: 0.75rem; color: var(--color-primary-600); margin-right: 0.25rem; }
  .wt-prog-n { float: right; margin-left: 0.4rem; padding: 0 0.45rem; font-size: 0.6875rem; font-weight: 600; border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); background: var(--color-slate-100); color: var(--color-slate-600); }
  .wt-prog-empty { color: var(--color-slate-400); font-size: 0.8125rem; }

  .wt-chip { display: inline-block; margin: 0.125rem 0.2rem 0.125rem 0; padding: 0.05rem 0.5rem; font-family: inherit; font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-600); background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); cursor: pointer; white-space: nowrap; }
  .wt-chip:hover { border-color: var(--color-primary-500); color: var(--color-primary-600); }
  .wt-none { font-size: 0.75rem; color: var(--color-slate-400); padding: 0.3rem 0; display: inline-block; }

  .wt-divider td { background: var(--color-slate-50); font-weight: 600; padding: 0.5rem 0.75rem; text-align: left; }
  .wt-done td { opacity: 0.5; }
  .wt-done:hover td { opacity: 0.9; }
  .wt-empty { text-align: center; padding: 1.75rem 1rem; color: var(--color-slate-500); }
  .wt-hint { margin: 0.5rem 0.125rem; font-size: 0.75rem; color: var(--color-slate-500); }
  .wt-status-cell { text-align: center; }
  .wt-table td.wt-linkcell { text-align: left; }
  /* status dropdowns: use the page font, not the browser's form-control font */
  .badge-select { font-family: inherit; font-size: 0.71875rem; font-weight: 600; line-height: 1.4; }
</style>
