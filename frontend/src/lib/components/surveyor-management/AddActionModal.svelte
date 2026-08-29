<script>
  // Clone of projects/AddAdvancementModal.svelte for the instructed surveys
  // actions tracker: one dated update fans out to the ticked surveys.
  import { createEventDispatcher } from 'svelte';
  import { createQuoteActions, suggestQuoteActionSummaries } from '$lib/api/quoteActions.js';

  export let show = false;
  export let projectId;
  export let quotes = [];              // quotes for the project (instructed only, or all at quote stage)
  export let preselectedQuoteId = null; // open with one survey already ticked
  export let stage = 'instructed';     // 'instructed' | 'quote' — stamped on new entries, picks the LLM prompt

  const dispatch = createEventDispatcher();

  $: noun = stage === 'quote' ? 'quote' : 'survey';

  let actionDate = '';
  let sourceType = 'email';   // 'email' | 'note'
  let fullText = '';
  let selections = {};        // quote_id -> { checked, summary }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let error = null;
  let seeded = false;

  // Seed state whenever the modal opens
  $: if (show && !seeded) {
    actionDate = new Date().toISOString().slice(0, 10);
    sourceType = 'email';
    fullText = '';
    error = null;
    generatedNotice = false;
    selections = {};
    for (const q of quotes) {
      selections[q.id] = { checked: q.id === preselectedQuoteId, summary: '' };
    }
    seeded = true;
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;

  function quoteLabel(q) {
    return `${q.discipline || 'Unknown discipline'} · ${q.surveyor_organisation || 'Unknown surveyor'}`;
  }

  function toggle(id) {
    selections = { ...selections, [id]: { ...selections[id], checked: !selections[id].checked } };
  }

  async function save() {
    const items = quotes
      .filter(q => selections[q.id]?.checked)
      .map(q => ({
        quote_id: q.id,
        summary: selections[q.id].summary.trim(),
      }));

    if (!items.length) { error = `Tick at least one ${noun} this update applies to.`; return; }
    if (!actionDate) { error = 'A date is required.'; return; }

    // Blank summaries: generate them from the pasted text (survey scope and
    // previous actions are read server-side). Typed summaries are left
    // untouched — they take precedence.
    const blanks = items.filter(i => !i.summary);
    if (blanks.length) {
      if (!fullText.trim()) {
        error = `Paste the email trail / note text so summaries can be generated, or type a summary under each ticked ${noun}.`;
        return;
      }
      generating = true;
      error = null;
      try {
        const { suggestions } = await suggestQuoteActionSummaries(projectId, {
          full_text: fullText,
          stage,
          items: items.map(i => ({
            quote_id: i.quote_id,
            user_summary: i.summary || null,
          })),
        });
        for (const s of suggestions) {
          if (selections[s.quote_id]?.checked && !selections[s.quote_id].summary.trim()) {
            selections[s.quote_id] = { ...selections[s.quote_id], summary: s.summary };
          }
        }
        selections = { ...selections };
        generatedNotice = true;
      } catch (err) {
        error = err.message;
      } finally {
        generating = false;
      }
      return; // review the generated summaries, then Save again
    }

    saving = true;
    error = null;
    try {
      const rows = await createQuoteActions(projectId, {
        action_date: actionDate,
        full_text: fullText.trim() || null,
        source_type: sourceType,
        stage,
        items,
      });
      dispatch('done', { rows });
      saving = false;
      close();
    } catch (err) {
      error = err.message;
      saving = false;
    }
  }

  function close() {
    if (saving || generating) return;
    show = false;
    seeded = false;
    dispatch('close');
  }
</script>

{#if show}
  <div class="adv-backdrop" on:click|self={close} role="presentation">
    <div class="adv-modal">
      <div class="adv-header">
        <h3>Add Progress</h3>
        <button class="adv-close-btn" on:click={close}>&times;</button>
      </div>

      <div class="adv-body">
        <div class="adv-row two-col">
          <div class="field field--date">
            <label>Date</label>
            <input type="date" bind:value={actionDate} />
          </div>
          <div class="field field--source">
            <label>Source</label>
            <div class="adv-source-toggle">
              <button class="adv-source-btn" class:active={sourceType === 'email'} on:click={() => sourceType = 'email'}>
                <i class="las la-envelope"></i> Email trail
              </button>
              <button class="adv-source-btn" class:active={sourceType === 'note'} on:click={() => sourceType = 'note'}>
                <i class="las la-sticky-note"></i> Note
              </button>
            </div>
          </div>
        </div>

        <div class="field">
          <label>
            {sourceType === 'email' ? 'Email trail' : 'What happened'}
            <span class="label-hint">{sourceType === 'email' ? 'paste the full trail - kept as the source record' : 'optional fuller detail behind the summaries'}</span>
          </label>
          <textarea
            rows="7"
            bind:value={fullText}
            placeholder={sourceType === 'email'
              ? 'Paste the email trail here…'
              : 'Type the full detail of what happened (optional)…'}
          ></textarea>
        </div>

        {#if generatedNotice}
          <div class="adv-notice">
            <i class="las la-magic"></i> Summaries generated from the pasted text - review or edit them, then press Save again.
          </div>
        {/if}

        <div class="field">
          <label>Applies to <span class="label-hint">tick the {noun}s - leave a summary blank to auto-summarise from the pasted text</span></label>
          <div class="adv-cond-list">
            {#each quotes as q (q.id)}
              {@const sel = selections[q.id]}
              <div class="adv-cond-row" class:checked={sel?.checked}>
                <label class="adv-cond-check">
                  <input type="checkbox" checked={sel?.checked} on:change={() => toggle(q.id)} />
                  <span class="adv-cond-label">{quoteLabel(q)}</span>
                </label>
                {#if sel?.checked}
                  <input
                    type="text"
                    class="adv-summary-input"
                    placeholder="Optional - leave blank to auto-summarise; anything typed here takes precedence"
                    bind:value={selections[q.id].summary}
                  />
                {/if}
              </div>
            {:else}
              <p class="adv-no-conditions">{stage === 'quote' ? 'No quotes yet.' : 'No instructed surveys yet.'}</p>
            {/each}
          </div>
        </div>
      </div>

      {#if error}
        <div class="adv-error">{error}</div>
      {/if}

      <div class="adv-footer">
        <span class="adv-count-hint">{checkedCount} {noun}{checkedCount !== 1 ? 's' : ''} selected</span>
        <div class="adv-footer-actions">
          <button class="btn-cancel" on:click={close} disabled={saving || generating}>Cancel</button>
          <button class="btn-save" on:click={save} disabled={saving || generating}>
            {#if generating}Summarising…{:else if saving}Saving…{:else if generatedNotice}Confirm & Save{:else}Save Progress{/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .adv-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .adv-modal {
    background: white;
    border-radius: var(--radius-lg);
    width: 95%;
    max-width: 760px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px var(--overlay-bg);
    overflow: hidden;
  }

  .adv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .adv-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .adv-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .adv-close-btn:hover { color: var(--color-slate-800); }

  .adv-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .adv-row { display: flex; flex-direction: column; gap: 0.5rem; }
  .adv-row.two-col { flex-direction: row; gap: 0.75rem; align-items: flex-start; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field--date { flex: 0 0 170px; }
  .field--source { flex: 1; }

  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .label-hint { font-weight: 400; color: var(--color-slate-400); }

  input[type="date"], input[type="text"], textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    resize: vertical;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--color-purple-600);
    box-shadow: 0 0 0 3px var(--color-violet-100);
  }

  /* Source toggle */
  .adv-source-toggle {
    display: flex;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    overflow: hidden;
    align-self: flex-start;
  }
  .adv-source-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-500);
    background: var(--color-slate-50);
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .adv-source-btn:not(:last-child) { border-right: 1px solid var(--color-slate-200); }
  .adv-source-btn.active { color: var(--color-purple-600); background: var(--color-purple-50); font-weight: 600; }

  /* Survey tick list */
  .adv-cond-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .adv-cond-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-slate-100);
  }
  .adv-cond-row:last-child { border-bottom: none; }
  .adv-cond-row.checked { background: var(--color-purple-50); }
  .adv-cond-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 400;
  }
  .adv-cond-label {
    font-size: 0.83rem;
    color: var(--color-slate-800);
    font-weight: 500;
  }
  .adv-summary-input { margin-left: 1.5rem; }
  .adv-no-conditions {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.82rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .adv-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--color-purple-700);
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
  }

  .adv-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .adv-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .adv-count-hint { font-size: 0.8rem; color: var(--color-slate-500); }
  .adv-footer-actions { display: flex; gap: 0.5rem; }
  .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
