<script context="module">
  // Per-project workspace state, kept while you move between tabs (memory only, lost on page reload).
  const sessions = new Map();

  function freshSession() {
    return {
      ticked: null, // null until the first load decides the default
      current: null,
      activeDocId: null,
      messages: [],
      sources: { groups: ['policies'], meeting_ids: [], document_ids: [], mode: 'notes' }
    };
  }

  function getSession(id) {
    if (!sessions.has(id)) sessions.set(id, freshSession());
    return sessions.get(id);
  }
</script>

<script>
  // Saved schemes workspace: schemes on the left (tick to include in the chat), the selected scheme's documents in the
  // middle, and a chat over the ticked schemes' documents on the right.
  import { createEventDispatcher, onMount } from 'svelte';
  import { getSchemeDocuments, uploadSchemeDocument, setSchemeDocumentType, deleteSchemeDocument } from '$lib/api/planit.js';
  import SchemeDocViewer from './SchemeDocViewer.svelte';
  import SchemeChat from './SchemeChat.svelte';

  export let project;
  export let saved = []; // saved scheme snapshots

  const dispatch = createEventDispatcher();

  $: projectId = project?.id;

  let s = getSession(project?.id);
  let lastProjectId = project?.id;
  let documents = [];
  let loadingDocs = true;
  let docsError = '';
  let uploading = [];
  let uploadError = '';
  let highlight = null;

  $: if (project?.id !== lastProjectId) {
    lastProjectId = project?.id;
    s = getSession(project?.id);
    documents = [];
    highlight = null;
    loadDocs();
  }

  onMount(loadDocs);

  async function loadDocs() {
    loadingDocs = true;
    docsError = '';
    try {
      documents = await getSchemeDocuments(projectId);
      if (s.ticked === null) s.ticked = saved.filter(r => documents.some(d => d.planit_name === r.name)).map(r => r.name);
    } catch (err) {
      docsError = err.message;
    } finally {
      loadingDocs = false;
      s = s;
    }
  }

  // Keep the selection valid as schemes are saved or removed.
  $: names = saved.map(r => r.name);
  $: if (!s.current || !names.includes(s.current)) {
    s.current = names[0] ?? null;
    s = s;
  }
  $: ticked = (s.ticked ?? []).filter(n => names.includes(n));
  $: currentScheme = saved.find(r => r.name === s.current) ?? null;
  $: currentDocs = documents.filter(d => d.planit_name === s.current);
  $: schemeLabels = Object.fromEntries(saved.map(r => [r.name, shorten(r.description || r.name)]));

  const shorten = t => (t.length > 70 ? `${t.slice(0, 67)}…` : t);

  const docsFor = name => documents.filter(d => d.planit_name === name);
  const missingOfficer = name => {
    const d = docsFor(name);
    return d.length > 0 && !d.some(x => x.doc_type === 'officer_report');
  };

  function stateClass(state) {
    if (state === 'Permitted' || state === 'Conditions') return 'granted';
    if (state === 'Rejected') return 'refused';
    return 'other';
  }

  function pickScheme(name) {
    s.current = name;
    s.activeDocId = null;
    highlight = null;
    uploadError = '';
    s = s;
  }

  function toggleTick(name) {
    s.ticked = ticked.includes(name) ? ticked.filter(n => n !== name) : [...ticked, name];
    s = s;
  }

  async function onUpload(e) {
    const name = s.current;
    uploadError = '';
    const errors = [];
    for (const file of e.detail) {
      uploading = [...uploading, file.name];
      try {
        const doc = await uploadSchemeDocument(projectId, name, file);
        documents = [...documents, doc];
        s.activeDocId = doc.id;
        if (!ticked.includes(name)) s.ticked = [...ticked, name];
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      } finally {
        uploading = uploading.filter(f => f !== file.name);
        s = s;
      }
    }
    uploadError = errors.join(' ');
  }

  async function onConfirm(e) {
    try {
      const doc = await setSchemeDocumentType(projectId, e.detail.doc.id, e.detail.type);
      documents = documents.map(d => (d.id === doc.id ? doc : d));
    } catch (err) {
      uploadError = err.message;
    }
  }

  async function onRemoveDoc(e) {
    const doc = e.detail;
    if (!confirm(`Delete "${doc.filename}" from this scheme? Its saved text will be removed.`)) return;
    try {
      await deleteSchemeDocument(projectId, doc.id);
      documents = documents.filter(d => d.id !== doc.id);
      if (s.activeDocId === doc.id) s.activeDocId = null;
      s = s;
    } catch (err) {
      uploadError = err.message;
    }
  }

  function onRemoveScheme() {
    const n = currentDocs.length;
    const warn = n ? ` Its ${n} uploaded document${n === 1 ? '' : 's'} will be deleted too.` : '';
    if (!confirm(`Remove this scheme from the saved list?${warn}`)) return;
    const name = s.current;
    documents = documents.filter(d => d.planit_name !== name);
    s.ticked = ticked.filter(t => t !== name);
    s.current = null;
    s.activeDocId = null;
    s = s;
    dispatch('removeScheme', name);
  }

  function onCite(e) {
    const { doc, scheme, quote } = e.detail;
    s.current = scheme;
    s.activeDocId = doc;
    highlight = quote ? { docId: doc, quote } : null;
    s = s;
  }
</script>

<div class="workspace">
  <div class="panel list">
    <div class="p-head">Saved schemes <span class="count">{ticked.length} of {saved.length} ticked</span></div>
    <div class="items">
      {#each saved as r (r.name)}
        {@const n = docsFor(r.name).length}
        <div class="item" class:cur={s.current === r.name}>
          <input type="checkbox" checked={ticked.includes(r.name)} disabled={n === 0} title={n === 0 ? 'Upload a document to include this scheme in the chat' : 'Include in the chat'} on:change={() => toggleTick(r.name)} aria-label="Include in the chat" />
          <button class="item-body" on:click={() => pickScheme(r.name)}>
            <span class="item-text" class:dim={n === 0}>{r.description || r.name}</span>
            <span class="item-meta">
              {#if r.app_state}<span class="badge {stateClass(r.app_state)}">{r.app_state}</span>{/if}
              <span class="docs">{n === 0 ? 'No docs' : `${n} doc${n === 1 ? '' : 's'}`}</span>
              {#if missingOfficer(r.name)}<span class="badge warn">No officer report</span>{/if}
            </span>
          </button>
        </div>
      {:else}
        <p class="empty">No saved schemes yet. Save some from the Search tab.</p>
      {/each}
    </div>
    <p class="p-foot">Tick the schemes you want the chat to read. Click one to view or add its documents.</p>
  </div>

  <div class="middle">
    {#if loadingDocs}
      <div class="panel centre"><span class="spinner"></span> Loading…</div>
    {:else if docsError}
      <div class="panel centre err">{docsError} <button class="retry" on:click={loadDocs}>Retry</button></div>
    {:else if currentScheme}
      <SchemeDocViewer
        {projectId}
        scheme={currentScheme}
        docs={currentDocs}
        bind:activeDocId={s.activeDocId}
        {highlight}
        {uploading}
        {uploadError}
        on:upload={onUpload}
        on:confirm={onConfirm}
        on:removeDoc={onRemoveDoc}
        on:removeScheme={onRemoveScheme}
        on:select={() => (highlight = null)}
        on:clearHighlight={() => (highlight = null)}
      />
    {:else}
      <div class="panel centre">Select a saved scheme.</div>
    {/if}
  </div>

  <div class="chat-col">
    <SchemeChat {projectId} names={ticked} docs={documents} {schemeLabels} bind:messages={s.messages} bind:sources={s.sources} on:cite={onCite} />
  </div>
</div>

<style>
  .workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr) 420px; gap: 1rem; height: 76vh; min-height: 600px; }
  .middle, .chat-col { min-width: 0; min-height: 0; }
  .panel { display: flex; flex-direction: column; min-height: 0; background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; }
  .panel.centre { align-items: center; justify-content: center; height: 100%; gap: 0.5rem; font-size: 0.85rem; color: var(--color-slate-500); flex-direction: row; }
  .panel.err { color: var(--color-red-800); }
  .retry { background: none; border: none; color: var(--color-purple-600); font: inherit; cursor: pointer; text-decoration: underline; }

  .p-head { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.9rem; border-bottom: 1px solid var(--color-slate-200); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-500); }
  .count { text-transform: none; letter-spacing: 0; font-weight: 500; }
  .items { flex: 1; min-height: 0; overflow-y: auto; }
  .item { display: flex; gap: 0.6rem; padding: 0.65rem 0.8rem; border-bottom: 1px solid var(--color-slate-100); align-items: flex-start; }
  .item.cur { background: var(--color-purple-50); box-shadow: inset 3px 0 0 var(--color-purple-600); }
  .item input { margin-top: 0.2rem; accent-color: var(--color-purple-600); cursor: pointer; }
  .item input:disabled { cursor: not-allowed; }
  .item-body { display: flex; flex-direction: column; gap: 0.3rem; text-align: left; background: none; border: none; padding: 0; font: inherit; cursor: pointer; min-width: 0; flex: 1; }
  .item-text { font-size: 0.8rem; line-height: 1.4; color: var(--color-slate-800); }
  .item-text.dim { color: var(--color-slate-500); }
  .item-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .docs { font-size: 0.72rem; color: var(--color-slate-500); }
  .badge { font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em; }
  .badge.granted { background: var(--color-emerald-100); color: var(--color-green-800); }
  .badge.refused { background: var(--color-red-100); color: var(--color-red-800); }
  .badge.other { background: var(--color-slate-100); color: var(--color-slate-600); }
  .badge.warn { background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); }
  .empty { margin: 0; padding: 1rem; font-size: 0.8rem; color: var(--color-slate-500); }
  .p-foot { margin: 0; padding: 0.65rem 0.9rem; border-top: 1px solid var(--color-slate-200); font-size: 0.73rem; color: var(--color-slate-500); line-height: 1.45; }

  .spinner { width: 0.85rem; height: 0.85rem; border: 2px solid var(--color-slate-200); border-top-color: var(--color-purple-600); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
