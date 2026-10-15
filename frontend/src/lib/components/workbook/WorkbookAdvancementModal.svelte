<script>
  // Add advancement: read a note against the workbook, review the suggested changes, apply the ticked ones.
  // Suggestions are grouped by the kind of row they are about (stage gate, risks, actions, issues, decisions). Each
  // is an update to an existing row, a new row, or a link between rows, laid out as Previous, Suggested, Why and
  // Quote. The suggested values are editable before applying, including a gate question's 1 to 5 score and any
  // date: the AI never proposes a score, but you can set one here. Nothing is saved until Apply.
  import { onMount } from 'svelte';
  import { listWorkbookNotes, getWorkbookNote, deleteWorkbookNote, parseWorkbookFile, suggestWorkbookAdvancement, applyWorkbookAdvancement } from '$lib/api/workbook.js';
  import { SOURCES, STATUSES, today, fmtLong, fmtShort } from './workbookUtils.js';

  export let projectId;
  export let gate = [];
  export let items = [];
  export let refs = {};
  export let onClose = () => {};
  export let onApplied = () => {};    // (workbook) - the refreshed { gate, items }

  let savedNotes = [];
  let noteId = null;          // set when the text came from a saved note
  let noteText = '';
  let date = today();
  let source = 'Meeting notes';
  let mode = 'paste';         // 'paste' | 'upload'
  let fileName = '';
  let parsing = false;
  let dragOver = false;
  let fileInput;
  let keepCopy = true;        // keep a copy of the notes on the workbook (stored when Apply is clicked)
  let noteTitle = '';
  let savedOpen = false;
  let armedNoteId = null;
  let drafting = false;
  let applying = false;
  let error = null;
  let summary = '';
  let proposals = null;     // null = not drafted yet
  let showMissing = false;  // highlight new rows that still have no priority
  let priorityWarning = null;  // names of the new rows that still need one, shown in a popup

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

  // Reading a file only fills the box below so it can be checked and edited. Nothing is saved.
  async function pickFile(file) {
    if (!file) return;
    parsing = true;
    error = null;
    try {
      const res = await parseWorkbookFile(projectId, file);
      noteText = res.text;
      fileName = res.file_name;
      noteId = null;
      proposals = null;
      if (!noteTitle.trim()) noteTitle = res.file_name.replace(/\.[^.]+$/, '');
    } catch (err) {
      error = err.message;
    } finally {
      parsing = false;
    }
  }
  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    mode = 'upload';
    pickFile(e.dataTransfer.files[0]);
  }
  function armDelete(id) {
    if (armedNoteId === id) { armedNoteId = null; removeNote(id); return; }
    armedNoteId = id;
    setTimeout(() => { if (armedNoteId === id) armedNoteId = null; }, 3000);
  }
  async function removeNote(id) {
    try {
      await deleteWorkbookNote(id);
      savedNotes = savedNotes.filter(n => n.id !== id);
      if (noteId === id) noteId = null;
    } catch (err) {
      error = err.message;
    }
  }
  async function useSaved(id) {
    try {
      const n = await getWorkbookNote(id);
      noteId = n.id; noteText = n.body; date = n.note_date; source = n.source; fileName = '';
      proposals = null;
    } catch (err) {
      error = err.message;
    }
  }

  const refOf = id => refs[id] || '';
  const itemLabel = i => `${refOf(i.id)} · ${i.subject}`.trim();
  const firstLine = t => String(t || '').split('\n')[0];
  const newest = it => [...(it.log || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)[0];
  function parentLabel(id) {
    const x = items.find(i => i.id === id);
    return x ? itemLabel(x) : 'None';
  }

  // Each proposal keeps an `edit` object with the values that will be applied, starting from what the AI suggested
  // (or the row's current value where it suggested nothing), plus `sugg` flags for what the AI actually proposed.
  function build(raw) {
    const out = [];
    for (const u of raw.updates) {
      if (u.kind === 'gate') {
        const g = gate.find(x => x.id === u.gate_id);
        if (g) out.push({ kind: 'gate', g, label: `Gate ${g.ref} · ${g.question.length > 70 ? g.question.slice(0, 70) + '…' : g.question}`, edit: { note: u.note || '', score: g.score }, sugg: {}, reason: u.reason, quote: u.quote, on: true });
      } else {
        const it = items.find(x => x.id === u.item_id);
        if (it) out.push({
          kind: 'item', it, label: itemLabel(it),
          edit: { note: u.note || '', status: u.status ?? it.status, target: u.target ?? it.target ?? '', owner: u.owner ?? it.owner ?? '' },
          sugg: { status: !!u.status, target: !!u.target, owner: !!u.owner }, targetBasis: u.target_basis,
          reason: u.reason, quote: u.quote, on: true,
        });
      }
    }
    for (const n of raw.new) {
      out.push({
        kind: 'new', data: n,
        edit: { subject: n.subject, text: n.text || '', owner: n.owner || '', priority: '', target: n.target || '' },
        sugg: { target: !!n.target }, targetBasis: n.target_basis, reason: n.reason, quote: n.quote, on: true,
      });
    }
    for (const l of raw.links) {
      const it = items.find(x => x.id === l.item_id);
      if (it) out.push({ kind: 'link', it, label: itemLabel(it), patch: l.patch, edit: {}, sugg: {}, reason: l.reason, quote: l.quote, on: true });
    }
    return out;
  }

  async function draft() {
    if (mode === 'upload' && !noteText.trim()) { error = 'Choose a file first.'; return; }
    if (noteText.trim().length < 20) { error = 'Add some notes first.'; return; }
    drafting = true;
    error = null;
    proposals = null;
    showMissing = false;
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
  function removeProposal(i) {
    proposals = proposals.filter((_, idx) => idx !== i);
  }
  // A new risk, action or issue needs a priority from the person applying. Decisions have none.
  const needsPriority = p => p.kind === 'new' && p.data.type !== 'decision';
  const hasPriority = p => [1, 2, 3].includes(Number(p.edit.priority));

  function setEdit(i, patch) {
    proposals = proposals.map((p, idx) => (idx === i ? { ...p, edit: { ...p.edit, ...patch } } : p));
  }

  // Grouped by the kind of row each suggestion is about; within a group, updates come first, then new rows, then links.
  const GROUPS = [
    ['gate', 'Stage gate'], ['risk', 'Risks and opportunities'], ['action', 'Actions'], ['issue', 'Issues'], ['decision', 'Decisions'],
  ];
  const KIND_RANK = { gate: 0, item: 0, new: 1, link: 2 };
  const typeOf = p => (p.kind === 'gate' ? 'gate' : p.kind === 'new' ? p.data.type : p.it.type);

  $: groups = proposals ? GROUPS.map(([type, title]) => ({
    type,
    title,
    rows: proposals.map((p, i) => ({ p, i })).filter(x => typeOf(x.p) === type).sort((a, b) => KIND_RANK[a.p.kind] - KIND_RANK[b.p.kind] || a.i - b.i),
  })).filter(g => g.rows.length) : [];
  $: ticked = proposals ? proposals.filter(p => p.on).length : 0;

  // The operation to send for a ticked proposal, or null when there is nothing to change.
  function opFor(p) {
    const e = p.edit;
    if (p.kind === 'item') {
      const note = (e.note || '').trim();
      const status = p.it.type !== 'decision' && STATUSES.includes(e.status) && e.status !== p.it.status ? e.status : undefined;
      const target = p.it.type !== 'decision' && e.target && e.target !== (p.it.target || '') ? e.target : undefined;
      const owner = (e.owner || '').trim() && (e.owner || '').trim() !== (p.it.owner || '') ? e.owner.trim() : undefined;
      if (!note && !status && !target && !owner) return null;
      return { op: 'item_update', item_id: p.it.id, note, status, target, owner };
    }
    if (p.kind === 'gate') {
      const note = (e.note || '').trim();
      const score = Number(e.score) !== p.g.score ? Number(e.score) : undefined;
      if (!note && score === undefined) return null;
      return { op: 'gate_update', gate_id: p.g.id, note, score };
    }
    if (p.kind === 'new') {
      if (!(e.subject || '').trim()) return null;
      return { op: 'new_item', data: { type: p.data.type, subject: e.subject.trim(), text: (e.text || '').trim(), owner: (e.owner || '').trim(), priority: Number(e.priority), target: e.target || '', gate_refs: p.data.gate_refs, parent_id: p.data.parent_id } };
    }
    return { op: 'link', item_id: p.it.id, patch: p.patch };
  }

  async function apply() {
    const missing = proposals.filter(p => p.on && needsPriority(p) && !hasPriority(p));
    if (missing.length) {
      showMissing = true;
      priorityWarning = missing.map(p => `${p.edit.subject || p.data.subject} (${p.data.type})`);
      return;
    }
    const ops = proposals.filter(p => p.on).map(opFor).filter(Boolean);
    if (!ops.length) { error = 'Nothing to apply. Tick a suggestion, or change a value.'; return; }
    applying = true;
    error = null;
    try {
      const result = await applyWorkbookAdvancement(projectId, { ops, date, source, summary, noteId, saveNote: keepCopy && !noteId, noteText, noteTitle });
      onApplied(result);
    } catch (err) {
      error = err.message;
      applying = false;
    }
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

      <div class="wa-tabs">
        <button type="button" class="wa-tab" class:active={mode === 'paste'} on:click={() => (mode = 'paste')}>Paste text</button>
        <button type="button" class="wa-tab" class:active={mode === 'upload'} on:click={() => (mode = 'upload')}>Upload a file</button>
      </div>

      {#if mode === 'upload'}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="wa-drop" class:over={dragOver} on:dragover|preventDefault={() => (dragOver = true)} on:dragleave={() => (dragOver = false)} on:drop={onDrop}>
          {#if parsing}
            Reading the file…
          {:else if fileName}
            <strong>{fileName}</strong> read ({noteText.length.toLocaleString()} characters).
            <button type="button" class="btn btn-secondary btn-sm" on:click={() => fileInput.click()}>Choose another</button>
          {:else}
            Drop a .docx, .pdf, .txt or .md file here, or
            <button type="button" class="btn btn-secondary btn-sm" on:click={() => fileInput.click()}>choose a file</button>
          {/if}
          <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt,.md" on:change={e => pickFile(e.target.files[0])} hidden>
        </div>
      {/if}

      {#if mode === 'paste'}
        <label class="wa-field">
          <span class="form-label">Notes or transcript</span>
          <textarea class="form-input wa-text" rows="7" bind:value={noteText} on:input={() => { noteId = null; }} placeholder="Paste meeting notes, an email or a transcript. Claude suggests updates to existing rows and any new actions, risks, issues or decisions. Nothing is saved until you apply it."></textarea>
        </label>
      {/if}

      <div class="wa-keep">
        {#if noteId}
          <span class="wa-keep-note">These notes are already saved on the workbook.</span>
        {:else}
          <label class="wa-keep-check"><input type="checkbox" bind:checked={keepCopy}> Keep a copy of these notes on the workbook</label>
          {#if keepCopy}
            <input class="form-input wa-keep-title" bind:value={noteTitle} placeholder="Title, e.g. Client call (optional)">
          {/if}
          <span class="wa-keep-note">{keepCopy ? 'Saved when you click Apply, not before.' : 'Nothing is kept. The changes are still applied.'}</span>
        {/if}
      </div>

      <div class="wa-saved">
        <button type="button" class="wa-saved-toggle" on:click={() => (savedOpen = !savedOpen)} aria-expanded={savedOpen}>
          <i class="las {savedOpen ? 'la-angle-down' : 'la-angle-right'}"></i> Saved notes ({savedNotes.length})
        </button>
        {#if savedOpen}
          {#each savedNotes as n (n.id)}
            <div class="wa-saved-row">
              <div class="wa-saved-main"><strong>{n.title}</strong><span>{fmtLong(n.note_date)} · {n.source}</span></div>
              <button type="button" class="btn btn-secondary btn-sm" on:click={() => useSaved(n.id)}>Use</button>
              <button type="button" class="wa-saved-del" class:armed={armedNoteId === n.id} on:click={() => armDelete(n.id)}>{armedNoteId === n.id ? 'Sure?' : 'Delete'}</button>
            </div>
          {:else}
            <div class="wa-saved-empty">No notes saved on this workbook yet.</div>
          {/each}
        {/if}
      </div>

      {#if error}<div class="wa-error">{error}</div>{/if}
      {#if drafting}<div class="wa-note">Reading the notes against {items.length} rows and {gate.length} gate questions…</div>{/if}

      {#if proposals}
        {#if summary}<p class="wa-summary">{summary}</p>{/if}
        {#if proposals.length}<p class="wa-hint">Change anything below before applying. The AI never suggests a score or a priority; you set those yourself, and every new risk, action or issue needs a priority.</p>{/if}
        {#if !proposals.length}
          <div class="wa-empty">No changes suggested from these notes.</div>
        {/if}
        {#each groups as g (g.title)}
          <section class="wa-group">
            <div class="wa-gh"><span>{g.title}</span><span class="wa-count">{g.rows.length}</span></div>
            {#each g.rows as { p, i } (i)}
              <div class="wa-prop" class:off={!p.on}>
                <div class="wa-prop-bar">
                <label class="wa-prop-head">
                  <input type="checkbox" checked={p.on} on:change={() => toggle(i)}>
                  {#if p.kind === 'new'}<span class="wa-tag wa-new">New {p.data.type}</span><span class="wa-title">{p.edit.subject || p.data.subject}</span>
                  {:else if p.kind === 'link'}<span class="wa-tag wa-link">Link</span><span class="wa-title">{p.label}</span>
                  {:else}<span class="wa-tag wa-upd">Update</span><span class="wa-title">{p.label}</span>{/if}
                </label>
                <button type="button" class="wa-remove" on:click={() => removeProposal(i)}>Remove</button>
                </div>

                <dl class="wa-grid">
                  <dt>Suggested</dt>
                  <dd class="wa-edit">
                    {#if p.kind === 'item'}
                      <label class="wa-ef wa-wide">
                        <span class="wa-lh"><span class="wa-lab">{p.it.type === 'action' ? 'New progress entry' : 'Update added'}</span><span class="wa-prev">Previous {p.it.type === 'action' ? 'entry' : 'update'}: {p.it.type === 'action' ? (newest(p.it) ? `${fmtLong(newest(p.it).date)}: ${newest(p.it).text}` : 'none') : (firstLine(p.it.update) || 'none')}</span></span>
                        <textarea class="form-input" class:wa-ai={!!p.edit.note} rows="2" value={p.edit.note} on:input={e => setEdit(i, { note: e.target.value })} placeholder="Nothing suggested. Type one if you want to add it."></textarea>
                      </label>
                      {#if p.it.type !== 'decision'}
                        <label class="wa-ef">
                          <span class="wa-lh"><span class="wa-lab">Status</span>{#if p.edit.status !== p.it.status}<span class="wa-prev">Previous: {p.it.status}</span>{/if}</span>
                          <select class="form-input" class:wa-ai={p.sugg.status} value={p.edit.status} on:change={e => setEdit(i, { status: e.target.value })}>
                            {#each STATUSES as s (s)}<option value={s}>{s}</option>{/each}
                          </select>
                        </label>
                        <label class="wa-ef">
                          <span class="wa-lh"><span class="wa-lab">Target date</span>{#if (p.edit.target || '') !== (p.it.target || '')}<span class="wa-prev">Previous: {p.it.target ? fmtLong(p.it.target) : 'none'}</span>{/if}</span>
                          <input class="form-input" class:wa-ai={p.sugg.target} type="date" value={p.edit.target} on:change={e => setEdit(i, { target: e.target.value })}>
                          {#if p.sugg.target && p.targetBasis}<span class="wa-basis">from “{p.targetBasis}”</span>{/if}
                        </label>
                      {/if}
                      <label class="wa-ef">
                        <span class="wa-lh"><span class="wa-lab">Owner</span>{#if (p.edit.owner || '') !== (p.it.owner || '')}<span class="wa-prev">Previous: {p.it.owner || 'none'}</span>{/if}</span>
                        <input class="form-input" class:wa-ai={p.sugg.owner} value={p.edit.owner} on:input={e => setEdit(i, { owner: e.target.value })}>
                      </label>

                    {:else if p.kind === 'gate'}
                      <label class="wa-ef wa-wide">
                        <span class="wa-lh"><span class="wa-lab">Comment added</span><span class="wa-prev">Previous comment: {firstLine(p.g.comment) || 'none'}</span></span>
                        <textarea class="form-input" class:wa-ai={!!p.edit.note} rows="2" value={p.edit.note} on:input={e => setEdit(i, { note: e.target.value })} placeholder="Nothing suggested."></textarea>
                      </label>
                      <label class="wa-ef">
                        <span class="wa-lh"><span class="wa-lab">Score (0 to 5)</span>{#if Number(p.edit.score) !== p.g.score}<span class="wa-prev">Previous: {p.g.score}</span>{/if}</span>
                        <select class="form-input" value={p.edit.score} on:change={e => setEdit(i, { score: parseInt(e.target.value, 10) })}>
                          {#each [0, 1, 2, 3, 4, 5] as n (n)}<option value={n}>{n}</option>{/each}
                        </select>
                      </label>

                    {:else if p.kind === 'new'}
                      <label class="wa-ef wa-wide">
                        <span class="wa-lab">Subject</span>
                        <input class="form-input wa-ai" value={p.edit.subject} on:input={e => setEdit(i, { subject: e.target.value })}>
                      </label>
                      <label class="wa-ef wa-wide">
                        <span class="wa-lab">Details</span>
                        <textarea class="form-input wa-ai" rows="2" value={p.edit.text} on:input={e => setEdit(i, { text: e.target.value })}></textarea>
                      </label>
                      <label class="wa-ef">
                        <span class="wa-lab">Owner</span>
                        <input class="form-input" class:wa-ai={!!p.data.owner} value={p.edit.owner} on:input={e => setEdit(i, { owner: e.target.value })}>
                      </label>
                      {#if p.data.type !== 'decision'}
                        <label class="wa-ef">
                          <span class="wa-lab">Priority</span>
                          <select class="form-input" class:wa-missing={showMissing && !hasPriority(p)} value={p.edit.priority} on:change={e => setEdit(i, { priority: e.target.value ? parseInt(e.target.value, 10) : '' })}>
                            <option value="">Select a priority</option>
                            <option value={1}>1 · High</option><option value={2}>2 · Medium</option><option value={3}>3 · Low</option>
                          </select>
                        </label>
                        <label class="wa-ef">
                          <span class="wa-lab">Target date</span>
                          <input class="form-input" class:wa-ai={p.sugg.target} type="date" value={p.edit.target} on:change={e => setEdit(i, { target: e.target.value })}>
                          {#if p.sugg.target && p.targetBasis}<span class="wa-basis">from “{p.targetBasis}”</span>{/if}
                        </label>
                      {/if}
                      {#if p.data.gate_refs.length || p.data.parent_id}
                        <div class="wa-ef wa-wide wa-fixed">
                          {#if p.data.gate_refs.length}<span><span class="wa-lab">Gate ref</span> {p.data.gate_refs.join(', ')}</span>{/if}
                          {#if p.data.parent_id}<span><span class="wa-lab">{p.data.type === 'action' ? 'Under risk' : 'Arising from'}</span> {parentLabel(p.data.parent_id)}</span>{/if}
                        </div>
                      {/if}

                    {:else}
                      {#if 'parent_id' in p.patch}<div><span class="wa-lab">Parent</span> <span class="wa-sugg">{parentLabel(p.patch.parent_id)}</span> <span class="wa-prev">Previous: {parentLabel(p.it.parent_id)}</span></div>{/if}
                      {#if 'gate_refs' in p.patch}<div><span class="wa-lab">Gate ref</span> <span class="wa-sugg">{p.patch.gate_refs.join(', ')}</span> <span class="wa-prev">Previous: {(p.it.gate_refs || []).join(', ') || 'none'}</span></div>{/if}
                    {/if}
                  </dd>

                  {#if p.reason}<dt>Why</dt><dd>{p.reason}</dd>{/if}
                  {#if p.quote}<dt>Quote</dt><dd class="wa-quote">“{p.quote}”</dd>{/if}
                </dl>
              </div>
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

{#if priorityWarning}
  <div class="wa-alert-backdrop" on:click|self={() => (priorityWarning = null)} role="presentation">
    <div class="wa-alert" role="alertdialog" aria-modal="true" aria-label="Priority needed">
      <h3>Priority needed</h3>
      <p>You need to either select a priority or remove the item for:</p>
      <ul>{#each priorityWarning as name (name)}<li>{name}</li>{/each}</ul>
      <div class="wa-alert-foot"><button class="btn btn-primary btn-sm" on:click={() => (priorityWarning = null)}>Back to the suggestions</button></div>
    </div>
  </div>
{/if}

<style>
  .wa-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wa-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(72rem, 100%); max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wa-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--color-slate-200); }
  .wa-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wa-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wa-body { padding: 1.25rem 1.75rem; overflow: auto; display: flex; flex-direction: column; gap: 1rem; }
  .wa-three { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 0.625rem; }
  .wa-field { display: flex; flex-direction: column; }
  .wa-text { min-height: 8rem; }
  .wa-error { font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wa-note { font-size: 0.8rem; color: var(--color-amber-800); background: var(--color-amber-100); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wa-summary { margin: 0; font-size: 0.875rem; color: var(--color-slate-700); }
  .wa-hint { margin: 0; font-size: 0.78rem; color: var(--color-slate-500); }
  .wa-empty { padding: 1rem; text-align: center; color: var(--color-slate-500); }

  .wa-group { display: flex; flex-direction: column; gap: 0.625rem; }
  .wa-gh { display: flex; justify-content: space-between; align-items: center; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-slate-500); padding-top: 0.25rem; }
  .wa-count { background: var(--color-slate-100); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); padding: 0 0.5rem; font-size: 0.6875rem; }

  .wa-prop { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
  .wa-prop.off { opacity: 0.5; }
  .wa-prop-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .wa-prop-head { display: flex; align-items: center; gap: 0.625rem; cursor: pointer; flex: 1; min-width: 0; }
  .wa-remove { background: none; border: none; padding: 0.125rem; font-family: inherit; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; }
  .wa-remove:hover { color: var(--color-red-600); }
  .wa-title { font-weight: 600; font-size: 0.9rem; color: var(--color-slate-800); }
  .wa-tag { display: inline-block; padding: 0 0.4rem; border-radius: 3px; font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
  .wa-new { background: var(--color-primary-100); color: var(--color-primary-700); }
  .wa-upd { background: var(--color-amber-100); color: var(--color-amber-800); }
  .wa-link { background: var(--color-slate-100); color: var(--color-slate-600); border: 1px solid var(--color-slate-200); }

  .wa-grid { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: 0.625rem 1rem; margin: 0; padding-left: 1.6rem; font-size: 0.84375rem; line-height: 1.45; }
  .wa-grid dt { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); padding-top: 0.3rem; }
  .wa-grid dd { margin: 0; color: var(--color-slate-700); min-width: 0; }
  .wa-grid dd > div + div { margin-top: 0.2rem; }
  .wa-lab { display: inline-block; min-width: 7rem; font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-500); }
  .wa-sugg { color: var(--color-emerald-800); font-weight: 500; }
  .wa-basis { color: var(--color-slate-500); font-style: italic; font-weight: 400; font-size: 0.75rem; }
  .wa-quote { font-style: italic; color: var(--color-slate-500); border-left: 2px solid var(--color-slate-200); padding-left: 0.625rem; }

  .wa-edit { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem 0.75rem; }
  .wa-ef { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
  .wa-ef .wa-lab { min-width: 0; }
  .wa-lh { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
  .wa-prev { font-size: 0.6875rem; font-weight: 400; color: var(--color-slate-500); text-align: right; overflow-wrap: anywhere; }
  .wa-wide { grid-column: 1 / -1; }
  .wa-fixed { flex-direction: row; gap: 1.5rem; flex-wrap: wrap; color: var(--color-slate-600); }
  .wa-edit :global(.form-input) { font-size: 0.8125rem; padding: 0.4rem 0.625rem; }
  /* values the AI proposed are tinted so they stand out from the ones you change yourself */
  .wa-edit :global(.form-input.wa-ai) { background: var(--color-emerald-100); border-color: var(--color-emerald-500); }

  .wa-tabs { display: flex; gap: 0.25rem; }
  .wa-tab { background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); padding: 0.25rem 0.875rem; font-family: inherit; font-size: 0.78rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer; }
  .wa-tab.active { background: var(--color-primary-50); border-color: var(--color-primary-200); color: var(--color-primary-700); font-weight: 600; }
  .wa-drop { border: 2px dashed var(--color-slate-300); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; color: var(--color-slate-500); font-size: 0.85rem; display: flex; gap: 0.625rem; align-items: center; justify-content: center; flex-wrap: wrap; }
  .wa-drop.over { border-color: var(--color-primary-500); background: var(--color-primary-50); }
  .wa-keep { display: flex; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; font-size: 0.8125rem; color: var(--color-slate-700); }
  .wa-keep-check { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; cursor: pointer; }
  .wa-keep-title { width: 16rem; padding: 0.3rem 0.625rem; font-size: 0.8125rem; }
  .wa-keep-note { color: var(--color-slate-500); font-size: 0.75rem; }
  .wa-saved { display: flex; flex-direction: column; gap: 0.375rem; }
  .wa-saved-toggle { align-self: flex-start; display: flex; align-items: center; gap: 0.375rem; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-slate-500); }
  .wa-saved-toggle:hover { color: var(--color-slate-800); }
  .wa-saved-row { display: flex; align-items: center; gap: 0.75rem; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; }
  .wa-saved-main { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 0.8125rem; }
  .wa-saved-main span { font-size: 0.75rem; color: var(--color-slate-500); }
  .wa-saved-del { background: none; border: none; padding: 0.125rem; font-family: inherit; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; }
  .wa-saved-del.armed { color: var(--color-red-600); }
  .wa-saved-empty { font-size: 0.8125rem; color: var(--color-slate-500); }
  .wa-edit :global(.form-input.wa-missing) { border-color: var(--color-red-500); box-shadow: 0 0 0 1px var(--color-red-500); background: var(--color-red-50); }
  .wa-alert-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2300; padding: 1rem; }
  .wa-alert { background: var(--color-white); border-radius: var(--radius-lg); width: min(28rem, 100%); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-modal); }
  .wa-alert h3 { margin: 0 0 0.5rem; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wa-alert p { margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--color-slate-600); }
  .wa-alert ul { margin: 0 0 1rem; padding-left: 1.25rem; font-size: 0.875rem; color: var(--color-slate-800); font-weight: 500; }
  .wa-alert-foot { display: flex; justify-content: flex-end; }
  .wa-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.75rem; border-top: 1px solid var(--color-slate-200); }
  @media (max-width: 48rem) { .wa-edit { grid-template-columns: 1fr; } }
  @media (max-width: 36rem) { .wa-three { grid-template-columns: 1fr; } .wa-grid { grid-template-columns: 1fr; padding-left: 0; } }
</style>
