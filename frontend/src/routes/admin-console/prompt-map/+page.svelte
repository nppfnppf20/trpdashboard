<script>
  import { PROMPT_MAP } from './promptMapData.js';

  let selectedToolId = $state(PROMPT_MAP[0].id);
  let openOperations = $state(new Set([PROMPT_MAP[0].operations[0].id]));
  let selectedComponent = $state(null); // { component, operationName, toolName }

  const TYPE_META = {
    system:   { label: 'System',   color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    tone:     { label: 'Tone',     color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    template: { label: 'Template', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    format:   { label: 'Format',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    guide:    { label: 'Guide',    color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
    runtime:  { label: 'Runtime',  color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  };

  const selectedTool = $derived(PROMPT_MAP.find(t => t.id === selectedToolId));

  function toggleOperation(opId) {
    const next = new Set(openOperations);
    if (next.has(opId)) {
      next.delete(opId);
    } else {
      next.add(opId);
    }
    openOperations = next;
  }

  function selectComponent(component, operation, tool) {
    if (selectedComponent?.component === component) {
      selectedComponent = null;
    } else {
      selectedComponent = { component, operation, tool };
    }
  }

  function selectAssembled(operation, tool) {
    const synthetic = {
      type: 'assembled',
      label: 'Assembled Prompt',
      content: operation.assembledPreview,
    };
    if (selectedComponent?.component === synthetic) {
      selectedComponent = null;
    } else {
      selectedComponent = { component: synthetic, operation, tool };
    }
  }

  function closePanel() {
    selectedComponent = null;
  }

  function selectTool(id) {
    selectedToolId = id;
    selectedComponent = null;
    openOperations = new Set([PROMPT_MAP.find(t => t.id === id)?.operations[0]?.id].filter(Boolean));
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

  <div class="page-body" class:panel-open={selectedComponent !== null}>
    <div class="operations-area">
      {#if selectedTool}
        <div class="tool-header">
          <h2><i class="las {selectedTool.icon}"></i> {selectedTool.name}</h2>
          <p class="tool-description">{selectedTool.description}</p>
        </div>

        {#each selectedTool.operations as operation}
          {@const isOpen = openOperations.has(operation.id)}
          <div class="operation-card" class:open={isOpen}>
            <button class="operation-header" onclick={() => toggleOperation(operation.id)}>
              <div class="op-header-left">
                <i class="las {isOpen ? 'la-chevron-down' : 'la-chevron-right'} chevron"></i>
                <span class="op-name">{operation.name}</span>
              </div>
              <span class="op-output-label">
                <i class="las la-arrow-right"></i>
                {operation.output}
              </span>
            </button>

            {#if isOpen}
              <div class="flow-diagram">
                <!-- Inputs column -->
                <div class="flow-col inputs-col">
                  <div class="col-label">Inputs</div>
                  {#each operation.components as component}
                    {@const meta = TYPE_META[component.type]}
                    {@const isSelected = selectedComponent?.component === component}
                    <button
                      class="component-node"
                      class:selected={isSelected}
                      style="--c-color:{meta.color}; --c-bg:{meta.bg}; --c-border:{meta.border}; {(component.type === 'runtime' || component.type === 'guide') ? 'border-style: dashed;' : ''}"
                      onclick={() => selectComponent(component, operation, selectedTool)}
                      title={component.source || component.description || ''}
                    >
                      <span class="comp-type-pill" style="background:{meta.color}; color:white">{meta.label}</span>
                      <span class="comp-label">{component.label}</span>
                      {#if component.source}
                        <span class="comp-source">{component.source}</span>
                      {/if}
                    </button>
                  {/each}
                </div>

                <!-- Arrow -->
                <div class="flow-arrow">
                  <div class="arrow-line"></div>
                  <i class="las la-arrow-right arrow-head"></i>
                </div>

                <!-- Assembled Prompt node -->
                <div class="flow-col assembled-col">
                  <div class="col-label">Assembled Prompt</div>
                  <button
                    class="assembled-node"
                    class:selected={selectedComponent?.component?.type === 'assembled' && selectedComponent?.operation === operation}
                    onclick={() => selectAssembled(operation, selectedTool)}
                  >
                    <i class="las la-layer-group"></i>
                    <span>View Template</span>
                  </button>
                </div>

                <!-- Arrow -->
                <div class="flow-arrow">
                  <div class="arrow-line"></div>
                  <i class="las la-arrow-right arrow-head"></i>
                </div>

                <!-- Claude node -->
                <div class="flow-col claude-col">
                  <div class="col-label">Model</div>
                  <div class="claude-node">
                    <i class="las la-robot"></i>
                    <span>Claude</span>
                    <span class="model-name">claude-sonnet-4-6</span>
                  </div>
                </div>

                <!-- Arrow -->
                <div class="flow-arrow">
                  <div class="arrow-line"></div>
                  <i class="las la-arrow-right arrow-head"></i>
                </div>

                <!-- Output node -->
                <div class="flow-col output-col">
                  <div class="col-label">Output</div>
                  <div class="output-node">
                    <i class="las la-file-alt"></i>
                    <span>{operation.output}</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Detail panel -->
    {#if selectedComponent}
      {@const c = selectedComponent.component}
      {@const meta = c.type === 'assembled' ? { label: 'Assembled Prompt', color: '#1e293b', bg: '#f1f5f9', border: '#cbd5e1' } : TYPE_META[c.type]}
      <div class="detail-panel">
        <div class="panel-header">
          <div class="panel-title">
            <span class="panel-type-pill" style="background:{meta.color}; color:white">{meta.label}</span>
            <span class="panel-label">{c.label}</span>
          </div>
          <button class="close-btn" onclick={closePanel}>
            <i class="las la-times"></i>
          </button>
        </div>
        {#if c.source}
          <div class="panel-source"><i class="las la-code-branch"></i> {c.source}</div>
        {/if}
        {#if c.description}
          <div class="panel-section">
            <div class="panel-section-label">Runtime injection</div>
            <div class="panel-description">{c.description}</div>
          </div>
        {/if}
        {#if c.content}
          <div class="panel-section">
            <div class="panel-section-label">{c.type === 'assembled' ? 'Prompt template' : 'Content'}</div>
            <pre class="panel-content">{c.content}</pre>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .prompt-map-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0;
  }

  /* ── Tool tabs ─────────────────────────────────────────────────── */
  .tool-tabs {
    display: flex;
    gap: 0.375rem;
    padding: 0 0 1.25rem 0;
    flex-wrap: wrap;
  }

  .tool-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-tab:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #cbd5e1;
  }

  .tool-tab.active {
    background: #1e293b;
    color: white;
    border-color: #1e293b;
  }

  .tool-tab i {
    font-size: 1rem;
  }

  /* ── Page body ─────────────────────────────────────────────────── */
  .page-body {
    display: flex;
    flex: 1;
    gap: 1.5rem;
    align-items: flex-start;
    overflow: hidden;
  }

  .operations-area {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }

  /* ── Tool header ───────────────────────────────────────────────── */
  .tool-header {
    margin-bottom: 1.25rem;
  }

  .tool-header h2 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tool-description {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  /* ── Operation card ────────────────────────────────────────────── */
  .operation-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
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
    color: #1e293b;
    font-size: 0.9rem;
    font-weight: 600;
    transition: background 0.15s;
    gap: 1rem;
  }

  .operation-header:hover {
    background: #f8fafc;
  }

  .op-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chevron {
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .op-output-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    font-weight: 400;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
  }

  /* ── Flow diagram ──────────────────────────────────────────────── */
  .flow-diagram {
    display: flex;
    align-items: flex-start;
    gap: 0;
    padding: 1.25rem 1.25rem 1.5rem;
    border-top: 1px solid #f1f5f9;
    overflow-x: auto;
  }

  .flow-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    min-width: 160px;
  }

  .col-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    margin-bottom: 0.25rem;
  }

  .flow-arrow {
    display: flex;
    align-items: center;
    padding: 0 0.375rem;
    margin-top: 2.25rem; /* align with node body, past col-label */
    flex-shrink: 0;
  }

  .arrow-line {
    width: 24px;
    height: 2px;
    background: #cbd5e1;
  }

  .arrow-head {
    font-size: 1rem;
    color: #94a3b8;
    margin-left: -2px;
  }

  /* ── Component nodes ───────────────────────────────────────────── */
  .component-node {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: var(--c-bg);
    border: 1.5px solid var(--c-border);
    border-radius: 0.375rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    color: #1e293b;
    font-size: 0.8rem;
  }

  .component-node:hover {
    filter: brightness(0.97);
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }

  .component-node.selected {
    border-color: var(--c-color);
    box-shadow: 0 0 0 2px var(--c-color);
  }

  .comp-type-pill {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
  }

  .comp-label {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.8rem;
    line-height: 1.3;
  }

  .comp-source {
    font-size: 0.7rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* ── Assembled node ────────────────────────────────────────────── */
  .assembled-col {
    min-width: 130px;
  }

  .assembled-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    background: #f1f5f9;
    border: 2px solid #cbd5e1;
    border-radius: 0.5rem;
    cursor: pointer;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.15s;
    width: 100%;
  }

  .assembled-node i {
    font-size: 1.25rem;
  }

  .assembled-node:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
  }

  .assembled-node.selected {
    background: #1e293b;
    border-color: #1e293b;
    color: white;
  }

  /* ── Claude node ───────────────────────────────────────────────── */
  .claude-col {
    min-width: 120px;
  }

  .claude-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%);
    border: 1.5px solid #c7d2fe;
    border-radius: 0.5rem;
    color: #4338ca;
    font-size: 0.8rem;
    font-weight: 600;
    width: 100%;
    text-align: center;
  }

  .claude-node i {
    font-size: 1.25rem;
  }

  .model-name {
    font-size: 0.65rem;
    font-weight: 400;
    color: #6366f1;
    font-family: monospace;
  }

  /* ── Output node ───────────────────────────────────────────────── */
  .output-col {
    min-width: 160px;
    max-width: 220px;
  }

  .output-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    background: #f0fdf4;
    border: 1.5px solid #86efac;
    border-radius: 0.5rem;
    color: #15803d;
    font-size: 0.75rem;
    font-weight: 500;
    width: 100%;
    text-align: center;
  }

  .output-node i {
    font-size: 1.25rem;
  }

  /* ── Detail panel ──────────────────────────────────────────────── */
  .detail-panel {
    width: 380px;
    flex-shrink: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow-y: auto;
    max-height: calc(100vh - 200px);
    position: sticky;
    top: 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.125rem 0.875rem;
    border-bottom: 1px solid #f1f5f9;
    gap: 0.5rem;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .panel-type-pill {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }

  .panel-label {
    font-weight: 700;
    font-size: 0.9rem;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    padding: 0.25rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: #1e293b;
    background: #f1f5f9;
  }

  .panel-source {
    padding: 0.5rem 1.125rem;
    font-size: 0.75rem;
    color: #64748b;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .panel-section {
    padding: 0.875rem 1.125rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .panel-section:last-child {
    border-bottom: none;
  }

  .panel-section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .panel-description {
    font-size: 0.825rem;
    color: #475569;
    line-height: 1.6;
  }

  .panel-content {
    font-size: 0.775rem;
    color: #1e293b;
    line-height: 1.65;
    white-space: pre-wrap;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    margin: 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.75rem;
    overflow-x: auto;
  }
</style>
