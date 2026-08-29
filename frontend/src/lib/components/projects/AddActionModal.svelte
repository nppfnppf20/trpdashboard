<script>
  import { createEventDispatcher } from 'svelte';
  import {
    createActions, suggestActionSummaries,
    listMeetingNotesForPicker, draftFromMeetingNotes, commitDraftedActions,
    getProgressData,
  } from '$lib/api/progressTracker.js';
  import { getStageBoard, createCustomStage } from '$lib/services/workflowApi.js';
  import AdvancementEntryFields from './AdvancementEntryFields.svelte';

  export let show = false;
  export let projectId;
  export let issues = [];
  export let preselectedIssueId = null;   // open with one issue already ticked
  export let defaultStageInstanceId = null;
  export let initialMode = 'manual';      // 'manual' | 'meeting-notes' — which tab the modal opens on
  export let preselectedTranscriptId = null;   // meeting-notes mode: skip picking a note, draft from this one straight away

  const dispatch = createEventDispatcher();

  let mode = 'manual';   // 'manual' | 'meeting-notes'

  // ── Shared: stage picker (project-wide, tags new actions) ──────────────────
  let stages = [];
  let stageInstanceId = null;
  let newStageName = '';
  let showAddStage = false;
  let addingStage = false;

  async function loadStages() {
    try {
      const board = await getStageBoard(projectId);
      stages = board.stages || [];
    } catch (err) {
      console.error('Failed to load stages:', err);
    }
  }

  async function handleAddStage() {
    const trimmed = newStageName.trim();
    if (!trimmed) { showAddStage = false; return; }
    addingStage = true;
    try {
      const board = await createCustomStage(projectId, { name: trimmed });
      stages = board.stages || [];
      const created = stages.find(s => s.stage_name === trimmed) || stages[stages.length - 1];
      if (created) stageInstanceId = created.instance_id;
      newStageName = '';
      showAddStage = false;
    } catch (err) {
      console.error('Failed to add stage:', err);
    } finally {
      addingStage = false;
    }
  }

  // ── Manual mode: type/paste + generate summary (mirrors AddAdvancementModal) ─
  let actionDate = '';
  let fullText = '';
  let selections = {};   // issue_id -> { checked, summary, subIds }
  let saving = false;
  let generating = false;
  let generatedNotice = false;
  let skippedLabels = [];
  let lastGeneratedText = null;
  let error = null;
  let seeded = false;

  $: if (show && !seeded) {
    actionDate = new Date().toISOString().slice(0, 10);
    fullText = '';
    error = null;
    generatedNotice = false;
    skippedLabels = [];
    lastGeneratedText = null;
    stageInstanceId = defaultStageInstanceId;
    selections = {};
    for (const iss of issues) {
      // Default the "relevant quote" tag: auto-select when the issue has
      // exactly one linked quote, otherwise leave untagged.
      const linked = iss.linked_quotes || [];
      selections[iss.id] = {
        checked: iss.id === preselectedIssueId,
        summary: '',
        subIds: {},
        quoteId: linked.length === 1 ? linked[0].quote_id : null,
      };
    }
    loadStages();
    seeded = true;
    if (initialMode === 'meeting-notes') enterMeetingNotesMode();
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;
  $: hasBlankChecked = issues.some(iss => selections[iss.id]?.checked && !selections[iss.id].summary.trim());
  $: canGenerate = hasBlankChecked && fullText.trim().length > 0;
  $: canSave = checkedCount > 0 && !hasBlankChecked;
  $: allChecked = issues.length > 0 && issues.every(iss => selections[iss.id]?.checked);

  function toggleSelectAll() {
    const next = !allChecked;
    const updated = {};
    for (const iss of issues) updated[iss.id] = { ...selections[iss.id], checked: next };
    selections = updated;
  }

  function issueLabel(iss) {
    return iss.discipline ? `${iss.title} (${iss.discipline})` : iss.title;
  }

  function toggle(id) {
    selections = { ...selections, [id]: { ...selections[id], checked: !selections[id].checked } };
  }

  function toggleSub(issueId, subId) {
    const sel = selections[issueId];
    selections = { ...selections, [issueId]: { ...sel, subIds: { ...sel.subIds, [subId]: !sel.subIds[subId] } } };
  }

  function buildItems() {
    return issues
      .filter(iss => selections[iss.id]?.checked)
      .map(iss => ({
        issue_id: iss.id,
        summary: selections[iss.id].summary.trim(),
        sub_issue_ids: Object.entries(selections[iss.id].subIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10)),
        quote_id: selections[iss.id].quoteId || null,
      }));
  }

  // Fill blank ticked rows from the pasted text. Typed summaries are left
  // untouched — they take precedence. The model only fills blanks for issues
  // the text actually contains relevant new information for.
  async function generateSummaries() {
    const items = buildItems();
    const blanks = items.filter(i => !i.summary);
    if (!blanks.length || !fullText.trim()) return;

    if (fullText === lastGeneratedText) {
      skippedLabels = issues.filter(iss => blanks.some(b => b.issue_id === iss.id)).map(issueLabel);
      return;
    }

    generating = true;
    error = null;
    try {
      const { suggestions } = await suggestActionSummaries(projectId, {
        full_text: fullText,
        items: items.map(i => ({ issue_id: i.issue_id, user_summary: i.summary || null })),
      });
      for (const s of suggestions) {
        if (selections[s.issue_id]?.checked && !selections[s.issue_id].summary.trim()) {
          selections[s.issue_id] = { ...selections[s.issue_id], summary: s.summary };
        }
      }
      selections = { ...selections };
      skippedLabels = issues
        .filter(iss => selections[iss.id]?.checked && !selections[iss.id].summary.trim())
        .map(issueLabel);
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

    if (!items.length) { error = 'Tick at least one issue this action applies to.'; return; }
    if (!actionDate) { error = 'A date is required.'; return; }
    if (items.some(i => !i.summary)) { error = 'Every ticked issue needs a summary - type one or use Generate & Fill Rows.'; return; }

    saving = true;
    error = null;
    try {
      const rows = await createActions(projectId, {
        action_date: actionDate,
        full_text: fullText.trim() || null,
        source_type: 'note',
        stage_instance_id: stageInstanceId || null,
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

  // ── Meeting notes mode ──────────────────────────────────────────────────────
  let meetingNotes = [];
  let notesLoading = false;
  let selectedNoteIds = {};
  let drafting = false;
  let proposals = [];       // enriched with accepted/editable fields
  let draftError = null;
  let committing = false;
  // Cosmetic issue-title lookup for meeting-notes mode. Callers already
  // inside the Issues Tracker pass `issues`; callers elsewhere (e.g. the
  // Meeting Notes tab's "Add to Issues Tracker?" prompt) don't have that
  // list handy, so fetch it once, lazily, the first time it's needed.
  let mnIssues = [];
  let mnIssuesLoaded = false;

  async function enterMeetingNotesMode() {
    mode = 'meeting-notes';
    proposals = [];
    draftError = null;
    if (issues.length) {
      mnIssues = issues;
    } else if (!mnIssuesLoaded) {
      mnIssuesLoaded = true;
      try {
        const data = await getProgressData(projectId);
        mnIssues = data.issues || [];
      } catch { /* labels just fall back to "Issue #id" */ }
    }
    if (!meetingNotes.length) {
      notesLoading = true;
      try {
        meetingNotes = await listMeetingNotesForPicker(projectId);
      } catch (err) {
        draftError = err.message;
      } finally {
        notesLoading = false;
      }
    }
    // Opened directly from a just-saved meeting note ("Add to Issues
    // Tracker?") — skip the picker and go straight to drafting.
    if (preselectedTranscriptId) {
      selectedNoteIds = { [preselectedTranscriptId]: true };
      await runDraft();
    }
  }

  $: selectedNoteCount = Object.values(selectedNoteIds).filter(Boolean).length;

  function toggleNote(id) {
    selectedNoteIds = { ...selectedNoteIds, [id]: !selectedNoteIds[id] };
  }

  function issueTitleById(id) {
    return mnIssues.find(iss => iss.id === id)?.title || `Issue #${id}`;
  }

  async function runDraft() {
    const ids = Object.entries(selectedNoteIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10));
    if (!ids.length) { draftError = 'Tick at least one meeting note.'; return; }
    drafting = true;
    draftError = null;
    try {
      const { proposals: raw } = await draftFromMeetingNotes(projectId, ids);
      if (!raw.length) {
        draftError = 'Nothing relevant to the tracked issues was found in the selected notes.';
        proposals = [];
      } else {
        proposals = raw.map((p, i) => ({ ...p, _key: i, accepted: true }));
      }
    } catch (err) {
      draftError = err.message;
    } finally {
      drafting = false;
    }
  }

  async function commitAccepted() {
    const accepted = proposals.filter(p => p.accepted);
    if (!accepted.length) { draftError = 'Tick at least one proposal to save.'; return; }
    committing = true;
    draftError = null;
    try {
      const result = await commitDraftedActions(projectId, {
        stage_instance_id: stageInstanceId || null,
        accepted: accepted.map(p => {
          if (p.kind === 'new_issue') return { kind: 'new_issue', title: p.title, discipline: p.discipline, summary: p.summary, action_date: p.action_date, source_note_id: p.source_note_id };
          if (p.kind === 'new_sub_issue') return { kind: 'new_sub_issue', issue_id: p.issue_id, sub_issue_title: p.sub_issue_title, summary: p.summary, action_date: p.action_date, source_note_id: p.source_note_id };
          return { kind: 'existing_issue', issue_id: p.issue_id, summary: p.summary, action_date: p.action_date, source_note_id: p.source_note_id };
        }),
      });
      dispatch('done', { issues: result.issues, subIssues: result.sub_issues, rows: result.actions });
      committing = false;
      close();
    } catch (err) {
      draftError = err.message;
      committing = false;
    }
  }

  function close() {
    if (saving || generating || drafting || committing) return;
    show = false;
    seeded = false;
    mode = 'manual';
    selectedNoteIds = {};
    proposals = [];
    mnIssues = [];
    mnIssuesLoaded = false;
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

      <div class="mode-tabs">
        <button class="mode-tab" class:active={mode === 'manual'} on:click={() => mode = 'manual'}>
          <i class="las la-pen"></i> Manual
        </button>
        <button class="mode-tab" class:active={mode === 'meeting-notes'} on:click={enterMeetingNotesMode}>
          <i class="las la-magic"></i> Draft from Meeting Notes
        </button>
      </div>

      <!-- Stage picker — shared across both modes, tags new actions -->
      <div class="stage-bar">
        <span class="stage-label">Stage</span>
        <select class="stage-select" bind:value={stageInstanceId}>
          <option value={null}>No stage</option>
          {#each stages as s (s.instance_id)}
            <option value={s.instance_id}>{s.stage_name}</option>
          {/each}
        </select>
        {#if showAddStage}
          <input
            class="stage-new-input"
            placeholder="New stage name"
            bind:value={newStageName}
            on:keydown={e => { if (e.key === 'Enter') handleAddStage(); if (e.key === 'Escape') { showAddStage = false; newStageName = ''; } }}
          />
          <button class="btn-cancel stage-add-btn" disabled={addingStage} on:click={handleAddStage}>{addingStage ? 'Adding…' : 'Add'}</button>
          <button class="btn-cancel stage-add-btn" on:click={() => { showAddStage = false; newStageName = ''; }}>Cancel</button>
        {:else}
          <button class="stage-add-toggle" on:click={() => showAddStage = true}><i class="las la-plus"></i> New stage</button>
        {/if}
      </div>

      {#if mode === 'manual'}
        <div class="adv-body">
          <AdvancementEntryFields
            bind:date={actionDate}
            bind:fullText={fullText}
            onGenerate={generateSummaries}
            {generating}
            canGenerate={canGenerate && !saving}
            fullTextHint="optional fuller detail behind the summaries - paste an email trail, notes, whatever you've got"
            fullTextPlaceholder="Type or paste the detail here…"
          />

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
              <label>Applies to <span class="label-hint">tick the issues - leave a summary blank to auto-summarise from the pasted text</span></label>
              <button type="button" class="select-all-btn" on:click={toggleSelectAll}>{allChecked ? 'Deselect all' : 'Select all'}</button>
            </div>
            <div class="adv-cond-list">
              {#each issues as iss (iss.id)}
                {@const sel = selections[iss.id]}
                <div class="adv-cond-row" class:checked={sel?.checked}>
                  <label class="adv-cond-check">
                    <input type="checkbox" checked={sel?.checked} on:change={() => toggle(iss.id)} />
                    <span class="adv-cond-label">{issueLabel(iss)}</span>
                  </label>
                  {#if sel?.checked}
                    {#if iss.sub_issues?.length}
                      <div class="adv-req-list">
                        {#each iss.sub_issues as sub (sub.id)}
                          <label class="adv-req-check">
                            <input type="checkbox" checked={!!sel.subIds[sub.id]} on:change={() => toggleSub(iss.id, sub.id)} />
                            <span class="adv-req-label" class:adv-req-complete={sub.status === 'Complete'}>{sub.sub_issue_text}</span>
                          </label>
                        {/each}
                      </div>
                    {/if}
                    {#if iss.linked_quotes?.length}
                      <div class="adv-quote-picker">
                        <span class="adv-quote-picker-label">Relevant quote:</span>
                        <select class="adv-quote-select" bind:value={selections[iss.id].quoteId}>
                          <option value={null}>Not relevant to a quote</option>
                          {#each iss.linked_quotes as q (q.quote_id)}
                            <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                          {/each}
                        </select>
                      </div>
                    {/if}
                    <textarea
                      class="adv-summary-input"
                      rows="2"
                      placeholder="Optional - leave blank to auto-summarise; anything typed here takes precedence"
                      bind:value={selections[iss.id].summary}
                    ></textarea>
                  {/if}
                </div>
              {:else}
                <p class="adv-no-conditions">No issues in the tracker yet.</p>
              {/each}
            </div>
          </div>
        </div>

        {#if error}
          <div class="adv-error">{error}</div>
        {/if}

        <div class="adv-footer">
          <span class="adv-count-hint">{checkedCount} issue{checkedCount !== 1 ? 's' : ''} selected</span>
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

      {:else}
        <!-- Meeting notes mode -->
        <div class="adv-body">
          {#if !proposals.length}
            <div class="field">
              <label>Meeting notes <span class="label-hint">tick one or more saved meeting notes to draft from</span></label>
              {#if notesLoading}
                <p class="adv-no-conditions">Loading meeting notes…</p>
              {:else}
                <div class="adv-cond-list">
                  {#each meetingNotes as note (note.id)}
                    <label class="adv-cond-check note-row">
                      <input type="checkbox" checked={!!selectedNoteIds[note.id]} on:change={() => toggleNote(note.id)} />
                      <span class="adv-cond-label">{note.title}</span>
                      {#if note.meeting_date}<span class="note-date">{new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>{/if}
                    </label>
                  {:else}
                    <p class="adv-no-conditions">No saved meeting notes on this project yet.</p>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="field">
              <label>Proposed actions <span class="label-hint">tick to accept, edit text before saving, untick to skip</span></label>
              <div class="proposal-list">
                {#each proposals as p (p._key)}
                  <div class="proposal-row" class:checked={p.accepted}>
                    <label class="adv-cond-check">
                      <input type="checkbox" bind:checked={p.accepted} />
                      {#if p.kind === 'new_issue'}
                        <span class="proposal-badge new-issue-badge">New issue</span>
                        <input class="proposal-title-input" bind:value={p.title} placeholder="Issue title" />
                        <input class="proposal-discipline-input" bind:value={p.discipline} placeholder="Discipline" />
                      {:else if p.kind === 'new_sub_issue'}
                        <span class="proposal-badge new-sub-issue-badge">New sub-issue of {issueTitleById(p.issue_id)}</span>
                        <input class="proposal-title-input" bind:value={p.sub_issue_title} placeholder="Sub-issue title" />
                      {:else}
                        <span class="proposal-badge">{issueTitleById(p.issue_id)}</span>
                      {/if}
                    </label>
                    <textarea class="adv-summary-input proposal-summary" rows="2" bind:value={p.summary}></textarea>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        {#if draftError}
          <div class="adv-error">{draftError}</div>
        {/if}

        <div class="adv-footer">
          <span class="adv-count-hint">
            {#if proposals.length}{proposals.filter(p => p.accepted).length} of {proposals.length} proposals accepted{:else}{selectedNoteCount} note{selectedNoteCount !== 1 ? 's' : ''} selected{/if}
          </span>
          <div class="adv-footer-actions">
            <button class="btn-cancel" on:click={close} disabled={drafting || committing}>Cancel</button>
            {#if proposals.length}
              <button class="btn-cancel" on:click={() => { proposals = []; }} disabled={committing}>Back</button>
              <button class="btn-save" on:click={commitAccepted} disabled={committing}>
                {committing ? 'Saving…' : 'Save Accepted'}
              </button>
            {:else}
              <button class="btn-save" on:click={runDraft} disabled={drafting || notesLoading}>
                {drafting ? 'Drafting…' : 'Draft Proposals'}
              </button>
            {/if}
          </div>
        </div>
      {/if}
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
    max-width: 800px;
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
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .adv-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
    flex-shrink: 0;
  }
  .mode-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 1.25rem;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .mode-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-slate-500);
    background: none;
    border: none;
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .mode-tab:hover { color: var(--color-slate-800); }
  .mode-tab.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); font-weight: 700; }

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
    flex-shrink: 0;
  }
  .adv-close-btn:hover { color: var(--color-slate-800); }

  .stage-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.5rem;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .stage-label { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); }
  .stage-select {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    background: white;
  }
  .stage-new-input {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
  }
  .stage-add-btn { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
  .stage-add-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    color: var(--color-primary-600);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .stage-add-toggle:hover { text-decoration: underline; }

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
  .note-row { padding: 0.5rem 0.75rem; }
  .note-date { margin-left: auto; font-size: 0.72rem; color: var(--color-slate-400); }
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
    border: 1px solid var(--color-sky-200);
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

  .proposal-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .proposal-row {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .proposal-row.checked { background: var(--color-primary-50); border-color: var(--color-sky-200); }
  .proposal-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-700);
    background: var(--color-slate-100);
    border-radius: 999px;
    padding: 2px 9px;
  }
  .new-issue-badge { color: var(--color-violet-600); background: var(--color-violet-100); }
  .new-sub-issue-badge { color: var(--color-teal-600); background: var(--color-sky-100); }
  .proposal-title-input, .proposal-discipline-input {
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
  }
  .proposal-title-input { flex: 1; min-width: 8rem; }
  .proposal-discipline-input { flex: 0 0 8rem; }
  .proposal-summary { margin-left: 0; }

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
