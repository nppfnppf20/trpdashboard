<script>
  import { createEventDispatcher } from 'svelte';

  export let show = false;
  export let items = [];   // [{ key, surveyorOrganisation, discipline, contactName, contactEmail, state: 'pending'|'sent' }]
  export let busy = false;

  const dispatch = createEventDispatcher();

  $: pendingCount = items.filter(i => i.state === 'pending').length;
  $: disciplines = [...new Set(items.map(i => i.discipline || 'Other'))];
</script>

{#if show}
  <div class="modal-overlay" on:click|self={() => dispatch('close')} role="presentation">
    <div class="modal-content" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>Review Selections</h2>
          <p class="modal-subtitle">
            {items.length} surveyor{items.length !== 1 ? 's' : ''} · {pendingCount} still to do
          </p>
        </div>
        <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#each disciplines as discipline}
          <section class="group">
            <h3>{discipline}</h3>
            <div class="rows">
              {#each items.filter(i => (i.discipline || 'Other') === discipline) as item (item.key)}
                <div class="row" class:done={item.state === 'sent'}>
                  <div class="who">
                    <span class="org">{item.surveyorOrganisation}</span>
                    <span class="contact">
                      {item.contactName}{#if item.contactEmail} · {item.contactEmail}{/if}
                    </span>
                  </div>
                  {#if item.state === 'sent'}
                    <span class="done-pill"><i class="las la-check"></i> Sent</span>
                  {:else}
                    <div class="row-actions">
                      <button class="btn btn-secondary btn-sm" on:click={() => dispatch('draft', { item })} disabled={busy}>
                        <i class="las la-envelope"></i> Draft email
                      </button>
                      <button class="btn btn-secondary btn-sm" on:click={() => dispatch('save', { item })} disabled={busy}>
                        <i class="las la-save"></i> Save as sent
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => dispatch('back')} disabled={busy}>
          <i class="las la-arrow-left"></i> Back
        </button>
        <span class="spacer"></span>
        {#if pendingCount === 0}
          <button class="btn btn-primary" on:click={() => dispatch('close')}>Done</button>
        {:else}
          <button class="btn btn-secondary" on:click={() => dispatch('saveall')} disabled={busy}>
            <i class="las la-save"></i> Save all as sent ({pendingCount})
          </button>
          <button class="btn btn-primary" on:click={() => dispatch('draftall')} disabled={busy}>
            <i class="las la-envelope"></i> Draft all emails ({pendingCount})
          </button>
        {/if}
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
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .modal-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
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
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .group + .group {
    margin-top: 1.25rem;
  }

  .group h3 {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    color: var(--color-slate-800);
  }

  .rows {
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .row + .row {
    border-top: 1px solid var(--color-slate-200);
  }

  .row.done {
    background: var(--color-slate-50);
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .org {
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .contact {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
  }

  .row-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .done-pill {
    padding: 0.125rem 0.625rem;
    border-radius: var(--radius-pill);
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .spacer {
    flex: 1;
  }
</style>
