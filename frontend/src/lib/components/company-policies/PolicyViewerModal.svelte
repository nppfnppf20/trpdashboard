<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { getCompanyPolicyContent, getCompanyPolicyFileUrl } from '$lib/api/companyPolicies.js';

  /** Id of the policy to show. */
  export let documentId;
  /** Optional chunk_index to scroll to and highlight when the reader opens (e.g. from an answer's source).
   *  @type {number | null} */
  export let focusChunk = null;
  /** PDF page for the Original tab to open at.
   *  @type {number | null} */
  export let focusPage = null;

  const dispatch = createEventDispatcher();

  /** @type {any} */
  let doc = null;
  /** @type {any[]} */
  let sections = [];
  let loading = true;
  let error = null;
  let tab = 'reader'; // 'reader' | 'original'
  let originalUrl = null;
  let originalError = null;
  let originalLoading = false;
  let readerEl;

  const STATUS_LABEL = { uploaded: 'Awaiting indexing', processing: 'Processing', ready: 'Ready', failed: 'Failed' };
  const BULLET_RE = /^([•▪●○◦‣·\-–—*])\s+/;

  onMount(async () => {
    try {
      const result = await getCompanyPolicyContent(documentId);
      doc = result.document;
      sections = result.sections;
      // Not indexed yet (or failed): the reader has nothing to show, so go straight to the original
      if (!sections.length) await selectTab('original');
      else if (focusChunk != null) {
        await tick();
        scrollToFocus();
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  async function scrollToFocus() {
    await tick();
    readerEl?.querySelector(`[data-chunk="${focusChunk}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  const isPdf = () => doc?.mime_type === 'application/pdf';

  async function selectTab(next) {
    tab = next;
    if (next === 'original' && !originalUrl && isPdf()) {
      originalLoading = true;
      originalError = null;
      try {
        originalUrl = await getCompanyPolicyFileUrl(documentId, { inline: true });
      } catch (err) {
        originalError = err.message;
      } finally {
        originalLoading = false;
      }
    }
  }

  async function download() {
    try {
      window.open(await getCompanyPolicyFileUrl(documentId), '_blank', 'noopener');
    } catch (err) {
      originalError = err.message;
    }
  }

  // The indexed sections, in order, as renderable blocks: a heading wherever the section changes,
  // then paragraphs, with runs of bullet lines grouped into one list.
  $: blocks = buildBlocks(sections);

  function buildBlocks(list) {
    /** @type {any[]} */
    const out = [];
    // The cover details (author, approver, review dates) are metadata, so they go after the policy text,
    // all together in one box
    /** @type {string[]} */
    const infoLines = [];
    let infoChunk = null;
    let lastPath = null;
    /** @type {string[]} */
    let lastParts = [];
    for (const s of list) {
      const isInfo = s.section_path === 'Document information';
      const parts = s.section_path.split(' > ');
      if (isInfo) {
        infoChunk ??= s.chunk_index;
        infoLines.push(...s.content.split(/\n{2,}/).map(p => p.trim()).filter(Boolean));
        continue;
      }
      if (s.section_path !== lastPath) {
        // A parent section with no text of its own ("2. Responsibilities" above "2.1 ...") has no
        // chunk, so its heading is added here, from wherever this path first differs from the last.
        let common = 0;
        while (common < parts.length - 1 && parts[common] === lastParts[common]) common++;
        for (let i = common; i < parts.length; i++) {
          out.push({ kind: 'heading', depth: Math.min(i + 1, 3), text: parts[i], chunk: i === parts.length - 1 ? s.chunk_index : null });
        }
        lastPath = s.section_path;
        lastParts = parts;
      }
      /** @type {any} */
      let list_ = null;
      for (const para of s.content.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)) {
        if (BULLET_RE.test(para)) {
          if (!list_) {
            list_ = { kind: 'list', items: [], chunk: s.chunk_index };
            out.push(list_);
          }
          list_.items.push(para.replace(BULLET_RE, ''));
        } else {
          list_ = null;
          out.push({ kind: 'para', text: para, chunk: s.chunk_index });
        }
      }
    }
    if (infoLines.length) {
      out.push({ kind: 'info-heading', chunk: infoChunk }, { kind: 'info', text: infoLines.join('\n'), chunk: infoChunk });
    }
    return out;
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="modal-backdrop" role="presentation" on:click|self={() => dispatch('close')}>
  <div class="viewer" role="dialog" aria-modal="true" aria-label={doc?.title || 'Policy'}>
    <div class="viewer-header">
      <div class="viewer-heading">
        <h2>{doc?.title || 'Loading…'}</h2>
        {#if doc}
          <div class="viewer-meta">
            <span>{doc.category}</span>
            <span>Version {doc.version}</span>
            {#if fmtDate(doc.effective_date)}<span>Effective {fmtDate(doc.effective_date)}</span>{/if}
            {#if !doc.is_current}<span class="badge badge-neutral">Superseded</span>{/if}
            {#if doc.status !== 'ready'}<span class="badge badge-warning">{STATUS_LABEL[doc.status] || doc.status}</span>{/if}
          </div>
        {/if}
      </div>
      <div class="viewer-actions">
        {#if doc}
          <button class="btn btn-secondary btn-sm" on:click={download}><i class="las la-download"></i> Download</button>
        {/if}
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close"><i class="las la-times"></i></button>
      </div>
    </div>

    {#if doc}
      <div class="viewer-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'reader'} class:active={tab === 'reader'} disabled={!sections.length} on:click={() => selectTab('reader')}>
          <i class="las la-align-left"></i> Reader
        </button>
        <button role="tab" aria-selected={tab === 'original'} class:active={tab === 'original'} on:click={() => selectTab('original')}>
          <i class="las la-file-pdf"></i> Original
        </button>
      </div>
    {/if}

    <div class="viewer-body">
      {#if loading}
        <div class="loading-state">Loading…</div>
      {:else if error}
        <div class="viewer-error">{error}</div>
      {:else if tab === 'reader'}
        <article class="reader" bind:this={readerEl}>
          {#each blocks as b}
            {#if b.kind === 'heading'}
              <svelte:element this={b.depth === 1 ? 'h3' : 'h4'} class="rh rh-{b.depth}" class:focused={focusChunk != null && focusChunk === b.chunk} data-chunk={b.chunk}>{b.text}</svelte:element>
            {:else if b.kind === 'info-heading'}
              <div class="info-label" data-chunk={b.chunk}>Document information</div>
            {:else if b.kind === 'info'}
              <p class="info">{b.text}</p>
            {:else if b.kind === 'list'}
              <ul class:focused={focusChunk === b.chunk} data-chunk={b.chunk}>
                {#each b.items as item}<li>{item}</li>{/each}
              </ul>
            {:else}
              <p class:focused={focusChunk === b.chunk} data-chunk={b.chunk}>{b.text}</p>
            {/if}
          {/each}
          <p class="reader-note">
            This is the text of the policy as indexed, laid out for reading. Tables and images are not shown; use the Original tab for the exact document.
          </p>
        </article>
      {:else if originalLoading}
        <div class="loading-state">Loading…</div>
      {:else if originalError}
        <div class="viewer-error">{originalError}</div>
      {:else if isPdf() && originalUrl}
        <iframe class="original" title="{doc.title} (original)" src={focusPage != null ? `${originalUrl}#page=${focusPage}` : originalUrl}></iframe>
      {:else}
        <div class="no-preview">
          <i class="las la-file-word"></i>
          <p>Word documents can't be previewed in the browser.</p>
          <button class="btn btn-primary" on:click={download}><i class="las la-download"></i> Download {doc?.original_filename}</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .viewer {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 62rem;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-modal);
  }

  .viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem 1.5rem 0.875rem;
  }
  .viewer-heading { min-width: 0; }
  .viewer-heading h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--color-slate-900); letter-spacing: -0.01em; }
  .viewer-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.875rem; margin-top: 0.375rem; font-size: 0.75rem; color: var(--color-slate-500); }
  .viewer-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover { background: var(--color-slate-100); color: var(--color-slate-800); }

  .viewer-tabs { display: flex; gap: 0.25rem; padding: 0 1.5rem; border-bottom: 1px solid var(--color-slate-200); }
  .viewer-tabs button {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 0.5rem 0.875rem;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-500);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .viewer-tabs button:hover:not(:disabled) { color: var(--color-slate-800); }
  .viewer-tabs button.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }
  .viewer-tabs button:disabled { opacity: 0.4; cursor: not-allowed; }

  .viewer-body { flex: 1; min-height: 0; overflow-y: auto; background: var(--color-slate-50); }
  .viewer-error { margin: 1.5rem; padding: 0.75rem 1rem; background: var(--color-red-50); color: var(--color-red-600); border-radius: var(--radius-md); font-size: 0.8125rem; }

  /* ── Reader: a document "page" on a grey desk ── */
  .reader {
    max-width: 44rem;
    margin: 1.5rem auto;
    padding: 2.5rem 3rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-subtle);
    color: var(--color-slate-700);
    font-size: 0.9375rem;
    line-height: 1.7;
  }
  .reader p { margin: 0 0 0.875rem; }
  .reader ul { margin: 0 0 0.875rem; padding-left: 1.375rem; }
  .reader li { margin-bottom: 0.375rem; padding-left: 0.25rem; }
  .reader li::marker { color: var(--color-primary-500); }

  .rh { color: var(--color-slate-900); font-weight: 700; letter-spacing: -0.01em; line-height: 1.35; }
  .rh-1 { font-size: 1.25rem; margin: 2rem 0 0.75rem; padding-bottom: 0.375rem; border-bottom: 1px solid var(--color-slate-200); }
  .rh-2, .rh-3 { font-size: 1.0625rem; margin: 1.5rem 0 0.5rem; color: var(--color-slate-800); }
  .reader > :first-child { margin-top: 0; }

  /* Document details sit at the end, set apart from the policy text */
  .info-label { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-500); margin: 2.25rem 0 0.375rem; }
  .info {
    font-size: 0.8125rem;
    color: var(--color-slate-600);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    margin-bottom: 0;
    white-space: pre-line;
  }

  .focused { background: var(--color-badge-warning-bg); box-shadow: -0.75rem 0 0 var(--color-badge-warning-bg), 0.75rem 0 0 var(--color-badge-warning-bg); border-radius: var(--radius-sm); }
  .reader-note { margin: 2.5rem 0 0; padding-top: 1rem; border-top: 1px solid var(--color-slate-200); font-size: 0.75rem; color: var(--color-slate-400); line-height: 1.5; }

  /* ── Original ── */
  .original { display: block; width: 100%; height: 100%; border: none; background: var(--color-slate-100); }
  .no-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; height: 100%; color: var(--color-slate-500); font-size: 0.875rem; }
  .no-preview i { font-size: 3rem; color: var(--color-slate-300); }
  .no-preview p { margin: 0; }

  @media (max-width: 700px) {
    .reader { padding: 1.5rem 1.25rem; margin: 0.75rem; }
  }
</style>
