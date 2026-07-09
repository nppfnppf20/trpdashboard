<script>
  // Clone of projects/AddAdvancementModal.svelte for the instructed surveys
  // actions tracker: one dated update fans out to the ticked surveys.
  import { createEventDispatcher } from 'svelte';
  import { createQuoteActions, suggestQuoteActionSummaries } from '$lib/api/quoteActions.js';

  export let show = false;
  export let projectId;
  export let quotes = [];              // instructed quotes for the project
  export let preselectedQuoteId = null; // open with one survey already ticked

  const dispatch = createEventDispatcher();

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

    if (!items.length) { error = 'Tick at least one survey this action applies to.'; return; }
    if (!actionDate) { error = 'A date is required.'; return; }

    // Blank summaries: generate them from the pasted text (survey scope and
    // previous actions are read server-side). Typed summaries are left
    // untouched — they take precedence.
    const blanks = items.filter(i => !i.summary);
    if (blanks.length) {
      if (!fullText.trim()) {
        error = 'Paste the email trail / note text so summaries can be generated, or type a summary under each ticked survey.';
        return;
      }
      generating = true;
      error = null;
      try {
        const { suggestions } = await suggestQuoteActionSummaries(projectId, {
          full_text: fullText,
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
        <h3>Add Action</h3>
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
            <span class="label-hint">{sourceType === 'email' ? 'paste the full trail — kept as the source record' : 'optional fuller detail behind the summaries'}</span>
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
            <i class="las la-magic"></i> Summaries generated from the pasted text — review or edit them, then press Save again.
          </div>
        {/if}

        <div class="field">
          <label>Applies to <span class="label-hint">tick the surveys — leave a summary blank to auto-summarise from the pasted text</span></label>
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
                    placeholder="Optional — leave blank to auto-summarise; anything typed here takes precedence"
                    bind:value={selections[q.id].summary}
                  />
                {/if}
              </div>
            {:else}
              <p class="adv-no-conditions">No instructed surveys yet.</p>
            {/each}
          </div>
        </div>
      </div>

      {#if error}
        <div class="adv-error">{error}</div>
      {/if}

      <div class="adv-footer">
        <span class="adv-count-hint">{checkedCount} survey{checkedCount !== 1 ? 's' : ''} selected</span>
        <div class="adv-footer-actions">
          <button class="btn-cancel" on:click={close} disabled={saving || generating}>Cancel</button>
          <button class="btn-save" on:click={save} disabled={saving || generating}>
            {#if generating}Summarising…{:else if saving}Saving…{:else if generatedNotice}Confirm & Save{:else}Save Action{/if}
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
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .adv-modal {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 760px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .adv-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .adv-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
  }
  .adv-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #64748b;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .adv-close-btn:hover { color: #1e293b; }

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
    color: #475569;
  }
  .label-hint { font-weight: 400; color: #94a3b8; }

  input[type="date"], input[type="text"], textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    resize: vertical;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px #f3e8ff;
  }

  /* Source toggle */
  .adv-source-toggle {
    display: flex;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
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
    color: #64748b;
    background: #f8fafc;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .adv-source-btn:not(:last-child) { border-right: 1px solid #e2e8f0; }
  .adv-source-btn.active { color: #9333ea; background: #faf5ff; font-weight: 600; }

  /* Survey tick list */
  .adv-cond-list {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .adv-cond-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .adv-cond-row:last-child { border-bottom: none; }
  .adv-cond-row.checked { background: #faf5ff; }
  .adv-cond-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 400;
  }
  .adv-cond-label {
    font-size: 0.83rem;
    color: #1e293b;
    font-weight: 500;
  }
  .adv-summary-input { margin-left: 1.5rem; }
  .adv-no-conditions {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.82rem;
    color: #94a3b8;
    text-align: center;
  }

  .adv-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #7e22ce;
    background: #faf5ff;
    border: 1px solid #e9d5ff;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .adv-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .adv-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .adv-count-hint { font-size: 0.8rem; color: #64748b; }
  .adv-footer-actions { display: flex; gap: 0.5rem; }
  .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: #64748b;
  }
  .btn-cancel:hover { background: #f8fafc; }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: #7e22ce; }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
