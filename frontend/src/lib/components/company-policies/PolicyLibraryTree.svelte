<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { childrenMap, depthOf, MAX_FOLDER_DEPTH } from '$lib/utils/policyFolders.js';

  /** Flat folder rows from the API. @type {any[]} */
  export let folders = [];
  /** Every document being shown (superseded ones too, if "previous versions" is on). @type {any[]} */
  export let docs = [];
  /** Text from the library filter box. */
  export let filterText = '';
  /** The row last clicked. @type {{ kind: 'folder' | 'doc', id: number } | null} */
  export let selected = null;
  /** The folder the chat is searching, if any. @type {number | null} */
  export let scopeFolderId = null;
  /** A document id that has an action in flight. @type {number | null} */
  export let busyId = null;
  export let loading = false;

  const dispatch = createEventDispatcher();

  const STATUS = {
    uploaded: { label: 'Awaiting indexing' },
    processing: { label: 'Processing' },
    ready: { label: 'Ready' },
    failed: { label: 'Failed' }
  };

  // ── Which folders are collapsed (remembered between visits; new folders start open) ──
  const STORE_KEY = 'company-policies:collapsed-folders';
  /** @type {Set<number>} */
  let collapsed = new Set();
  onMount(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) collapsed = new Set(JSON.parse(raw));
    } catch { /* storage unavailable: everything starts open */ }
  });
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...collapsed])); } catch { /* not remembered */ }
  }

  // ── Building the visible rows ──
  $: needle = filterText.trim().toLowerCase();
  $: kids = childrenMap(folders);
  $: docsIn = groupDocs(docs);
  $: counts = countDocs(kids, docsIn);
  $: rows = buildRows(kids, docsIn, counts, collapsed, needle);

  /** @param {any[]} list */
  function groupDocs(list) {
    /** @type {Map<number | null, any[]>} */
    const map = new Map();
    for (const d of list) {
      const key = d.folder_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(d);
    }
    for (const l of map.values()) l.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) || b.id - a.id);
    return map;
  }

  /** Documents in each folder and everything below it. */
  function countDocs(kidsMap, docMap) {
    /** @type {Map<number, number>} */
    const out = new Map();
    const total = (id) => {
      let n = (docMap.get(id) || []).length;
      for (const f of kidsMap.get(id) || []) n += total(f.id);
      out.set(id, n);
      return n;
    };
    for (const f of kidsMap.get(null) || []) total(f.id);
    return out;
  }

  function buildRows(kidsMap, docMap, countMap, closed, q) {
    const out = [];
    const docHit = (d) => !q || [d.title, d.original_filename].some(v => (v || '').toLowerCase().includes(q));
    const nameHit = (f) => !!q && f.name.toLowerCase().includes(q);
    // With a filter on: keep a folder if its name, or anything inside it, matches
    const relevant = (f) => nameHit(f) || (docMap.get(f.id) || []).some(docHit) || (kidsMap.get(f.id) || []).some(relevant);

    const pushDocs = (folderId, depth, showAll) => {
      for (const d of docMap.get(folderId) || []) {
        if (showAll || docHit(d)) out.push({ kind: 'doc', key: `d${d.id}`, doc: d, depth });
      }
    };
    const walk = (parentId, depth, showAll) => {
      for (const f of kidsMap.get(parentId) || []) {
        const all = showAll || nameHit(f);
        if (q && !all && !relevant(f)) continue;
        const inner = (kidsMap.get(f.id) || []).length > 0 || (docMap.get(f.id) || []).length > 0;
        const open = q ? true : !closed.has(f.id);
        out.push({ kind: 'folder', key: `f${f.id}`, folder: f, depth, open, hasChildren: inner, count: countMap.get(f.id) || 0 });
        if (open) {
          walk(f.id, depth + 1, all);
          pushDocs(f.id, depth + 1, all);
        }
      }
    };
    walk(null, 0, false);
    pushDocs(null, 0, false);
    return out;
  }

  // ── Selecting, opening, collapsing ──
  function pick(kind, id) {
    selected = { kind, id };
    dispatch('select', selected);
  }

  // A folder that becomes selected (e.g. one just created) must not be hidden inside a collapsed parent
  $: if (selected?.kind === 'folder') revealFolder(selected.id, folders);

  function revealFolder(id, list) {
    const byId = new Map(list.map(f => [f.id, f]));
    let changed = false;
    for (let cur = byId.get(byId.get(id)?.parent_id); cur; cur = byId.get(cur.parent_id)) {
      if (collapsed.delete(cur.id)) changed = true;
    }
    if (changed) {
      collapsed = collapsed;
      persist();
    }
  }

  function toggle(id) {
    if (collapsed.has(id)) collapsed.delete(id);
    else collapsed.add(id);
    collapsed = collapsed;
    persist();
  }

  function clickFolder(f) {
    pick('folder', f.id);
    if (collapsed.has(f.id)) toggle(f.id);
  }

  function clickDoc(d) {
    pick('doc', d.id);
    dispatch('view', d.id);
  }

  function expandAll() {
    collapsed = new Set();
    persist();
  }

  function collapseAll() {
    collapsed = new Set(folders.filter(f => (kids.get(f.id) || []).length || (docsIn.get(f.id) || []).length).map(f => f.id));
    persist();
  }

  // ── Keyboard: Enter/Space open, Left/Right collapse/expand, Up/Down move ──
  let treeEl;
  function onKey(e, row) {
    if (e.target !== e.currentTarget) return; // a key pressed on a button inside the row is the button's
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      row.kind === 'folder' ? clickFolder(row.folder) : clickDoc(row.doc);
    } else if (e.key === 'ArrowRight' && row.kind === 'folder' && row.hasChildren && !row.open) {
      e.preventDefault();
      toggle(row.folder.id);
    } else if (e.key === 'ArrowLeft' && row.kind === 'folder' && row.hasChildren && row.open && !needle) {
      e.preventDefault();
      toggle(row.folder.id);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...treeEl.querySelectorAll('[role="treeitem"]')];
      const next = items[items.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }
  }

  // ── Delete confirmation, in the row ──
  /** @type {{ kind: 'folder' | 'doc', id: number } | null} */
  let confirm = null;

  // ── The "more" menu on a document ──
  /** @type {{ doc: any, left: number, top: number, up: boolean } | null} */
  let menu = null;
  const MENU_W = 168;
  const MENU_H = 176;

  function openMenu(e, d) {
    e.stopPropagation();
    if (menu?.doc.id === d.id) { menu = null; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < MENU_H + 8;
    menu = { doc: d, left: Math.max(8, r.right - MENU_W), top: up ? r.top - 4 : r.bottom + 4, up };
  }

  // Keyboard users land on the first available item when the menu opens
  function focusFirst(node) {
    node.querySelector('button:not(:disabled)')?.focus();
  }

  function menuAction(name) {
    const d = menu?.doc;
    menu = null;
    if (!d) return;
    if (name === 'delete') confirm = { kind: 'doc', id: d.id };
    else dispatch(name, d);
  }

  // ── Drag a document onto a folder to file it ──
  const DOC_TYPE = 'application/x-policy-doc';
  const isDocDrag = (e) => e.dataTransfer?.types?.includes(DOC_TYPE);
  let draggingDoc = false;
  /** @type {number | 'root' | null} */
  let dropTarget = null;

  function dragStart(e, d) {
    e.dataTransfer.setData(DOC_TYPE, String(d.id));
    e.dataTransfer.effectAllowed = 'move';
    draggingDoc = true;
    menu = null;
  }

  function dragOver(e, target) {
    if (!isDocDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropTarget = target;
  }

  function drop(e, folderId) {
    dropTarget = null;
    draggingDoc = false; // this handler stops the event, so the window-level reset never sees it
    if (!isDocDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const docId = Number(e.dataTransfer.getData(DOC_TYPE));
    if (Number.isInteger(docId)) dispatch('dropdoc', { docId, folderId });
  }

  function endDrag() {
    draggingDoc = false;
    dropTarget = null;
  }

  // ── Small display helpers ──
  const fileIcon = (d) => (d.mime_type === 'application/pdf' ? 'la-file-pdf' : d.original_filename?.toLowerCase().endsWith('.docx') ? 'la-file-word' : 'la-file-alt');
  const fileClass = (d) => (d.mime_type === 'application/pdf' ? 'pdf' : 'word');

  function size(bytes) {
    if (!bytes) return '';
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function docTip(d) {
    const parts = [d.title, `Version ${d.version}`];
    if (d.status === 'ready') parts.push(`${d.chunk_count} sections indexed`);
    parts.push(STATUS[d.status]?.label || d.status);
    if (d.status === 'failed' && d.status_detail) parts.push(d.status_detail);
    if (!d.is_current) parts.push('Superseded by a newer version');
    if (d.visibility === 'admin') parts.push('Admins only');
    parts.push(`${d.original_filename}${d.file_size ? ` · ${size(d.file_size)}` : ''}`);
    return parts.join('\n');
  }
</script>

<svelte:window
  on:click={() => (menu = null)}
  on:keydown={(e) => e.key === 'Escape' && (menu = null)}
  on:resize={() => (menu = null)}
  on:dragend={endDrag}
  on:drop={endDrag}
/>

<div class="tools">
  <button class="btn btn-ghost btn-sm" on:click={expandAll} title="Open every folder"><i class="las la-angle-double-down"></i> Expand all</button>
  <button class="btn btn-ghost btn-sm" on:click={collapseAll} title="Close every folder"><i class="las la-angle-double-up"></i> Collapse all</button>
  <span class="grow"></span>
  <button class="btn btn-ghost btn-sm" on:click={() => dispatch('createfolder', null)} title="New folder"><i class="las la-folder-plus"></i> New folder</button>
</div>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="tree-scroll" on:scroll={() => (menu = null)}>
  <div class="tree" role="tree" aria-label="Folders and documents" bind:this={treeEl}>
    {#each rows as row (row.key)}
      {#if row.kind === 'folder'}
        {@const f = row.folder}
        <div
          class="r folder"
          class:sel={selected?.kind === 'folder' && selected.id === f.id}
          class:drop={dropTarget === f.id}
          style="--d: {row.depth}"
          role="treeitem"
          tabindex="0"
          aria-level={row.depth + 1}
          aria-expanded={row.hasChildren ? row.open : undefined}
          aria-selected={selected?.kind === 'folder' && selected.id === f.id}
          on:click={() => clickFolder(f)}
          on:keydown={(e) => onKey(e, row)}
          on:dragover={(e) => dragOver(e, f.id)}
          on:dragleave={() => dropTarget === f.id && (dropTarget = null)}
          on:drop={(e) => drop(e, f.id)}
        >
          {#each Array(row.depth) as _, i}<span class="guide" style="--i: {i}"></span>{/each}

          {#if confirm?.kind === 'folder' && confirm.id === f.id}
            <span class="confirm">
              <span class="confirm-text">Delete <strong>{f.name}</strong>?</span>
              <button class="btn btn-danger btn-sm" on:click|stopPropagation={() => { confirm = null; dispatch('removefolder', f); }}>Delete</button>
              <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => (confirm = null)}>Cancel</button>
            </span>
          {:else}
            <button
              class="chev"
              class:open={row.open}
              class:none={!row.hasChildren}
              tabindex="-1"
              aria-label="{row.open ? 'Collapse' : 'Expand'} {f.name}"
              on:click|stopPropagation={() => toggle(f.id)}
            ><i class="las la-angle-right"></i></button>
            <i class="las {row.open && row.hasChildren ? 'la-folder-open' : 'la-folder'} fi" class:empty={!row.hasChildren}></i>
            <span class="nm" title={f.name}>{f.name}</span>
            {#if scopeFolderId === f.id}<i class="las la-comments scope" title="The chat is searching this folder"></i>{/if}
            <span class="cnt">{row.count}</span>
            <span class="acts">
              {#if depthOf(folders, f.id) < MAX_FOLDER_DEPTH}
                <button class="ibtn" on:click|stopPropagation={() => dispatch('createfolder', f.id)} title="New sub-folder" aria-label="New sub-folder in {f.name}"><i class="las la-folder-plus"></i></button>
              {/if}
              <button class="ibtn" on:click|stopPropagation={() => dispatch('askfolder', f.id)} title="Ask questions about this folder" aria-label="Ask about {f.name}"><i class="las la-comments"></i></button>
              <button class="ibtn" on:click|stopPropagation={() => dispatch('editfolder', f)} title="Rename or move" aria-label="Rename or move {f.name}"><i class="las la-edit"></i></button>
              <button class="ibtn del" on:click|stopPropagation={() => (confirm = { kind: 'folder', id: f.id })} title="Delete folder" aria-label="Delete {f.name}"><i class="las la-trash"></i></button>
            </span>
          {/if}
        </div>
      {:else}
        {@const d = row.doc}
        <div
          class="r doc"
          class:sel={selected?.kind === 'doc' && selected.id === d.id}
          class:old={!d.is_current}
          class:menu-open={menu?.doc.id === d.id}
          style="--d: {row.depth}"
          role="treeitem"
          tabindex="0"
          draggable="true"
          title={docTip(d)}
          aria-level={row.depth + 1}
          aria-selected={selected?.kind === 'doc' && selected.id === d.id}
          on:click={() => clickDoc(d)}
          on:keydown={(e) => onKey(e, row)}
          on:dragstart={(e) => dragStart(e, d)}
        >
          {#each Array(row.depth) as _, i}<span class="guide" style="--i: {i}"></span>{/each}

          {#if confirm?.kind === 'doc' && confirm.id === d.id}
            <span class="confirm">
              <span class="confirm-text">Delete <strong>{d.title}</strong> and its index?</span>
              <button class="btn btn-danger btn-sm" disabled={busyId === d.id} on:click|stopPropagation={() => { confirm = null; dispatch('removedoc', d); }}>Delete</button>
              <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => (confirm = null)}>Cancel</button>
            </span>
          {:else}
            <span class="chev none"></span>
            <i class="las {fileIcon(d)} file {fileClass(d)}"></i>
            <span class="nm">{d.title}</span>
            {#if !d.is_current}<span class="tag">old</span>{/if}
            {#if d.visibility === 'admin'}<i class="las la-lock lock" title="Admins only"></i>{/if}
            <span class="dot {d.status}" title={STATUS[d.status]?.label || d.status}></span>
            <span class="acts">
              <button class="ibtn" on:click|stopPropagation={() => clickDoc(d)} title="View" aria-label="View {d.title}"><i class="las la-eye"></i></button>
              <button class="ibtn" disabled={busyId === d.id} on:click|stopPropagation={() => dispatch('download', d)} title="Download original" aria-label="Download {d.title}"><i class="las la-download"></i></button>
              <button class="ibtn" on:click={(e) => openMenu(e, d)} title="More" aria-label="More actions for {d.title}" aria-haspopup="menu" aria-expanded={menu?.doc.id === d.id}><i class="las la-ellipsis-h"></i></button>
            </span>
          {/if}
        </div>
        {#if d.status === 'failed' && d.status_detail}
          <div class="failed-note" style="--d: {row.depth}">{d.status_detail}</div>
        {/if}
      {/if}
    {/each}

    {#if !rows.length}
      <div class="empty">
        {#if loading}
          Loading…
        {:else if needle}
          Nothing matches "{filterText.trim()}".
        {:else}
          No policies yet. Use "Upload policy" to add the first one, or create a folder to organise them.
        {/if}
      </div>
    {/if}
  </div>

  {#if draggingDoc}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="unfile" class:drop={dropTarget === 'root'} on:dragover={(e) => dragOver(e, 'root')} on:dragleave={() => dropTarget === 'root' && (dropTarget = null)} on:drop={(e) => drop(e, null)}>
      <i class="las la-level-up-alt"></i> Drop here to take it out of its folder
    </div>
  {/if}
</div>

{#if menu}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="menu" role="menu" tabindex="-1" use:focusFirst style="left: {menu.left}px; top: {menu.top}px; transform: translateY({menu.up ? '-100%' : '0'})" on:click|stopPropagation>
    {#if menu.doc.is_current}
      <button role="menuitem" on:click={() => menuAction('newversion')}><i class="las la-code-branch"></i> Upload new version</button>
    {/if}
    <button role="menuitem" disabled={menu.doc.status === 'processing'} on:click={() => menuAction('reindex')}><i class="las la-sync"></i> Re-index</button>
    <button role="menuitem" on:click={() => menuAction('editdoc')}><i class="las la-edit"></i> Edit details</button>
    <div class="menu-sep" role="separator"></div>
    <button role="menuitem" class="danger" on:click={() => menuAction('delete')}><i class="las la-trash"></i> Delete</button>
  </div>
{/if}

<style>
  .tools { display: flex; align-items: center; gap: 0.125rem; padding: 0.375rem 0.5rem 0.25rem; flex-shrink: 0; }
  .tools .grow { flex: 1; }

  .tree-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0.25rem 0.375rem 0.5rem; position: relative; }
  .tree { display: flex; flex-direction: column; gap: 0.0625rem; }

  /* ── Rows ── */
  .r {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    min-height: 1.875rem;
    padding-right: 0.375rem;
    padding-left: calc(0.25rem + var(--d) * 1.125rem);
    border-radius: var(--radius-sm);
    cursor: pointer;
    user-select: none;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
  }
  .r:hover { background: var(--color-slate-100); }
  .r:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: -2px; }
  .r.sel { background: var(--color-primary-100); color: var(--color-primary-700); }
  .r.sel .nm { font-weight: 600; }
  .r.drop { background: var(--color-primary-100); outline: 2px dashed var(--color-primary-600); outline-offset: -2px; }
  .r.old .nm { color: var(--color-slate-500); }
  .guide { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--color-slate-200); left: calc(0.875rem + var(--i) * 1.125rem); pointer-events: none; }

  .chev { width: 1.25rem; height: 1.375rem; border: none; background: none; padding: 0; display: grid; place-items: center; border-radius: var(--radius-sm); color: var(--color-slate-500); cursor: pointer; flex-shrink: 0; }
  .chev:hover { background: var(--color-slate-200); color: var(--color-slate-800); }
  .chev i { font-size: 0.75rem; transition: transform 0.12s; }
  .chev.open i { transform: rotate(90deg); }
  .chev.none { visibility: hidden; pointer-events: none; }

  .fi { font-size: 1.1875rem; color: var(--color-amber-500); flex-shrink: 0; }
  .fi.empty { opacity: 0.55; }
  .file { font-size: 1.1875rem; flex-shrink: 0; }
  .file.pdf { color: var(--color-red-600); }
  .file.word { color: var(--color-primary-600); }

  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cnt { font-size: 0.6875rem; font-weight: 500; color: var(--color-slate-500); background: var(--color-slate-100); border-radius: var(--radius-pill); padding: 0 0.4375rem; flex-shrink: 0; }
  .r.sel .cnt { background: var(--color-primary-200); color: var(--color-primary-700); }
  .scope { font-size: 0.8125rem; color: var(--color-primary-600); flex-shrink: 0; }
  .tag { font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-500); background: var(--color-slate-100); border-radius: var(--radius-sm); padding: 0 0.3125rem; flex-shrink: 0; }
  .lock { font-size: 0.8125rem; color: var(--color-slate-400); flex-shrink: 0; }

  .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; flex-shrink: 0; margin: 0 0.25rem; }
  .dot.ready { background: var(--color-emerald-500); }
  .dot.processing { background: var(--color-primary-500); animation: dot-pulse 1.4s ease-in-out infinite; }
  .dot.failed { background: var(--color-red-500); }
  .dot.uploaded { background: var(--color-slate-400); }
  @keyframes dot-pulse { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .dot.processing { animation: none; } }

  /* Actions replace the count / status dot while a row is hovered or focused */
  .acts { display: none; align-items: center; flex-shrink: 0; margin-left: auto; }
  .r:hover .acts, .r:focus-within .acts, .r.menu-open .acts { display: flex; }
  .r:hover .cnt, .r:focus-within .cnt, .r:hover .dot, .r:focus-within .dot, .r.menu-open .dot { display: none; }
  .ibtn { width: 1.5rem; height: 1.5rem; border: none; background: none; border-radius: var(--radius-sm); display: grid; place-items: center; color: var(--color-slate-500); cursor: pointer; padding: 0; font-size: 1rem; }
  .ibtn:hover:not(:disabled) { background: var(--color-slate-200); color: var(--color-slate-800); }
  .ibtn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ibtn.del:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .confirm { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; padding: 0.25rem 0.25rem 0.25rem 0.5rem; font-size: 0.75rem; color: var(--color-red-600); min-width: 0; }
  .confirm-text { min-width: 0; overflow-wrap: anywhere; }
  .failed-note { padding: 0 0.5rem 0.25rem calc(2.625rem + var(--d) * 1.125rem); font-size: 0.6875rem; color: var(--color-red-600); line-height: 1.35; }

  .empty { padding: 1.5rem 1rem; text-align: center; font-size: 0.8125rem; color: var(--color-slate-500); line-height: 1.5; }

  /* ── Drop zone for taking a document out of its folder ── */
  .unfile {
    position: sticky;
    bottom: 0;
    margin-top: 0.5rem;
    padding: 0.625rem 0.75rem;
    border: 2px dashed var(--color-slate-300);
    border-radius: var(--radius-md);
    background: var(--color-slate-50);
    color: var(--color-slate-600);
    font-size: 0.75rem;
    text-align: center;
  }
  .unfile.drop { border-color: var(--color-primary-600); background: var(--color-primary-100); color: var(--color-primary-700); }

  /* ── The "more" menu ── */
  .menu {
    position: fixed;
    z-index: 1100;
    width: 10.5rem;
    padding: 0.25rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    display: flex;
    flex-direction: column;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.5rem;
    border: none;
    background: none;
    border-radius: var(--radius-sm);
    font: inherit;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover:not(:disabled) { background: var(--color-slate-100); }
  .menu button:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: -2px; }
  .menu button:disabled { opacity: 0.45; cursor: not-allowed; }
  .menu button.danger { color: var(--color-red-600); }
  .menu button.danger:hover { background: var(--color-red-50); }
  .menu-sep { height: 1px; background: var(--color-slate-200); margin: 0.25rem 0; }
</style>
