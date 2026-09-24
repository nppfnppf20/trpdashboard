<script>
  import { getBriefingSources } from '$lib/api/quoteRequests.js';

  // Source picker — briefing notes and (project) meeting notes in one combined
  // list (newest first), each with a per-note "use full transcript" toggle.
  // Selection is exposed via bind:selectedSources as
  // [{ type: 'briefing_note'|'meeting_note', id, full }].
  export let projectUniqueId = null;
  export let contextBudget = 200000;
  export let hint = 'Tick any briefing notes and meeting notes to use as source material.';
  export let selectedSources = []; // bindable output
  export let overBudget = false;   // bindable output

  // [{ type, id, title, date, summary_chars, transcript_chars, checked, full }]
  let notes = [];

  $: if (projectUniqueId) loadSources(projectUniqueId);

  const byDateDesc = (a, b) => new Date(b.date || 0) - new Date(a.date || 0);

  async function loadSources(id) {
    try {
      const res = await getBriefingSources(id);
      notes = [
        ...(res.briefingNotes || []).map(n => ({
          ...n, type: 'briefing_note', title: n.title || n.file_name || 'Untitled', date: n.created_at, checked: false, full: false,
        })),
        ...(res.meetingNotes || []).map(n => ({
          ...n, type: 'meeting_note', title: n.title || 'Untitled', date: n.meeting_date || n.created_at, checked: false, full: false,
        })),
      ].sort(byDateDesc);
    } catch {
      notes = [];
    }
  }

  // Clears all ticks/toggles without re-fetching — call before reopening a picker.
  export function reset() {
    notes = notes.map(n => ({ ...n, checked: false, full: false }));
  }

  // "Full transcript" only means something for an included note, so the two
  // ticks stay in step: ticking Full also ticks the note, and unticking the
  // note also clears Full (otherwise it looks selected while contributing
  // nothing to the context meter).
  function onFullToggle(note) {
    if (note.full) note.checked = true;
    notes = notes;
  }
  function onNoteToggle(note) {
    if (!note.checked) note.full = false;
    notes = notes;
  }

  $: selectedSources = notes.filter(n => n.checked).map(n => ({ type: n.type, id: n.id, full: n.full }));
  $: totalChars = notes
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
    <label>Briefing &amp; Meeting Notes</label>
    {#if notes.length === 0}
      <p class="picker-empty">No briefing or meeting notes for this project yet.</p>
    {:else}
      <div class="source-list">
        {#each notes as note (`${note.type}:${note.id}`)}
          <div class="source-row">
            <label class="source-checkbox">
              <input type="checkbox" bind:checked={note.checked} on:change={() => onNoteToggle(note)} />
              <span class="source-title">{note.title}</span>
              <span class="source-date">{note.date ? new Date(note.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
            </label>
            <label class="source-full-toggle" class:disabled={!note.transcript_chars}>
              <input type="checkbox" bind:checked={note.full} disabled={!note.transcript_chars} on:change={() => onFullToggle(note)} />
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
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .picker-empty {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-400);
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
    color: var(--color-slate-700);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--color-slate-200);
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
    background: var(--color-slate-50);
  }

  .source-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-slate-800);
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
    color: var(--color-slate-400);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .source-full-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--color-slate-500);
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
    color: var(--color-slate-500);
  }

  .context-warning {
    color: var(--color-red-600);
    font-weight: 500;
  }

  .context-track {
    width: 100%;
    height: 5px;
    background: var(--color-slate-200);
    border-radius: 999px;
    overflow: hidden;
  }

  .context-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.2s ease;
  }
</style>
