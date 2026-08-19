<script>
  import { getBriefingSources } from '$lib/api/quoteRequests.js';

  // Source picker — briefing notes and (project) meeting notes, each with a
  // per-note "use full transcript" toggle. Selection is exposed via
  // bind:selectedSources as [{ type: 'briefing_note'|'meeting_note', id, full }].
  export let projectUniqueId = null;
  export let contextBudget = 200000;
  export let hint = 'Tick any briefing notes and meeting notes to use as source material.';
  export let selectedSources = []; // bindable output
  export let overBudget = false;   // bindable output

  let briefingNotes = []; // [{ id, title, file_name, created_at, summary_chars, transcript_chars, checked, full }]
  let meetingNotes = [];  // [{ id, title, meeting_date, created_at, summary_chars, transcript_chars, checked, full }]

  $: if (projectUniqueId) loadSources(projectUniqueId);

  async function loadSources(id) {
    try {
      const res = await getBriefingSources(id);
      briefingNotes = (res.briefingNotes || []).map(n => ({ ...n, checked: false, full: false }));
      meetingNotes = (res.meetingNotes || []).map(n => ({ ...n, checked: false, full: false }));
    } catch {
      briefingNotes = [];
      meetingNotes = [];
    }
  }

  // Clears all ticks/toggles without re-fetching — call before reopening a picker.
  export function reset() {
    briefingNotes = briefingNotes.map(n => ({ ...n, checked: false, full: false }));
    meetingNotes = meetingNotes.map(n => ({ ...n, checked: false, full: false }));
  }

  // Ticking "Full transcript" implies wanting the note included, so it also
  // ticks the note itself rather than requiring two separate clicks.
  function onBriefingFullToggle(note) {
    if (note.full) note.checked = true;
    briefingNotes = briefingNotes;
  }
  function onMeetingFullToggle(note) {
    if (note.full) note.checked = true;
    meetingNotes = meetingNotes;
  }

  $: selectedSources = [
    ...briefingNotes.filter(n => n.checked).map(n => ({ type: 'briefing_note', id: n.id, full: n.full })),
    ...meetingNotes.filter(n => n.checked).map(n => ({ type: 'meeting_note', id: n.id, full: n.full })),
  ];
  $: totalChars = [...briefingNotes, ...meetingNotes]
    .filter(n => n.checked)
    .reduce((sum, n) => sum + (n.full ? (n.transcript_chars ?? n.summary_chars ?? 0) : (n.summary_chars ?? 0)), 0);
  $: contextPct = Math.min(100, Math.round(totalChars / contextBudget * 100));
  $: contextColour = contextPct >= 75 ? '#dc2626' : contextPct >= 50 ? '#d97706' : '#16a34a';
  $: overBudget = totalChars > contextBudget;
</script>

<div class="note-source-picker">
  {#if hint}
    <p class="picker-hint">{hint}</p>
  {/if}

  <div class="picker-field">
    <label>Briefing Notes</label>
    {#if briefingNotes.length === 0}
      <p class="picker-empty">No briefing notes for this project yet.</p>
    {:else}
      <div class="source-list">
        {#each briefingNotes as note (note.id)}
          <div class="source-row">
            <label class="source-checkbox">
              <input type="checkbox" bind:checked={note.checked} />
              <span class="source-title">{note.title || note.file_name || 'Untitled'}</span>
              <span class="source-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </label>
            <label class="source-full-toggle" class:disabled={!note.transcript_chars}>
              <input type="checkbox" bind:checked={note.full} disabled={!note.transcript_chars} on:change={() => onBriefingFullToggle(note)} />
              Full transcript
            </label>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="picker-field">
    <label>Meeting Notes</label>
    {#if meetingNotes.length === 0}
      <p class="picker-empty">No meeting notes for this project yet.</p>
    {:else}
      <div class="source-list">
        {#each meetingNotes as note (note.id)}
          <div class="source-row">
            <label class="source-checkbox">
              <input type="checkbox" bind:checked={note.checked} />
              <span class="source-title">{note.title || 'Untitled'}</span>
              <span class="source-date">{note.meeting_date ? new Date(note.meeting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
            </label>
            <label class="source-full-toggle" class:disabled={!note.transcript_chars}>
              <input type="checkbox" bind:checked={note.full} disabled={!note.transcript_chars} on:change={() => onMeetingFullToggle(note)} />
              Full transcript
            </label>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if selectedSources.length > 0}
    <div class="context-meter">
      <div class="context-meter-label">
        ~{contextPct}% of context window used
        {#if overBudget}<span class="context-warning">- untick some sources to make room</span>{/if}
      </div>
      <div class="context-track">
        <div class="context-fill" style="width:{contextPct}%; background:{contextColour};"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .note-source-picker {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .picker-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
  }

  .picker-empty {
    margin: 0;
    font-size: 0.8125rem;
    color: #94a3b8;
    font-style: italic;
  }

  .picker-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .picker-field label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem;
  }

  .source-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
  }

  .source-row:hover {
    background: #f8fafc;
  }

  .source-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #1e293b;
    cursor: pointer;
    min-width: 0;
  }

  .source-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-date {
    font-size: 0.75rem;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .source-full-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .source-full-toggle.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .context-meter {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .context-meter-label {
    font-size: 0.75rem;
    color: #64748b;
  }

  .context-warning {
    color: #dc2626;
    font-weight: 500;
  }

  .context-track {
    width: 100%;
    height: 5px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
  }

  .context-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.2s ease;
  }
</style>
