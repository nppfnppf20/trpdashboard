<script>
  // Shared date + full-text + "Generate & Fill" block for every advancement
  // add/edit form (bulk-add modals, the timeline view/edit popup, and each
  // tracker tab's inline drawer). No source-type picker — new/edited entries
  // always keep whatever source_type the caller decides (usually 'note',
  // or left unchanged on edit); this component only handles the text.
  export let date;
  export let fullText;
  export let onGenerate = null; // async () => void, or null to hide the button
  export let generating = false;
  export let canGenerate = true;
  export let generateLabel = 'Generate & Fill Rows';
  export let generateHint = 'Summarises text into ticked rows below. Rows must be selected first.';
  export let dateLabel = 'Date';
  export let fullTextLabel = 'What happened';
  export let fullTextHint = 'optional fuller detail behind the summaries';
  export let fullTextPlaceholder = 'Type the full detail of what happened (optional)…';
  export let rows = 7;
</script>

<div class="aef-field aef-field--date">
  <label class="form-label" for="aef-date">{dateLabel}</label>
  <input id="aef-date" class="form-input" type="date" bind:value={date} />
</div>

<div class="aef-field">
  <label class="form-label" for="aef-text">
    {fullTextLabel}
    {#if fullTextHint}<span class="aef-hint">{fullTextHint}</span>{/if}
  </label>
  <textarea id="aef-text" class="form-input" {rows} bind:value={fullText} placeholder={fullTextPlaceholder}></textarea>
  {#if onGenerate}
    <div class="aef-generate-row">
      <button type="button" class="aef-generate-btn" on:click={onGenerate} disabled={!canGenerate || generating}>
        {#if generating}<span class="aef-spinner"></span> Generating…{:else}<i class="las la-magic"></i> {generateLabel}{/if}
      </button>
      {#if generateHint}<span class="aef-generate-hint">{generateHint}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .aef-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .aef-field--date {
    max-width: 200px;
  }

  .aef-hint {
    font-weight: 400;
    color: var(--color-slate-400);
    margin-left: 0.4rem;
  }

  .aef-generate-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  .aef-generate-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .aef-generate-btn:hover:not(:disabled) { background: var(--color-primary-100); }
  .aef-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .aef-generate-hint { font-size: 0.74rem; color: var(--color-slate-400); }

  .aef-spinner {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border: 2px solid var(--color-primary-200);
    border-top-color: var(--color-primary-700);
    border-radius: 50%;
    animation: aef-spin 0.6s linear infinite;
  }
  @keyframes aef-spin { to { transform: rotate(360deg); } }
</style>
