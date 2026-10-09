<script context="module">
  // Fetched document text, kept for the page's lifetime so switching tabs does not re-download it.
  const textCache = new Map();
</script>

<script>
  // The middle column of the saved-schemes workspace: a tab per uploaded document, the accepted/suggested type,
  // upload (button or drop) and a text viewer that can highlight a cited passage or a search term.
  import { createEventDispatcher, tick } from 'svelte';
  import { getSchemeDocumentText } from '$lib/api/planit.js';
  import { safeUrl } from '$lib/utils/safeUrl.js';

  export let projectId;
  export let scheme; // the saved scheme (snapshot of the PlanIt record)
  export let docs = []; // document metadata for this scheme
  export let activeDocId = null;
  /** @type {{ docId: number, quote: string } | null} */
  export let highlight = null; // from a clicked citation
  export let uploading = []; // filenames currently being uploaded
  export let uploadError = '';

  const dispatch = createEventDispatcher();

  const TYPES = [
    { value: 'decision_notice', label: 'Decision notice' },
    { value: 'officer_report', label: 'Officer report' },
    { value: 'consultee', label: 'Consultee response' },
    { value: 'other', label: 'Other document' }
  ];
  const labelOf = type => TYPES.find(t => t.value === type)?.label ?? 'Document';

  let text = '';
  let loadingText = false;
  let textError = '';
  let loadedFor = null;
  let find = '';
  let dragOver = false;
  let fileInput;
  let viewer;

  $: activeDoc = docs.find(d => d.id === activeDocId) ?? docs[0] ?? null;
  $: if (activeDoc && activeDoc.id !== loadedFor) loadText(activeDoc.id);
  $: if (!activeDoc) {
    text = '';
    loadedFor = null;
  }

  async function loadText(id) {
    loadedFor = id;
    textError = '';
    if (textCache.has(id)) {
      text = textCache.get(id);
      return;
    }
    loadingText = true;
    text = '';
    try {
      const t = await getSchemeDocumentText(projectId, id);
      textCache.set(id, t);
      if (loadedFor === id) text = t;
    } catch (err) {
      if (loadedFor === id) textError = err.message;
    } finally {
      if (loadedFor === id) loadingText = false;
    }
  }

  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A quote from the chat is matched loosely: quote marks and emphasis characters may differ from the stored text.
  function quotePattern(quote) {
    const words = String(quote).replace(/["'“”‘’`_*]/g, ' ').split(/\s+/).filter(Boolean).map(escapeRe);
    return words.length ? words.join('[\\s"\'“”‘’`_*]+') : '';
  }

  function findPattern(q) {
    const words = q.trim().split(/\s+/).filter(Boolean).map(escapeRe);
    return q.trim().length >= 2 ? words.join('\\s+') : '';
  }

  function buildSegments(source, pattern) {
    if (!source) return [];
    if (!pattern) return [{ t: source, hit: false }];
    const out = [];
    let last = 0;
    let n = 0;
    for (const m of source.matchAll(new RegExp(pattern, 'gi'))) {
      if (!m[0].length) continue;
      if (m.index > last) out.push({ t: source.slice(last, m.index), hit: false });
      out.push({ t: m[0], hit: true });
      last = m.index + m[0].length;
      if (++n >= 300) break;
    }
    if (last < source.length) out.push({ t: source.slice(last), hit: false });
    return out;
  }

  $: citeActive = !!(highlight && activeDoc && highlight.docId === activeDoc.id && highlight.quote);
  $: pattern = citeActive && highlight ? quotePattern(highlight.quote) : findPattern(find);
  $: segments = buildSegments(text, pattern);
  $: hits = segments.filter(s => s.hit).length;
  $: if (citeActive && segments.length) scrollToHit();

  async function scrollToHit() {
    await tick();
    viewer?.querySelector('mark')?.scrollIntoView({ block: 'center' });
  }

  /** @param {Event} e */
  function onChangeType(e) {
    const value = /** @type {HTMLSelectElement} */ (e.target).value;
    if (value && activeDoc) dispatch('confirm', { doc: activeDoc, type: value });
  }

  function pick(files) {
    const list = Array.from(files ?? []);
    if (list.length) dispatch('upload', list);
  }

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    pick(e.dataTransfer?.files);
  }

  function onBrowse(e) {
    pick(e.target.files);
    e.target.value = '';
  }

  const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const fmtSize = n => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`) + ' characters';
</script>

<div class="viewer" class:drag={dragOver} on:dragover|preventDefault={() => (dragOver = true)} on:dragleave={() => (dragOver = false)} on:drop={onDrop} role="region" aria-label="Scheme documents">
  <div class="v-head">
    <div class="v-title">{scheme.description || '(No description)'}</div>
    <div class="v-meta">
      {#if scheme.address}<span>{scheme.address}</span>{/if}
      {#if scheme.decided_date}<span>Decided {fmtDate(scheme.decided_date)}</span>{:else if scheme.start_date}<span>Submitted {fmtDate(scheme.start_date)}</span>{/if}
      {#if scheme.app_state}<span class="v-state">{scheme.app_state}</span>{/if}
      {#if scheme.url && safeUrl(scheme.url)}
        <a href={safeUrl(scheme.url)} target="_blank" rel="noopener noreferrer">Council site <i class="las la-external-link-alt"></i></a>
      {/if}
      <button class="link danger" on:click={() => dispatch('removeScheme')}>Remove scheme</button>
    </div>
  </div>

  <div class="v-tabs">
    {#each docs as d (d.id)}
      <button class="tab" class:on={activeDoc && activeDoc.id === d.id} on:click={() => { activeDocId = d.id; dispatch('select', d.id); }} title={d.filename}>
        {labelOf(d.doc_type)}{#if !d.type_confirmed}<span class="unconfirmed" title="Suggested type: please confirm">?</span>{/if}
      </button>
    {/each}
    <span class="spacer"></span>
    <button class="btn-add" on:click={() => fileInput.click()}><i class="las la-upload"></i> Add document</button>
    <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt,.md" multiple hidden on:change={onBrowse} />
  </div>

  {#if uploading.length}
    <div class="notice"><span class="spinner"></span> Reading {uploading.join(', ')}…</div>
  {/if}
  {#if uploadError}<div class="notice error">{uploadError}</div>{/if}

  {#if activeDoc}
    {#if !activeDoc.type_confirmed}
      <div class="suggest">
        <span>Looks like a <strong>{labelOf(activeDoc.doc_type)}</strong>.</span>
        <button class="btn-accept" on:click={() => dispatch('confirm', { doc: activeDoc, type: activeDoc.doc_type })}>Yes, that's right</button>
        <label class="change">
          or change to
          <select on:change={onChangeType}>
            <option value="" selected disabled>Choose…</option>
            {#each TYPES.filter(t => t.value !== activeDoc.doc_type) as t}<option value={t.value}>{t.label}</option>{/each}
          </select>
        </label>
      </div>
    {/if}
    <div class="v-bar">
      <span class="file">{activeDoc.filename} · {fmtSize(activeDoc.char_count)} · text saved</span>
      {#if citeActive}
        <button class="link" on:click={() => dispatch('clearHighlight')}>Clear highlight</button>
      {:else if hits}
        <span class="file">{hits} match{hits === 1 ? '' : 'es'}</span>
      {/if}
      <input class="find" type="search" placeholder="Find in document" bind:value={find} aria-label="Find in document" />
      <button class="link danger" on:click={() => dispatch('removeDoc', activeDoc)}>Delete</button>
    </div>
    {#if activeDoc.parse_warning}<div class="notice">{activeDoc.parse_warning}</div>{/if}
    <div class="v-text" bind:this={viewer}>
      {#if loadingText}
        <div class="muted"><span class="spinner"></span> Loading…</div>
      {:else if textError}
        <div class="notice error">{textError}</div>
      {:else}
        <pre>{#each segments as seg}{#if seg.hit}<mark>{seg.t}</mark>{:else}{seg.t}{/if}{/each}</pre>
      {/if}
    </div>
  {:else}
    <div class="empty">
      <i class="las la-cloud-upload-alt"></i>
      <p><strong>No documents for this scheme yet.</strong></p>
      <p>Drop decision notices, officer reports or consultee responses here (PDF, Word, .txt or .md), or use Add document. The text is saved to this scheme and the AI suggests what each one is.</p>
    </div>
  {/if}

  {#if dragOver}<div class="drop-overlay">Drop to add to this scheme</div>{/if}
</div>

<style>
  .viewer { position: relative; display: flex; flex-direction: column; min-height: 0; height: 100%; background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; overflow: hidden; }
  .viewer.drag { border-color: var(--color-purple-600); }
  .drop-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--color-purple-50); color: var(--color-purple-700); font-weight: 600; opacity: 0.94; pointer-events: none; }

  .v-head { padding: 12px 16px 6px; display: flex; flex-direction: column; gap: 4px; }
  .v-title { font-size: 0.9rem; font-weight: 700; color: var(--color-slate-900); line-height: 1.4; }
  .v-meta { display: flex; flex-wrap: wrap; gap: 0.25rem 0.9rem; align-items: center; font-size: 0.75rem; color: var(--color-slate-500); }
  .v-meta a { color: var(--color-purple-600); text-decoration: none; }
  .v-state { font-weight: 700; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.03em; background: var(--color-slate-100); color: var(--color-slate-600); padding: 0.1rem 0.5rem; border-radius: 20px; }

  .v-tabs { display: flex; align-items: center; gap: 2px; border-bottom: 1px solid var(--color-slate-200); padding: 0 8px; overflow-x: auto; }
  .tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.55rem 0.8rem; font: inherit; font-size: 0.8rem; color: var(--color-slate-500); cursor: pointer; white-space: nowrap; }
  .tab.on { color: var(--color-purple-700); font-weight: 600; border-bottom-color: var(--color-purple-600); }
  .unconfirmed { margin-left: 0.35rem; display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; border-radius: 50%; background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); font-size: 0.65rem; font-weight: 700; }
  .spacer { flex: 1; }
  .btn-add { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.7rem; border: 1px solid var(--color-slate-200); border-radius: 7px; background: var(--color-white); font: inherit; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-700); cursor: pointer; white-space: nowrap; }
  .btn-add:hover { border-color: var(--color-purple-600); color: var(--color-purple-700); }

  .suggest { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.55rem 1rem; background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); font-size: 0.8rem; border-bottom: 1px solid var(--color-amber-200); }
  .btn-accept { padding: 0.2rem 0.7rem; border: 1px solid var(--color-badge-warning-fg); border-radius: 20px; background: var(--color-white); color: var(--color-badge-warning-fg); font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
  .change { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; }
  .change select { font: inherit; font-size: 0.75rem; padding: 0.15rem 0.4rem; border: 1px solid var(--color-slate-200); border-radius: 6px; background: var(--color-white); color: var(--color-slate-700); }

  .v-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 1rem; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-200); }
  .file { font-size: 0.75rem; color: var(--color-slate-500); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .find { width: 11rem; padding: 0.25rem 0.6rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font: inherit; font-size: 0.75rem; color: var(--color-slate-800); }
  .find:focus { outline: none; border-color: var(--color-purple-600); }

  .v-text { flex: 1; min-height: 0; overflow-y: auto; padding: 1rem 1.25rem; }
  .v-text pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 0.84rem; line-height: 1.65; color: var(--color-slate-700); }
  .v-text mark { background: var(--color-amber-200); color: inherit; border-radius: 3px; padding: 0 1px; }

  .link { background: none; border: none; padding: 0; font: inherit; font-size: 0.75rem; color: var(--color-purple-600); cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .link.danger { color: var(--color-red-800); }

  .notice { margin: 0.5rem 1rem 0; padding: 0.45rem 0.7rem; border-radius: 6px; background: var(--color-slate-50); color: var(--color-slate-600); font-size: 0.78rem; display: flex; align-items: center; gap: 0.5rem; }
  .notice.error { background: var(--color-red-100); color: var(--color-red-800); }
  .muted { display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); font-size: 0.8rem; }

  .empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; padding: 2rem; text-align: center; color: var(--color-slate-500); }
  .empty i { font-size: 2.2rem; color: var(--color-purple-600); }
  .empty p { margin: 0; font-size: 0.85rem; max-width: 380px; line-height: 1.5; }

  .spinner { width: 0.85rem; height: 0.85rem; border: 2px solid var(--color-slate-200); border-top-color: var(--color-purple-600); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
