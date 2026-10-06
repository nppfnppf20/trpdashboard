<script>
  import { createEventDispatcher } from 'svelte';

  export let context;
  export let options;
  export let suggesting = false;
  export let suggestError = '';
  export let starting = false;
  export let error = '';
  export let hasResults = false;
  export let draftedFrom = '';

  const dispatch = createEventDispatcher();

  $: schemeVague = !context.scheme.trim() || /to be confirmed|\btbc\b|unknown|not stated/i.test(context.scheme);

  function addIssue() {
    context.issues = [...context.issues, { label: '', weight: 3, include: true }];
  }

  function removeIssue(i) {
    context.issues = context.issues.filter((_, idx) => idx !== i);
  }
</script>

<div class="setup">
  <div class="card section">
    <div class="section-head">
      <h3>The scheme</h3>
      <div class="head-actions">
        <button class="btn btn-secondary btn-sm" on:click={() => dispatch('pick')} disabled={suggesting}>
          <i class="las la-file-alt"></i> {suggesting ? 'Reading...' : 'Fill from notes and documents'}
        </button>
      </div>
    </div>
    {#if suggesting}
      <div class="filling" role="status" aria-live="polite">
        <span class="filling-label">Filling...</span>
        <div class="filling-track"><div class="filling-bar"></div></div>
      </div>
    {/if}
    {#if draftedFrom}<p class="hint">Drafted from {draftedFrom}.</p>{/if}
    {#if suggestError}<p class="msg msg-error">{suggestError}</p>{/if}

    <label class="form-label" for="ap-scheme">What is proposed</label>
    <textarea id="ap-scheme" class="form-input" rows="2" bind:value={context.scheme} placeholder="e.g. ground-mounted solar farm, or residential development of 120 dwellings"></textarea>
    {#if schemeVague}
      <p class="msg msg-warn">Describe the type of scheme. The search uses it to find comparable decisions, and it can't do that well without it.</p>
    {/if}

    <label class="form-label" for="ap-setting">Setting and designations</label>
    <input id="ap-setting" class="form-input" type="text" bind:value={context.setting} placeholder="e.g. within the setting of a National Landscape, Green Belt, near listed buildings" />

    <div class="scale-row">
      <div>
        <label class="form-label" for="ap-mw">Capacity (MW)</label>
        <input id="ap-mw" class="form-input" type="number" min="0" step="any" bind:value={context.scale.mw} />
      </div>
      <div>
        <label class="form-label" for="ap-units">Dwellings / units</label>
        <input id="ap-units" class="form-input" type="number" min="0" step="any" bind:value={context.scale.units} />
      </div>
      <div>
        <label class="form-label" for="ap-ha">Site area (ha)</label>
        <input id="ap-ha" class="form-input" type="number" min="0" step="any" bind:value={context.scale.hectares} />
      </div>
    </div>
    <p class="hint">Scale is used to keep much smaller or larger schemes from ranking as close precedents. Leave blank if unknown.</p>
  </div>

  <div class="card section">
    <div class="section-head">
      <h3>Key issues</h3>
      <button class="btn btn-secondary btn-sm" on:click={addIssue}>Add issue</button>
    </div>
    {#if context.issues.length}
      <div class="issue-head"><span></span><span>Issue</span><span>Weight</span><span></span></div>
      {#each context.issues as issue, i}
        <div class="issue-row" class:off={!issue.include}>
          <input type="checkbox" bind:checked={issue.include} aria-label="Include this issue" />
          <input class="form-input" type="text" bind:value={issue.label} placeholder="e.g. Character and appearance" aria-label="Issue" />
          <select class="form-input" bind:value={issue.weight} aria-label="Weight">
            <option value={5}>5 Most important</option>
            <option value={4}>4</option>
            <option value={3}>3</option>
            <option value={2}>2</option>
            <option value={1}>1 Minor</option>
          </select>
          <button class="btn btn-ghost btn-sm" on:click={() => removeIssue(i)} aria-label="Remove issue">Remove</button>
        </div>
      {/each}
      <p class="hint">Higher-weighted issues count more when ranking. The search favours decisions that actually decided them.</p>
    {:else}
      <p class="hint">No issues entered. The search will work out the issues most likely to decide an appeal for this kind of scheme. Use "Fill from notes and documents" to get suggestions you can edit.</p>
    {/if}
  </div>

  <div class="card section">
    <h3>Instructions</h3>
    <label class="form-label" for="ap-instructions">Anything specific to look for or avoid</label>
    <textarea id="ap-instructions" class="form-input" rows="3" bind:value={context.instructions} placeholder="e.g. Focus on cases where the inspector weighed landscape harm against benefits. Ignore battery-only schemes."></textarea>
  </div>

  <details class="card section limits">
    <summary>Search limits</summary>
    <div class="limits-grid">
      <div>
        <label class="form-label" for="ap-from">Decisions from</label>
        <input id="ap-from" class="form-input" type="date" bind:value={context.dateFrom} />
        <p class="hint">Blank means the last three years.</p>
      </div>
      <div>
        <label class="form-label" for="ap-cap">Appealbase calls</label>
        <input id="ap-cap" class="form-input" type="number" min="5" max="80" bind:value={options.callCap} />
        <p class="hint">Each search page or decision read uses one.</p>
      </div>
      <div>
        <label class="form-label" for="ap-max">Precedents to find</label>
        <input id="ap-max" class="form-input" type="number" min="3" max="20" bind:value={options.maxRecords} />
      </div>
    </div>
  </details>

  {#if error}<p class="msg msg-error">{error}</p>{/if}

  <div class="run-row">
    <button class="btn btn-primary" on:click={() => dispatch('run')} disabled={starting}>
      {starting ? 'Starting...' : hasResults ? 'Search again and add results' : 'Find precedents'}
    </button>
    <span class="hint">Takes 5 to 10 minutes. Usually 10 to 40 Appealbase calls and roughly $1 to $4 of AI usage. Nothing is saved.</span>
  </div>
</div>

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 820px;
  }

  .section {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .filling {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .filling-label {
    font-size: 0.78125rem;
    font-weight: 600;
    color: var(--color-violet-600);
  }

  .filling-track {
    height: 5px;
    background: var(--color-slate-200);
    border-radius: 999px;
    overflow: hidden;
  }

  .filling-bar {
    height: 100%;
    width: 35%;
    background: var(--color-violet-600);
    border-radius: 999px;
    animation: filling-slide 1.2s ease-in-out infinite;
  }

  @keyframes filling-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(300%);
    }
  }

  .head-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-slate-900);
  }

  .scale-row,
  .limits-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .hint {
    margin: 0;
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    line-height: 1.45;
  }

  .msg {
    margin: 0;
    font-size: 0.8125rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
  }

  .msg-warn {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .msg-error {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .issue-head,
  .issue-row {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) 9.5rem auto;
    gap: var(--space-2);
    align-items: center;
  }

  .issue-head {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-slate-500);
  }

  .issue-row.off input.form-input,
  .issue-row.off select {
    opacity: 0.5;
  }

  .limits summary {
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-700);
  }

  .limits-grid {
    margin-top: var(--space-3);
  }

  .run-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .scale-row,
    .limits-grid {
      grid-template-columns: 1fr;
    }

    .issue-head {
      display: none;
    }

    .issue-row {
      grid-template-columns: 1.5rem minmax(0, 1fr);
    }
  }
</style>
