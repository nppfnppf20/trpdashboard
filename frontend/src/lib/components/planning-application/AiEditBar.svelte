<script>
  // Status bar for a quick AI edit (highlight → "ask AI to change"). Docked to
  // the bottom of the screen rather than floating under the selection, so it
  // can never sit on top of the text being changed. Shows progress while the
  // AI works, then Accept / Edit Again / Discard once the changes are in the
  // document (shown inline in the editor, pending review).
  import { createEventDispatcher, onDestroy, tick } from 'svelte';

  export let loading = false;
  export let error = null;
  export let warning = null;

  const dispatch = createEventDispatcher();

  const STEPS = [
    'Reading your document',
    'Working out what needs to change',
    'Drafting the edits',
    'Checking the changes fit',
  ];
  const STEP_MS = 4500;

  let elapsed = 0;
  let timer = null;

  $: if (loading && !timer) {
    elapsed = 0;
    timer = setInterval(() => { elapsed += 1; }, 1000);
  } else if (!loading && timer) {
    clearInterval(timer);
    timer = null;
  }

  onDestroy(() => { if (timer) clearInterval(timer); });

  $: stepIndex = Math.min(Math.floor((elapsed * 1000) / STEP_MS), STEPS.length - 1);

  // When changes land, bring the first one into view so the user can review it.
  let wasLoading = false;
  $: {
    if (wasLoading && !loading && !error) {
      tick().then(() => {
        document
          .querySelector('.quick-ai-edit-pending, .quick-ai-edit-pending-deleted')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    wasLoading = loading;
  }
</script>

<div class="ai-bar" class:ai-bar--error={!!error} role="status" aria-live="polite">
  {#if loading}
    <div class="ai-bar-row">
      <i class="las la-magic ai-bar-icon ai-bar-icon--busy"></i>
      <div class="ai-bar-text">
        <span class="ai-bar-title">{STEPS[stepIndex]}…</span>
        <span class="ai-bar-sub">{elapsed}s · larger sections can take up to a minute</span>
      </div>
      <button class="btn btn-secondary ai-bar-btn" on:click={() => dispatch('cancel')}>Cancel</button>
    </div>
    <div class="ai-bar-track"><div class="ai-bar-fill"></div></div>
  {:else if error}
    <div class="ai-bar-row">
      <i class="las la-exclamation-circle ai-bar-icon ai-bar-icon--error"></i>
      <p class="ai-bar-message">{error}</p>
      <button class="btn btn-secondary ai-bar-btn" on:click={() => dispatch('discard')}>Dismiss</button>
    </div>
  {:else}
    <div class="ai-bar-row">
      <i class="las la-check-circle ai-bar-icon"></i>
      <div class="ai-bar-text">
        <span class="ai-bar-title">AI changes ready to review</span>
        <span class="ai-bar-sub">New text is highlighted blue, removed text is struck through.</span>
        {#if warning}<span class="ai-bar-warning">{warning}</span>{/if}
      </div>
      <div class="ai-bar-actions">
        <button class="btn btn-secondary ai-bar-btn" on:click={() => dispatch('discard')}>Discard</button>
        <button class="btn btn-secondary ai-bar-btn" on:click={() => dispatch('editagain')}>Edit Again</button>
        <button class="btn btn-primary ai-bar-btn" on:click={() => dispatch('accept')}>Accept</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .ai-bar {
    position: fixed;
    bottom: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 2rem));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.7rem 0.85rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
  }
  .ai-bar--error { border-color: var(--color-red-200); }

  .ai-bar-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .ai-bar-icon {
    flex-shrink: 0;
    font-size: 1.35rem;
    color: var(--color-primary-600);
  }
  .ai-bar-icon--error { color: var(--color-red-600); }
  .ai-bar-icon--busy { animation: ai-bar-pulse 1.4s ease-in-out infinite; }

  .ai-bar-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .ai-bar-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .ai-bar-sub {
    font-size: 0.72rem;
    color: var(--color-slate-500);
  }
  .ai-bar-warning {
    font-size: 0.72rem;
    color: var(--color-amber-800);
  }
  .ai-bar-message {
    flex: 1;
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--color-slate-700);
  }

  .ai-bar-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .ai-bar-btn {
    font-size: 0.78rem;
    padding: 0.35rem 0.75rem;
    white-space: nowrap;
  }

  .ai-bar-track {
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-primary-100);
    overflow: hidden;
  }
  .ai-bar-fill {
    height: 100%;
    width: 40%;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--color-primary-200), var(--color-primary-500), var(--color-primary-200));
    animation: ai-bar-slide 1.6s ease-in-out infinite;
  }

  @keyframes ai-bar-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
  @keyframes ai-bar-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-bar-fill, .ai-bar-icon--busy { animation: none; }
    .ai-bar-fill { width: 100%; }
  }

  @media (max-width: 560px) {
    .ai-bar-row { flex-wrap: wrap; }
    .ai-bar-actions { width: 100%; justify-content: flex-end; }
  }
</style>
