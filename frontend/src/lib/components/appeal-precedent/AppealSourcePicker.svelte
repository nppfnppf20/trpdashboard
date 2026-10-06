<script>
  // Pick meeting notes and project documents to draft the Appeal Precedent setup from (scheme, scale, key issues and
  // instructions). Same shape as the picker used when generating the Planning Assessment: a "Draft from" mode, a
  // checklist of notes, and a context meter.
  import { createEventDispatcher } from 'svelte';
  import { getPrecedentSources } from '$lib/api/appealPrecedent.js';

  export let projectId;
  export let open = false;

  const dispatch = createEventDispatcher();

  const MODES = [
    { value: 'notes', label: 'Notes', hint: 'Summaries, actions and notes only' },
    { value: 'transcript', label: 'Full transcript', hint: 'The full transcript or document text; summaries not used' },
    { value: 'both', label: 'Both', hint: 'Summaries plus the full text' }
  ];
  const TRACKERS = [
    { key: 'consultation', label: 'Consultation Tracker', hint: 'Consultee responses and their comments' },
    { key: 'conditions', label: 'Conditions Tracker', hint: 'Conditions and their status' },
    { key: 'issues_tracker', label: 'Project Tracker', hint: 'Issues logged against project stages' }
  ];
  const PER_SOURCE_CAP = 40000; // the server reads at most this many characters of each source
  const TOTAL_CAP = 130000; // and about this many in total

  let loading = false;
  let error = '';
  let meetings = [];
  let documents = [];
  let pickedMeetings = new Set();
  let pickedDocs = new Set();
  let pickedTrackers = new Set();
  let mode = 'notes';
  let loadedFor = null;

  $: if (open && loadedFor !== projectId) load();
  $: if (!open) loadedFor = null;

  async function load() {
    loadedFor = projectId;
    loading = true;
    error = '';
    try {
      const out = await getPrecedentSources(projectId);
      meetings = out.meetings ?? [];
      documents = out.documents ?? [];
      pickedMeetings = new Set();
      pickedDocs = new Set();
      pickedTrackers = new Set();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  const sizeOf = item => (mode === 'notes' ? item.summary_chars : mode === 'transcript' ? item.transcript_chars : item.summary_chars + item.transcript_chars);
  const isEmpty = item => sizeOf(item) < 120;
  const fmtSize = n => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`) + ' chars';
  const fmtDate = d => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  function toggle(set, id) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }

  $: nothingTicked = pickedMeetings.size + pickedDocs.size + pickedTrackers.size === 0;
  $: chosen = [...meetings.filter(m => pickedMeetings.has(m.id)), ...documents.filter(d => pickedDocs.has(d.id))];
  $: usedChars = chosen.reduce((n, i) => n + Math.min(sizeOf(i), PER_SOURCE_CAP), 0);
  $: pct = Math.min(100, Math.round((usedChars / TOTAL_CAP) * 100));
  $: tone = pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
  $: truncated = chosen.some(i => sizeOf(i) > PER_SOURCE_CAP);
  $: overCap = usedChars > TOTAL_CAP;

  function close() {
    dispatch('close');
  }

  function draft() {
    dispatch('draft', { document_ids: [...pickedDocs], meeting_ids: [...pickedMeetings], trackers: [...pickedTrackers], mode });
  }
</script>

{#if open}
  <div class="asp-overlay" on:click|self={close} on:keydown={e => e.key === 'Escape' && close()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="asp-modal">
      <div class="asp-header">
        <span class="asp-title"><i class="las la-magic"></i> Draft the setup from your notes</span>
        <button class="asp-close" on:click={close} aria-label="Close"><i class="las la-times"></i></button>
      </div>

      <div class="asp-body">
        <div class="asp-block">
          <span class="asp-label">Draft from</span>
          <div class="asp-modes">
            {#each MODES as m (m.value)}
              <label class="asp-mode" class:asp-mode--active={mode === m.value} title={m.hint}>
                <input type="radio" name="asp-mode" value={m.value} bind:group={mode} />
                {m.label}
              </label>
            {/each}
          </div>
          <span class="asp-hint">{MODES.find(m => m.value === mode)?.hint}</span>
        </div>

        {#if loading}
          <p class="asp-empty">Loading...</p>
        {:else if error}
          <p class="asp-error">{error}</p>
        {:else}
          <div class="asp-block">
            <span class="asp-label">Trackers (the issues list is drafted mainly from these)</span>
            <div class="asp-list">
              {#each TRACKERS as t (t.key)}
                <label class="asp-item" class:asp-item--checked={pickedTrackers.has(t.key)}>
                  <input type="checkbox" checked={pickedTrackers.has(t.key)} on:change={() => (pickedTrackers = toggle(pickedTrackers, t.key))} />
                  <span class="asp-name">{t.label}</span>
                  <span class="asp-meta">{t.hint}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="asp-block">
            <span class="asp-label">Notes and Docs</span>
            {#if meetings.length + documents.length === 0}
              <p class="asp-empty">No notes or documents for this project yet.</p>
            {:else}
              <div class="asp-list">
                {#each meetings as m (`m${m.id}`)}
                  <label class="asp-item" class:asp-item--checked={pickedMeetings.has(m.id)} class:asp-item--empty={isEmpty(m)}>
                    <input type="checkbox" checked={pickedMeetings.has(m.id)} on:change={() => (pickedMeetings = toggle(pickedMeetings, m.id))} />
                    <span class="asp-name">{m.title || `Meeting note ${m.id}`}<span class="asp-type">Meeting note</span></span>
                    <span class="asp-meta">{isEmpty(m) ? 'nothing in this mode' : fmtSize(sizeOf(m))} · {fmtDate(m.date)}</span>
                  </label>
                {/each}
                {#each documents as d (`d${d.id}`)}
                  <label class="asp-item" class:asp-item--checked={pickedDocs.has(d.id)} class:asp-item--empty={isEmpty(d)}>
                    <input type="checkbox" checked={pickedDocs.has(d.id)} on:change={() => (pickedDocs = toggle(pickedDocs, d.id))} />
                    <span class="asp-name">{d.title}<span class="asp-type">{d.doc_type_label}</span></span>
                    <span class="asp-meta">{isEmpty(d) ? 'nothing in this mode' : fmtSize(sizeOf(d))} · {fmtDate(d.date)}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>

          {#if chosen.length > 0}
            <div class="asp-block">
              <span class="asp-hint">~{pct}% of what the draft can read is used by the selected sources</span>
              <div class="asp-track"><div class="asp-fill asp-fill--{tone}" style="width:{pct}%"></div></div>
              {#if truncated}<span class="asp-hint">Very long sources are read up to {fmtSize(PER_SOURCE_CAP)} each.</span>{/if}
              {#if overCap}<span class="asp-warn">Too much selected. The later sources will be cut short.</span>{/if}
            </div>
          {/if}
          {#if nothingTicked}
            <span class="asp-hint">Nothing ticked: choose at least one tracker, note or document to draft from.</span>
          {/if}

          <p class="asp-hint">Drafting replaces the scheme, setting, issues and instructions in the form, using what you tick here. Scale is only filled where it's empty.</p>
        {/if}
      </div>

      <div class="asp-footer">
        <button class="btn btn-secondary" on:click={close}>Cancel</button>
        <button class="btn btn-primary" on:click={draft} disabled={loading || nothingTicked}><i class="las la-magic"></i> Draft setup</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .asp-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    z-index: 1300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .asp-modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .asp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .asp-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-slate-800);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .asp-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-slate-400);
    font-size: 1.1rem;
  }

  .asp-close:hover {
    color: var(--color-slate-600);
  }

  .asp-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .asp-block {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .asp-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-slate-500);
  }

  .asp-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    line-height: 1.45;
  }

  .asp-empty {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-400);
    font-style: italic;
  }

  .asp-error {
    margin: 0;
    font-size: 0.8125rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .asp-warn {
    font-size: 0.75rem;
    color: var(--color-badge-warning-fg);
    background: var(--color-badge-warning-bg);
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius-md);
  }

  .asp-modes {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .asp-mode {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 999px;
    background: var(--color-white);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-600);
    cursor: pointer;
  }

  .asp-mode--active {
    background: var(--color-violet-600);
    border-color: var(--color-violet-600);
    color: var(--color-white);
  }

  .asp-mode input {
    accent-color: var(--color-violet-600);
    margin: 0;
  }

  .asp-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.5rem;
  }

  .asp-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .asp-item:hover {
    background: var(--color-slate-50);
  }

  .asp-item--checked {
    background: var(--color-purple-50);
  }

  .asp-item--empty .asp-name {
    color: var(--color-slate-400);
  }

  .asp-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-slate-800);
  }

  .asp-type {
    margin-left: 0.5rem;
    font-size: 0.71875rem;
    color: var(--color-slate-500);
  }

  .asp-meta {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    white-space: nowrap;
  }

  .asp-track {
    width: 100%;
    height: 5px;
    background: var(--color-slate-200);
    border-radius: 999px;
    overflow: hidden;
  }

  .asp-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.2s ease;
  }

  .asp-fill--low {
    background: var(--color-emerald-600);
  }

  .asp-fill--mid {
    background: var(--color-amber-600);
  }

  .asp-fill--high {
    background: var(--color-red-600);
  }

  .asp-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }
</style>
