<script>
  // Same "suggest, accept or decline" pattern as KeyDateSuggestionCard.svelte, for a planning stage change
  // spotted in a meeting note or a chat. Accepting makes that ONE change to that ONE stage; it never completes
  // an earlier stage or starts a later one.
  import { setPlanningStage } from '$lib/api/planningStages.js';
  import { STATUS_FOR_CHANGE } from '$lib/utils/planningStages.js';
  import { bumpPlanningStagesVersion } from '$lib/stores/planningStages.js';

  export let projectId;
  export let suggestion; // { stage_key, stage_num, stage_name, change: 'start' | 'complete' | 'na', quote, reason }
  export let onDismiss = () => {};
  export let onAccepted = () => {}; // fired once the stage has actually been saved
  export let dismissLabel = 'Not now';
  export let compact = false;

  let status = 'pending'; // 'pending' | 'saving' | 'accepted' | 'error' | 'dismissed'

  $: stageLabel = `Stage ${suggestion.stage_num} ${suggestion.stage_name}`;
  $: acceptLabel = suggestion.change === 'start' ? 'Start stage' : suggestion.change === 'complete' ? 'Mark complete' : 'Mark N/A';
  $: doneLabel = suggestion.change === 'start' ? 'Started' : suggestion.change === 'complete' ? 'Marked complete' : 'Marked N/A';

  async function accept() {
    status = 'saving';
    try {
      await setPlanningStage(projectId, suggestion.stage_key, STATUS_FOR_CHANGE[suggestion.change]);
      bumpPlanningStagesVersion();
      status = 'accepted';
      onAccepted?.();
    } catch (err) {
      console.error('Failed to save stage change', err);
      status = 'error';
    }
  }
</script>

{#if status !== 'dismissed'}
  <div class="ssc" class:ssc-compact={compact}>
    <div class="ssc-icon"><i class="las la-stream"></i></div>
    <div class="ssc-body">
      <div class="ssc-label">
        {#if suggestion.change === 'start'}Start <strong>{stageLabel}</strong>?
        {:else if suggestion.change === 'complete'}Mark <strong>{stageLabel}</strong> as complete?
        {:else}Mark <strong>{stageLabel}</strong> as not applicable?{/if}
      </div>
      {#if suggestion.quote}<div class="ssc-quote">&ldquo;{suggestion.quote}&rdquo;</div>{/if}
      {#if suggestion.reason && !compact}<div class="ssc-reason">{suggestion.reason}</div>{/if}
      {#if status === 'pending'}
        <div class="ssc-actions">
          <button class="ssc-btn ssc-btn-accept" on:click={accept}>{acceptLabel}</button>
          <button class="ssc-btn ssc-btn-dismiss" on:click={() => { status = 'dismissed'; onDismiss?.(); }}>{dismissLabel}</button>
        </div>
      {:else if status === 'saving'}
        <div class="ssc-status"><span class="ssc-spinner"></span> Saving…</div>
      {:else if status === 'accepted'}
        <div class="ssc-status ssc-status-ok"><i class="las la-check-circle"></i> {doneLabel}</div>
      {:else if status === 'error'}
        <div class="ssc-actions">
          <span class="ssc-status ssc-status-error">Failed to save.</span>
          <button class="ssc-btn ssc-btn-accept" on:click={accept}>Retry</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ssc {
    display: flex;
    gap: 0.6rem;
    padding: 0.65rem 0.75rem;
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: 8px;
  }
  .ssc-compact { padding: 0.5rem 0.6rem; margin-top: 0.4rem; }
  .ssc-icon { flex-shrink: 0; color: var(--color-primary-700); font-size: 1.1rem; line-height: 1.4; }
  .ssc-body { flex: 1; min-width: 0; }
  .ssc-label { font-size: 0.85rem; color: var(--color-slate-900); line-height: 1.4; }
  .ssc-quote { margin-top: 0.15rem; font-size: 0.78rem; font-style: italic; color: var(--color-slate-600); line-height: 1.4; }
  .ssc-reason { margin-top: 0.15rem; font-size: 0.75rem; color: var(--color-slate-500); line-height: 1.4; }

  .ssc-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .ssc-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .ssc-btn-accept { background: var(--color-primary-600); color: var(--color-white); }
  .ssc-btn-accept:hover { background: var(--color-primary-700); }
  .ssc-btn-dismiss { background: none; border-color: var(--color-primary-200); color: var(--color-primary-700); }
  .ssc-btn-dismiss:hover { background: var(--color-primary-100); }

  .ssc-status { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--color-slate-600); }
  .ssc-status-ok { color: var(--color-emerald-600); font-weight: 600; }
  .ssc-status-error { color: var(--color-red-600); }

  .ssc-spinner {
    display: inline-block;
    width: 0.75rem; height: 0.75rem;
    border: 2px solid var(--color-primary-200);
    border-top-color: var(--color-primary-700);
    border-radius: 50%;
    animation: ssc-spin 0.7s linear infinite;
  }
  @keyframes ssc-spin { to { transform: rotate(360deg); } }
</style>
