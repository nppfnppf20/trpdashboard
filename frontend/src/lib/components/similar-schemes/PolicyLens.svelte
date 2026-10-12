<script>
  // Policy lens: pick individual policies from the project, ask how they are interpreted, and see each ticked scheme
  // side by side (officer report, decision notice, consultees, weight given) with verified quotes.
  import { createEventDispatcher } from 'svelte';
  import { lensSchemeDocuments } from '$lib/api/planit.js';
  import PolicyPicker from './PolicyPicker.svelte';

  export let projectId;
  export let names = []; // ticked scheme names
  export let docs = []; // metadata of every uploaded document
  export let saved = []; // saved scheme snapshots
  export let policies = [];
  export let lens; // bound session state: { policyIds, question, result }

  const dispatch = createEventDispatcher();

  const COLUMNS = [
    { key: 'officer_report', label: 'Officer report', kinds: ['officer_report'], missing: 'No officer report uploaded' },
    { key: 'decision_notice', label: 'Decision notice', kinds: ['decision_notice'], missing: 'No decision notice uploaded' },
    { key: 'consultee', label: 'Consultees and other', kinds: ['consultee', 'other'], missing: 'No consultee response uploaded' }
  ];

  let running = false;
  let error = '';
  let copied = false;

  $: tickedDocs = docs.filter(d => names.includes(d.planit_name));
  $: canRun = !running && lens.policyIds.length > 0 && tickedDocs.length > 0;
  $: result = lens.result;
  $: stale = !!result && (result.names.length !== names.length || result.names.some(n => !names.includes(n)));
  $: rows = result ? result.schemes.map(sc => ({ ...sc, snapshot: saved.find(r => r.name === sc.name) })) : [];

  // One running number per finding, so a cell can point at its source.
  $: numbering = (() => {
    const map = new Map();
    let n = 0;
    for (const sc of rows) for (const f of sc.findings) map.set(f, ++n);
    return map;
  })();

  const hasDoc = (name, kinds) => docs.some(d => d.planit_name === name && kinds.includes(d.doc_type));
  const findingsFor = (sc, kinds) => sc.findings.filter(f => kinds.includes(f.kind));

  function stateClass(state) {
    if (state === 'Permitted' || state === 'Conditions') return 'granted';
    if (state === 'Rejected') return 'refused';
    return 'other';
  }

  async function run() {
    running = true;
    error = '';
    try {
      const out = await lensSchemeDocuments(projectId, { names, policy_ids: lens.policyIds, question: lens.question });
      lens.result = { ...out, names: [...names], ranAt: Date.now() };
    } catch (e) {
      error = e.message;
    } finally {
      running = false;
      lens = lens;
    }
  }

  async function copyPattern() {
    try {
      await navigator.clipboard.writeText(result.pattern.map(b => `- ${b}`).join('\n'));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      error = 'Could not copy to the clipboard.';
    }
  }

  const cite = f => dispatch('cite', { doc: f.doc, scheme: rows.find(r => r.findings.includes(f))?.name, quote: f.verified ? f.quote : '' });
  const citeWeight = sc => dispatch('cite', { doc: sc.weight.doc, scheme: sc.name, quote: sc.weight.verified ? sc.weight.quote : '' });
</script>

<div class="lens">
  <div class="ask">
    <div class="row">
      <span class="lbl">Policies</span>
      <PolicyPicker {policies} bind:selected={lens.policyIds} label="Choose policies" />
    </div>
    <textarea rows="2" bind:value={lens.question} aria-label="Question about the policies"></textarea>
    <div class="row">
      <span class="hint">
        {#if !tickedDocs.length}Tick a scheme that has documents on the left.
        {:else}Reads {names.length} scheme{names.length === 1 ? '' : 's'}, {tickedDocs.length} document{tickedDocs.length === 1 ? '' : 's'}. Project details are always included.{/if}
      </span>
      <button class="run" disabled={!canRun} on:click={run}>
        {#if running}<span class="spinner"></span> Comparing…{:else}<i class="las la-balance-scale"></i> Run on {names.length} scheme{names.length === 1 ? '' : 's'}{/if}
      </button>
    </div>
    {#if !policies.length}<div class="note">This project has no relevant policies yet. Add some on the Policy &amp; History tab.</div>{/if}
    {#if error}<div class="note err">{error}</div>{/if}
  </div>

  <div class="out">
    {#if result}
      {#if stale}<div class="note">The ticked schemes have changed since this was run. Run it again to refresh.</div>{/if}
      <div class="grid">
        <div class="gh">Scheme</div>
        {#each COLUMNS as c}<div class="gh">{c.label}</div>{/each}
        <div class="gh">Weight</div>

        {#each rows as sc (sc.name)}
          <div class="gc scheme">
            <div class="s-name">{sc.snapshot?.description || sc.description || sc.name}</div>
            {#if sc.state}<span class="badge {stateClass(sc.state)}">{sc.state}</span>{/if}
          </div>
          {#each COLUMNS as c}
            <div class="gc">
              {#each findingsFor(sc, c.kinds) as f}
                <div class="finding">
                  <span>{f.text}</span>
                  <button class="cite" on:click={() => cite(f)} title="Open in document">{numbering.get(f)}</button>
                  {#if f.verified}<div class="quote">"{f.quote}"</div>{:else}<div class="unver">Quote not verified in the document</div>{/if}
                </div>
              {:else}
                {#if !hasDoc(sc.name, c.kinds)}
                  <div class="gap">{c.missing}</div>
                {:else}
                  <div class="none">Not addressed</div>
                {/if}
              {/each}
            </div>
          {/each}
          <div class="gc">
            {#if sc.weight}
              <button class="wt" on:click={() => citeWeight(sc)} title="Open in document">{sc.weight.wording}</button>
              {#if !sc.weight.verified}<div class="unver">Not verified</div>{/if}
            {:else}
              <span class="none">Not stated</span>
            {/if}
          </div>
        {/each}
      </div>

      {#if result.pattern.length}
        <div class="pattern">
          <div class="p-head">
            <span>Pattern across the schemes</span>
            <button class="link" on:click={copyPattern}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <ul>{#each result.pattern as b}<li>{b}</li>{/each}</ul>
        </div>
      {/if}
    {:else if !running}
      <div class="empty">
        <i class="las la-balance-scale"></i>
        <p><strong>Compare how the policies were applied.</strong></p>
        <p>Choose one or more of this project's policies, ask your question, and see each ticked scheme's officer report, decision notice and consultees side by side.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .lens { display: flex; flex-direction: column; gap: 0.9rem; height: 100%; min-height: 0; overflow-y: auto; padding-right: 2px; }
  .ask { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.9rem 1rem; background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; }
  .row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .lbl { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-500); }
  textarea { resize: vertical; padding: 0.55rem 0.7rem; border: 1px solid var(--color-slate-200); border-radius: 8px; font: inherit; font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.45; }
  textarea:focus { outline: none; border-color: var(--color-purple-600); }
  .hint { flex: 1; min-width: 12rem; font-size: 0.75rem; color: var(--color-slate-500); }
  .run { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.1rem; border: none; border-radius: 7px; background: var(--color-purple-600); color: var(--color-white); font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
  .run:hover:not(:disabled) { background: var(--color-purple-700); }
  .run:disabled { opacity: 0.5; cursor: not-allowed; }
  .note { padding: 0.45rem 0.7rem; border-radius: 6px; background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); font-size: 0.78rem; }
  .note.err { background: var(--color-red-100); color: var(--color-red-800); }

  .out { display: flex; flex-direction: column; gap: 0.9rem; }
  .grid { display: grid; grid-template-columns: minmax(10rem, 1.1fr) repeat(3, minmax(0, 1.5fr)) minmax(6rem, 0.8fr); background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; overflow: hidden; }
  .gh { padding: 0.55rem 0.8rem; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-200); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-500); }
  .gc { padding: 0.75rem 0.8rem; border-bottom: 1px solid var(--color-slate-100); display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem; line-height: 1.5; color: var(--color-slate-700); min-width: 0; }
  .scheme { gap: 0.4rem; }
  .s-name { font-weight: 600; color: var(--color-slate-900); }
  .badge { width: fit-content; font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em; }
  .badge.granted { background: var(--color-emerald-100); color: var(--color-green-800); }
  .badge.refused { background: var(--color-red-100); color: var(--color-red-800); }
  .badge.other { background: var(--color-slate-100); color: var(--color-slate-600); }
  .finding { display: flex; flex-direction: column; gap: 0.2rem; }
  .cite { display: inline-flex; width: fit-content; align-items: center; justify-content: center; min-width: 1.15rem; height: 1.15rem; padding: 0 0.3rem; border: none; border-radius: 20px; background: var(--color-violet-100); color: var(--color-purple-700); font: inherit; font-size: 0.65rem; font-weight: 700; cursor: pointer; }
  .cite:hover { background: var(--color-purple-600); color: var(--color-white); }
  .quote { border-left: 3px solid var(--color-violet-100); padding-left: 0.5rem; font-size: 0.76rem; font-style: italic; color: var(--color-slate-600); }
  .unver { font-size: 0.72rem; color: var(--color-badge-warning-fg); }
  .gap { border: 1.5px dashed var(--color-slate-200); border-radius: 8px; padding: 0.5rem 0.6rem; font-size: 0.76rem; color: var(--color-slate-500); background: var(--color-slate-50); }
  .none { font-size: 0.76rem; color: var(--color-slate-400); }
  .wt { width: fit-content; text-align: left; background: none; border: none; padding: 0; font: inherit; font-size: 0.8rem; font-weight: 700; color: var(--color-slate-800); cursor: pointer; }
  .wt:hover { color: var(--color-purple-700); text-decoration: underline; }

  .pattern { padding: 0.9rem 1rem; background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; }
  .p-head { display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-500); }
  .pattern ul { margin: 0.5rem 0 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; line-height: 1.55; color: var(--color-slate-700); }
  .link { background: none; border: none; padding: 0; font: inherit; font-size: 0.75rem; color: var(--color-purple-600); cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 500; }

  .empty { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 2.5rem 1rem; text-align: center; color: var(--color-slate-500); }
  .empty i { font-size: 2.2rem; color: var(--color-purple-600); }
  .empty p { margin: 0; font-size: 0.85rem; max-width: 420px; line-height: 1.5; }

  .spinner { width: 0.85rem; height: 0.85rem; border: 2px solid var(--color-purple-50); border-top-color: var(--color-white); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
