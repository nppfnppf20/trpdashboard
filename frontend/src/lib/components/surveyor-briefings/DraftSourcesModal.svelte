<script>
  import { createEventDispatcher } from 'svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';

  export let show = false;
  export let projectUniqueId = null;
  export let draftCount = 1;   // how many emails are about to be drafted

  const dispatch = createEventDispatcher();

  let picker; // bind:this - used to clear ticks each time the popup opens
  let sources = [];
  let overBudget = false;
  let guidance = '';

  let wasShown = false;
  $: if (show && !wasShown) {
    wasShown = true;
    guidance = '';
    picker?.reset();
  } else if (!show) {
    wasShown = false;
  }

  $: canDraft = !overBudget && (sources.length > 0 || guidance.trim().length > 0);

  function go() {
    dispatch('go', { sources, guidance: guidance.trim() });
  }
</script>

{#if show}
  <div class="overlay" on:click|self={() => dispatch('close')} role="presentation">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="header">
        <div class="header-left">
          <i class="las la-magic"></i>
          <h3>Draft {draftCount > 1 ? `${draftCount} emails` : 'email'}</h3>
        </div>
        <button class="close" on:click={() => dispatch('close')} aria-label="Close"><i class="las la-times"></i></button>
      </div>

      <div class="body">
        <NoteSourcePicker
          bind:this={picker}
          {projectUniqueId}
          title="Notes and Docs"
          hint="Tick the notes and docs the AI should draft the intro and Project Information from, or leave empty and give instructions below."
          bind:selectedSources={sources}
          bind:overBudget
        />

        <div class="field">
          <label for="draft-sources-guidance">Instructions (optional)</label>
          <textarea
            id="draft-sources-guidance"
            rows="3"
            bind:value={guidance}
            placeholder="Anything the AI should focus on or rely on for these emails."
          ></textarea>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-secondary" on:click={() => dispatch('close')}>Cancel</button>
        <span class="spacer"></span>
        <button class="btn btn-secondary" on:click={() => dispatch('skip')} title="Use the template as it is, with no AI drafting">
          Template only
        </button>
        <button class="btn btn-primary" on:click={go} disabled={!canDraft}>
          <i class="las la-magic"></i> Draft with notes
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-primary-600);
  }

  .header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .close {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--color-slate-400);
    cursor: pointer;
  }

  .close:hover {
    color: var(--color-slate-800);
  }

  .body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-700);
  }

  .field textarea {
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    font: inherit;
    resize: vertical;
  }

  .field textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .spacer {
    flex: 1;
  }
</style>
