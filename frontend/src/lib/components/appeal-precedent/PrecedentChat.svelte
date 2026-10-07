<script>
  import { safeUrl } from '$lib/utils/safeUrl.js';
  import { askAboutPrecedents } from '$lib/api/appealPrecedent.js';
  import { escapeHtml } from '$lib/utils/chatMarkdown.js';

  export let runId;
  export let projectId;
  export let projectName = '';
  export let records = []; // ticked records
  export let issues = []; // [{ label, weight }]
  export let messages = []; // bound to the session: { role, content, citations? }
  export let disabledReason = ''; // set while the search is still running

  const BUDGET_TOKENS = 175000; // matches the server limit
  const MAX_DECISIONS = 10;

  let input = '';
  let sending = false;
  let progress = ''; // e.g. "Reading batch 2 of 3..." while a batched question runs
  let error = '';
  let openCitations = new Set();
  let listEl;

  $: contextTokens = Math.round(records.reduce((n, r) => n + (r.chars ?? 0), 0) / 4);
  $: pct = Math.min(100, Math.round((contextTokens / BUDGET_TOKENS) * 100));
  $: batches = planBatches(records);
  $: batched = batches.length > 1;
  $: tooBig = records.some(r => (r.chars ?? 0) / 4 > BUDGET_TOKENS); // one decision alone can't fit
  $: meterTone = pct >= 85 ? 'high' : pct >= 60 ? 'mid' : 'low';
  $: primary = [...issues].sort((a, b) => b.weight - a.weight)[0]?.label;
  $: starters = [
    primary ? `How did the inspectors weigh ${primary} against the benefits of the scheme?` : 'How did the inspectors weigh the harms against the benefits?',
    primary ? `What level of harm and what weight was given to ${primary} in each decision?` : 'What level of harm and what weight was given to the main issue in each decision?',
    'Which of these is closest to our scheme, and why?',
    'What arguments would the Council be likely to make, based on these decisions?'
  ];
  $: canAsk = !disabledReason && records.length > 0 && !tooBig && !sending;

  // Split the ticked decisions into groups that each fit the context window (and the decision-count limit). The question
  // is asked of each group in turn and the answers are shown together, so ticking a lot just takes longer.
  function planBatches(recs) {
    const maxChars = BUDGET_TOKENS * 4 * 0.95; // a little headroom under the server limit
    const out = [];
    let cur = [];
    let chars = 0;
    for (const r of recs) {
      const c = r.chars ?? 0;
      if (cur.length && (cur.length >= MAX_DECISIONS || chars + c > maxChars)) {
        out.push(cur);
        cur = [];
        chars = 0;
      }
      cur.push(r);
      chars += c;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  // Number citations continuously across batches so [1] in part 2 doesn't clash with [1] in part 1.
  function shiftCitations(reply, citations, offset) {
    if (!offset) return { reply, citations };
    return {
      reply: reply.replace(/\[(\d+)\]/g, (m, n) => (citations.some(c => c.n === Number(n)) ? `[${Number(n) + offset}]` : m)),
      citations: citations.map(c => ({ ...c, n: c.n + offset }))
    };
  }

  function render(text, citations = []) {
    const known = new Set(citations.map(c => c.n));
    return escapeHtml(text)
      .replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\s*)[-*]\s+/gm, '$1&bull; ')
      .replace(/\[(\d+)\]/g, (m, n) => (known.has(Number(n)) ? `<sup class="cite">${n}</sup>` : m))
      .replace(/\n/g, '<br>');
  }

  function toggleCitations(idx) {
    const next = new Set(openCitations);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    openCitations = next;
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || !canAsk) return;
    error = '';
    input = '';
    messages = [...messages, { role: 'user', content: q }];
    sending = true;
    scroll();
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const parts = [];
    let citations = [];
    try {
      for (let i = 0; i < batches.length; i++) {
        progress = batched ? `Reading batch ${i + 1} of ${batches.length}...` : '';
        const out = await askAboutPrecedents(runId, { projectId, projectName, refs: batches[i].map(r => r.reference), messages: history });
        const shifted = shiftCitations(out.reply, out.citations ?? [], citations.length);
        citations = [...citations, ...shifted.citations];
        parts.push(batched ? `**Batch ${i + 1} of ${batches.length}: ${batches[i].map(r => r.lpa || r.reference).join(', ')}**

${shifted.reply}` : shifted.reply);
      }
    } catch (e) {
      error = parts.length ? `${e.message} Showing the ${parts.length} of ${batches.length} batches that finished.` : e.message;
    } finally {
      if (parts.length) messages = [...messages, { role: 'assistant', content: parts.join('\n\n'), citations }];
      progress = '';
      sending = false;
      scroll();
    }
  }

  function newChat() {
    messages = [];
    error = '';
    input = '';
    openCitations = new Set();
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

<div class="card chat">
  <div class="chat-head">
    <div class="title-row">
      <h3>Ask about the ticked decisions</h3>
      {#if messages.length}
        <button class="btn btn-ghost btn-sm" on:click={newChat} disabled={sending} title="Clear this conversation and start again">New chat</button>
      {/if}
    </div>
    <p class="sub">{records.length} ticked. Answers come only from the full text of these decisions, with a verified quote for every claim.</p>
    <div class="meter" title="Share of the context window the ticked decisions take up">
      <div class="meter-label">~{pct}% of context window used</div>
      <div class="meter-track"><div class="meter-fill {meterTone}" style="width:{pct}%"></div></div>
    </div>
    {#if batched}
      <p class="hint">Appeals will be read in {batches.length} batches. It might take a little longer.</p>
    {/if}
    {#if tooBig}<p class="warn">One of the ticked decisions is too long to read on its own. Untick it.</p>{/if}
  </div>

  <div class="list" bind:this={listEl}>
    {#if !messages.length}
      <p class="hint">
        {#if disabledReason}{disabledReason}
        {:else if !records.length}Tick one or more decisions on the left to start.
        {:else}The first question reads the full text of each ticked decision from Appealbase, which can take a few seconds. Try one of these:{/if}
      </p>
      {#if canAsk}
        <div class="starters">
          {#each starters as s}<button class="starter" on:click={() => send(s)}>{s}</button>{/each}
        </div>
      {/if}
    {/if}

    {#each messages as m, idx}
      <div class="msg {m.role}">
        {#if m.role === 'user'}
          <div class="bubble">{m.content}</div>
        {:else}
          <div class="bubble">
            {@html render(m.content, m.citations)}
            {#if m.citations?.length}
              <button class="cite-toggle" on:click={() => toggleCitations(idx)} aria-expanded={openCitations.has(idx)}>
                {m.citations.length} citation{m.citations.length === 1 ? '' : 's'} {openCitations.has(idx) ? '(hide)' : '(show)'}
              </button>
              {#if openCitations.has(idx)}
                <div class="citations">
                  {#each m.citations as c}
                    <div class="citation">
                      <div class="c-head">
                        <span class="c-n">{c.n}</span>
                        <a href={safeUrl(c.url)} target="_blank" rel="noopener">{c.lpa} {c.ref}</a>
                        {#if c.para}<span class="c-para">paragraph {c.para}</span>{/if}
                      </div>
                      {#if c.verified}
                        <div class="c-quote">&ldquo;{c.quote}&rdquo;</div>
                      {:else}
                        <div class="c-quote c-unverified">The quote for this point could not be verified against the decision text, so it is not shown.</div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    {#if sending}<div class="msg assistant"><div class="bubble typing">{progress || 'Reading the decisions...'}</div></div>{/if}
  </div>

  {#if error}<p class="warn err">{error}</p>{/if}

  <div class="composer">
    <textarea
      class="form-input"
      rows="2"
      bind:value={input}
      on:keydown={onKey}
      placeholder={disabledReason || (records.length ? 'Ask a question about the ticked decisions...' : 'Tick a decision first')}
      disabled={!!disabledReason || !records.length}
    ></textarea>
    <button class="btn btn-primary" on:click={() => send()} disabled={!canAsk || !input.trim()}>Send</button>
  </div>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-3);
    min-height: 420px;
    max-height: calc(100vh - 8rem);
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-slate-900);
  }

  .sub,
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    line-height: 1.45;
  }

  .meter {
    margin-top: var(--space-2);
  }

  .meter-label {
    font-size: 0.71875rem;
    color: var(--color-slate-500);
    margin-bottom: 0.2rem;
  }

  .meter-track {
    height: 5px;
    background: var(--color-slate-200);
    border-radius: 3px;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    background: var(--color-primary-600);
  }

  .meter-fill.mid {
    background: var(--color-amber-500);
  }

  .meter-fill.high {
    background: var(--color-red-600);
  }

  .warn {
    margin: var(--space-2) 0 0;
    font-size: 0.78125rem;
    color: var(--color-badge-warning-fg);
    background: var(--color-badge-warning-bg);
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius-md);
  }

  .warn.err {
    color: var(--color-badge-danger-fg);
    background: var(--color-badge-danger-bg);
    margin: 0;
  }

  .list {
    flex: 1;
    min-height: 140px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .starters {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .starter {
    text-align: left;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: 0.45rem 0.7rem;
    cursor: pointer;
  }

  .starter:hover {
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
  }

  .msg {
    display: flex;
  }

  .msg.user {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 94%;
    font-size: 0.84375rem;
    line-height: 1.55;
    color: var(--color-slate-800);
    padding: 0.55rem 0.8rem;
    border-radius: var(--radius-lg);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
  }

  .msg.user .bubble {
    background: var(--color-primary-50);
    border-color: var(--color-primary-200);
  }

  .typing {
    color: var(--color-slate-500);
    font-style: italic;
  }

  .bubble :global(.cite) {
    color: var(--color-primary-700);
    font-weight: 700;
    margin-left: 1px;
  }

  .cite-toggle {
    display: block;
    margin-top: 0.5rem;
    font: inherit;
    font-size: 0.75rem;
    color: var(--color-primary-700);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }

  .citations {
    margin-top: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .citation {
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    padding: 0.4rem 0.6rem;
    font-size: 0.78125rem;
  }

  .c-head {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    flex-wrap: wrap;
  }

  .c-n {
    font-weight: 700;
    color: var(--color-primary-700);
  }

  .c-head a {
    color: var(--color-primary-600);
  }

  .c-para {
    color: var(--color-slate-500);
  }

  .c-quote {
    margin-top: 0.25rem;
    font-style: italic;
    color: var(--color-slate-700);
  }

  .c-unverified {
    color: var(--color-slate-500);
  }

  .composer {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
  }

  .composer textarea {
    resize: none;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
</style>
