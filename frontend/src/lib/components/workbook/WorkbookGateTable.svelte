<script>
  // Stage gate questions: score, owner and comments, with a Linked with column that opens the popup.
  import { linkCounts, autosize } from './workbookUtils.js';

  export let gate = [];
  export let items = [];
  export let onChange = () => {};     // (id, patch)
  export let onOpenLinks = () => {};  // (kind, id, focusType)
  export let onAdd = () => {};
  export let onDelete = () => {};     // (id)
  export let deleteImpact = () => null;      // (id) => lines to warn about, or null
  export let onConfirmDelete = () => {};     // (id) - open the warning

  let armedId = null;
  function arm(id) {
    if (deleteImpact(id)) { onConfirmDelete(id); return; }
    if (armedId === id) { armedId = null; onDelete(id); return; }
    armedId = id;
    setTimeout(() => { if (armedId === id) armedId = null; }, 3000);
  }

  // Group questions by section, keeping their order.
  $: sections = gate
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .reduce((acc, g) => {
      let s = acc.find(x => x.section === g.section);
      if (!s) { s = { section: g.section, title: g.section_title, rows: [] }; acc.push(s); }
      s.rows.push(g);
      return acc;
    }, []);

  const avg = rows => (rows.length ? rows.reduce((n, g) => n + g.score, 0) / rows.length : 0);
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const scoreClass = n => (n <= 1 ? 'pill-danger' : n <= 3 ? 'pill-warning' : 'pill-success');

  function text(g, field, e) {
    const v = e.target.value;
    if (v !== (g[field] ?? '')) onChange(g.id, { [field]: v });
  }
</script>

<div class="wg-bar">
  <button class="btn btn-primary btn-sm" on:click={onAdd}>+ Add gate question</button>
</div>

{#if !gate.length}
  <div class="wg-empty">No gate questions yet for this project. Add the first one above.</div>
{:else}
  <div class="table-wrapper wg-wrap">
    <table class="wg-table">
      <thead>
        <tr>
          <th class="wg-ref-col">Ref</th>
          <th class="wg-left">Gate question</th>
          <th class="wg-w-owner">Responsible</th>
          <th class="wg-w-score">1 to 5</th>
          <th class="wg-w-comment wg-left">Comments / evidence</th>
          <th class="wg-w-links">Linked with</th>
          <th class="wg-w-del">Delete</th>
        </tr>
      </thead>
      <tbody>
        {#each sections as s (s.section)}
          <tr class="wg-section"><td colspan="7">{s.section}. {s.title}<span class="wg-avg">avg {f1(avg(s.rows))}</span></td></tr>
          {#each s.rows as g (g.id)}
            <tr>
              <!-- the whole cell is the click target; the button inside keeps it reachable from the keyboard -->
              <!-- svelte-ignore a11y-click-events-have-key-events, a11y-no-noninteractive-element-interactions -->
              <td class="wg-ref-col wg-ref-click" on:click={() => onOpenLinks('gate', g.id, '')} title="Open everything linked to {g.ref}">
                <button class="wg-ref" type="button">{g.ref}</button>
              </td>
              <td class="wg-q">{g.question}</td>
              <td><input class="wg-cell" list="wb-owners" value={g.owner} on:change={e => text(g, 'owner', e)} aria-label="Responsible for {g.ref}"></td>
              <td>
                <select class="wg-pill {scoreClass(g.score)}" on:change={e => onChange(g.id, { score: parseInt(e.target.value, 10) })} aria-label="Score for {g.ref}">
                  {#each [0, 1, 2, 3, 4, 5] as n (n)}<option value={n} selected={n === g.score}>{n}</option>{/each}
                </select>
              </td>
              <td><textarea class="wg-cell wg-left" rows="1" use:autosize={g.comment} value={g.comment} on:change={e => text(g, 'comment', e)} aria-label="Comments for {g.ref}"></textarea></td>
              <td class="wg-linkcell">
                {#each linkCounts(gate, items, 'gate', g.id) as c (c.type)}
                  <button class="wg-chip" on:click={() => onOpenLinks('gate', g.id, c.type)}>{c.label}</button>
                {:else}
                  <span class="wg-none">None</span>
                {/each}
              </td>
              <td class="wg-del-cell"><button class="wg-del" class:armed={armedId === g.id} on:click={() => arm(g.id)}>{armedId === g.id ? 'Sure?' : 'Delete'}</button></td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
  <p class="wg-hint">A score of 4 or 5 means the question is answered well enough to progress. Click a reference or a Linked with chip to see what is attached.</p>
{/if}

<style>
  .wg-bar { display: flex; align-items: center; margin-bottom: 0.625rem; }
  .wg-empty { padding: 2rem; text-align: center; color: var(--color-slate-500); }
  .wg-wrap { background: var(--color-white); }
  .wg-table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1080px; table-layout: fixed; font-size: var(--font-size-sm); color: var(--color-slate-700); }
  .wg-table th { text-align: center; padding: 0.6rem 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); background: var(--color-slate-50); border-bottom: 2px solid var(--color-slate-200); }
  .wg-table td { padding: 0.25rem 0.375rem; vertical-align: middle; text-align: center; border-bottom: 1px solid var(--color-slate-200); }
  .wg-table tr:hover td { background: var(--color-slate-50); }
  .wg-ref-col { width: 5rem; position: sticky; left: 0; background: var(--color-white); border-right: 1px solid var(--color-slate-200); z-index: 1; }
  th.wg-ref-col { background: var(--color-slate-50); z-index: 2; }
  .wg-table tr:hover td.wg-ref-col { background: var(--color-slate-50); }
  .wg-w-owner { width: 7.5rem; } .wg-w-score { width: 4.75rem; } .wg-w-comment { width: 24rem; } .wg-w-links { width: 13rem; } .wg-w-del { width: 5rem; }
  .wg-ref-click { cursor: pointer; }
  .wg-ref-click:hover .wg-ref { text-decoration-style: solid; }
  .wg-del-cell { text-align: center; }
  .wg-section td { background: var(--color-slate-50); font-weight: 600; padding: 0.5rem 0.75rem; text-align: left; }
  .wg-section:hover td { background: var(--color-slate-50); }
  .wg-avg { float: right; font-size: 0.75rem; font-weight: 500; color: var(--color-slate-500); }
  .wg-q { padding: 0.5rem 0.5rem; line-height: 1.45; }
  .wg-table td.wg-q, .wg-table td.wg-linkcell { text-align: left; }

  .wg-ref { background: none; border: none; padding: 0.375rem 0.125rem; cursor: pointer; font-family: 'Courier New', monospace; font-size: 0.8125rem; font-weight: 600; color: var(--color-primary-600); text-decoration: underline dotted; text-underline-offset: 3px; }
  .wg-ref:hover { text-decoration-style: solid; }
  .wg-ref { display: block; margin-inline: auto; }
  .wg-del { display: block; margin-inline: auto; background: none; border: none; padding: 0.125rem; font-family: inherit; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; }
  .wg-del.armed { color: var(--color-red-600); }

  .wg-cell { text-align: center; width: 100%; box-sizing: border-box; border: 1px solid transparent; background: transparent; border-radius: var(--radius-sm); padding: 0.3rem 0.375rem; font-family: inherit; font-size: inherit; color: inherit; resize: none; overflow: hidden; display: block; }
    .wg-cell:hover { border-color: var(--color-slate-200); }
  .wg-cell:focus { outline: none; border-color: var(--color-primary-600); background: var(--color-white); box-shadow: var(--focus-ring-blue); }

  .wg-pill { display: block; box-sizing: border-box; width: 2.75rem; margin-inline: auto; border: none; border-radius: var(--radius-pill); padding: 0.25rem 0.25rem; font-family: inherit; font-size: 0.78rem; font-weight: 700; text-align: center; text-align-last: center; padding-inline: 0; cursor: pointer; appearance: none; -webkit-appearance: none; }
  .pill-danger { background: var(--color-badge-danger-bg); color: var(--color-badge-danger-fg); }
  .pill-warning { background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); }
  .pill-success { background: var(--color-badge-success-bg); color: var(--color-badge-success-fg); }

  .wg-table th.wg-left, .wg-cell.wg-left { text-align: left; text-align-last: auto; }
  .wg-chip { display: inline-block; margin: 0.125rem 0.2rem 0.125rem 0; padding: 0.05rem 0.5rem; font-family: inherit; font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-600); background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); cursor: pointer; white-space: nowrap; }
  .wg-chip:hover { border-color: var(--color-primary-500); color: var(--color-primary-600); }
  .wg-none { font-size: 0.75rem; color: var(--color-slate-400); padding: 0.3rem 0; display: inline-block; }
  .wg-hint { margin: 0.5rem 0.125rem; font-size: 0.75rem; color: var(--color-slate-500); }
</style>
