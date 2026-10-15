<script>
  // Add advancement: read a note against the workbook, review the suggested changes, apply the ticked ones.
  // Suggestions come back in four groups: progress and status on existing rows, gate question changes, new rows,
  // and links between rows. Nothing is saved until Apply.
  import { onMount } from 'svelte';
  import { listWorkbookNotes, getWorkbookNote, suggestWorkbookAdvancement, applyWorkbookAdvancement } from '$lib/api/workbook.js';
  import { SOURCES, today, fmtLong, fmtShort } from './workbookUtils.js';

  export let projectId;
  export let gate = [];
  export let items = [];
  export let refs = {};
  export let initialNote = null;      // a saved note to start from: { id, title, note_date, source, body }
  export let onClose = () => {};
  export let onApplied = () => {};    // (workbook) - the refreshed { gate, items }

  let savedNotes = [];
  let noteId = initialNote?.id ?? null;
  let noteText = initialNote?.body ?? '';
  let date = initialNote?.note_date ?? today();
  let source = initialNote?.source ?? 'Meeting notes';
  let drafting = false;
  let applying = false;
  let error = null;
  let summary = '';
  let proposals = null;     // null = not drafted yet

  onMount(async () => {
    try { savedNotes = (await listWorkbookNotes(projectId)).notes; } catch { /* the picker is optional */ }
  });

  async function loadSaved(e) {
    const id = parseInt(e.target.value, 10);
    if (!id) { noteId = null; return; }
    try {
      const n = await getWorkbookNote(id);
      noteId = n.id; noteText = n.body; date = n.note_date; source = n.source;
      proposals = null;
    } catch (err) {
      error = err.message;
    }
  }

  const refOf = id => refs[id] || '';
  const itemLabel = i => `${refOf(i.id)} · ${i.subject}`.trim();

  function build(raw) {
    const out = [];
    for (const u of raw.updates) {
      if (u.kind === 'gate') {
        const g = gate.find(x => x.id === u.gate_id);
        if (g) out.push({ kind: 'gate', g, label: `Gate ${g.ref} · ${g.question.length > 70 ? g.question.slice(0, 70) + '…' : g.question}`, note: u.note, score: u.score, reason: u.reason, quote: u.quote, on: true });
      } else {
        const it = items.find(x => x.id === u.item_id);
        if (it) out.push({ kind: 'item', it, label: itemLabel(it), note: u.note, status: u.status, target: u.target, owner: u.owner, reason: u.reason, quote: u.quote, on: true });
      }
    }
    for (const n of raw.new) out.push({ kind: 'new', data: n, reason: n.reason, quote: n.quote, on: true });
    for (const l of raw.links) {
      const it = items.find(x => x.id === l.item_id);
      if (it) out.push({ kind: 'link', it, label: itemLabel(it), patch: l.patch, reason: l.reason, quote: l.quote, on: true });
    }
    return out;
  }

  async function draft() {
    if (noteText.trim().length < 20) { error = 'Add some notes first.'; return; }
    drafting = true;
    error = null;
    proposals = null;
    try {
      const raw = await suggestWorkbookAdvancement(projectId, { text: noteText, noteId, date, source });
      summary = raw.summary;
      proposals = build(raw);
    } catch (err) {
      error = err.message;
    } finally {
      drafting = false;
    }
  }

  function toggle(i) {
    proposals = proposals.map((p, idx) => (idx === i ? { ...p, on: !p.on } : p));
  }

  $: groups = proposals ? [
    { title: 'Progress and status', rows: proposals.map((p, i) => ({ p, i })).filter(x => x.p.kind === 'item') },
    { title: 'Gate questions', rows: proposals.map((p, i) => ({ p, i })).filter(x => x.p.kind === 'gate') },
    { title: 'New rows', rows: proposals.map((p, i) => ({ p, i })).filter(x => x.p.kind === 'new') },
    { title: 'Links between rows', rows: proposals.map((p, i) => ({ p, i })).filter(x => x.p.kind === 'link') },
  ].filter(g => g.rows.length) : [];
  $: ticked = proposals ? proposals.filter(p => p.on).length : 0;

  async function apply() {
    const ops = proposals.filter(p => p.on).map(p => {
      if (p.kind === 'item') return { op: 'item_update', item_id: p.it.id, note: p.note, status: p.status, target: p.target, owner: p.owner };
      if (p.kind === 'gate') return { op: 'gate_update', gate_id: p.g.id, note: p.note, score: p.score };
      if (p.kind === 'new') return { op: 'new_item', data: { type: p.data.type, subject: p.data.subject, text: p.data.text, owner: p.data.owner, priority: p.data.priority, target: p.data.target, gate_refs: p.data.gate_refs, parent_id: p.data.parent_id } };
      return { op: 'link', item_id: p.it.id, patch: p.patch };
    });
    if (!ops.length) return;
    applying = true;
    error = null;
    try {
      const result = await applyWorkbookAdvancement(projectId, { ops, date, source, summary, noteId });
      onApplied(result);
    } catch (err) {
      error = err.message;
      applying = false;
    }
  }

  function parentLabel(id) {
    const x = items.find(i => i.id === id);
    return x ? itemLabel(x) : 'None';
  }
  function onKey(e) { if (e.key === 'Escape' && !drafting && !applying) onClose(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wa-backdrop" on:click|self={() => !drafting && !applying && onClose()} role="presentation">
  <div class="wa-modal" role="dialog" aria-modal="true" aria-label="Add advancement">
    <div class="wa-head">
      <div>
        <div class="wa-eyebrow">Project Workbook</div>
        <h2>Add advancement</h2>
      </div>
      <button class="btn btn-secondary btn-sm" on:click={onClose} disabled={drafting || applying}>Close</button>
    </div>

    <div class="wa-body">
      <div class="wa-three">
        <label class="wa-field"><span class="form-label">Date</span><input class="form-input" type="date" bind:value={date}></label>
        <label class="wa-field"><span class="form-label">Source</span>
          <select class="form-input" bind:value={source}>{#each SOURCES as s (s)}<option value={s}>{s}</option>{/each}</select>
        </label>
        <label class="wa-field"><span class="form-label">Saved note</span>
          <select class="form-input" value={noteId ?? ''} on:change={loadSaved}>
            <option value="">Pasted text</option>
            {#each savedNotes as n (n.id)}<option value={n.id}>{n.title} · {fmtShort(n.note_date)}</option>{/each}
          </select>
        </label>
      </div>

      <label class="wa-field">
        <span class="form-label">Notes or transcript</span>
        <textarea class="form-input wa-text" rows="7" bind:value={noteText} on:input={() => { noteId = null; }} placeholder="Paste meeting notes, an email or a transcript. Claude suggests updates to existing rows and any new actions, risks, issues or decisions. Nothing is saved until you apply it."></textarea>
      </label>

      {#if error}<div class="wa-error">{error}</div>{/if}
      {#if drafting}<div class="wa-note">Reading the notes against {items.length} rows and {gate.length} gate questions…</div>{/if}

      {#if proposals}
        {#if summary}<p class="wa-summary">{summary}</p>{/if}
        {#if !proposals.length}
          <div class="wa-empty">No changes suggested from these notes.</div>
        {/if}
        {#each groups as g (g.title)}
          <section class="wa-group">
            <div class="wa-gh"><span>{g.title}</span><span class="wa-count">{g.rows.length}</span></div>
            {#each g.rows as { p, i } (i)}
              <label class="wa-prop" class:off={!p.on}>
                <input type="checkbox" checked={p.on} on:change={() => toggle(i)}>
                <div class="wa-prop-main">
                  <div class="wa-title">
                    {#if p.kind === 'new'}<span class="wa-tag wa-new">New {p.data.type}</span>{p.data.subject}
                    {:else if p.kind === 'link'}<span class="wa-tag wa-link">Link</span>{p.label}
                    {:else}<span class="wa-tag wa-upd">Update</span>{p.label}{/if}
                  </div>
                  <div class="wa-diff">
                    {#if p.kind === 'new'}
                      {#if p.data.text}<div>{p.data.text}</div>{/if}
                      <div><b>Owner</b> {p.data.owner || 'none'} <b>Pri</b> {p.data.priority} <b>Target</b> {p.data.target ? fmtLong(p.data.target) : 'none'}
                        {#if p.data.gate_refs.length}<b>Gate</b> {p.data.gate_refs.join(', ')}{/if}
                        {#if p.data.parent_id}<b>Under</b> {refOf(p.data.parent_id)}{/if}</div>
                    {:else if p.kind === 'link'}
                      {#if 'parent_id' in p.patch}<div><b>Parent</b> <span class="wa-old">{parentLabel(p.it.parent_id)}</span> → {parentLabel(p.patch.parent_id)}</div>{/if}
                      {#if 'gate_refs' in p.patch}<div><b>Gate ref</b> <span class="wa-old">{(p.it.gate_refs || []).join(', ') || 'none'}</span> → {p.patch.gate_refs.join(', ')}</div>{/if}
                    {:else if p.kind === 'gate'}
                      {#if p.note}<div><b>Comment</b> <span class="wa-add">{p.note}</span></div>{/if}
                      {#if p.score !== undefined}<div><b>Score</b> <span class="wa-old">{p.g.score}</span> → {p.score}</div>{/if}
                    {:else}
                      {#if p.note}<div><b>{p.it.type === 'action' ? 'Progress' : 'Update'}</b> <span class="wa-add">{p.note}</span></div>{/if}
                      {#if p.status}<div><b>Status</b> <span class="wa-old">{p.it.status}</span> → {p.status}</div>{/if}
                      {#if p.target}<div><b>Target</b> <span class="wa-old">{p.it.target ? fmtLong(p.it.target) : 'none'}</span> → {fmtLong(p.target)}</div>{/if}
                      {#if p.owner}<div><b>Owner</b> <span class="wa-old">{p.it.owner || 'none'}</span> → {p.owner}</div>{/if}
                    {/if}
                  </div>
                  {#if p.quote}<div class="wa-quote">“{p.quote}”</div>{/if}
                  {#if p.reason}<div class="wa-why">{p.reason}</div>{/if}
                </div>
              </label>
            {/each}
          </section>
        {/each}
      {/if}
    </div>

    <div class="wa-foot">
      <button class="btn btn-secondary btn-sm" on:click={draft} disabled={drafting || applying}>{proposals ? 'Suggest again' : 'Suggest updates'}</button>
      {#if proposals && proposals.length}
        <button class="btn btn-primary btn-sm" on:click={apply} disabled={applying || !ticked}>{applying ? 'Applying…' : `Apply ${ticked} selected`}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .wa-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wa-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(46rem, 100%); max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wa-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .wa-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wa-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wa-body { padding: 1rem 1.25rem; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem; }
  .wa-three { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 0.625rem; }
  .wa-field { display: flex; flex-direction: column; }
  .wa-text { min-height: 8rem; }
  .wa-error { font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wa-note { font-size: 0.8rem; color: var(--color-amber-800); background: var(--color-amber-100); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wa-summary { margin: 0; font-size: 0.85rem; color: var(--color-slate-700); }
  .wa-empty { padding: 1rem; text-align: center; color: var(--color-slate-500); }
  .wa-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .wa-gh { display: flex; justify-content: space-between; align-items: center; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-slate-500); padding-top: 0.25rem; }
  .wa-count { background: var(--color-slate-100); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); padding: 0 0.5rem; font-size: 0.6875rem; }
  .wa-prop { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.625rem; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.625rem 0.75rem; cursor: pointer; }
  .wa-prop.off { opacity: 0.5; }
  .wa-prop input { margin-top: 0.2rem; }
  .wa-title { font-weight: 600; font-size: 0.85rem; color: var(--color-slate-800); }
  .wa-tag { display: inline-block; margin-right: 0.4rem; padding: 0 0.35rem; border-radius: 3px; font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .wa-new { background: var(--color-primary-100); color: var(--color-primary-700); }
  .wa-upd { background: var(--color-amber-100); color: var(--color-amber-800); }
  .wa-link { background: var(--color-slate-100); color: var(--color-slate-600); border: 1px solid var(--color-slate-200); }
  .wa-diff { font-size: 0.8125rem; color: var(--color-slate-700); display: flex; flex-direction: column; gap: 0.125rem; margin-top: 0.25rem; }
  .wa-diff b { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; color: var(--color-slate-400); margin-right: 0.25rem; }
  .wa-add { color: var(--color-emerald-600); }
  .wa-old { color: var(--color-slate-400); text-decoration: line-through; }
  .wa-quote { margin-top: 0.375rem; padding-left: 0.5rem; border-left: 2px solid var(--color-slate-200); font-size: 0.75rem; font-style: italic; color: var(--color-slate-500); }
  .wa-why { margin-top: 0.25rem; font-size: 0.75rem; color: var(--color-slate-500); }
  .wa-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--color-slate-200); }
  @media (max-width: 36rem) { .wa-three { grid-template-columns: 1fr; } }
</style>
