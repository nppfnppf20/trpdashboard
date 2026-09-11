<script>
  import { createEventDispatcher } from 'svelte';
  import { createConsultationAdvancements, suggestConsultationAdvancementSummaries } from '$lib/api/consultation.js';
  import { suggestQuoteWorkStatus } from '$lib/api/quoteActions.js';
  import { updateQuoteWorkStatus } from '$lib/api/quotes.js';
  import AdvancementEntryFields from './AdvancementEntryFields.svelte';
  import VoiceDictationButton from './VoiceDictationButton.svelte';
  import DateSuggestionPopup from './DateSuggestionPopup.svelte';

  export let show = false;
  export let projectId;
  export let responses = [];
  export let preselectedResponseId = null;   // open with one response already ticked

  const dispatch = createEventDispatcher();

  // Post-save check — advisory only, for a linked quote's work status (only
  // relevant for items tagged with a "Relevant quote"). Deliberately NOT
  // reset by the seed block below or by close(): it's a small popup shown
  // after the modal has already closed, independent of this modal's own
  // open/close lifecycle.
  let pendingSuggestions = []; // [{ key, label, kind: 'status', suggestion }]

  let advDate = '';
  let fullText = '';
  let selections = {};        // response_id -> { checked, summary }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let skippedLabels = [];       // ticked responses the source text had nothing relevant for
  let autoTickedCount = 0;      // rows the AI ticked itself (nothing was checked before generating)
  let lastGeneratedText = null; // avoid regenerating in a loop for the same text
  let error = null;
  let seeded = false;

  // Seed state whenever the modal opens
  $: if (show && !seeded) {
    advDate = new Date().toISOString().slice(0, 10);
    fullText = '';
    error = null;
    generatedNotice = false;
    skippedLabels = [];
    autoTickedCount = 0;
    lastGeneratedText = null;
    selections = {};
    for (const r of responses) {
      // Default the "relevant quote" tag: auto-select when the response has
      // exactly one linked quote, otherwise leave untagged.
      const linked = r.linked_quotes || [];
      selections[r.id] = {
        checked: r.id === preselectedResponseId,
        summary: '',
        quoteId: linked.length === 1 ? linked[0].quote_id : null,
      };
    }
    seeded = true;
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;
  $: hasBlankChecked = responses.some(r => selections[r.id]?.checked && !selections[r.id].summary.trim());
  // Enabled either when some ticked rows still need summaries, or when
  // nothing is ticked at all — in which case the AI works out which rows
  // this applies to instead of requiring them to be picked first.
  $: canGenerate = fullText.trim().length > 0 && (hasBlankChecked || checkedCount === 0);
  $: canSave = checkedCount > 0 && !hasBlankChecked;
  $: allChecked = responses.length > 0 && responses.every(r => selections[r.id]?.checked);

  function toggleSelectAll() {
    const next = !allChecked;
    const updated = {};
    for (const r of responses) updated[r.id] = { ...selections[r.id], checked: next };
    selections = updated;
  }

  function responseLabel(r) {
    return r.consultee_name;
  }

  function toggle(id) {
    selections = { ...selections, [id]: { ...selections[id], checked: !selections[id].checked } };
  }

  function onSummaryTranscript(responseId, e) {
    const text = e.detail;
    const sel = selections[responseId];
    const summary = sel.summary?.trim() ? `${sel.summary.trim()} ${text}` : text;
    selections = { ...selections, [responseId]: { ...sel, summary } };
  }

  function buildItems() {
    return responses
      .filter(r => selections[r.id]?.checked)
      .map(r => ({
        response_id: r.id,
        summary: selections[r.id].summary.trim(),
        quote_id: selections[r.id].quoteId || null,
      }));
  }

  // Fill blank ticked rows from the pasted text (consultee position, comments
  // and previous advancements are read server-side). Typed summaries are left
  // untouched — they take precedence. The model only fills blanks for
  // responses the text actually contains relevant new information for.
  //
  // If nothing is ticked at all, this instead asks the backend to read every
  // response in the tracker and work out which one(s) the text is actually
  // about — those come back in `suggestions` too, and get ticked here just
  // like an already-checked blank row would.
  async function generateSummaries() {
    if (!fullText.trim()) return;
    const items = buildItems();
    const blanks = items.filter(i => !i.summary);
    const suggestMode = items.length === 0;
    if (!suggestMode && !blanks.length) return;

    // Already generated for this exact text — don't hit the API again, just
    // refresh which ticked rows are still unresolved. Doesn't apply in
    // suggest mode: there's nothing ticked yet to "still be unresolved".
    if (!suggestMode && fullText === lastGeneratedText) {
      skippedLabels = responses.filter(r => blanks.some(b => b.response_id === r.id)).map(responseLabel);
      return;
    }

    generating = true;
    error = null;
    try {
      const { suggestions } = await suggestConsultationAdvancementSummaries(projectId, {
        full_text: fullText,
        items: items.map(i => ({
          response_id: i.response_id,
          user_summary: i.summary || null,
        })),
      });
      let newlyTicked = 0;
      for (const s of suggestions) {
        const current = selections[s.response_id];
        if (!current || (current.checked && current.summary.trim())) continue;
        if (!current.checked) newlyTicked++;
        selections[s.response_id] = { ...current, checked: true, summary: s.summary };
      }
      selections = { ...selections };
      autoTickedCount = newlyTicked;
      skippedLabels = suggestMode
        ? []
        : responses.filter(r => selections[r.id]?.checked && !selections[r.id].summary.trim()).map(responseLabel);
      lastGeneratedText = fullText;
      generatedNotice = true;
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }

  async function save() {
    const items = buildItems();

    if (!items.length) { error = 'Tick at least one response this advancement applies to.'; return; }
    if (!advDate) { error = 'A date is required.'; return; }
    if (items.some(i => !i.summary)) { error = 'Every ticked response needs a summary - type one or use Generate & Fill Rows.'; return; }

    saving = true;
    error = null;
    try {
      const rows = await createConsultationAdvancements(projectId, {
        advancement_date: advDate,
        full_text: fullText.trim() || null,
        source_type: 'note',
        items,
      });
      dispatch('done', { rows });
      saving = false;
      const capturedFullText = fullText;
      close();
      checkForQuoteStatusSuggestions(items, capturedFullText); // fire-and-forget
    } catch (err) {
      error = err.message;
      saving = false;
    }
  }

  // Advisory-only, and runs after the modal has already closed — never
  // blocks the save, never reopens the modal. Time-boxed so the backend
  // call behind this can't hang around forever in the background.
  async function checkForQuoteStatusSuggestions(items, capturedFullText) {
    const tagged = items.filter(i => i.quote_id);
    if (!tagged.length) return;
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 8000));
      const { suggestions } = await Promise.race([
        suggestQuoteWorkStatus(projectId, {
          full_text: capturedFullText.trim() || null,
          items: tagged.map(i => ({ quote_id: i.quote_id })),
        }),
        timeout,
      ]);
      if (!suggestions.length) return;
      pendingSuggestions = [...pendingSuggestions, ...suggestions.map(s => ({
        key: `status-${s.quote_id}`,
        label: responseLabel(responses.find(r => tagged.some(i => i.response_id === r.id && i.quote_id === s.quote_id)) || {}),
        kind: 'status',
        quote_id: s.quote_id,
        suggestion: { field_label: 'Work Status', value: s.status },
      }))];
    } catch (err) {
      console.error('checkForQuoteStatusSuggestions failed:', err);
    }
  }

  async function acceptPendingSuggestion(item) {
    try {
      await updateQuoteWorkStatus(item.quote_id, item.suggestion.value);
      pendingSuggestions = pendingSuggestions.filter(p => p !== item);
      return true;
    } catch (err) {
      alert('Failed to save: ' + err.message);
      return false;
    }
  }

  function dismissPendingSuggestion(item) {
    pendingSuggestions = pendingSuggestions.filter(p => p !== item);
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
        <h3>Add Advancement</h3>
        <button class="adv-close-btn" on:click={close}>&times;</button>
      </div>

      <div class="adv-body">
        <AdvancementEntryFields
          bind:date={advDate}
          bind:fullText={fullText}
          onGenerate={generateSummaries}
          {generating}
          canGenerate={canGenerate && !saving}
          generateHint="Tick rows to summarise into them, or leave everything unticked and it'll suggest which ones apply."
        />

        {#if generatedNotice}
          <div class="adv-notice">
            <i class="las la-magic"></i>
            {#if autoTickedCount > 0}
              Identified {autoTickedCount} response{autoTickedCount !== 1 ? 's' : ''} this looks relevant to and ticked {autoTickedCount !== 1 ? 'them' : 'it'} below - review before saving.
            {:else}
              Summaries generated from the pasted text - review or edit them below.
            {/if}
          </div>
        {/if}
        {#if skippedLabels.length}
          <div class="adv-skip-notice">
            <i class="las la-info-circle"></i>
            No relevant information was found for: <strong>{skippedLabels.join('; ')}</strong> - untick them or type their summaries manually.
          </div>
        {/if}

        <div class="field">
          <div class="adv-applies-header">
            <label>Applies to <span class="label-hint">tick the responses - leave a summary blank to auto-summarise from the source text above</span></label>
            <button type="button" class="select-all-btn" on:click={toggleSelectAll}>{allChecked ? 'Deselect all' : 'Select all'}</button>
          </div>
          <div class="adv-cond-list">
            {#each responses as r (r.id)}
              {@const sel = selections[r.id]}
              <div class="adv-cond-row" class:checked={sel?.checked}>
                <label class="adv-cond-check">
                  <input type="checkbox" checked={sel?.checked} on:change={() => toggle(r.id)} />
                  <span class="adv-cond-label">{responseLabel(r)}</span>
                  {#if r.position}
                    <span class="adv-cond-type">{r.position}</span>
                  {/if}
                </label>
                {#if sel?.checked}
                  {#if r.linked_quotes?.length}
                    <div class="adv-quote-picker">
                      <span class="adv-quote-picker-label">Relevant quote:</span>
                      <select class="adv-quote-select" bind:value={selections[r.id].quoteId}>
                        <option value={null}>Not relevant to a quote</option>
                        {#each r.linked_quotes as q (q.quote_id)}
                          <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                  <div class="adv-summary-wrap">
                    <textarea
                      class="adv-summary-input"
                      rows="2"
                      placeholder="Write it yourself, or leave blank to auto-summarise from the source text above"
                      bind:value={selections[r.id].summary}
                    ></textarea>
                    <VoiceDictationButton class="adv-summary-mic-btn" on:transcript={(e) => onSummaryTranscript(r.id, e)} />
                  </div>
                {/if}
              </div>
            {:else}
              <p class="adv-no-conditions">No responses in the tracker yet.</p>
            {/each}
          </div>
        </div>
      </div>

      {#if error}
        <div class="adv-error">{error}</div>
      {/if}

      <div class="adv-footer">
        <span class="adv-count-hint">{checkedCount} response{checkedCount !== 1 ? 's' : ''} selected</span>
        <div class="adv-footer-actions">
          <button class="btn-cancel" on:click={close} disabled={saving || generating}>Cancel</button>
          <button
            class="btn-save"
            on:click={save}
            disabled={saving || generating || !canSave}
            title={!canSave && checkedCount ? 'Every ticked row needs a summary before this can save' : ''}
          >
            {saving ? 'Saving…' : 'Save Advancement'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ── Post-save suggestion popup — independent of the modal above, so
     it can appear after the modal has already closed. ─────────────────── -->
<DateSuggestionPopup
  suggestions={pendingSuggestions}
  onAccept={acceptPendingSuggestion}
  onDismiss={dismissPendingSuggestion}
  onClose={() => pendingSuggestions = []}
/>

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
    border-radius: 12px;
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

  .field { display: flex; flex-direction: column; gap: 0.3rem; }

  label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .label-hint { font-weight: 400; color: var(--color-slate-400); }

  /* Applies-to header */
  .adv-applies-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .select-all-btn {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }
  .select-all-btn:hover { color: var(--color-slate-800); background: var(--color-slate-100); }

  .adv-cond-type {
    font-size: 0.64rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 7px;
    flex-shrink: 0;
    white-space: nowrap;
    margin-left: auto;
    color: var(--color-teal-600);
    background: var(--color-sky-100);
  }

  /* Response tick list */
  .adv-cond-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
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
  .adv-cond-row.checked { background: var(--color-primary-50); }
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
  .adv-summary-wrap {
    position: relative;
    margin-left: 1.5rem;
  }
  .adv-summary-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 2.35rem 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    line-height: 1.5;
    resize: vertical;
    font-size: 0.8rem;
  }
  :global(.adv-summary-mic-btn) {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.75rem;
    height: 1.75rem;
  }
  .adv-summary-input:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: var(--focus-ring-blue);
  }
  .adv-quote-picker {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: 1.5rem;
  }
  .adv-quote-picker-label { font-size: 0.76rem; font-weight: 600; color: var(--color-slate-600); }
  .adv-quote-select {
    font-size: 0.78rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-family: inherit;
    background: white;
  }
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
    color: var(--color-teal-600);
    background: var(--color-primary-50);
    border: 1px solid var(--color-sky-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .adv-skip-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--color-amber-800);
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .adv-error {
    margin: 0 1.5rem;
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
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
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-teal-600); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
