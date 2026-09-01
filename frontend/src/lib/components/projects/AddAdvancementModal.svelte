<script>
  import { createEventDispatcher } from 'svelte';
  import { createConditionAdvancements, suggestConditionAdvancementSummaries } from '$lib/api/conditions.js';
  import AdvancementEntryFields from './AdvancementEntryFields.svelte';

  export let show = false;
  export let projectId;
  export let conditions = [];
  export let preselectedConditionId = null;   // open with one condition already ticked

  const dispatch = createEventDispatcher();

  let advDate = '';
  let fullText = '';
  let selections = {};        // condition_id -> { checked, summary }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let skippedLabels = [];       // ticked conditions the source text had nothing relevant for
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
    for (const c of conditions) {
      // Default the "relevant quote" tag: auto-select when the condition has
      // exactly one linked quote, otherwise leave untagged.
      const linked = c.linked_quotes || [];
      selections[c.id] = {
        checked: c.id === preselectedConditionId,
        summary: '',
        reqIds: {},
        quoteId: linked.length === 1 ? linked[0].quote_id : null,
      };
    }
    seeded = true;
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;
  $: hasBlankChecked = conditions.some(c => selections[c.id]?.checked && !selections[c.id].summary.trim());
  // Enabled either when some ticked rows still need summaries, or when
  // nothing is ticked at all — in which case the AI works out which rows
  // this applies to instead of requiring them to be picked first.
  $: canGenerate = fullText.trim().length > 0 && (hasBlankChecked || checkedCount === 0);
  $: canSave = checkedCount > 0 && !hasBlankChecked;
  $: allChecked = conditions.length > 0 && conditions.every(c => selections[c.id]?.checked);

  function toggleSelectAll() {
    const next = !allChecked;
    const updated = {};
    for (const c of conditions) updated[c.id] = { ...selections[c.id], checked: next };
    selections = updated;
  }

  function conditionLabel(c) {
    return `${c.condition_number ? c.condition_number + '. ' : ''}${c.title}`;
  }

  // ── Sort the tick list: by condition number, or by type priority ──────────
  let sortBy = 'number';   // 'number' | 'type'

  const TYPE_PRIORITY = {
    'Pre-Commencement': 1,
    'Action Required (not Pre-Commencement)': 2,
    'Pre-Beneficial Use': 3,
    'Compliance': 4,
    'Informative': 5,
  };
  function typePriority(t) { return TYPE_PRIORITY[t] || 6; }

  function conditionNumberValue(num) {
    const digits = (num || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 999999;
  }

  $: displayConditions = [...conditions].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'type') cmp = typePriority(a.condition_type) - typePriority(b.condition_type);
    if (cmp === 0) cmp = conditionNumberValue(a.condition_number) - conditionNumberValue(b.condition_number);
    if (cmp === 0) cmp = a.id - b.id;
    return cmp;
  });

  const TYPE_BADGE_CLASS = {
    'Pre-Commencement': 'adv-type-red',
    'Pre-Beneficial Use': 'adv-type-blue',
    'Action Required (not Pre-Commencement)': 'adv-type-orange',
    'Compliance': 'adv-type-green',
    'Informative': 'adv-type-green',
  };

  function shortType(t) {
    return t === 'Action Required (not Pre-Commencement)' ? 'Action Required' : t;
  }

  function toggle(id) {
    selections = { ...selections, [id]: { ...selections[id], checked: !selections[id].checked } };
  }

  function toggleReq(conditionId, reqId) {
    const sel = selections[conditionId];
    selections = {
      ...selections,
      [conditionId]: { ...sel, reqIds: { ...sel.reqIds, [reqId]: !sel.reqIds[reqId] } },
    };
  }

  function buildItems() {
    return conditions
      .filter(c => selections[c.id]?.checked)
      .map(c => ({
        condition_id: c.id,
        summary: selections[c.id].summary.trim(),
        requirement_ids: Object.entries(selections[c.id].reqIds)
          .filter(([, on]) => on)
          .map(([id]) => parseInt(id, 10)),
        quote_id: selections[c.id].quoteId || null,
      }));
  }

  // Fill blank ticked rows from the pasted text (condition wording, reason and
  // previous advancements are read server-side). Typed summaries are left
  // untouched — they take precedence. The model only fills blanks for
  // conditions the text actually contains relevant new information for.
  //
  // If nothing is ticked at all, this instead asks the backend to read every
  // condition in the tracker and work out which one(s) the text is actually
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
      skippedLabels = conditions.filter(c => blanks.some(b => b.condition_id === c.id)).map(conditionLabel);
      return;
    }

    generating = true;
    error = null;
    try {
      const { suggestions } = await suggestConditionAdvancementSummaries(projectId, {
        full_text: fullText,
        items: items.map(i => ({
          condition_id: i.condition_id,
          user_summary: i.summary || null,
          requirement_ids: i.requirement_ids,
        })),
      });
      let newlyTicked = 0;
      for (const s of suggestions) {
        const current = selections[s.condition_id];
        if (!current || (current.checked && current.summary.trim())) continue;
        if (!current.checked) newlyTicked++;
        selections[s.condition_id] = { ...current, checked: true, summary: s.summary };
      }
      selections = { ...selections };
      autoTickedCount = newlyTicked;
      skippedLabels = suggestMode
        ? []
        : conditions.filter(c => selections[c.id]?.checked && !selections[c.id].summary.trim()).map(conditionLabel);
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

    if (!items.length) { error = 'Tick at least one condition this advancement applies to.'; return; }
    if (!advDate) { error = 'A date is required.'; return; }
    if (items.some(i => !i.summary)) { error = 'Every ticked condition needs a summary - type one or use Generate & Fill Rows.'; return; }

    saving = true;
    error = null;
    try {
      const rows = await createConditionAdvancements(projectId, {
        advancement_date: advDate,
        full_text: fullText.trim() || null,
        source_type: 'note',
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
              Identified {autoTickedCount} condition{autoTickedCount !== 1 ? 's' : ''} this looks relevant to and ticked {autoTickedCount !== 1 ? 'them' : 'it'} below - review before saving.
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
            <label>Applies to <span class="label-hint">tick the conditions - leave a summary blank to auto-summarise from the source text above</span></label>
            <div class="sort-pills">
              <button type="button" class="select-all-btn" on:click={toggleSelectAll}>{allChecked ? 'Deselect all' : 'Select all'}</button>
              <span class="sort-label">Sort:</span>
              <button type="button" class="sort-pill" class:active={sortBy === 'number'} on:click={() => sortBy = 'number'}>No.</button>
              <button type="button" class="sort-pill" class:active={sortBy === 'type'} on:click={() => sortBy = 'type'} title="Pre-Commencement first, then Action Required, Pre-Beneficial Use, Compliance, Informative">Type</button>
            </div>
          </div>
          <div class="adv-cond-list">
            {#each displayConditions as c (c.id)}
              {@const sel = selections[c.id]}
              <div class="adv-cond-row" class:checked={sel?.checked}>
                <label class="adv-cond-check">
                  <input type="checkbox" checked={sel?.checked} on:change={() => toggle(c.id)} />
                  <span class="adv-cond-label">{conditionLabel(c)}</span>
                  {#if c.condition_type}
                    <span class="adv-cond-type {TYPE_BADGE_CLASS[c.condition_type] || ''}">{shortType(c.condition_type)}</span>
                  {/if}
                </label>
                {#if sel?.checked}
                  {#if c.requirements?.length}
                    <div class="adv-req-list">
                      {#each c.requirements as req (req.id)}
                        <label class="adv-req-check">
                          <input type="checkbox" checked={!!sel.reqIds[req.id]} on:change={() => toggleReq(c.id, req.id)} />
                          <span class="adv-req-label" class:adv-req-complete={req.status === 'Complete'}>{req.requirement_text}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                  {#if c.linked_quotes?.length}
                    <div class="adv-quote-picker">
                      <span class="adv-quote-picker-label">Relevant quote:</span>
                      <select class="adv-quote-select" bind:value={selections[c.id].quoteId}>
                        <option value={null}>Not relevant to a quote</option>
                        {#each c.linked_quotes as q (q.quote_id)}
                          <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                  <textarea
                    class="adv-summary-input"
                    rows="2"
                    placeholder="Write it yourself, or leave blank to auto-summarise from the source text above"
                    bind:value={selections[c.id].summary}
                  ></textarea>
                {/if}
              </div>
            {:else}
              <p class="adv-no-conditions">No conditions in the tracker yet.</p>
            {/each}
          </div>
        </div>
      </div>

      {#if error}
        <div class="adv-error">{error}</div>
      {/if}

      <div class="adv-footer">
        <span class="adv-count-hint">{checkedCount} condition{checkedCount !== 1 ? 's' : ''} selected</span>
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

  /* Applies-to header with sort pills */
  .adv-applies-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .sort-pills {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .sort-label { font-size: 0.72rem; color: var(--color-slate-400); margin-right: 2px; }
  .sort-pill {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .sort-pill:hover { color: var(--color-slate-800); }
  .sort-pill.active {
    background: var(--color-violet-100);
    border-color: var(--color-violet-300);
    color: var(--color-violet-600);
    font-weight: 600;
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
    margin-right: 6px;
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
  }
  .adv-type-red    { color: var(--color-red-800); background: var(--color-red-100); }
  .adv-type-blue   { color: var(--color-primary-600); background: var(--color-primary-100); }
  .adv-type-orange { color: var(--color-amber-600); background: var(--color-orange-100); }
  .adv-type-green  { color: var(--color-emerald-600); background: var(--color-emerald-100); }

  /* Condition tick list */
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
  .adv-summary-input {
    margin-left: 1.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    line-height: 1.5;
    resize: vertical;
    font-size: 0.8rem;
  }
  .adv-summary-input:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: var(--focus-ring-blue);
  }
  .adv-req-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-left: 1.5rem;
    padding: 0.375rem 0.5rem;
    background: var(--color-white);
    border: 1px solid var(--color-violet-200);
    border-radius: 6px;
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
  .adv-req-check {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    cursor: pointer;
    font-weight: 400;
  }
  .adv-req-check input { margin-top: 2px; }
  .adv-req-label {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--color-slate-600);
  }
  .adv-req-complete { color: var(--color-slate-400); text-decoration: line-through; }
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
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
