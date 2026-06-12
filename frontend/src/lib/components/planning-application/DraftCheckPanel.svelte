<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { checkBriefCoverage, checkConsistency, checkGrammar } from '$lib/api/draftCheck.js';

  export let project;
  export let docTypeSlug = 'planning_statement';
  export let developmentType = null;
  export let getDraftHtml = () => '';
  export let locateText = null;

  const dispatch = createEventDispatcher();

  let notFoundKey = null;

  function locate(sectionKey, idx, text) {
    if (!locateText || !text) return;
    notFoundKey = null;
    if (!locateText(text)) notFoundKey = `${sectionKey}:${idx}`;
  }

  const SECTION_DEFS = [
    { key: 'brief',       label: 'Guiding Brief Coverage',  icon: 'la-book',           run: checkBriefCoverage },
    { key: 'consistency', label: 'Project Information',     icon: 'la-clipboard-list', run: checkConsistency },
    { key: 'grammar',     label: 'Grammar & Style',         icon: 'la-spell-check',    run: checkGrammar },
  ];

  let sections = {
    brief:       { status: 'idle', items: [], error: null, meta: {} },
    consistency: { status: 'idle', items: [], error: null, meta: {} },
    grammar:     { status: 'idle', items: [], error: null, meta: {} },
  };
  let expanded = { brief: true, consistency: true, grammar: true, policy: false, policyUpdates: false };
  let noDraft = false;

  async function runSection(def) {
    const html = getDraftHtml();
    if (!html?.trim()) { noDraft = true; return; }
    noDraft = false;
    sections[def.key] = { status: 'running', items: [], error: null, meta: {} };
    try {
      const result = await def.run(project.id, {
        draft_html: html,
        document_type: docTypeSlug,
        development_type: developmentType || null,
      });
      const { items = [], ...meta } = result;
      sections[def.key] = { status: 'done', items, error: null, meta };
    } catch (err) {
      sections[def.key] = { status: 'error', items: [], error: err.message, meta: {} };
    }
  }

  function runAll() {
    const html = getDraftHtml();
    if (!html?.trim()) { noDraft = true; return; }
    SECTION_DEFS.forEach(def => runSection(def));
  }

  onMount(runAll);

  $: anyRunning = SECTION_DEFS.some(def => sections[def.key].status === 'running');

  function issueCount(key) {
    const items = sections[key].items;
    if (key === 'brief')       return items.filter(i => i.status !== 'present').length;
    if (key === 'consistency') return items.filter(i => i.status === 'mismatch').length;
    if (key === 'grammar')     return items.length;
    return 0;
  }

  const BRIEF_ICONS  = { present: 'la-check-circle', partial: 'la-exclamation-triangle', missing: 'la-times-circle' };
  const CONSISTENCY_ICONS = { consistent: 'la-check-circle', mismatch: 'la-times-circle', not_mentioned: 'la-minus-circle' };
  const CONSISTENCY_TONES = { consistent: 'present', mismatch: 'missing', not_mentioned: 'neutral' };
  const GRAMMAR_TONES = { high: 'missing', medium: 'partial', low: 'neutral' };
  const GRAMMAR_ICONS = { high: 'la-times-circle', medium: 'la-exclamation-triangle', low: 'la-info-circle' };
</script>

<div class="check-panel">
  <div class="check-panel-header">
    <span class="check-panel-title"><i class="las la-clipboard-check"></i> Check Draft</span>
    <div class="check-panel-actions">
      <button class="check-rerun-all" disabled={anyRunning} on:click={runAll} title="Re-run all checks">
        <i class="las la-sync"></i> Run again
      </button>
      <button class="check-panel-close" aria-label="Close check panel" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
    </div>
  </div>

  <div class="check-panel-body">
    {#if noDraft}
      <div class="check-empty-note"><i class="las la-info-circle"></i> The draft is empty — generate or write some content first.</div>
    {/if}

    {#each SECTION_DEFS as def}
      {@const s = sections[def.key]}
      <div class="check-section">
        <button class="check-section-header" on:click={() => expanded[def.key] = !expanded[def.key]}>
          <span class="check-section-label"><i class="las {def.icon}"></i> {def.label}</span>
          {#if s.status === 'running'}
            <span class="check-mini-spinner"></span>
          {:else if s.status === 'error'}
            <span class="check-badge check-badge--error">Failed</span>
          {:else if s.status === 'done'}
            {@const n = issueCount(def.key)}
            <span class="check-badge {n === 0 ? 'check-badge--ok' : 'check-badge--issues'}">
              {n === 0 ? 'All clear' : `${n} to review`}
            </span>
          {/if}
          <i class="las la-angle-{expanded[def.key] ? 'up' : 'down'} check-chevron"></i>
        </button>

        {#if expanded[def.key]}
          <div class="check-section-body">
            {#if s.status === 'running'}
              <div class="check-section-loading"><span class="check-mini-spinner"></span> Checking...</div>

            {:else if s.status === 'error'}
              <div class="check-item check-item--missing">
                <span class="check-item-icon"><i class="las la-exclamation-circle"></i></span>
                <div class="check-item-text">
                  <span class="check-item-detail">{s.error}</span>
                  <button class="check-retry-btn" on:click={() => runSection(def)}><i class="las la-sync"></i> Retry</button>
                </div>
              </div>

            {:else if s.meta.no_brief}
              <p class="check-section-empty">No guiding brief found for this document type{developmentType ? ` (${developmentType})` : ''}. Add one in Admin Console → Guiding Briefs.</p>
            {:else if s.meta.no_content}
              <p class="check-section-empty">A guiding brief exists but has no guidance content or review checklist. Add one in Admin Console → Guiding Briefs.</p>
            {:else if s.meta.no_project_info}
              <p class="check-section-empty">No project information recorded to check against.</p>

            {:else if s.status === 'done' && s.items.length === 0}
              <p class="check-section-empty">Nothing flagged.</p>

            {:else if def.key === 'brief'}
              {#each s.items as item}
                <div class="check-item check-item--{item.status}">
                  <span class="check-item-icon"><i class="las {BRIEF_ICONS[item.status] ?? 'la-question-circle'}"></i></span>
                  <div class="check-item-text">
                    <span class="check-item-topic">{item.topic}</span>
                    {#if item.question}<span class="check-item-question">{item.question}</span>{/if}
                    {#if item.suggestion}<span class="check-item-detail">{item.suggestion}</span>{/if}
                  </div>
                </div>
              {/each}

            {:else if def.key === 'consistency'}
              {#each s.items as item, idx}
                {@const locatable = !!(locateText && item.found_in_draft)}
                <button
                  class="check-item check-item--{CONSISTENCY_TONES[item.status] ?? 'neutral'}"
                  disabled={!locatable}
                  title={locatable ? 'Show in the draft' : undefined}
                  on:click={() => locate(def.key, idx, item.found_in_draft)}
                >
                  <span class="check-item-icon"><i class="las {CONSISTENCY_ICONS[item.status] ?? 'la-question-circle'}"></i></span>
                  <div class="check-item-text">
                    <span class="check-item-topic">{item.field}</span>
                    {#if item.status === 'mismatch'}
                      <span class="check-item-compare">
                        <span class="check-compare-expected">Recorded: {item.expected ?? '—'}</span>
                        <span class="check-compare-found">Draft: {item.found_in_draft ?? '—'}</span>
                      </span>
                    {:else if item.status === 'not_mentioned'}
                      <span class="check-item-detail">Not mentioned in the draft.</span>
                    {/if}
                    {#if item.note}<span class="check-item-detail">{item.note}</span>{/if}
                    {#if notFoundKey === `${def.key}:${idx}`}
                      <span class="check-item-notfound">Couldn't find this text in the draft — it may have been edited since the check ran.</span>
                    {/if}
                  </div>
                  {#if locatable}<i class="las la-search check-item-locate-icon"></i>{/if}
                </button>
              {/each}

            {:else if def.key === 'grammar'}
              {#each s.items as item, idx}
                {@const locatable = !!(locateText && item.excerpt)}
                <button
                  class="check-item check-item--{GRAMMAR_TONES[item.severity] ?? 'neutral'}"
                  disabled={!locatable}
                  title={locatable ? 'Show in the draft' : undefined}
                  on:click={() => locate(def.key, idx, item.excerpt)}
                >
                  <span class="check-item-icon"><i class="las {GRAMMAR_ICONS[item.severity] ?? 'la-info-circle'}"></i></span>
                  <div class="check-item-text">
                    {#if item.excerpt}<span class="check-item-excerpt">“{item.excerpt}”</span>{/if}
                    <span class="check-item-topic">{item.issue}</span>
                    {#if item.suggestion}<span class="check-item-detail">{item.suggestion}</span>{/if}
                    {#if notFoundKey === `${def.key}:${idx}`}
                      <span class="check-item-notfound">Couldn't find this text in the draft — it may have been edited since the check ran.</span>
                    {/if}
                  </div>
                  {#if locatable}<i class="las la-search check-item-locate-icon"></i>{/if}
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Phase 2: Policy Review -->
    <div class="check-section check-section--placeholder">
      <button class="check-section-header" on:click={() => expanded.policy = !expanded.policy}>
        <span class="check-section-label"><i class="las la-balance-scale"></i> Policy Review</span>
        <span class="check-badge check-badge--soon">Coming soon</span>
        <i class="las la-angle-{expanded.policy ? 'up' : 'down'} check-chevron"></i>
      </button>
      {#if expanded.policy}
        <div class="check-section-body">
          <p class="check-section-empty">Will test the draft's policy arguments against the verbatim wording of the project's policies — flagging weak interpretations, unused arguments, and relevant policies not yet cited.</p>
        </div>
      {/if}
    </div>

    <!-- Phase 3: Policy Updates -->
    <div class="check-section check-section--placeholder">
      <button class="check-section-header" on:click={() => expanded.policyUpdates = !expanded.policyUpdates}>
        <span class="check-section-label"><i class="las la-bell"></i> Policy Updates</span>
        <span class="check-badge check-badge--soon">Coming soon</span>
        <i class="las la-angle-{expanded.policyUpdates ? 'up' : 'down'} check-chevron"></i>
      </button>
      {#if expanded.policyUpdates}
        <div class="check-section-body">
          <p class="check-section-empty">Will check the draft against a maintained table of new and emerging policy — flagging outdated references, contradictions, and new policy that could strengthen the case.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .check-panel { height: 100%; overflow-y: auto; }

  .check-panel-header {
    position: sticky; top: 0; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; background: white;
  }
  .check-panel-title { font-size: 0.8rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 0.375rem; }
  .check-panel-actions { display: flex; align-items: center; gap: 0.5rem; }
  .check-rerun-all {
    display: flex; align-items: center; gap: 0.3rem;
    background: white; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 600; color: #475569;
    cursor: pointer; font-family: inherit; transition: all 0.12s;
  }
  .check-rerun-all:hover:not(:disabled) { background: #f8fafc; color: #1e293b; }
  .check-rerun-all:disabled { opacity: 0.5; cursor: default; }
  .check-panel-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.2rem; font-size: 1rem; line-height: 1; }
  .check-panel-close:hover { color: #374151; }

  .check-panel-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }

  .check-empty-note {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 0.875rem; border-radius: 7px;
    background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 0.78rem;
  }

  .check-section { border: 1px solid #e2e8f0; border-radius: 7px; overflow: hidden; background: white; }
  .check-section--placeholder { opacity: 0.75; }
  .check-section-header {
    width: 100%; display: flex; align-items: center; gap: 0.5rem;
    padding: 0.625rem 0.75rem; background: #f8fafc; border: none;
    cursor: pointer; font-family: inherit; text-align: left; transition: background 0.12s;
  }
  .check-section-header:hover { background: #f1f5f9; }
  .check-section-label { flex: 1; font-size: 0.8rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.375rem; }
  .check-chevron { font-size: 0.7rem; color: #94a3b8; flex-shrink: 0; }

  .check-badge { font-size: 0.68rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px; flex-shrink: 0; }
  .check-badge--ok { background: #dcfce7; color: #15803d; }
  .check-badge--issues { background: #fef3c7; color: #b45309; }
  .check-badge--error { background: #fee2e2; color: #dc2626; }
  .check-badge--soon { background: #f1f5f9; color: #64748b; }

  .check-section-body { padding: 0.5rem 0.625rem; display: flex; flex-direction: column; gap: 0.375rem; border-top: 1px solid #e2e8f0; }
  .check-section-loading { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; font-size: 0.78rem; color: #64748b; }
  .check-section-empty { margin: 0; padding: 0.375rem 0.25rem; font-size: 0.78rem; color: #94a3b8; font-style: italic; line-height: 1.5; }

  .check-item {
    display: flex; align-items: flex-start; gap: 0.625rem;
    padding: 0.5rem 0.625rem; border-radius: 6px; font-size: 0.78rem;
  }
  button.check-item {
    width: 100%; border: none; font-family: inherit; text-align: left;
    cursor: pointer; transition: box-shadow 0.12s;
  }
  button.check-item:disabled { cursor: default; }
  button.check-item:not(:disabled):hover { box-shadow: inset 0 0 0 1px #cbd5e1; }
  .check-item-locate-icon {
    flex-shrink: 0; margin-left: auto; margin-top: 0.05rem;
    font-size: 0.85rem; color: #94a3b8; opacity: 0;
    transition: opacity 0.12s;
  }
  button.check-item:not(:disabled):hover .check-item-locate-icon { opacity: 1; }
  .check-item-notfound { color: #b45309; font-size: 0.72rem; font-style: italic; }
  .check-item--present { background: #f0fdf4; }
  .check-item--partial { background: #fffbeb; }
  .check-item--missing { background: #fef2f2; }
  .check-item--neutral { background: #f8fafc; }
  .check-item-icon { flex-shrink: 0; font-size: 1rem; margin-top: 0.05rem; }
  .check-item--present .check-item-icon { color: #16a34a; }
  .check-item--partial .check-item-icon { color: #ca8a04; }
  .check-item--missing .check-item-icon { color: #dc2626; }
  .check-item--neutral .check-item-icon { color: #94a3b8; }
  .check-item-text { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
  .check-item-topic { font-weight: 600; color: #1e293b; }
  .check-item-question { color: #334155; line-height: 1.5; }
  .check-item-detail { color: #475569; line-height: 1.5; }
  .check-item-excerpt { color: #64748b; font-style: italic; line-height: 1.5; }
  .check-item-compare { display: flex; flex-direction: column; gap: 0.1rem; line-height: 1.5; }
  .check-compare-expected { color: #15803d; }
  .check-compare-found { color: #dc2626; }

  .check-retry-btn {
    align-self: flex-start; display: flex; align-items: center; gap: 0.3rem;
    margin-top: 0.25rem; background: white; border: 1px solid #e2e8f0; border-radius: 5px;
    padding: 0.25rem 0.55rem; font-size: 0.72rem; font-weight: 600; color: #475569;
    cursor: pointer; font-family: inherit;
  }
  .check-retry-btn:hover { background: #f8fafc; }

  .check-mini-spinner {
    width: 13px; height: 13px; flex-shrink: 0;
    border: 2px solid #e2e8f0; border-top-color: #475569; border-radius: 50%;
    animation: check-spin 0.7s linear infinite;
  }
  @keyframes check-spin { to { transform: rotate(360deg); } }
</style>
