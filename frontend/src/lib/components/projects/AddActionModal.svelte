<script>
  import { createEventDispatcher } from 'svelte';
  import {
    createActions, suggestActionSummaries,
    listMeetingNotesForPicker, draftFromMeetingNotes, commitDraftedActions,
    getProgressData,
  } from '$lib/api/progressTracker.js';
  import { getStageBoard, createCustomStage } from '$lib/services/workflowApi.js';

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
      selections[iss.id] = { checked: iss.id === preselectedIssueId, summary: '', subIds: {} };
    }
    loadStages();
    seeded = true;
    if (initialMode === 'meeting-notes') enterMeetingNotesMode();
  }

  $: checkedCount = Object.values(selections).filter(s => s.checked).length;

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

  async function save() {
    const items = issues
      .filter(iss => selections[iss.id]?.checked)
      .map(iss => ({
        issue_id: iss.id,
        summary: selections[iss.id].summary.trim(),
        sub_issue_ids: Object.entries(selections[iss.id].subIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10)),
      }));

    if (!items.length) { error = 'Tick at least one issue this action applies to.'; return; }
    if (!actionDate) { error = 'A date is required.'; return; }

    const blanks = items.filter(i => !i.summary);
    if (blanks.length) {
      if (!fullText.trim()) {
        error = 'Paste the email trail / note text so summaries can be generated, or type a summary under each ticked issue.';
        return;
      }
      if (fullText === lastGeneratedText) {
        const blankLabels = issues.filter(iss => blanks.some(b => b.issue_id === iss.id)).map(issueLabel);
        error = `The pasted text had no relevant information for: ${blankLabels.join('; ')}. Untick them, type their summaries manually, or change the pasted text.`;
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
      return;
    }

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
      close();
    } catch (err) {
      draftError = err.message;
    } finally {
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
          <div class="field field--date">
            <label>Date</label>
            <input type="date" bind:value={actionDate} />
          </div>

          <div class="field">
            <label>What happened <span class="label-hint">optional fuller detail behind the summaries — paste an email trail, notes, whatever you've got</span></label>
            <textarea
              rows="7"
              bind:value={fullText}
              placeholder="Type or paste the detail here…"
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
            <label>Applies to <span class="label-hint">tick the issues — leave a summary blank to auto-summarise from the pasted text</span></label>
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
                    <textarea
                      class="adv-summary-input"
                      rows="2"
                      placeholder="Optional — leave blank to auto-summarise; anything typed here takes precedence"
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
            <button class="btn-save" on:click={save} disabled={saving || generating}>
              {#if generating}Summarising…{:else if saving}Saving…{:else if generatedNotice}Confirm & Save{:else}Save Advancement{/if}
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
    max-width: 800px;
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
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .adv-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
    flex-shrink: 0;
  }
  .mode-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 1.25rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .mode-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: #64748b;
    background: none;
    border: none;
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .mode-tab:hover { color: #1e293b; }
  .mode-tab.active { color: #0284c7; border-bottom-color: #0284c7; font-weight: 700; }

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
    flex-shrink: 0;
  }
  .adv-close-btn:hover { color: #1e293b; }

  .stage-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .stage-label { font-size: 0.78rem; font-weight: 600; color: #475569; }
  .stage-select {
    padding: 0.3rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    background: white;
  }
  .stage-new-input {
    padding: 0.3rem 0.5rem;
    border: 1px solid #d1d5db;
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
    color: #0284c7;
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
  .field--date { flex: 0 0 auto; }
  .field--date input { max-width: 170px; }

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
    border-color: #0284c7;
    box-shadow: 0 0 0 3px #e0f2fe;
  }

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
  .adv-cond-row.checked { background: #f0f9ff; }
  .adv-cond-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 400;
  }
  .note-row { padding: 0.5rem 0.75rem; }
  .note-date { margin-left: auto; font-size: 0.72rem; color: #94a3b8; }
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
    border: 1px solid #bae6fd;
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

  .proposal-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .proposal-row {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .proposal-row.checked { background: #f0f9ff; border-color: #bae6fd; }
  .proposal-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: #334155;
    background: #f1f5f9;
    border-radius: 999px;
    padding: 2px 9px;
  }
  .new-issue-badge { color: #7c3aed; background: #f3e8ff; }
  .new-sub-issue-badge { color: #0369a1; background: #e0f2fe; }
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
    color: #0369a1;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
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
    background: #0284c7;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: #0369a1; }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
