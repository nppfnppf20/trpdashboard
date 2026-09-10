<script>
  // Shared "date(s) found" popup shown after an advancement is quick-added
  // (Add Advancement's manual mode, and Overview's per-row tracker quick-add)
  // — same backdrop/modal size and position as the modal that just closed,
  // so it's obvious rather than an easy-to-miss corner toast.
  import KeyDateSuggestionCard from './KeyDateSuggestionCard.svelte';

  export let suggestions = []; // [{ key, label, date_suggestion: { date, title } }]
  export let onAccept;         // (item) => Promise<boolean>
  export let onDismiss;        // (item) => void
  export let onClose;          // () => void — "Done", the close button, or backdrop click
</script>

{#if suggestions.length}
  <div class="dsp-backdrop" on:click|self={onClose} role="presentation">
    <div class="dsp-modal">
      <div class="dsp-header">
        <h3>Date{suggestions.length > 1 ? 's' : ''} found</h3>
        <button class="dsp-close-btn" on:click={onClose}>&times;</button>
      </div>
      <div class="dsp-body">
        <div class="dsp-field">
          <label class="dsp-label">Advancement saved <span class="dsp-hint">a date worth scheduling was mentioned - review before closing</span></label>
          <div class="dsp-list">
            {#each suggestions as item (item.key)}
              <div class="dsp-row">
                <span class="dsp-badge">{item.label}</span>
                <KeyDateSuggestionCard
                  suggestion={item.date_suggestion}
                  onAccept={() => onAccept(item)}
                  onDismiss={() => onDismiss(item)}
                />
              </div>
            {/each}
          </div>
        </div>
      </div>
      <div class="dsp-footer">
        <button class="dsp-done-btn" on:click={onClose}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dsp-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2100;
    padding: 1rem;
  }
  .dsp-modal {
    background: var(--color-white);
    border-radius: 12px;
    width: 95%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
    overflow: hidden;
  }
  .dsp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .dsp-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
    flex-shrink: 0;
  }
  .dsp-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
  }
  .dsp-close-btn:hover { color: var(--color-slate-800); }

  .dsp-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }
  .dsp-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .dsp-label { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); }
  .dsp-hint { font-weight: 400; color: var(--color-slate-400); }

  .dsp-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .dsp-row {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .dsp-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-700);
    background: var(--color-slate-100);
    border-radius: 999px;
    padding: 2px 9px;
    align-self: flex-start;
  }

  .dsp-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .dsp-done-btn {
    padding: 0.45rem 1.1rem;
    background: var(--color-primary-600);
    color: var(--color-white);
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .dsp-done-btn:hover { background: var(--color-teal-600); }
</style>
