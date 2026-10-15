<script>
  import {
    getPlanningStages,
    setPlanningStage,
    completeStageAndStartNext,
    setPlanningStagesApplicable
  } from '$lib/api/planningStages.js';

  export let projectId;

  // Order and names of the seven planning stages. Keys match the stage_key check in migration 190.
  const STAGES = [
    { key: 'appraisal',           num: '1(a)', name: 'Detailed appraisal' },
    { key: 'pre_app',             num: '2',    name: 'Pre-application discussions' },
    { key: 'eia_screening',       num: '3',    name: 'EIA screening' },
    { key: 'surveys',             num: '4(a)', name: 'Specialist surveys and reports' },
    { key: 'public_engagement',   num: '5',    name: 'Public engagement' },
    { key: 'prepare_application', num: '6',    name: 'Prepare planning application' },
    { key: 'post_submission',     num: '7',    name: 'Post-submission' }
  ];
  const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', complete: 'Complete', na: 'Not applicable' };
  const STATUS_OPTIONS = ['not_started', 'in_progress', 'complete', 'na'];

  let root;
  let state = null;      // { applicable, stages: [{ key, status, changed_at }] }
  let loadFailed = false;
  let saving = false;
  let error = null;
  let openKey = null;    // stage whose popover is open
  let confirmHide = false;

  let loadedFor = null;
  $: if (projectId && projectId !== loadedFor) { loadedFor = projectId; load(); }

  async function load() {
    loadFailed = false;
    try { state = await getPlanningStages(projectId); }
    catch (err) { console.error('Planning stages failed to load', err); state = null; loadFailed = true; }
  }

  // Runs a save, swaps in the refreshed state, and closes any open popover.
  async function run(fn) {
    saving = true; error = null;
    try { state = await fn(); openKey = null; confirmHide = false; }
    catch (err) { error = err.message; }
    finally { saving = false; }
  }

  // One entry per stage with its status, hover text and the stage "complete and start next" would start.
  // Built from `state` in a reactive statement so the pills redraw as soon as a save returns.
  function buildView(st) {
    if (!st) return [];
    const statusOf = key => st.stages.find(s => s.key === key)?.status || 'not_started';
    return STAGES.map((stage, i) => {
      const row = st.stages.find(s => s.key === stage.key);
      const status = statusOf(stage.key);
      const when = row?.changed_at ? ` · ${new Date(row.changed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : '';
      return {
        ...stage,
        status,
        tip: `${STATUS_LABEL[status]}${when}`,
        next: STAGES.slice(i + 1).find(s => statusOf(s.key) === 'not_started') || null
      };
    });
  }
  $: view = buildView(state);

  function togglePopover(key) { confirmHide = false; openKey = openKey === key ? null : key; error = null; }
  function closeAll() { openKey = null; confirmHide = false; }
  function onWindowClick(e) { if (root && !root.contains(e.target)) closeAll(); }
  function onKeydown(e) { if (e.key === 'Escape') closeAll(); }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKeydown} />

{#if state}
  <div class="stage-strip" bind:this={root}>
    {#if !state.applicable}
      <div class="hide-note">
        <span>Planning stages do not apply to this project.</span>
        <button class="link-btn" disabled={saving} on:click={() => run(() => setPlanningStagesApplicable(projectId, true))}>Show stages</button>
      </div>
    {:else}
      <div class="tray">
        {#each view as stage, i (stage.key)}
          {@const status = stage.status}
          {@const next = stage.next}
          <div class="cell" class:first={i === 0}>
            <button
              class="chev {status}"
              class:open={openKey === stage.key}
              title={stage.tip}
              aria-haspopup="dialog"
              aria-expanded={openKey === stage.key}
              on:click={() => togglePopover(stage.key)}
            >
              <span class="num">{status === 'complete' ? '✓ ' : ''}Stage {stage.num}</span>
              <span class="name">{stage.name}</span>
            </button>

            {#if openKey === stage.key}
              <div class="pop" class:right={i >= 4} role="dialog" aria-label="Change {stage.name}">
                <h4><small>Stage {stage.num}</small>{stage.name}</h4>
                <div class="opts">
                  {#each STATUS_OPTIONS as opt}
                    <button
                      class="opt"
                      aria-pressed={status === opt}
                      disabled={saving}
                      on:click={() => (status === opt ? closeAll() : run(() => setPlanningStage(projectId, stage.key, opt)))}
                    >
                      <span class="sw {opt}"></span>{STATUS_LABEL[opt]}
                    </button>
                  {/each}
                </div>
                {#if status === 'in_progress'}
                  <button class="btn btn-primary btn-sm" disabled={saving} on:click={() => run(() => completeStageAndStartNext(projectId, stage.key))}>
                    {next ? `Complete and start Stage ${next.num} →` : 'Complete this stage'}
                  </button>
                  <p class="hint">{next ? `Starts ${next.name.toLowerCase()}. Not applicable stages are skipped.` : 'No later stage left to start.'}</p>
                {:else if status === 'not_started'}
                  <p class="hint">Set to in progress to run it alongside any other stage.</p>
                {/if}
                {#if error}<p class="err">{error}</p>{/if}
              </div>
            {/if}
          </div>
        {/each}

        <div class="cell na-cell">
          <button class="na-btn" title="Planning stages do not apply to this project. Hides this strip." on:click={() => { openKey = null; confirmHide = !confirmHide; error = null; }}>N/A</button>
          {#if confirmHide}
            <div class="pop right confirm" role="alertdialog" aria-label="Confirm stages not applicable">
              <h4>Mark planning stages as not applicable?</h4>
              <p class="hint">This hides the stage strip for the whole project. Any stage statuses you have set are kept, and you can show the strip again at any time.</p>
              <div class="confirm-actions">
                <button class="btn btn-secondary btn-sm" on:click={closeAll}>Cancel</button>
                <button class="btn btn-primary btn-sm" disabled={saving} on:click={() => run(() => setPlanningStagesApplicable(projectId, false))}>Hide stages</button>
              </div>
              {#if error}<p class="err">{error}</p>{/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .stage-strip { flex: 1 1 420px; min-width: 0; margin: 0 1.25rem; }

  .tray {
    display: flex;
    align-items: stretch;
    background: var(--color-slate-100);
    border-radius: var(--radius-md);
    padding: 5px 8px;
  }

  .cell { position: relative; flex: 1 1 0; min-width: 0; margin-right: -6px; }
  .cell:nth-last-child(2) { margin-right: 0; }

  .chev {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 42px;
    border: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    padding: 4px 12px 4px 18px;
    background: var(--color-white);
    color: var(--color-slate-900);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%);
  }
  .cell.first .chev {
    padding-left: 12px;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%);
  }
  .chev .num { font-size: 0.625rem; font-weight: 500; }
  .chev .name { font-size: 0.7188rem; font-weight: 600; line-height: 1.15; }
  .chev:hover, .chev.open { filter: brightness(0.95); }

  .chev.complete { background: var(--color-emerald-100); color: var(--color-slate-900); }
  .chev.in_progress { background: var(--color-primary-600); color: var(--color-white); }
  .chev.na {
    background: repeating-linear-gradient(135deg, var(--color-slate-100) 0 5px, var(--color-slate-200) 5px 7px);
    color: var(--color-slate-600);
  }
  .chev.na .name { text-decoration: line-through; }

  .na-cell { flex: none; margin: 0 0 0 20px; display: flex; align-items: center; }
  .na-cell::before { content: ''; position: absolute; left: -11px; top: -6px; bottom: -6px; width: 1px; background: var(--color-slate-200); }
  .na-btn {
    border: 1px dashed var(--color-slate-400);
    background: transparent;
    color: var(--color-slate-500);
    border-radius: var(--radius-sm);
    padding: 2px 7px;
    font-family: inherit;
    font-size: 0.625rem;
    font-weight: 600;
    cursor: pointer;
  }
  .na-btn:hover { border-color: var(--color-slate-800); color: var(--color-slate-800); }

  .pop {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    z-index: 20;
    width: 300px;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 10px;
    box-shadow: var(--shadow-dropdown);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .pop.right { left: auto; right: 0; }
  .pop.confirm { width: 320px; }
  .pop h4 { margin: 0; font-size: 0.8125rem; line-height: 1.3; color: var(--color-slate-900); }
  .pop h4 small { display: block; font-weight: 500; font-size: 0.6875rem; color: var(--color-primary-600); }

  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .opt {
    display: flex; align-items: center; gap: 7px;
    border: 1px solid var(--color-slate-200);
    background: var(--color-white);
    color: var(--color-slate-800);
    border-radius: var(--radius-md);
    padding: 7px 8px;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  .opt:hover { background: var(--color-slate-50); }
  .opt[aria-pressed='true'] { border-color: var(--color-primary-600); background: var(--color-primary-50); }
  .sw { width: 12px; height: 12px; border-radius: 50%; flex: none; border: 2px solid var(--color-slate-300); }
  .sw.complete { background: var(--color-emerald-600); border-color: var(--color-emerald-600); }
  .sw.in_progress { background: var(--color-primary-600); border-color: var(--color-primary-600); }
  .sw.na { background: repeating-linear-gradient(135deg, var(--color-slate-100) 0 2px, var(--color-slate-400) 2px 3px); border-color: var(--color-slate-400); }

  .hint { margin: 0; font-size: 0.7188rem; color: var(--color-slate-500); line-height: 1.4; }
  .err { margin: 0; font-size: 0.7188rem; color: var(--color-red-600); }
  .confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  .hide-note { display: flex; gap: 0.625rem; align-items: center; justify-content: flex-end; font-size: 0.75rem; color: var(--color-slate-500); min-height: 42px; flex-wrap: wrap; }
  .link-btn { background: none; border: 0; padding: 0; font-family: inherit; color: var(--color-primary-600); font-size: 0.75rem; cursor: pointer; text-decoration: underline; }
  .link-btn:disabled { color: var(--color-slate-400); cursor: default; }
</style>
