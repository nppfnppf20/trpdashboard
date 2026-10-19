<script>
  import { createEventDispatcher } from 'svelte';
  import { childrenMap, scopeIds, depthOf, MAX_FOLDER_DEPTH } from '$lib/utils/policyFolders.js';

  /** Flat folder rows from the API. @type {any[]} */
  export let folders = [];
  /** The documents being shown in the library (used for the counts). @type {any[]} */
  export let docs = [];
  /** 'all', 'unfiled', or a folder id. @type {'all' | 'unfiled' | number} */
  export let selected = 'all';
  /** The folder the chat is currently searching, if any. @type {number | null} */
  export let scopeFolderId = null;

  const dispatch = createEventDispatcher();

  /** @type {Set<number>} */
  let collapsed = new Set();
  /** @type {number | null} */
  let confirmId = null;
  /** @type {number | 'unfiled' | null} */
  let dropTarget = null;

  $: kids = childrenMap(folders);
  $: rows = flatten(kids, collapsed);
  $: unfiledCount = docs.filter(d => d.folder_id == null).length;

  /** @param {Map<number | null, any[]>} map @param {Set<number>} closed */
  function flatten(map, closed) {
    const out = [];
    const walk = (parent, depth) => {
      for (const f of map.get(parent) || []) {
        const hasChildren = (map.get(f.id) || []).length > 0;
        out.push({ folder: f, depth, hasChildren, open: !closed.has(f.id) });
        if (hasChildren && !closed.has(f.id)) walk(f.id, depth + 1);
      }
    };
    walk(null, 1);
    return out;
  }

  // Documents in a folder and everything under it
  function countIn(folderId) {
    const ids = scopeIds(folders, folderId);
    return docs.filter(d => ids.includes(d.folder_id)).length;
  }

  function toggle(id) {
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    collapsed = collapsed;
  }

  function choose(folder) {
    selected = folder.id;
    if (collapsed.has(folder.id)) toggle(folder.id);
    dispatch('select', folder.id);
  }

  // ── Drag a document onto a folder to file it ──
  const DOC_TYPE = 'application/x-policy-doc';
  const isDocDrag = (e) => e.dataTransfer?.types?.includes(DOC_TYPE);

  function over(e, target) {
    if (!isDocDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropTarget = target;
  }

  function drop(e, folderId) {
    dropTarget = null;
    if (!isDocDrag(e)) return;
    e.preventDefault();
    const docId = Number(e.dataTransfer.getData(DOC_TYPE));
    if (Number.isInteger(docId)) dispatch('dropdoc', { docId, folderId });
  }
</script>

<div class="tree" role="tree" aria-label="Folders">
  <div class="tree-head">
    <span class="tree-title">Folders</span>
    <button class="btn btn-ghost btn-sm btn-icon" on:click={() => dispatch('create', null)} title="New folder" aria-label="New folder"><i class="las la-folder-plus"></i></button>
  </div>

  <button class="node" class:active={selected === 'all'} role="treeitem" aria-selected={selected === 'all'} on:click={() => { selected = 'all'; dispatch('select', 'all'); }}>
    <i class="las la-layer-group node-icon"></i>
    <span class="node-name">All documents</span>
    <span class="node-count">{docs.length}</span>
  </button>

  {#each rows as { folder, depth, hasChildren, open } (folder.id)}
    <div
      class="node-row"
      class:active={selected === folder.id}
      class:drop={dropTarget === folder.id}
      class:scoped={scopeFolderId === folder.id}
      style="--indent: {(depth - 1) * 1}rem"
      role="none"
      on:dragover={(e) => over(e, folder.id)}
      on:dragleave={() => dropTarget === folder.id && (dropTarget = null)}
      on:drop={(e) => drop(e, folder.id)}
    >
      {#if confirmId === folder.id}
        <div class="confirm" role="alertdialog" aria-label="Delete folder {folder.name}?">
          <span>Delete <strong>{folder.name}</strong>?</span>
          <button class="btn btn-danger btn-sm" on:click={() => { confirmId = null; dispatch('remove', folder); }}>Delete</button>
          <button class="btn btn-secondary btn-sm" on:click={() => (confirmId = null)}>Cancel</button>
        </div>
      {:else}
        <button class="chev" class:invisible={!hasChildren} tabindex={hasChildren ? 0 : -1} aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={hasChildren ? open : undefined} on:click={() => toggle(folder.id)}>
          <i class="las la-angle-right" class:rot={open}></i>
        </button>
        <button class="node grow" role="treeitem" aria-selected={selected === folder.id} aria-level={depth} on:click={() => choose(folder)} title={folder.name}>
          <i class="las {open && hasChildren ? 'la-folder-open' : 'la-folder'} node-icon"></i>
          <span class="node-name">{folder.name}</span>
          {#if scopeFolderId === folder.id}<i class="las la-comments scope-flag" title="The chat is searching this folder"></i>{/if}
          <span class="node-count">{countIn(folder.id)}</span>
        </button>
        <span class="row-actions">
          {#if depthOf(folders, folder.id) < MAX_FOLDER_DEPTH}
            <button class="btn btn-ghost btn-sm btn-icon" on:click={() => dispatch('create', folder.id)} title="New sub-folder" aria-label="New sub-folder in {folder.name}"><i class="las la-folder-plus"></i></button>
          {/if}
          <button class="btn btn-ghost btn-sm btn-icon" on:click={() => dispatch('ask', folder.id)} title="Ask questions about this folder" aria-label="Ask about {folder.name}"><i class="las la-comments"></i></button>
          <button class="btn btn-ghost btn-sm btn-icon" on:click={() => dispatch('edit', folder)} title="Rename or move" aria-label="Rename or move {folder.name}"><i class="las la-edit"></i></button>
          <button class="btn btn-danger-ghost btn-sm btn-icon" on:click={() => (confirmId = folder.id)} title="Delete folder" aria-label="Delete {folder.name}"><i class="las la-trash"></i></button>
        </span>
      {/if}
    </div>
  {/each}

  <button
    class="node"
    class:active={selected === 'unfiled'}
    class:drop={dropTarget === 'unfiled'}
    role="treeitem"
    aria-selected={selected === 'unfiled'}
    on:click={() => { selected = 'unfiled'; dispatch('select', 'unfiled'); }}
    on:dragover={(e) => over(e, 'unfiled')}
    on:dragleave={() => dropTarget === 'unfiled' && (dropTarget = null)}
    on:drop={(e) => drop(e, null)}
  >
    <i class="las la-inbox node-icon"></i>
    <span class="node-name">Unfiled</span>
    <span class="node-count">{unfiledCount}</span>
  </button>
</div>

<style>
  .tree { display: flex; flex-direction: column; gap: 0.0625rem; padding: 0.5rem 0.5rem 0.625rem; }
  .tree-head { display: flex; align-items: center; justify-content: space-between; padding: 0 0.25rem 0 0.5rem; }
  .tree-title { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-500); }

  .node {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.3125rem 0.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .node:hover { background: var(--color-slate-100); }
  .node:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: -2px; }
  .node.active { background: var(--color-primary-50); color: var(--color-primary-700); font-weight: 600; }
  .node.drop, .node-row.drop { background: var(--color-primary-100); outline: 2px dashed var(--color-primary-600); outline-offset: -2px; }
  .node-icon { font-size: 1.0625rem; color: var(--color-slate-500); flex-shrink: 0; }
  .node.active .node-icon { color: var(--color-primary-600); }
  .node-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node-count { font-size: 0.6875rem; color: var(--color-slate-500); font-weight: 500; background: var(--color-slate-100); border-radius: var(--radius-pill); padding: 0 0.4375rem; flex-shrink: 0; }
  .node.active .node-count { background: var(--color-primary-100); color: var(--color-primary-700); }
  .scope-flag { font-size: 0.8125rem; color: var(--color-primary-600); flex-shrink: 0; }

  .node-row { display: flex; align-items: center; padding-left: var(--indent); border-radius: var(--radius-sm); position: relative; }
  .node-row.active { background: var(--color-primary-50); }
  .node-row.active .node { background: none; }
  .node-row:hover .node:not(.active) { background: none; }
  .node-row:hover { background: var(--color-slate-100); }
  .node-row.active:hover { background: var(--color-primary-50); }
  .node.grow { flex: 1; min-width: 0; padding-left: 0.125rem; }

  .chev { background: none; border: none; width: 1.25rem; height: 1.5rem; padding: 0; cursor: pointer; color: var(--color-slate-500); display: grid; place-items: center; flex-shrink: 0; border-radius: var(--radius-sm); }
  .chev.invisible { visibility: hidden; }
  .chev:hover { color: var(--color-slate-800); }
  .chev i { font-size: 0.75rem; transition: transform 0.12s; }
  .chev i.rot { transform: rotate(90deg); }

  /* Actions slide in over the count when the row is hovered or has keyboard focus */
  .row-actions { display: none; align-items: center; flex-shrink: 0; margin-left: auto; background: inherit; }
  .node-row:hover .row-actions, .node-row:focus-within .row-actions { display: flex; }
  .node-row:hover .node-count, .node-row:focus-within .node-count { display: none; }
  .row-actions :global(.btn) { padding: 0.1875rem 0.3125rem; min-width: 0; }

  .confirm { display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--color-red-600); flex-wrap: wrap; }
</style>
