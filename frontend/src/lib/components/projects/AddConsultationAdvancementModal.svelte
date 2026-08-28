<script>
  import { createEventDispatcher } from 'svelte';
  import { createConsultationAdvancements, suggestConsultationAdvancementSummaries } from '$lib/api/consultation.js';

  export let show = false;
  export let projectId;
  export let responses = [];
  export let preselectedResponseId = null;   // open with one response already ticked

  const dispatch = createEventDispatcher();

  let advDate = '';
  let sourceType = 'note';   // 'note' | 'email'
  let fullText = '';
  let selections = {};        // response_id -> { checked, summary }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let skippedLabels = [];       // ticked responses the source text had nothing relevant for
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
    for (const r of responses) {
      selections[r.id] = {
        checked: r.id === preselectedResponseId,
        summary: '',
      };
    }
    seeded = true;
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;
  $: hasBlankChecked = responses.some(r => selections[r.id]?.checked && !selections[r.id].summary.trim());
  $: canGenerate = hasBlankChecked && fullText.trim().length > 0;
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

  function buildItems() {
    return responses
      .filter(r => selections[r.id]?.checked)
      .map(r => ({
        response_id: r.id,
        summary: selections[r.id].summary.trim(),
      }));
  }

  // Fill blank ticked rows from the pasted text (consultee position, comments
  // and previous advancements are read server-side). Typed summaries are left
  // untouched — they take precedence. The model only fills blanks for
  // responses the text actually contains relevant new information for.
  async function generateSummaries() {
    const items = buildItems();
    const blanks = items.filter(i => !i.summary);
    if (!blanks.length || !fullText.trim()) return;

    // Already generated for this exact text — don't hit the API again, just
    // refresh which ticked rows are still unresolved.
    if (fullText === lastGeneratedText) {
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
      for (const s of suggestions) {
        if (selections[s.response_id]?.checked && !selections[s.response_id].summary.trim()) {
          selections[s.response_id] = { ...selections[s.response_id], summary: s.summary };
        }
      }
      selections = { ...selections };
      skippedLabels = responses
        .filter(r => selections[r.id]?.checked && !selections[r.id].summary.trim())
        .map(responseLabel);
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
            <span class="label-hint">{sourceType === 'email' ? 'paste the full trail - kept as the source record' : 'optional fuller detail behind the summaries'}</span>
          </label>
          <textarea
            rows="7"
            bind:value={fullText}
            placeholder={sourceType === 'email'
              ? 'Paste the email trail here…'
              : 'Type the full detail of what happened (optional)…'}
          ></textarea>
          <div class="adv-generate-row">
            <button
              type="button"
              class="btn-generate"
              on:click={generateSummaries}
              disabled={!canGenerate || generating || saving}
            >
              {#if generating}<span class="mini-spinner"></span> Generating…{:else}<i class="las la-magic"></i> Generate & Fill Rows{/if}
            </button>
            <span class="adv-generate-hint">Summarises text into ticked rows below. Rows must be selected first.</span>
          </div>
        </div>

        {#if generatedNotice}
          <div class="adv-notice">
            <i class="las la-magic"></i> Summaries generated from the pasted text - review or edit them below.
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
            <label>Applies to <span class="label-hint">tick the responses - leave a summary blank to auto-summarise from the pasted text</span></label>
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
                  <textarea
                    class="adv-summary-input"
                    rows="2"
                    placeholder="Optional - leave blank to auto-summarise; anything typed here takes precedence"
                    bind:value={selections[r.id].summary}
                  ></textarea>
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
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    resize: vertical;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: 0 0 0 3px var(--color-sky-100);
  }

  .adv-generate-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .btn-generate {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    background: var(--color-primary-50);
    color: var(--color-teal-600);
    border: 1px solid var(--color-sky-200);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-generate:hover:not(:disabled) { background: var(--color-sky-100); }
  .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }
  .adv-generate-hint { font-size: 0.74rem; color: var(--color-slate-400); }
  .mini-spinner {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border: 2px solid var(--color-sky-200);
    border-top-color: var(--color-teal-600);
    border-radius: 50%;
    animation: adv-spin 0.6s linear infinite;
  }
  @keyframes adv-spin { to { transform: rotate(360deg); } }

  /* Source toggle */
  .adv-source-toggle {
    display: flex;
    border: 1px solid var(--color-slate-200);
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
    color: var(--color-slate-500);
    background: var(--color-slate-50);
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .adv-source-btn:not(:last-child) { border-right: 1px solid var(--color-slate-200); }
  .adv-source-btn.active { color: var(--color-primary-600); background: var(--color-primary-50); font-weight: 600; }

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
  .adv-summary-input {
    margin-left: 1.5rem;
    line-height: 1.5;
    resize: vertical;
    font-size: 0.8rem;
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
