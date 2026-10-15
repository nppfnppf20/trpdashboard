<script>
  // Project Workbook (Beta): stage-gate questions plus risks, actions, issues and decisions for one project,
  // with progress logs, a Linked with popup, the page's own meeting notes and Add advancement.
  import * as api from '$lib/api/workbook.js';
  import { computeRefs, computeFlags, isOpen } from '$lib/components/workbook/workbookUtils.js';
  import WorkbookGateTable from '$lib/components/workbook/WorkbookGateTable.svelte';
  import WorkbookItemTable from '$lib/components/workbook/WorkbookItemTable.svelte';
  import WorkbookLinksModal from '$lib/components/workbook/WorkbookLinksModal.svelte';
  import WorkbookProgressDrawer from '$lib/components/workbook/WorkbookProgressDrawer.svelte';
  import WorkbookNewItemModal from '$lib/components/workbook/WorkbookNewItemModal.svelte';
  import WorkbookGateModal from '$lib/components/workbook/WorkbookGateModal.svelte';
  import WorkbookConfirmModal from '$lib/components/workbook/WorkbookConfirmModal.svelte';
  import WorkbookNotesModal from '$lib/components/workbook/WorkbookNotesModal.svelte';
  import WorkbookAdvancementModal from '$lib/components/workbook/WorkbookAdvancementModal.svelte';

  export let project;

  $: projectId = project?.id;

  let loading = true;
  let error = null;
  let gate = [];
  let items = [];
  let tab = 'gate';
  let lastProjectId = null;

  // Popups and panels
  let linksModal = null;      // { kind, id, focus }
  let logItemId = null;
  let newType = null;
  let gateModalOpen = false;
  let confirmDelete = null;   // { kind: 'item' | 'gate', id, title, lines }
  let notesOpen = false;
  let advOpen = false;
  let advNote = null;
  let flagsOpen = false;
  let toast = '';
  let toastTimer;

  $: if (projectId && projectId !== lastProjectId) {
    lastProjectId = projectId;
    tab = 'gate';
    load();
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const data = await api.getWorkbook(projectId);
      gate = data.gate;
      items = data.items;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  $: gateNo = gate[0]?.gate ?? 2;
  $: refs = computeRefs(items, gateNo);
  $: owners = [...new Set([...items, ...gate].flatMap(r => String(r.owner || '').split('/').map(s => s.trim())).filter(Boolean))].sort();
  $: flags = computeFlags(gate, items, refs);
  $: logItem = items.find(i => i.id === logItemId) || null;
  $: counts = {
    gate: gate.length,
    risk: items.filter(i => i.type === 'risk' && isOpen(i)).length,
    action: items.filter(i => i.type === 'action' && isOpen(i)).length,
    issue: items.filter(i => i.type === 'issue' && isOpen(i)).length,
    decision: items.filter(i => i.type === 'decision').length,
  };

  const TABS = [
    ['gate', 'Stage gate'], ['risk', 'Risks & opps'], ['action', 'Actions'], ['issue', 'Issues'], ['decision', 'Decisions'],
  ];
  const LATER = [['roles', 'Roles and responsibilities'], ['budget', 'Budget and expenditure'], ['programme', 'Programme']];
  const LATER_INFO = {
    roles: 'A fixed matrix of tasks against TRP planning, TRP project management, technical consultants and the client. Set once per project.',
    budget: 'Estimates replaced by quotes as they arrive, with an expenditure view that spreads each fee over the months it is invoiced.',
    programme: 'A programme to submission, shared with the client. Dates here could feed the overdue flags.',
  };

  function say(msg) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 3500);
  }

  // ── Edits ──────────────────────────────────────────────────────────────────
  const replaceItem = updated => { items = items.map(i => (i.id === updated.id ? updated : i)); };

  async function changeItem(id, patch) {
    items = items.map(i => (i.id === id ? { ...i, ...patch } : i));   // show it straight away
    try {
      replaceItem(await api.updateWorkbookItem(id, patch));
    } catch (err) {
      say(err.message);
      await load();
    }
  }

  async function changeGate(id, patch) {
    gate = gate.map(g => (g.id === id ? { ...g, ...patch } : g));
    try {
      const updated = await api.updateGateQuestion(id, patch);
      gate = gate.map(g => (g.id === id ? { ...g, ...updated } : g));
    } catch (err) {
      say(err.message);
      await load();
    }
  }

  async function addGateQuestion(data) {
    const result = await api.createGateQuestion(projectId, data);
    gate = result.gate;
    say('Gate question added.');
  }

  // What deleting something would affect, as sentences for the warning. null means nothing depends on it.
  const list = (names, max = 6) => names.slice(0, max).join(', ') + (names.length > max ? `, and ${names.length - max} more` : '');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function itemImpact(id) {
    const it = items.find(i => i.id === id);
    if (!it) return null;
    const lines = [];
    const children = items.filter(i => i.parent_id === id);
    if (children.length) {
      lines.push(`${plural(children.length, 'row sits', 'rows sit')} under ${refs[id] || 'it'}: ${list(children.map(c => refs[c.id] || c.subject))}. ${children.length === 1 ? 'It' : 'They'} will stay but lose this link.`);
    }
    const nLog = (it.log || []).length;
    if (nLog) lines.push(`Its ${plural(nLog, 'progress entry', 'progress entries')} will be deleted with it.`);
    return lines.length ? lines : null;
  }

  function gateImpact(id) {
    const g = gate.find(x => x.id === id);
    if (!g) return null;
    const linked = items.filter(i => (i.gate_refs || []).includes(g.ref));
    if (!linked.length) return null;
    return [`${plural(linked.length, 'row is', 'rows are')} linked to gate question ${g.ref}: ${list(linked.map(i => refs[i.id] || i.subject))}. ${linked.length === 1 ? 'It' : 'They'} will stay but lose this link.`];
  }

  function askDelete(kind, id) {
    const lines = kind === 'gate' ? gateImpact(id) : itemImpact(id);
    if (!lines) return kind === 'gate' ? deleteGateQuestion(id) : deleteItem(id);
    const subject = kind === 'gate' ? `gate question ${gate.find(g => g.id === id)?.ref}` : (refs[id] || 'this row');
    confirmDelete = { kind, id, title: `Delete ${subject}?`, lines };
  }

  async function confirmedDelete() {
    const { kind, id } = confirmDelete;
    if (kind === 'gate') await deleteGateQuestion(id);
    else await deleteItem(id);
    confirmDelete = null;
  }

  async function deleteGateQuestion(id) {
    try {
      const result = await api.deleteGateQuestion(id);
      gate = result.gate;
      items = result.items;
    } catch (err) {
      say(err.message);
    }
  }

  async function addItem(data) {
    const created = await api.createWorkbookItem(projectId, data);
    items = [...items, created];
    return created;
  }

  async function deleteItem(id) {
    try {
      await api.deleteWorkbookItem(id);
      items = items.filter(i => i.id !== id).map(i => (i.parent_id === id ? { ...i, parent_id: null } : i));
      if (logItemId === id) logItemId = null;
    } catch (err) {
      say(err.message);
    }
  }

  // Add from the + in the Linked with popup: the new row is linked to the row the popup was opened on.
  async function addLinked(kind, id, type, { subject, owner }) {
    const data = { type, subject, owner };
    if (kind === 'gate') {
      const g = gate.find(x => x.id === id);
      data.gate_refs = g ? [g.ref] : [];
    } else {
      const o = items.find(x => x.id === id);
      data.gate_refs = [...(o?.gate_refs || [])];
      if (type === 'action' || type === 'issue') data.parent_id = id;
    }
    try {
      await addItem(data);
      say(`${type[0].toUpperCase()}${type.slice(1)} added.`);
    } catch (err) {
      say(err.message);
    }
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  const setLog = (itemId, fn) => { items = items.map(i => (i.id === itemId ? { ...i, log: fn(i.log || []) } : i)); };

  async function addProgress(itemId, entry) {
    try {
      const created = await api.addWorkbookProgress(itemId, entry);
      setLog(itemId, log => [...log, created]);
    } catch (err) {
      say(err.message);
    }
  }
  async function updateProgress(itemId, entryId, patch) {
    try {
      const updated = await api.updateWorkbookProgress(entryId, patch);
      setLog(itemId, log => log.map(e => (e.id === entryId ? updated : e)));
    } catch (err) {
      say(err.message);
    }
  }
  async function deleteProgress(itemId, entryId) {
    try {
      await api.deleteWorkbookProgress(entryId);
      setLog(itemId, log => log.filter(e => e.id !== entryId));
    } catch (err) {
      say(err.message);
    }
  }

  // ── Panels ─────────────────────────────────────────────────────────────────
  const openLinks = (kind, id, focus = '') => { linksModal = { kind, id, focus }; };
  const openLog = id => { logItemId = id; };

  function draftFromNote(note) {
    notesOpen = false;
    advNote = note;
    advOpen = true;
  }
  function openAdvancement() {
    advNote = null;
    advOpen = true;
  }
  function advancementApplied(result) {
    gate = result.gate;
    items = result.items;
    advOpen = false;
    advNote = null;
    say(`Applied ${result.applied} change${result.applied === 1 ? '' : 's'}.`);
  }
  function goToFlag(f) {
    tab = f.tab;
    flagsOpen = false;
  }
</script>

<div class="wb">
  <header class="wb-header">
    <div>
      <div class="wb-eyebrow">{project?.project_name || 'Project'} <span class="wb-beta">Beta</span></div>
      <h1>Project Workbook</h1>
      <p class="wb-sub">Stage Gate {gateNo}</p>
    </div>
    <div class="wb-actions">
      <button class="btn btn-secondary btn-sm" on:click={() => (flagsOpen = true)}>
        Flags{#if flags.length}<span class="wb-flagcount">{flags.length}</span>{/if}
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => (notesOpen = true)}>Meeting notes</button>
      <button class="btn btn-primary btn-sm" on:click={openAdvancement}>Add advancement</button>
    </div>
  </header>

  <nav class="wb-tabs" aria-label="Workbook sections">
    {#each TABS as [key, label] (key)}
      <button class="wb-tab" class:active={tab === key} on:click={() => (tab = key)}>{label}<span class="wb-n">{counts[key]}</span></button>
    {/each}
    {#each LATER as [key, label] (key)}
      <button class="wb-tab wb-later" class:active={tab === key} on:click={() => (tab = key)}>{label}</button>
    {/each}
  </nav>

  {#if loading}
    <div class="wb-state">Loading the workbook…</div>
  {:else if error}
    <div class="wb-state wb-error">{error}</div>
  {:else if tab === 'gate'}
    <WorkbookGateTable {gate} {items} onChange={changeGate} onOpenLinks={openLinks} onAdd={() => (gateModalOpen = true)} onDelete={deleteGateQuestion}
      deleteImpact={gateImpact} onConfirmDelete={id => askDelete('gate', id)} />
  {:else if ['risk', 'action', 'issue', 'decision'].includes(tab)}
    <WorkbookItemTable
      type={tab} {gate} {items} {refs} {owners}
      onChange={changeItem}
      onOpenLinks={openLinks}
      onOpenLog={openLog}
      onAdd={t => (newType = t)}
      onDelete={deleteItem}
      deleteImpact={itemImpact}
      onConfirmDelete={id => askDelete('item', id)}
    />
  {:else}
    <div class="card wb-later-card">
      <h2>{LATER.find(l => l[0] === tab)?.[1]}</h2>
      <p>{LATER_INFO[tab]}</p>
      <p class="wb-muted">Not built yet.</p>
    </div>
  {/if}
</div>

<datalist id="wb-owners">
  {#each owners as o (o)}<option value={o}></option>{/each}
</datalist>

{#if linksModal}
  <WorkbookLinksModal
    {gate} {items} {refs}
    kind={linksModal.kind} id={linksModal.id} focus={linksModal.focus}
    onClose={() => (linksModal = null)}
    onAddLinked={addLinked}
    onStatus={(itemId, status) => changeItem(itemId, { status })}
    onAddProgress={addProgress}
  />
{/if}

{#if logItem}
  <WorkbookProgressDrawer
    item={logItem} {gate} {items} {refs}
    onClose={() => (logItemId = null)}
    onAddProgress={addProgress}
    onUpdateProgress={updateProgress}
    onDeleteProgress={deleteProgress}
    onStatus={(itemId, status) => changeItem(itemId, { status })}
    onOpenLog={openLog}
  />
{/if}

{#if newType}
  <WorkbookNewItemModal
    type={newType} {gate} {items} {refs}
    onSubmit={addItem}
    onClose={() => (newType = null)}
  />
{/if}

{#if confirmDelete}
  <WorkbookConfirmModal
    title={confirmDelete.title}
    lines={confirmDelete.lines}
    onConfirm={confirmedDelete}
    onCancel={() => (confirmDelete = null)}
  />
{/if}

{#if gateModalOpen}
  <WorkbookGateModal {gate} {gateNo} onSubmit={addGateQuestion} onClose={() => (gateModalOpen = false)} />
{/if}

{#if notesOpen}
  <WorkbookNotesModal {projectId} onClose={() => (notesOpen = false)} onDraft={draftFromNote} />
{/if}

{#if advOpen}
  <WorkbookAdvancementModal
    {projectId} {gate} {items} {refs}
    initialNote={advNote}
    onClose={() => { advOpen = false; advNote = null; }}
    onApplied={advancementApplied}
  />
{/if}

{#if flagsOpen}
  <div class="wb-backdrop" on:click|self={() => (flagsOpen = false)} role="presentation">
    <div class="wb-flags" role="dialog" aria-modal="true" aria-label="Flags">
      <div class="wb-flags-head">
        <h2>Flags</h2>
        <button class="btn btn-secondary btn-sm" on:click={() => (flagsOpen = false)}>Close</button>
      </div>
      <div class="wb-flags-body">
        {#each flags as f, i (i)}
          <div class="wb-flag">
            <span class="wb-sev {f.sev}"></span>
            <div>
              <div>{f.msg}</div>
              <button class="wb-flag-go" on:click={() => goToFlag(f)}>Open the {f.tab === 'gate' ? 'stage gate' : f.tab + 's'}</button>
            </div>
          </div>
        {:else}
          <div class="wb-state">Nothing to flag right now.</div>
        {/each}
        <p class="wb-muted">Checks overdue and unowned items, priority 1 items not started, open risks with no open action, low-scoring gate questions with nothing linked, and actions with no progress logged for two weeks.</p>
      </div>
    </div>
  </div>
{/if}

{#if toast}<div class="wb-toast" role="status">{toast}</div>{/if}

<style>
  .wb { padding: 1.25rem 1.5rem 3rem; display: flex; flex-direction: column; gap: 0.875rem; min-width: 0; }
  .wb-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
  .wb-header h1 { margin: 0.125rem 0 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-slate-900); }
  .wb-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wb-beta { margin-left: 0.4rem; padding: 0.05rem 0.4rem; border-radius: var(--radius-pill); background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); letter-spacing: 0.04em; }
  .wb-sub { margin: 0.125rem 0 0; font-size: 0.85rem; color: var(--color-slate-500); }
  .wb-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .wb-flagcount { display: inline-block; margin-left: 0.4rem; min-width: 1.1rem; padding: 0 0.3rem; border-radius: var(--radius-pill); background: var(--color-badge-danger-bg); color: var(--color-badge-danger-fg); font-size: 0.6875rem; font-weight: 700; text-align: center; }

  .wb-tabs { display: flex; gap: 0.125rem; flex-wrap: wrap; border-bottom: 1px solid var(--color-slate-200); }
  .wb-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.55rem 0.75rem; font-family: inherit; font-size: 0.84375rem; font-weight: 600; color: var(--color-slate-500); cursor: pointer; }
  .wb-tab:hover { color: var(--color-slate-800); }
  .wb-tab.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }
  .wb-n { margin-left: 0.4rem; font-size: 0.72rem; font-weight: 500; color: var(--color-slate-400); }
  .wb-later { opacity: 0.6; }

  .wb-state { padding: 2rem; text-align: center; color: var(--color-slate-500); }
  .wb-error { color: var(--color-red-600); }
  .wb-later-card { max-width: 40rem; }
  .wb-later-card h2 { margin: 0 0 0.375rem; font-size: 1.05rem; color: var(--color-slate-800); }
  .wb-later-card p { margin: 0 0 0.5rem; color: var(--color-slate-600); font-size: 0.875rem; }
  .wb-muted { color: var(--color-slate-500); font-size: 0.8rem; }

  .wb-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wb-flags { background: var(--color-white); border-radius: var(--radius-lg); width: min(36rem, 100%); max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wb-flags-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .wb-flags-head h2 { margin: 0; font-size: 1.05rem; color: var(--color-slate-800); }
  .wb-flags-body { padding: 0.5rem 1.25rem 1.25rem; overflow: auto; }
  .wb-flag { display: flex; gap: 0.75rem; padding: 0.625rem 0; border-bottom: 1px solid var(--color-slate-100); font-size: 0.85rem; color: var(--color-slate-700); }
  .wb-sev { width: 0.5rem; border-radius: 2px; flex: none; }
  .wb-sev.hi { background: var(--color-red-500); }
  .wb-sev.mid { background: var(--color-amber-500); }
  .wb-sev.lo { background: var(--color-slate-400); }
  .wb-flag-go { background: none; border: none; padding: 0; font-family: inherit; font-size: 0.75rem; font-weight: 600; color: var(--color-primary-600); cursor: pointer; }
  .wb-flag-go:hover { text-decoration: underline; }

  .wb-toast { position: fixed; left: 50%; bottom: 1.25rem; transform: translateX(-50%); background: var(--color-slate-900); color: var(--color-white); padding: 0.5rem 0.875rem; border-radius: var(--radius-md); font-size: 0.85rem; z-index: 3000; max-width: 90vw; }
</style>
