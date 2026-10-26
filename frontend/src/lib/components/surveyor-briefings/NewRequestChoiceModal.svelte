<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;

  const dispatch = createEventDispatcher();
</script>

{#if show}
  <div class="modal-overlay" on:click|self={() => dispatch('close')} role="presentation">
    <div class="modal-content" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>New Quote Request</h2>
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- The main route: big, filled and first -->
        <button class="primary-choice" on:click={() => dispatch('select')}>
          <i class="las la-user-check"></i>
          <span class="primary-text">
            <span class="primary-title">Select surveyors</span>
            <span class="primary-desc">Pick disciplines, then surveyors for each</span>
          </span>
          <i class="las la-arrow-right chevron"></i>
        </button>

        <!-- The alternative: a divider and a small, quiet button -->
        <div class="or" aria-hidden="true"><span>or</span></div>

        <button class="alt-choice" on:click={() => dispatch('draft')}>
          <i class="las la-envelope"></i>
          Draft email
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 90%;
    max-width: 440px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-slate-800);
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 1.5rem;
  }

  .primary-choice {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.25rem;
    text-align: left;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    font: inherit;
    transition: background 0.15s;
  }

  .primary-choice:hover {
    background: var(--color-primary-700);
  }

  .primary-choice > i:first-child {
    font-size: 2rem;
  }

  .primary-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .primary-title {
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .primary-desc {
    font-size: 0.8125rem;
    opacity: 0.85;
  }

  .chevron {
    font-size: 1.25rem;
  }

  .or {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1rem 0;
    color: var(--color-slate-400);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .or::before,
  .or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-slate-200);
  }

  .alt-choice {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    color: var(--color-slate-500);
    border: 1px dashed var(--color-slate-400);
    border-radius: var(--radius-pill);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
  }

  .alt-choice:hover {
    color: var(--color-primary-700);
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
  }
</style>
