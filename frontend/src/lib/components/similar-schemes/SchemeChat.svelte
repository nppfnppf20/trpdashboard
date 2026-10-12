<script>
  // The right column of the saved-schemes workspace: ask questions of the ticked schemes' documents, framed by the
  // project's own sources (chosen with the same Sources popover as the Overview Project Chat). Answers carry citations
  // that open the passage in the viewer.
  import { createEventDispatcher } from 'svelte';
  import { askSchemeDocuments } from '$lib/api/planit.js';
  import { escapeHtml } from '$lib/utils/chatMarkdown.js';
  import SchemeSources from './SchemeSources.svelte';

  export let projectId;
  export let names = []; // ticked scheme names
  export let docs = []; // metadata of every uploaded document
  export let schemeLabels = {}; // name -> short description
  export let policies = []; // the project's relevant policies, to choose from individually
  export let messages = []; // bound to the session: { role, content, citations? }
  export let sources; // bound: { project_details, groups, meeting_ids, policy_ids }

  const dispatch = createEventDispatcher();

  const DOC_BUDGET_CHARS = 600000; // matches the server limit
  const STARTERS = [
    'Across these, how is the key policy being interpreted?',
    'How did each weigh the harms against the benefits?',
    'Which is closest to our scheme, and why?'
  ];

  let input = '';
  let sending = false;
  let error = '';
  let listEl;
  let contextPct = 0;

  $: tickedDocs = docs.filter(d => names.includes(d.planit_name));
  $: docChars = tickedDocs.reduce((n, d) => n + d.char_count, 0);
  $: tooBig = docChars > DOC_BUDGET_CHARS;
  $: canAsk = !sending && tickedDocs.length > 0 && !tooBig;
  $: tone = contextPct >= 85 ? 'high' : contextPct >= 60 ? 'mid' : 'low';

  function render(text, citations = []) {
    const known = new Set(citations.map(c => c.n));
    return escapeHtml(text)
      .replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\s*)[-*]\s+/gm, '$1&bull; ')
      .replace(/\[(\d+)\]/g, (m, n) => (known.has(Number(n)) ? `<sup class="cite">${n}</sup>` : m))
      .replace(/\n/g, '<br>');
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || !canAsk) return;
    error = '';
    input = '';
    messages = [...messages, { role: 'user', content: q }];
    sending = true;
    scroll();
    try {
      const out = await askSchemeDocuments(projectId, {
        names,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        sources: { project_details: sources.project_details, groups: sources.groups, meeting_ids: sources.meeting_ids, policy_ids: sources.policy_ids }
      });
      messages = [...messages, { role: 'assistant', content: out.reply, citations: out.citations ?? [], truncated: out.sourcesTruncated }];
    } catch (e) {
      error = e.message;
    } finally {
      sending = false;
      scroll();
    }
  }

  function newChat() {
    messages = [];
    error = '';
    input = '';
  }

  function scroll() {
    setTimeout(() => listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' }), 30);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="chat">
  <div class="c-head">
    <span class="c-title"><i class="las la-comment-dots"></i> Ask the documents</span>
    <div class="c-actions">
      {#if messages.length}<button class="link" on:click={newChat}>New chat</button>{/if}
      <SchemeSources {projectId} {policies} {docChars} bind:value={sources} bind:contextPct />
    </div>
  </div>

  <div class="c-context">
    <div class="reading">
      <strong>Reading:</strong>
      {#if names.length}{names.length} ticked scheme{names.length === 1 ? '' : 's'}, {tickedDocs.length} document{tickedDocs.length === 1 ? '' : 's'}{:else}no schemes ticked{/if}
    </div>
    <div class="meter-row">
      <div class="track"><div class="fill fill--{tone}" style="width:{contextPct}%"></div></div>
      <span class="hint">{contextPct}% of context</span>
    </div>
    {#if tooBig}<div class="warn">Too much text ticked to read together. Untick a scheme.</div>{/if}
  </div>

  <div class="c-list" bind:this={listEl}>
    {#if !messages.length}
      <div class="starters">
        <p class="hint">Tick schemes on the left, choose project sources with the Sources button, then ask.</p>
        {#each STARTERS as s}
          <button class="starter" disabled={!canAsk} on:click={() => send(s)}>{s}</button>
        {/each}
      </div>
    {/if}
    {#each messages as m}
      {#if m.role === 'user'}
        <div class="bubble user">{m.content}</div>
      {:else}
        <div class="bubble bot">
          <div class="reply">{@html render(m.content, m.citations)}</div>
          {#if m.truncated}<div class="hint">Some project sources were cut short to fit.</div>{/if}
          {#if m.citations?.length}
            <div class="cites">
              {#each m.citations as c (c.n)}
                <div class="cite-row">
                  <span class="cite-n">{c.n}</span>
                  <div class="cite-body">
                    <div class="cite-src">{schemeLabels[c.scheme] ?? c.scheme} · {c.type}{c.para ? ` · ${c.para}` : ''}</div>
                    {#if c.verified}<div class="cite-quote">"{c.quote}"</div>{:else}<div class="hint">Quote could not be verified in the document.</div>{/if}
                    <button class="link" on:click={() => dispatch('cite', { doc: c.doc, scheme: c.scheme, quote: c.verified ? c.quote : '' })}>Open in document</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
    {#if sending}<div class="bubble bot"><span class="spinner"></span> Reading the documents…</div>{/if}
    {#if error}<div class="err">{error}</div>{/if}
  </div>

  <div class="c-input">
    <textarea rows="2" placeholder={tickedDocs.length ? 'Ask a question about the ticked schemes' : 'Tick a scheme with documents to ask about'} bind:value={input} on:keydown={onKey} disabled={!canAsk && !input}></textarea>
    <button class="send" disabled={!canAsk || !input.trim()} on:click={() => send()}>Send</button>
  </div>
</div>

<style>
  .chat { display: flex; flex-direction: column; min-height: 0; height: 100%; background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; overflow: hidden; }
  .c-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.65rem 0.9rem; border-bottom: 1px solid var(--color-slate-200); }
  .c-title { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; font-weight: 700; color: var(--color-slate-800); }
  .c-actions { display: flex; align-items: center; gap: 0.75rem; }
  .c-context { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.55rem 0.9rem; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-200); }
  .reading { font-size: 0.78rem; color: var(--color-slate-600); }
  .meter-row { display: flex; align-items: center; gap: 0.6rem; }
  .track { flex: 1; height: 5px; background: var(--color-slate-200); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; transition: width 0.2s; }
  .fill--low { background: var(--color-emerald-600); }
  .fill--mid { background: var(--color-amber-600); }
  .fill--high { background: var(--color-red-600); }
  .hint { font-size: 0.73rem; color: var(--color-slate-500); line-height: 1.45; margin: 0; }
  .warn { font-size: 0.75rem; color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); padding: 0.3rem 0.6rem; border-radius: 6px; }

  .c-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0.9rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .starters { display: flex; flex-direction: column; gap: 0.4rem; }
  .starter { text-align: left; padding: 0.45rem 0.7rem; border: 1px solid var(--color-slate-200); border-radius: 8px; background: var(--color-white); font: inherit; font-size: 0.8rem; color: var(--color-slate-700); cursor: pointer; }
  .starter:hover:not(:disabled) { border-color: var(--color-purple-600); color: var(--color-purple-700); }
  .starter:disabled { opacity: 0.5; cursor: not-allowed; }

  .bubble { max-width: 94%; padding: 0.55rem 0.8rem; border-radius: 12px; font-size: 0.82rem; line-height: 1.55; }
  .bubble.user { align-self: flex-end; background: var(--color-purple-600); color: var(--color-white); border-bottom-right-radius: 2px; max-width: 86%; }
  .bubble.bot { align-self: flex-start; background: var(--color-slate-50); border: 1px solid var(--color-slate-200); color: var(--color-slate-800); border-bottom-left-radius: 2px; display: flex; flex-direction: column; gap: 0.5rem; }
  .reply :global(.cite) { font-size: 0.62rem; font-weight: 700; color: var(--color-purple-700); }

  .cites { border-top: 1px solid var(--color-slate-200); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .cite-row { display: flex; gap: 0.5rem; }
  .cite-n { font-size: 0.7rem; font-weight: 700; color: var(--color-purple-700); width: 1rem; flex-shrink: 0; }
  .cite-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  .cite-src { font-size: 0.72rem; font-weight: 600; color: var(--color-slate-600); }
  .cite-quote { font-size: 0.75rem; font-style: italic; color: var(--color-slate-600); border-left: 3px solid var(--color-violet-100); padding-left: 0.5rem; }

  .link { background: none; border: none; padding: 0; font: inherit; font-size: 0.72rem; color: var(--color-purple-600); cursor: pointer; width: fit-content; }
  .link:hover { text-decoration: underline; }
  .err { font-size: 0.78rem; padding: 0.4rem 0.7rem; border-radius: 6px; background: var(--color-badge-danger-bg); color: var(--color-badge-danger-fg); }

  .c-input { display: flex; gap: 0.5rem; padding: 0.6rem 0.9rem 0.9rem; border-top: 1px solid var(--color-slate-200); }
  .c-input textarea { flex: 1; resize: none; padding: 0.5rem 0.65rem; border: 1px solid var(--color-slate-200); border-radius: 8px; font: inherit; font-size: 0.82rem; color: var(--color-slate-800); }
  .c-input textarea:focus { outline: none; border-color: var(--color-purple-600); }
  .send { padding: 0 1rem; border: none; border-radius: 8px; background: var(--color-purple-600); color: var(--color-white); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  .send:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner { width: 0.85rem; height: 0.85rem; border: 2px solid var(--color-slate-200); border-top-color: var(--color-purple-600); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; margin-right: 0.4rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
