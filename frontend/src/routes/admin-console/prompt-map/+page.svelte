<script>
  import { onMount } from 'svelte';
  import { PROMPT_MAP } from './promptMapData.js';
  import { getScraperFilterPrompts } from '$lib/services/projectmap/projectMapApi.js';

  let selectedToolId = $state(PROMPT_MAP[0].id);
  let openOperations = $state(new Set([PROMPT_MAP[0].operations[0].id]));
  let liveScraperPrompts = $state({});

  onMount(async () => {
    try {
      const rows = await getScraperFilterPrompts();
      liveScraperPrompts = Object.fromEntries(rows.map(r => [r.category, r.prompt]));
    } catch (e) {
      console.warn('[prompt-map] Could not load scraper prompts:', e.message);
    }
  });

  const selectedTool = $derived(PROMPT_MAP.find(t => t.id === selectedToolId));

  function selectTool(id) {
    selectedToolId = id;
    openOperations = new Set([PROMPT_MAP.find(t => t.id === id)?.operations[0]?.id].filter(Boolean));
  }

  function toggleOperation(opId) {
    const next = new Set(openOperations);
    next.has(opId) ? next.delete(opId) : next.add(opId);
    openOperations = next;
  }

  function resolvePrompt(operation) {
    if (!operation.assembledPreview) return '';
    let text = operation.assembledPreview;
    for (const [cat, prompt] of Object.entries(liveScraperPrompts)) {
      const component = operation.components.find(c => c.liveCategory === cat);
      if (component) {
        text = text.replace(`[TEMPLATE: ${cat} prompt from DB]`, prompt);
      }
    }
    return text;
  }

  function getVariables(operation) {
    return operation.components.filter(c => c.type === 'runtime' || c.type === 'guide');
  }
</script>

<div class="prompt-map-page">
  <!-- Tool tabs -->
  <div class="tool-tabs">
    {#each PROMPT_MAP as tool}
      <button
        class="tool-tab"
        class:active={selectedToolId === tool.id}
        onclick={() => selectTool(tool.id)}
      >
        <i class="las {tool.icon}"></i>
        <span>{tool.name}</span>
      </button>
    {/each}
  </div>

  {#if selectedTool}
    <div class="tool-header">
      <h2><i class="las {selectedTool.icon}"></i> {selectedTool.name}</h2>
      <p>{selectedTool.description}</p>
    </div>

    <div class="operations-list">
      {#each selectedTool.operations as operation}
        {@const isOpen = openOperations.has(operation.id)}
        {@const variables = getVariables(operation)}
        <div class="operation-card" class:open={isOpen}>

          <button class="operation-header" onclick={() => toggleOperation(operation.id)}>
            <div class="op-left">
              <i class="las {isOpen ? 'la-chevron-down' : 'la-chevron-right'} chevron"></i>
              <span class="op-name">{operation.name}</span>
            </div>
            <span class="op-output">{operation.output}</span>
          </button>

          {#if isOpen}
            <div class="operation-body">

              {#if variables.length > 0}
                <div class="variables-section">
                  <div class="section-label">Variables injected at runtime</div>
                  <div class="variables-grid">
                    {#each variables as v}
                      <div class="variable-box">
                        <div class="var-label">
                          {#if v.type === 'guide'}
                            <i class="las la-book-open"></i>
                          {:else}
                            <i class="las la-code"></i>
                          {/if}
                          {v.label}
                        </div>
                        {#if v.description}
                          <div class="var-desc">{v.description}</div>
                        {:else if v.source}
                          <div class="var-desc">{v.source}</div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="prompt-section">
                <div class="section-label">Full prompt</div>
                <pre class="prompt-text">{resolvePrompt(operation)}</pre>
              </div>

            </div>
          {/if}

        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .prompt-map-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Tool tabs ─────────────────────────────────────────── */
  .tool-tabs {
    display: flex;
    gap: 0.375rem;
    padding-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .tool-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-tab:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
    border-color: var(--color-slate-300);
  }

  .tool-tab.active {
    background: var(--color-slate-800);
    color: white;
    border-color: var(--color-slate-800);
  }

  .tool-tab i {
    font-size: 1rem;
  }

  /* ── Tool header ───────────────────────────────────────── */
  .tool-header {
    margin-bottom: 1.25rem;
  }

  .tool-header h2 {
    margin: 0 0 0.25rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tool-header p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  /* ── Operation cards ───────────────────────────────────── */
  .operations-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .operation-card {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .operation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.875rem 1.125rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-slate-800);
    font-size: 0.875rem;
    font-weight: 600;
    transition: background 0.15s;
    gap: 1rem;
  }

  .operation-header:hover {
    background: var(--color-slate-50);
  }

  .op-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .chevron {
    font-size: 0.875rem;
    color: var(--color-slate-400);
  }

  .op-output {
    font-size: 0.775rem;
    font-weight: 400;
    color: var(--color-slate-400);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 55%;
  }

  /* ── Operation body ────────────────────────────────────── */
  .operation-body {
    border-top: 1px solid var(--color-slate-100);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-slate-400);
    margin-bottom: 0.625rem;
  }

  /* ── Variables ─────────────────────────────────────────── */
  .variables-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .variable-box {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    max-width: 280px;
  }

  .var-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.2rem;
  }

  .var-label i {
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  .var-desc {
    font-size: 0.75rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  /* ── Prompt text ───────────────────────────────────────── */
  .prompt-text {
    font-size: 0.775rem;
    color: var(--color-slate-800);
    line-height: 1.7;
    white-space: pre-wrap;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    margin: 0;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    padding: 1rem;
    overflow-x: auto;
  }
</style>
