<script>
  import { createEventDispatcher } from 'svelte';
  import { createConditionAdvancements, suggestConditionAdvancementSummaries } from '$lib/api/conditions.js';

  export let show = false;
  export let projectId;
  export let conditions = [];
  export let preselectedConditionId = null;   // open with one condition already ticked

  const dispatch = createEventDispatcher();

  let advDate = '';
  let sourceType = 'note';   // 'note' | 'email'
  let fullText = '';
  let selections = {};        // condition_id -> { checked, summary }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let skippedLabels = [];       // ticked conditions the source text had nothing relevant for
  let lastGeneratedText = null; // avoid regenerating in a loop for the same text
  let error = null;
  let seeded = false;

  // Seed state whenever the modal opens
  $: if (show && !seeded) {
    advDate = new Date().toISOString().slice(0, 10);
    sourceType = 'note';
    fullText = '';
    error = null;
    generatedNotice = false;
    skippedLabels = [];
    lastGeneratedText = null;
    selections = {};
    for (const c of conditions) {
      selections[c.id] = { checked: c.id === preselectedConditionId, summary: '', reqIds: {} };
    }
    seeded = true;
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;

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

  async function save() {
    const items = conditions
      .filter(c => selections[c.id]?.checked)
      .map(c => ({
        condition_id: c.id,
        summary: selections[c.id].summary.trim(),
        requirement_ids: Object.entries(selections[c.id].reqIds)
          .filter(([, on]) => on)
          .map(([id]) => parseInt(id, 10)),
      }));

    if (!items.length) { error = 'Tick at least one condition this advancement applies to.'; return; }
    if (!advDate) { error = 'A date is required.'; return; }

    // Blank summaries: generate them from the pasted text (condition wording,
    // reason and previous advancements are read server-side). Typed summaries
    // are left untouched — they take precedence. The model only fills blanks
    // for conditions the text actually contains relevant new information for.
    const blanks = items.filter(i => !i.summary);
    if (blanks.length) {
      if (!fullText.trim()) {
        error = 'Paste the email trail / note text so summaries can be generated, or type a summary under each ticked condition.';
        return;
      }
      // Already generated for this exact text and some ticked conditions came
      // back with nothing relevant — don't regenerate in a loop
      if (fullText === lastGeneratedText) {
        const blankLabels = conditions.filter(c => blanks.some(b => b.condition_id === c.id)).map(conditionLabel);
        error = `The pasted text had no relevant information for: ${blankLabels.join('; ')}. Untick them, type their summaries manually, or change the pasted text.`;
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
        for (const s of suggestions) {
          if (selections[s.condition_id]?.checked && !selections[s.condition_id].summary.trim()) {
            selections[s.condition_id] = { ...selections[s.condition_id], summary: s.summary };
          }
        }
        selections = { ...selections };
        skippedLabels = conditions
          .filter(c => selections[c.id]?.checked && !selections[c.id].summary.trim())
          .map(conditionLabel);
        lastGeneratedText = fullText;
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
      const rows = await createConditionAdvancements(projectId, {
        advancement_date: advDate,
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
        <h3>Add Advancement</h3>
        <button class="adv-close-btn" on:click={close}>&times;</button>
      </div>

      <div class="adv-body">
        <div class="adv-row two-col">
          <div class="field field--date">
            <label>Date</label>
            <input type="date" bind:value={advDate} />
          </div>
          <div class="field field--source">
            <label>Source</label>
            <div class="adv-source-toggle">
              <button class="adv-source-btn" class:active={sourceType === 'note'} on:click={() => sourceType = 'note'}>
                <i class="las la-sticky-note"></i> Note
              </button>
              <button class="adv-source-btn" class:active={sourceType === 'email'} on:click={() => sourceType = 'email'}>
                <i class="las la-envelope"></i> Email trail
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
          {#if skippedLabels.length}
            <div class="adv-skip-notice">
              <i class="las la-info-circle"></i>
              No relevant information was found for: <strong>{skippedLabels.join('; ')}</strong> — untick them or type their summaries manually.
            </div>
          {/if}
        {/if}

        <div class="field">
          <div class="adv-applies-header">
            <label>Applies to <span class="label-hint">tick the conditions — leave a summary blank to auto-summarise from the pasted text</span></label>
            <div class="sort-pills">
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
                  <textarea
                    class="adv-summary-input"
                    rows="2"
                    placeholder="Optional — leave blank to auto-summarise; anything typed here takes precedence"
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
          <button class="btn-save" on:click={save} disabled={saving || generating}>
            {#if generating}Summarising…{:else if saving}Saving…{:else if generatedNotice}Confirm & Save{:else}Save Advancement{/if}
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
  .sort-label { font-size: 0.72rem; color: #94a3b8; margin-right: 2px; }
  .sort-pill {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.72rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .sort-pill:hover { color: #1e293b; }
  .sort-pill.active {
    background: #f3e8ff;
    border-color: #d8b4fe;
    color: #7c3aed;
    font-weight: 600;
  }

  .adv-cond-type {
    font-size: 0.64rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 7px;
    flex-shrink: 0;
    white-space: nowrap;
    margin-left: auto;
  }
  .adv-type-red    { color: #b91c1c; background: #fee2e2; }
  .adv-type-blue   { color: #2563eb; background: #dbeafe; }
  .adv-type-orange { color: #ea580c; background: #ffedd5; }
  .adv-type-green  { color: #16a34a; background: #dcfce7; }

  /* Condition tick list */
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
  .adv-summary-input {
    margin-left: 1.5rem;
    line-height: 1.5;
    resize: vertical;
    font-size: 0.8rem;
  }
  .adv-req-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-left: 1.5rem;
    padding: 0.375rem 0.5rem;
    background: #fff;
    border: 1px solid #e9d5ff;
    border-radius: 6px;
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
    color: #475569;
  }
  .adv-req-complete { color: #94a3b8; text-decoration: line-through; }
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
  .adv-skip-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.78rem;
    line-height: 1.5;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
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
