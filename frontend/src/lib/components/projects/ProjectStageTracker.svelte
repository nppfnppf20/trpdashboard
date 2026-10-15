<script>
  import { PLANNING_STAGES, STAGE_STATUS_LABEL } from '$lib/utils/planningStages.js';
  import { openProjectModal } from '$lib/stores/projectViewModal.js';
  import { selectProject } from '$lib/stores/projectSelection.js';

  export let projects = [];
  export let stageMap = new Map();   // project id -> { applicable, stages: { <key>: status } }
  export let stagesLoaded = false;


  const statusOf = (project, key) => stageMap.get(project.id)?.stages[key] || 'not_started';
  const notApplicable = project => stageMap.get(project.id)?.applicable === false;
  // Same as picking the project in the sidebar switcher: select it, then open its Overview.
  function openOverview(id) {
    selectProject(id);
    openProjectModal(id, 'details');
  }

  const subline = project => [project.client, (project.sectors || []).join(', ')].filter(Boolean).join(' · ');
</script>

<div class="tracker">
  <div class="tracker-bar">
    <div class="legend">
      <span><i class="sq complete"></i>Complete</span>
      <span><i class="sq in_progress"></i>In progress</span>
      <span><i class="sq not_started"></i>Not started</span>
      <span><i class="sq na"></i>Not applicable</span>
    </div>
  </div>

  {#if !stagesLoaded}
    <p class="unavailable">Planning stages could not be loaded, so they are not shown. The Information view still works.</p>
  {:else}
    <div class="scroll">
      <div class="grid">
        <div class="h-name">Project</div>
        {#each PLANNING_STAGES as stage}
          <div class="h-stage">
            <b>Stage {stage.num}</b>
            <span>{stage.name}</span>
            <small>{stage.sub}</small>
          </div>
        {/each}

        {#each projects as project (project.id)}
          <div class="name-cell">
            <button class="name-btn" on:click={() => openOverview(project.id)}>{project.project_name}</button>
            {#if subline(project)}<small>{subline(project)}</small>{/if}
          </div>
          {#if notApplicable(project)}
            <div class="na-all">Planning stages not applicable</div>
          {:else}
            {#each PLANNING_STAGES as stage}
              {@const status = statusOf(project, stage.key)}
              <div class="cell">
                <span class="sq mk {status}" title="Stage {stage.num} {stage.name}: {STAGE_STATUS_LABEL[status]}"></span>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .tracker { min-width: 0; }

  .tracker-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--color-slate-500); align-items: center; }
  .legend span { display: inline-flex; align-items: center; gap: 0.375rem; }

  .scroll { overflow-x: auto; }
  .grid {
    display: grid;
    grid-template-columns: 220px repeat(7, minmax(92px, 1fr));
    min-width: 864px;
    align-items: stretch;
  }

  .h-name {
    align-self: end;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-slate-500);
  }
  .h-stage {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 2px;
    padding: 0 0.5rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .h-stage b { font-size: 0.6875rem; font-weight: 600; color: var(--color-primary-600); }
  .h-stage span { font-size: 0.8125rem; font-weight: 600; line-height: 1.25; color: var(--color-slate-900); }
  .h-stage small { font-size: 0.6875rem; line-height: 1.25; color: var(--color-slate-500); }

  .name-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.625rem 0.625rem 0.625rem 0;
    border-bottom: 1px solid var(--color-slate-200);
    min-width: 0;
  }
  .name-btn {
    background: none;
    border: 0;
    padding: 0;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-900);
    text-align: left;
    cursor: pointer;
  }
  .name-btn:hover { color: var(--color-primary-600); }
  .name-cell small { font-size: 0.75rem; color: var(--color-slate-500); }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .na-all {
    grid-column: span 7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    border-bottom: 1px solid var(--color-slate-200);
  }

  .sq {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1.5px solid var(--color-slate-300);
    background: var(--color-white);
    box-sizing: border-box;
  }
  /* Pill markers: 52 by 20, fully rounded; the legend uses a smaller one. */
  .sq.mk { width: 52px; height: 20px; border-radius: 10px; }
  .legend .sq { width: 24px; height: 12px; border-radius: 6px; }
  .sq.complete { background: var(--color-emerald-100); border-color: var(--color-emerald-600); }
  .sq.in_progress { background: var(--color-primary-600); border-color: var(--color-primary-600); }
  .sq.na {
    background: repeating-linear-gradient(135deg, var(--color-slate-100) 0 3px, var(--color-slate-300) 3px 4px);
    border-color: var(--color-slate-400);
  }

  .unavailable { font-size: 0.875rem; color: var(--color-slate-500); }
</style>
