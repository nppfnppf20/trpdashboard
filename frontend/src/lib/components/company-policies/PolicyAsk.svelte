<script>
  import { tick, createEventDispatcher } from 'svelte';
  import { askCompanyPolicies } from '$lib/api/companyPolicies.js';
  import { folderOptions } from '$lib/utils/policyFolders.js';

  /** False while nothing is indexed yet, to explain why asking won't work. */
  export let ready = true;
  /** Flat folder rows, for the "searching in" picker. @type {any[]} */
  export let folders = [];
  /** Limit the search to this folder and what is inside it; null searches everything. @type {number | null} */
  export let scopeFolderId = null;

  $: scopeOptions = folderOptions(folders);
  $: scopeName = folders.find(f => f.id === scopeFolderId)?.name ?? null;

  const dispatch = createEventDispatcher();

  let question = '';
  let asking = false;
  /** @type {{ question: string, answer: string | null, sources: any[], error: string | null, done: boolean }[]} */
  let turns = [];
  let threadEl;
  let inputEl;
  let stickToBottom = true;

  const MAX_HISTORY_TURNS = 4;
  const strip = (text) => text.replace(/ *\[\d+\]/g, '');

  async function ask() {
    const q = question.trim();
    if (!q || asking || !ready) return;

    // Earlier turns give follow-ups ("what about part-timers?") their context.
    const history = turns
      .filter(t => t.done)
      .slice(-MAX_HISTORY_TURNS)
      .flatMap(t => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.answer ?? '' }
      ]);

    // answer stays null while searching, fills in as the reply streams, and done flips when it is complete
    /** @type {{ question: string, answer: string | null, sources: any[], error: string | null, done: boolean }} */
    const turn = { question: q, answer: null, sources: [], error: null, done: false };
    turns = [...turns, turn];
    question = '';
    resizeInput();
    asking = true;
    stickToBottom = true;
    await scrollToEnd();
    try {
      const result = await askCompanyPolicies(q, history, {
        folderId: scopeFolderId,
        onDelta: (text) => {
          turn.answer = (turn.answer ?? '') + text;
          turns = turns;
          scrollToEnd();
        }
      });
      // The final answer is the cleaned version of what streamed in
      turn.answer = result.answer;
      turn.sources = result.sources;
      turn.done = true;
    } catch (err) {
      turn.error = err.message;
    } finally {
      turns = turns;
      asking = false;
      await scrollToEnd();
      inputEl?.focus();
    }
  }

  async function scrollToEnd() {
    await tick();
    if (threadEl && stickToBottom) threadEl.scrollTop = threadEl.scrollHeight;
  }

  // Follow the answer as it streams, unless the reader has scrolled up to re-read something
  function onThreadScroll() {
    stickToBottom = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight < 80;
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ask();
    }
  }

  // The input grows with its text, up to a few lines
  function resizeInput() {
    tick().then(() => {
      if (!inputEl) return;
      inputEl.style.height = 'auto';
      inputEl.style.height = `${Math.min(inputEl.scrollHeight, 128)}px`;
    });
  }

  // Answer text -> paragraphs and "- " bullet lists.
  function parseAnswer(text) {
    const blocks = [];
    for (const raw of text.split(/\n{2,}/)) {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      const bullets = lines.filter(l => /^[-•]\s+/.test(l));
      if (bullets.length === lines.length) {
        blocks.push({ kind: 'ul', items: lines.map(l => clean(l.replace(/^[-•]\s+/, ''))) });
      } else {
        blocks.push({ kind: 'p', text: clean(lines.join(' ')) });
      }
    }
    return blocks;
  }

  const clean = (line) => strip(line).replace(/\*\*/g, '');

  function pages(s) {
    if (s.page_start == null) return '';
    return s.page_end && s.page_end !== s.page_start ? `pages ${s.page_start}-${s.page_end}` : `page ${s.page_start}`;
  }

  // The page opens the document viewer, scrolled to and highlighting the cited section.
  function openSource(s) {
    dispatch('view', { documentId: s.document_id, chunkIndex: s.chunk_index, page: s.page_start });
  }

  function clearThread() {
    turns = [];
    stickToBottom = true;
  }
</script>

<section class="card ask-panel" aria-label="Ask the policies">
  <div class="ask-head">
    <h2 class="ask-title"><i class="las la-comments"></i> Ask the policies</h2>
    <div class="ask-tools">
      <label class="scope">
        <span class="scope-label">Searching</span>
        <select class="form-input scope-select" bind:value={scopeFolderId} disabled={asking} aria-label="Folder to search">
          <option value={null}>All documents</option>
          {#each scopeOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
        </select>
      </label>
      {#if turns.length}
        <button class="btn btn-ghost btn-sm" on:click={clearThread} disabled={asking}><i class="las la-eraser"></i> Clear</button>
      {/if}
    </div>
  </div>

  <div class="thread" bind:this={threadEl} on:scroll={onThreadScroll} aria-live="polite">
    {#if turns.length}
      {#each turns as t}
        <div class="turn">
          <div class="q">{t.question}</div>

          {#if t.error}
            <div class="a a-error">{t.error}</div>
          {:else if t.answer === null}
            <div class="a a-pending"><span class="spinner"></span> Searching the policies…</div>
          {:else}
            <div class="a" class:streaming={!t.done}>
              {#each parseAnswer(t.answer) as block}
                {#if block.kind === 'ul'}
                  <ul>
                    {#each block.items as item}<li>{item}</li>{/each}
                  </ul>
                {:else}
                  <p>{block.text}</p>
                {/if}
              {/each}
            </div>

            {#if t.done && t.sources.length}
              <details class="sources">
                <summary>
                  <i class="las la-angle-right chevron"></i>
                  <i class="las la-file-alt"></i>
                  {t.sources.length} source{t.sources.length > 1 ? 's' : ''}
                </summary>
                <div class="source-list">
                  {#each t.sources as s}
                    <div class="source">
                      <button class="source-link" on:click={() => openSource(s)} title="View the full document">
                        {s.title} <i class="las la-external-link-alt"></i>
                      </button>
                      <div class="source-meta">{s.section_path}{pages(s) ? ` · ${pages(s)}` : ''}</div>
                      <details class="passage">
                        <summary>Show passage</summary>
                        <p class="excerpt">{s.excerpt}</p>
                      </details>
                    </div>
                  {/each}
                </div>
              </details>
            {/if}
          {/if}
        </div>
      {/each}
    {:else}
      <div class="empty">
        <i class="las la-comment-dots empty-icon"></i>
        {#if ready}
          <p class="empty-title">Ask anything about {scopeName ? `the ${scopeName} folder` : 'company policy'}</p>
          <p class="empty-hint">For example, "How many days of leave can I carry over?" Each answer shows which policy it came from.</p>
        {:else}
          <p class="empty-title">Nothing to search yet</p>
          <p class="empty-hint">
            {scopeName ? `There are no indexed policies in ${scopeName}. Choose another folder, or search all documents.` : 'Upload a policy and wait for it to show as Ready, then ask your question here.'}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="composer">
    <div class="ask-row">
      <textarea
        class="form-input"
        rows="1"
        bind:this={inputEl}
        bind:value={question}
        on:keydown={onKeydown}
        on:input={resizeInput}
        aria-label="Ask a question about company policy"
        placeholder="Ask a question about company policy…"
        disabled={asking || !ready}
      ></textarea>
      <button class="btn btn-primary send" on:click={ask} disabled={asking || !question.trim() || !ready} aria-label="Ask">
        <i class="las la-paper-plane"></i> Ask
      </button>
    </div>
    <div class="composer-hint">Enter to send, Shift+Enter for a new line</div>
  </div>
</section>

<style>
  .ask-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
  .ask-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.125rem;
    border-bottom: 1px solid var(--color-slate-100);
    flex-shrink: 0;
  }
  .ask-title { margin: 0; font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.5rem; }
  .ask-title i { color: var(--color-primary-600); }
  .ask-tools { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
  .scope { display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
  .scope-label { font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-500); text-transform: uppercase; letter-spacing: 0.04em; }
  .scope-select { width: auto; max-width: 14rem; padding: 0.3125rem 0.5rem; font-size: 0.75rem; }

  .thread {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.125rem 1.375rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .turn { display: flex; flex-direction: column; gap: 0.625rem; }
  .q {
    align-self: flex-end;
    max-width: 80%;
    background: var(--color-primary-50);
    color: var(--color-slate-800);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
  }
  .a { font-size: 0.875rem; color: var(--color-slate-700); line-height: 1.65; }
  .a p { margin: 0 0 0.625rem; }
  .a p:last-child { margin-bottom: 0; }
  .a ul { margin: 0 0 0.625rem 1.25rem; padding: 0; }
  .a li { margin-bottom: 0.25rem; }
  .a-pending { display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); }
  .a-error { color: var(--color-red-600); background: var(--color-red-50); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; }

  .a.streaming > :last-child::after {
    content: '';
    display: inline-block;
    width: 0.4375rem;
    height: 0.9em;
    margin-left: 0.1875rem;
    vertical-align: -0.1em;
    background: var(--color-slate-400);
    border-radius: 1px;
    animation: ask-caret 1s steps(2, start) infinite;
  }
  @keyframes ask-caret { to { visibility: hidden; } }

  /* ── Sources: collapsed until clicked ── */
  .sources { font-size: 0.8125rem; }
  .sources > summary {
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem 0.25rem 0.375rem;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-pill);
    background: var(--color-slate-50);
    color: var(--color-slate-600);
    font-weight: 600;
    font-size: 0.75rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s, border-color 0.15s;
  }
  .sources > summary::-webkit-details-marker { display: none; }
  .sources > summary:hover { background: var(--color-slate-100); border-color: var(--color-slate-300); }
  .sources > summary:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 2px; }
  .chevron { font-size: 0.75rem; transition: transform 0.15s; }
  .sources[open] > summary .chevron { transform: rotate(90deg); }

  .source-list { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.625rem; padding-left: 0.25rem; }
  .source { border-left: 2px solid var(--color-slate-200); padding-left: 0.75rem; min-width: 0; }
  .source-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-primary-600);
    cursor: pointer;
    text-align: left;
  }
  .source-link:hover { color: var(--color-primary-700); text-decoration: underline; }
  .source-meta { font-size: 0.75rem; color: var(--color-slate-500); }
  .passage > summary { font-size: 0.75rem; color: var(--color-slate-500); cursor: pointer; margin-top: 0.125rem; width: fit-content; }
  .excerpt { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--color-slate-600); line-height: 1.5; white-space: pre-wrap; background: var(--color-slate-50); border-radius: var(--radius-sm); padding: 0.5rem 0.625rem; }

  /* ── Empty state ── */
  .empty { margin: auto; text-align: center; max-width: 24rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 1rem; }
  .empty-icon { font-size: 2.5rem; color: var(--color-slate-300); }
  .empty-title { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--color-slate-700); }
  .empty-hint { margin: 0; font-size: 0.8125rem; color: var(--color-slate-500); line-height: 1.5; }

  /* ── Composer, pinned to the bottom ── */
  .composer { flex-shrink: 0; padding: 0.875rem 1.125rem 0.75rem; border-top: 1px solid var(--color-slate-100); background: var(--color-white); }
  .ask-row { display: flex; gap: 0.5rem; align-items: flex-end; }
  .ask-row textarea { flex: 1; min-height: 2.5rem; max-height: 8rem; resize: none; line-height: 1.5; }
  .send { height: 2.5rem; }
  .composer-hint { margin-top: 0.375rem; font-size: 0.6875rem; color: var(--color-slate-500); }
</style>
