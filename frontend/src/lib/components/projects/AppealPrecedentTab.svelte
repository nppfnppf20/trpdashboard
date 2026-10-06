<script>
  // Appeal Precedent: find planning appeal decisions relevant to this project, review them, then ask questions about
  // the ones you tick. The search runs in the background on the server; results live in memory only (nothing is saved).
  import { onMount, onDestroy } from 'svelte';
  import { getOrCreateSession, mergeRecords } from '$lib/stores/appealPrecedent.js';
  import { suggestPrecedentContext, getSavedPrecedents, savePrecedents, startPrecedentRun, getPrecedentRun, cancelPrecedentRun } from '$lib/api/appealPrecedent.js';
  import AppealSetup from '$lib/components/appeal-precedent/AppealSetup.svelte';
  import AppealProgress from '$lib/components/appeal-precedent/AppealProgress.svelte';
  import PrecedentCard from '$lib/components/appeal-precedent/PrecedentCard.svelte';
  import PrecedentChat from '$lib/components/appeal-precedent/PrecedentChat.svelte';
  import { exportAppealPrecedentPdf } from '$lib/services/appealPrecedentPdfExport.js';
  import AppealSourcePicker from '$lib/components/appeal-precedent/AppealSourcePicker.svelte';

  export let project;

  const POLL_MS = 3000;
  const SAVE_DELAY_MS = 3000;

  let s = getOrCreateSession(project?.id);
  let lastProjectId = project?.id;
  let starting = false;
  let cancelling = false;
  let outcomeFilter = 'all';
  let pickerOpen = false;
  let timer = null;
  let saveTimer = null;
  let lastSaved = '';
  let saveError = '';

  // Switching to a different project while the tab stays mounted.
  $: if (project?.id !== lastProjectId) {
    lastProjectId = project?.id;
    stopPolling();
    flushSave();
    s = getOrCreateSession(project?.id);
    if (s.phase === 'running') startPolling();
    restoreSaved();
  }

  // Autosave: whenever there are results, save them shortly after anything changes (records, ticks, chat, setup).
  $: if (s.savedChecked && s.records.length) scheduleSave();

  $: issueLabels = Object.fromEntries((s.runIssues ?? []).map(i => [i.id, i.label]));
  $: shown = s.records.filter(r => outcomeFilter === 'all' || r.outcome === outcomeFilter);
  $: selectedRecords = s.records.filter(r => s.selected.includes(r.reference));
  $: chatIssues = s.runIssues?.length ? s.runIssues : s.context.issues.filter(i => i.include && i.label.trim());

  onMount(() => {
    if (s.phase === 'running') startPolling();
    restoreSaved();
  });
  onDestroy(() => {
    stopPolling();
    flushSave();
  });

  // ── Saved results ───────────────────────────────────────────────────────────
  const savePayload = () => ({
    records: s.records,
    issues: chatIssues,
    context: s.context,
    selected: s.selected,
    messages: s.messages,
    draftedFrom: s.draftedFrom
  });

  async function restoreSaved() {
    const sess = s;
    if (sess.savedChecked) return;
    sess.savedChecked = true;
    if (sess.records.length || sess.phase !== 'setup') return; // this session already has its own results
    try {
      const saved = await getSavedPrecedents(project.id);
      if (!saved?.records?.length || sess.records.length) return;
      sess.records = saved.records;
      sess.baseRecords = saved.records;
      sess.selected = saved.selected ?? [];
      sess.messages = saved.messages ?? [];
      sess.runIssues = saved.issues ?? [];
      sess.draftedFrom = saved.draftedFrom ?? '';
      sess.context = { ...sess.context, ...(saved.context ?? {}) };
      sess.restoredAt = saved.savedAt;
      sess.status = 'done';
      sess.phase = 'results';
      lastSaved = JSON.stringify(savePayload());
    } catch (e) {
      sess.savedChecked = false; // couldn't read the save: don't autosave over it, and look again next time
      sess.error = e.message;
    } finally {
      if (sess === s) s = s;
    }
  }

  // Not reset on every change: during a run the page changes every few seconds, so a resetting timer would never fire.
  function scheduleSave() {
    if (!saveTimer) saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
  }

  async function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!s.savedChecked || !s.records.length || !project?.id) return;
    const payload = JSON.stringify(savePayload());
    if (payload === lastSaved) return;
    lastSaved = payload;
    try {
      await savePrecedents(project.id, JSON.parse(payload));
      saveError = '';
    } catch (e) {
      lastSaved = '';
      saveError = e.message;
    }
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  // `sources` ({ document_ids, meeting_ids, mode }) means the user picked notes/documents to draft from: that is an
  // explicit action, so the scheme, setting, issues and instructions are replaced. Without it, only empty fields fill.
  async function suggest(sources = null) {
    s.suggesting = true;
    s.suggestError = '';
    s = s;
    try {
      const out = await suggestPrecedentContext(project.id, sources);
      const c = s.context;
      const replace = !!sources;
      if (replace ? out.project.scheme : !c.scheme.trim()) c.scheme = out.project.scheme ?? '';
      if (replace ? out.project.setting : !c.setting.trim()) c.setting = out.project.setting ?? '';
      c.lpa = out.project.lpa || c.lpa;
      for (const k of ['mw', 'units', 'hectares']) if (c.scale[k] === '' || c.scale[k] == null) c.scale[k] = out.scale?.[k] ?? '';
      if (replace ? out.issues?.length : !c.issues.length) c.issues = (out.issues ?? []).map(i => ({ ...i, include: true }));
      if (replace && out.instructions) c.instructions = out.instructions;
      if (replace) {
        const u = out.usedSources ?? {};
        const parts = [u.trackers && `${u.trackers} tracker${u.trackers === 1 ? '' : 's'}`, u.meetings && `${u.meetings} meeting note${u.meetings === 1 ? '' : 's'}`, u.documents && `${u.documents} document${u.documents === 1 ? '' : 's'}`].filter(Boolean);
        s.draftedFrom = `${parts.join(', ')} (${{ notes: 'notes', transcript: 'full transcript', both: 'notes and full transcript' }[u.mode] ?? 'notes'})`;
      }
      s.suggested = true;
    } catch (e) {
      s.suggestError = e.message;
    } finally {
      s.suggesting = false;
      s = s;
    }
  }

  function onDraft(e) {
    pickerOpen = false;
    suggest(e.detail);
  }

  async function run() {
    starting = true;
    s.error = '';
    s = s;
    const c = s.context;
    const payload = {
      project: { name: project.project_name, scheme: c.scheme, lpa: c.lpa, setting: c.setting },
      issues: c.issues.filter(i => i.include && i.label.trim()).map(i => ({ label: i.label.trim(), weight: Number(i.weight) || 3 })),
      instructions: c.instructions,
      scale: { mw: c.scale.mw, units: c.scale.units, hectares: c.scale.hectares },
      dateFrom: c.dateFrom || ''
    };
    try {
      const { runId } = await startPrecedentRun({
        projectId: project.id,
        context: payload,
        options: { callCap: Number(s.options.callCap) || 40, maxRecords: Number(s.options.maxRecords) || 12 }
      });
      s.baseRecords = s.keepResults ? s.records : [];
      if (!s.keepResults) {
        s.records = [];
        s.selected = [];
        s.messages = [];
      }
      s.keepResults = false;
      s.runId = runId;
      s.phase = 'running';
      s.status = 'running';
      s.progress = [];
      s.cursor = 0;
      s.stats = null;
      startPolling();
    } catch (e) {
      s.error = e.message;
    } finally {
      starting = false;
      s = s;
    }
  }

  // ── Polling ─────────────────────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    timer = setInterval(poll, POLL_MS);
    poll();
  }

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function apply(v) {
    s.progress = [...s.progress, ...v.progress];
    s.cursor = v.cursor;
    s.status = v.status;
    s.stats = v.stats;
    s.runIssues = v.issues ?? s.runIssues;
    s.records = mergeRecords(s.baseRecords, v.records);
    if (v.status !== 'running') {
      stopPolling();
      s.baseRecords = s.records;
      s.phase = s.records.length ? 'results' : 'setup';
      if (v.error) s.error = v.error;
      if (!s.selected.length) s.selected = s.records.slice(0, 5).map(r => r.reference);
    }
    s = s;
  }

  async function poll() {
    if (!s.runId) return;
    try {
      apply(await getPrecedentRun(s.runId, s.cursor));
    } catch (e) {
      stopPolling();
      s.error = e.message;
      s.phase = s.records.length ? 'results' : 'setup';
      s = s;
    }
  }

  async function cancel() {
    cancelling = true;
    try {
      apply(await cancelPrecedentRun(s.runId, s.cursor));
    } catch (e) {
      s.error = e.message;
      s = s;
    } finally {
      cancelling = false;
    }
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  function toggle(ref) {
    s.selected = s.selected.includes(ref) ? s.selected.filter(r => r !== ref) : [...s.selected, ref];
    s = s;
  }

  function exportPdf() {
    exportAppealPrecedentPdf(project, s.records, {
      issues: chatIssues,
      context: { scheme: s.context.scheme, lpa: s.context.lpa, setting: s.context.setting }
    });
  }

  function searchAgain() {
    s.keepResults = true;
    s.phase = 'setup';
    s = s;
  }

  function newSearch() {
    s.records = [];
    s.baseRecords = [];
    s.selected = [];
    s.messages = [];
    s.runId = null;
    s.status = '';
    s.stats = null;
    s.progress = [];
    s.error = '';
    s.keepResults = false;
    s.restoredAt = null;
    s.phase = 'setup';
    s = s;
    clearTimeout(saveTimer);
    lastSaved = '';
    savePrecedents(project.id, { records: [] }).catch(e => (saveError = e.message)); // clears the saved copy
  }
</script>

<div class="appeal-precedent-tab">
  <div class="tab-header">
    <h2 class="tab-title">Appeal Precedent</h2>
    <span class="construction-pill"><i class="las la-hard-hat"></i> Under Construction</span>
  </div>
  <p class="beta-note">
    Results are saved to this project automatically{#if s.restoredAt}. Restored from {new Date(s.restoredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{/if}.
    {#if saveError}<span class="save-error">Could not save: {saveError}</span>{/if}
  </p>

  {#if s.phase === 'setup'}
    <AppealSetup
      bind:context={s.context}
      bind:options={s.options}
      suggesting={s.suggesting}
      suggestError={s.suggestError}
      {starting}
      error={s.error}
      hasResults={s.records.length > 0}
      draftedFrom={s.draftedFrom}
      on:pick={() => (pickerOpen = true)}
      on:run={run}
    />
  {:else}
    {#if !(s.restoredAt && !s.runId)}
    <AppealProgress
      stats={s.stats}
      progress={s.progress}
      status={s.status}
      callCap={s.options.callCap}
      maxRecords={s.options.maxRecords}
      recordCount={s.records.length}
      {cancelling}
      on:cancel={cancel}
    />
    {/if}
    {#if s.error}<p class="msg msg-error">{s.error}</p>{/if}

    {#if s.records.length}
      <div class="results" class:with-chat={s.phase === 'results'}>
        <div class="list-col">
          <div class="toolbar">
            <div class="filters">
              {#each ['all', 'Allowed', 'Dismissed'] as o}
                <button class="chip-btn" class:active={outcomeFilter === o} on:click={() => (outcomeFilter = o)}>{o === 'all' ? 'All outcomes' : o}</button>
              {/each}
            </div>
            <span class="count">{s.selected.length} of {s.records.length} ticked</span>
            {#if s.phase === 'results'}
              <button class="btn btn-secondary btn-sm" on:click={exportPdf}><i class="las la-file-pdf"></i> Export PDF</button>
              <button class="btn btn-secondary btn-sm" on:click={searchAgain}>Search again and add results</button>
              <button class="btn btn-ghost btn-sm" on:click={newSearch}>New search</button>
            {/if}
          </div>
          {#each shown as r (r.reference)}
            <PrecedentCard record={r} {issueLabels} selected={s.selected.includes(r.reference)} on:toggle={() => toggle(r.reference)} />
          {/each}
        </div>

        {#if s.phase === 'results'}
          <div class="chat-col">
            <PrecedentChat runId={s.runId} projectId={project.id} projectName={project.project_name} records={selectedRecords} issues={chatIssues} bind:messages={s.messages} />
          </div>
        {/if}
      </div>
    {:else if s.phase === 'running'}
      <p class="beta-note">Decisions appear here as the search finds them.</p>
    {/if}
  {/if}
</div>

<AppealSourcePicker projectId={project?.id} open={pickerOpen} on:close={() => (pickerOpen = false)} on:draft={onDraft} />

<style>
  .appeal-precedent-tab {
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .tab-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .tab-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0;
  }

  .construction-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
    border: 1px solid var(--color-amber-200);
    border-radius: var(--radius-pill);
    padding: 0.125rem 0.75rem;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .beta-note {
    margin: calc(var(--space-2) * -1) 0 0;
    font-size: 0.78125rem;
    color: var(--color-slate-500);
  }

  .save-error {
    color: var(--color-badge-danger-fg);
  }

  .msg-error {
    margin: 0;
    font-size: 0.8125rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .results {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;
  }

  .list-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    gap: var(--space-2);
  }

  .chip-btn {
    font: inherit;
    font-size: 0.8125rem;
    border: 1px solid var(--color-slate-200);
    background: var(--color-white);
    color: var(--color-slate-700);
    border-radius: var(--radius-pill);
    padding: 0.15rem 0.8rem;
    cursor: pointer;
  }

  .chip-btn.active {
    background: var(--color-primary-600);
    border-color: var(--color-primary-600);
    color: var(--color-white);
  }

  .count {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    margin-right: auto;
  }

  .chat-col {
    min-width: 0;
  }

  @media (min-width: 1180px) {
    .results.with-chat {
      grid-template-columns: minmax(0, 1fr) minmax(340px, 430px);
    }

    .chat-col {
      position: sticky;
      top: var(--space-4);
    }
  }
</style>
