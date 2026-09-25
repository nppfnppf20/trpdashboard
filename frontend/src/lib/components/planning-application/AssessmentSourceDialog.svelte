<script>
  // Click-time source picker for the Planning Statement v3 Planning Assessment.
  // Opened by requestGenerateSection (planning-drafts.js) instead of generating
  // straight away. Reads/writes the same starting-docs slots as the Starting
  // Documents ('assessment_meeting_notes' selection — the project's meeting
  // notes — and 'briefing_source_mode'), then hands off to handleGenerateSection.
  import { get } from 'svelte/store';
  import { getStartingDocs, upsertStartingDocText } from '$lib/api/appeal.js';
  import { getBriefingSources } from '$lib/api/quoteRequests.js';
  import { assessmentPicker, handleGenerateSection } from '$lib/stores/planning-drafts.js';

  export let project;

  const MODES = [
    { value: 'notes',      label: 'Notes',           hint: "Summaries plus each issue's argument notes" },
    { value: 'transcript', label: 'Full transcript', hint: 'Built from the full transcripts; argument notes not used' },
    { value: 'both',       label: 'Both',            hint: 'Argument notes guide the structure, full transcripts supply the detail' },
  ];
  const CONTEXT_BUDGET = 200000;

  let loading = true;
  let saving = false;
  let notes = [];
  let selectedIds = new Set();
  let mode = 'notes';
  let loadedFor = null;

  $: req = $assessmentPicker;
  $: if (req && loadedFor !== req.sectionId) load(req);
  $: if (!req) loadedFor = null;

  $: rawTypeId = req ? parseInt(String(req.typeId).replace('appeal_', ''), 10) : null;

  async function load(request) {
    loadedFor = request.sectionId;
    loading = true;
    try {
      const raw = parseInt(String(request.typeId).replace('appeal_', ''), 10);
      const [sources, slotRows] = await Promise.all([
        getBriefingSources(project.unique_id).catch(() => ({ meetingNotes: [] })),
        getStartingDocs(project.id, raw).catch(() => []),
      ]);
      // All project meeting notes, newest first.
      notes = sources.meetingNotes ?? [];
      const sel = slotRows.find(r => r.slot_slug === 'assessment_meeting_notes');
      try { selectedIds = new Set(sel?.content_text ? JSON.parse(sel.content_text) : []); } catch { selectedIds = new Set(); }
      const m = slotRows.find(r => r.slot_slug === 'briefing_source_mode')?.content_text;
      mode = ['notes', 'transcript', 'both'].includes(m) ? m : 'notes';
    } finally {
      loading = false;
    }
  }

  function toggle(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  $: totalChars = notes
    .filter(n => selectedIds.has(n.id))
    .reduce((sum, n) => sum + (mode === 'notes' ? (n.summary_chars ?? 0) : (n.transcript_chars ?? n.summary_chars ?? 0)), 0);
  $: pct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: colour = pct >= 75 ? '#dc2626' : pct >= 50 ? '#d97706' : '#16a34a';

  function close() {
    assessmentPicker.set(null);
  }

  async function generate() {
    const request = get(assessmentPicker);
    if (!request) return;
    saving = true;
    try {
      await Promise.all([
        upsertStartingDocText(project.id, rawTypeId, 'assessment_meeting_notes', JSON.stringify([...selectedIds])),
        upsertStartingDocText(project.id, rawTypeId, 'briefing_source_mode', mode),
      ]);
    } catch (err) {
      console.error('Failed to save assessment sources:', err);
      alert('Could not save your source selection.');
      saving = false;
      return;
    }
    saving = false;
    assessmentPicker.set(null);
    handleGenerateSection(request.sectionId, request.typeId, request.provider);
  }
</script>

{#if req}
  <div class="asd-overlay" on:click|self={close} role="dialog" aria-modal="true">
    <div class="asd-modal">
      <div class="asd-header">
        <span class="asd-title"><i class="las la-magic"></i> Generate Planning Assessment</span>
        <button class="asd-close" on:click={close} aria-label="Close"><i class="las la-times"></i></button>
      </div>

      <div class="asd-body">
        <div class="asd-block">
          <span class="asd-label">Draft from</span>
          <div class="asd-modes">
            {#each MODES as m (m.value)}
              <label class="asd-mode" class:asd-mode--active={mode === m.value} title={m.hint}>
                <input type="radio" name="asd-mode" value={m.value} bind:group={mode} />
                {m.label}
              </label>
            {/each}
          </div>
          <span class="asd-hint">{MODES.find(m => m.value === mode)?.hint}</span>
        </div>

        <div class="asd-block">
          <span class="asd-label">Meeting notes</span>
          {#if loading}
            <p class="asd-empty">Loading…</p>
          {:else if notes.length === 0}
            <p class="asd-empty">No meeting notes for this project yet.</p>
          {:else}
            <div class="asd-list">
              {#each notes as note (note.id)}
                <label class="asd-note" class:asd-note--checked={selectedIds.has(note.id)}>
                  <input type="checkbox" checked={selectedIds.has(note.id)} on:change={() => toggle(note.id)} />
                  <span class="asd-note-name">{note.title || `Meeting note ${note.id}`}</span>
                  <span class="asd-note-date">{new Date(note.meeting_date || note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </label>
              {/each}
            </div>
          {/if}
          {#if selectedIds.size === 0 && !loading && notes.length > 0}
            <span class="asd-hint">Nothing ticked: it will generate without meeting notes.</span>
          {/if}
        </div>

        {#if selectedIds.size > 0}
          <div class="asd-block">
            <span class="asd-hint">~{pct}% of the context window used by the selected notes</span>
            <div class="asd-track"><div class="asd-fill" style="width:{pct}%; background:{colour}"></div></div>
          </div>
        {/if}
      </div>

      <div class="asd-footer">
        <button class="btn btn-secondary" on:click={close} disabled={saving}>Cancel</button>
        <button class="btn btn-primary" on:click={generate} disabled={saving || loading}>
          {#if saving}<div class="mini-spinner"></div> Saving…{:else}<i class="las la-magic"></i> Generate{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .asd-overlay {
    position: fixed; inset: 0; background: var(--overlay-bg); z-index: 1200;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .asd-modal {
    background: white; border-radius: 10px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
  }
  .asd-header {
    display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .asd-title { font-size: 0.95rem; font-weight: 600; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.4rem; }
  .asd-close { background: none; border: none; cursor: pointer; color: var(--color-slate-400); font-size: 1.1rem; }
  .asd-close:hover { color: var(--color-slate-600); }
  .asd-body { padding: 1rem 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
  .asd-block { display: flex; flex-direction: column; gap: 0.4rem; }
  .asd-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-500); }
  .asd-hint { font-size: 0.75rem; color: var(--color-slate-500); }
  .asd-empty { margin: 0; font-size: 0.8125rem; color: var(--color-slate-400); font-style: italic; }
  .asd-modes { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .asd-mode {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border: 1px solid var(--color-slate-200);
    border-radius: 999px; background: white; font-size: 0.8rem; font-weight: 500; color: var(--color-slate-600); cursor: pointer;
  }
  .asd-mode--active { background: var(--color-violet-600); border-color: var(--color-violet-600); color: white; }
  .asd-mode input { accent-color: var(--color-violet-600); margin: 0; }
  .asd-list {
    display: flex; flex-direction: column; gap: 0.3rem; max-height: 220px; overflow-y: auto;
    border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.5rem;
  }
  .asd-note { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; cursor: pointer; }
  .asd-note:hover { background: var(--color-slate-50); }
  .asd-note--checked { background: var(--color-purple-50); }
  .asd-note-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-slate-800); }
  .asd-note-date { font-size: 0.75rem; color: var(--color-slate-400); white-space: nowrap; }
  .asd-track { width: 100%; height: 5px; background: var(--color-slate-200); border-radius: 999px; overflow: hidden; }
  .asd-fill { height: 100%; border-radius: 999px; transition: width 0.2s ease; }
  .asd-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--color-slate-200);
  }
</style>
