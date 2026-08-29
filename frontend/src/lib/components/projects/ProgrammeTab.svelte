<script>
  import {
    getQuotes,
    getProgrammeEvents,
    getQuoteKeyDates,
    createProgrammeEvent,
    updateProgrammeEvent,
    deleteProgrammeEvent,
    updateQuoteKeyDate,
    deleteQuoteKeyDate
  } from '$lib/api/quotes.js';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import ViewDateModal from '$lib/components/admin-console/ViewDateModal.svelte';

  export let project;
  $: projectId = project?.unique_id;

  let quotes = [];
  let programmeEvents = [];
  let quoteKeyDates = [];
  let loading = true;
  let error = null;

  $: if (projectId) load();

  async function load() {
    loading = true;
    error = null;
    try {
      const [q, pe, kd] = await Promise.all([
        getQuotes({ projectId }),
        getProgrammeEvents(projectId),
        getQuoteKeyDates(projectId)
      ]);
      quotes = q;
      programmeEvents = pe;
      quoteKeyDates = kd;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Group quotes by the Condition / Issue they're linked to ────────────────
  // A quote linked to more than one tracker item appears once per item — same
  // duplication the tracker timelines themselves already show.
  function conditionNumberValue(num) {
    const digits = (num || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 999999;
  }

  function buildGroups(allQuotes, field) {
    const map = new Map();
    for (const q of allQuotes) {
      for (const link of q[field] || []) {
        if (!map.has(link.id)) map.set(link.id, { ...link, quotes: [] });
        map.get(link.id).quotes.push(q);
      }
    }
    return [...map.values()];
  }

  $: conditionGroups = buildGroups(quotes, 'linked_conditions').sort((a, b) =>
    (a.sort_order ?? 999999) - (b.sort_order ?? 999999)
    || conditionNumberValue(a.condition_number) - conditionNumberValue(b.condition_number)
    || a.id - b.id
  );

  $: issueGroups = buildGroups(quotes, 'linked_issues').sort((a, b) =>
    (a.sort_order ?? 999999) - (b.sort_order ?? 999999) || a.id - b.id
  );

  $: linkedQuoteIds = new Set([...conditionGroups, ...issueGroups].flatMap(g => g.quotes.map(q => q.id)));
  $: visibleQuotes = quotes.filter(q => linkedQuoteIds.has(q.id));
  $: visibleKeyDates = quoteKeyDates.filter(kd => linkedQuoteIds.has(kd.quote_id));

  // ── Week columns ─────────────────────────────────────────────────────────
  function getWeekCommencing(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  }

  function isDateInWeek(dateString, weekStart) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return date >= weekStart && date <= weekEnd;
  }

  function buildWeeks(events, keyDates, quotesForDates) {
    const allDates = [
      ...events.map(e => new Date(e.date)),
      ...keyDates.map(kd => new Date(kd.date)),
      ...quotesForDates.flatMap(q => [q.site_visit_date, q.report_draft_date, q.report_final_date])
        .filter(Boolean).map(d => new Date(d))
    ].filter(d => !Number.isNaN(d.getTime()));

    const now = new Date();
    const startWeek = allDates.length ? getWeekCommencing(new Date(Math.min(...allDates))) : getWeekCommencing(now);
    startWeek.setDate(startWeek.getDate() - 14);

    const endWeek = allDates.length ? getWeekCommencing(new Date(Math.max(...allDates))) : getWeekCommencing(now);
    endWeek.setDate(endWeek.getDate() + 14);

    const minWeeks = 12;
    const spanWeeks = Math.max(minWeeks, Math.round((endWeek - startWeek) / (7 * 24 * 60 * 60 * 1000)) + 1);

    const weeks = [];
    const current = new Date(startWeek);
    for (let i = 0; i < spanWeeks; i++) {
      weeks.push({
        date: new Date(current),
        label: `${current.getDate()}/${current.getMonth() + 1}`,
        field: current.toISOString().split('T')[0]
      });
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }

  $: weeks = buildWeeks(programmeEvents, visibleKeyDates, visibleQuotes);

  // ── Chips per row/week ───────────────────────────────────────────────────
  function milestoneChipsForWeek(weekStart) {
    return programmeEvents
      .filter(pe => isDateInWeek(pe.date, weekStart))
      .map(pe => ({ id: pe.id, title: pe.title, date: pe.date, colour: pe.colour || 'var(--color-primary-700)', type: 'project' }));
  }

  function quoteChipsForWeek(quote, weekStart) {
    const chips = [];
    if (isDateInWeek(quote.site_visit_date, weekStart)) {
      chips.push({ title: 'Site Visit', date: quote.site_visit_date, colour: 'var(--color-primary-500)', label: 'SV', type: 'quote-builtin', discipline: quote.discipline, surveyor_organisation: quote.surveyor_organisation });
    }
    if (isDateInWeek(quote.report_draft_date, weekStart)) {
      chips.push({ title: 'Draft Report', date: quote.report_draft_date, colour: 'var(--color-violet-600)', label: 'D', type: 'quote-builtin', discipline: quote.discipline, surveyor_organisation: quote.surveyor_organisation });
    }
    if (isDateInWeek(quote.report_final_date, weekStart)) {
      chips.push({ title: 'Final Report', date: quote.report_final_date, colour: 'var(--color-emerald-500)', label: 'F', type: 'quote-builtin', discipline: quote.discipline, surveyor_organisation: quote.surveyor_organisation });
    }
    for (const kd of quoteKeyDates) {
      if (kd.quote_id === quote.id && isDateInWeek(kd.date, weekStart)) {
        chips.push({ id: kd.id, title: kd.title, date: kd.date, colour: kd.colour || 'var(--color-amber-500)', label: (kd.title || '?').charAt(0).toUpperCase(), type: 'quote', discipline: quote.discipline, surveyor_organisation: quote.surveyor_organisation });
      }
    }
    return chips;
  }

  // ── Add / view / edit / delete (project milestones + editing existing
  // quote key dates — adding a NEW quote key date now happens from inside
  // the Conditions/Issues Tracker drawer, where the quote is already linked) ──
  let showAddKeyDateModal = false;
  let showViewDateModal = false;
  let selectedDate = null;
  let keyDateType = 'project';
  let preSelectedDate = null;
  let existingDateForEdit = null;

  function handleAddProjectDate(date = null) {
    keyDateType = 'project';
    preSelectedDate = date;
    existingDateForEdit = null;
    showAddKeyDateModal = true;
  }

  function handleViewDate(chip) {
    selectedDate = chip;
    showViewDateModal = true;
  }

  function handleEditDate(date) {
    if (date.type === 'quote-builtin') {
      alert('Site Visit, Draft Report and Final Report dates come from the quote itself — edit them from Surveyor Management.');
      return;
    }
    existingDateForEdit = date;
    keyDateType = date.type === 'project' ? 'project' : 'quote';
    preSelectedDate = null;
    showViewDateModal = false;
    showAddKeyDateModal = true;
  }

  async function handleDeleteDate(date) {
    try {
      if (date.type === 'project') {
        await deleteProgrammeEvent(date.id);
        programmeEvents = programmeEvents.filter(pe => pe.id !== date.id);
      } else if (date.type === 'quote') {
        await deleteQuoteKeyDate(date.id);
        quoteKeyDates = quoteKeyDates.filter(kd => kd.id !== date.id);
      } else {
        alert('Site Visit, Draft Report and Final Report dates come from the quote itself — remove them from Surveyor Management.');
      }
    } catch (err) {
      alert('Failed to delete date: ' + err.message);
    }
  }

  async function handleSubmitDate(event) {
    const { type, data, isEdit } = event.detail;
    try {
      if (isEdit) {
        if (type === 'project') {
          const updated = await updateProgrammeEvent(data.id, { title: data.title, date: data.date, colour: data.color });
          programmeEvents = programmeEvents.map(pe => pe.id === data.id ? { ...pe, ...updated } : pe);
        } else {
          const updated = await updateQuoteKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
          quoteKeyDates = quoteKeyDates.map(kd => kd.id === data.id ? { ...kd, ...updated } : kd);
        }
      } else {
        const newEvent = await createProgrammeEvent(projectId, { title: data.title, date: data.date, colour: data.color });
        programmeEvents = [...programmeEvents, newEvent];
      }
    } catch (err) {
      alert('Failed to save date: ' + err.message);
    }
    showAddKeyDateModal = false;
    existingDateForEdit = null;
  }
</script>

<div class="pg-tab">
  <div class="pg-header">
    <h2>Programme</h2>
    <button class="btn btn-primary" on:click={() => handleAddProjectDate()}>
      <i class="las la-calendar-plus"></i> Add Project Date
    </button>
  </div>

  {#if loading}
    <div class="pg-state"><span class="pg-spinner"></span><p>Loading programme…</p></div>
  {:else if error}
    <div class="pg-state pg-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if conditionGroups.length === 0 && issueGroups.length === 0 && programmeEvents.length === 0}
    <div class="pg-empty">
      <i class="las la-calendar-alt pg-empty-icon"></i>
      <p class="pg-empty-title">Nothing to schedule yet</p>
      <p class="pg-empty-hint">Programme shows dates for surveys linked to a Condition or Issue. Link a survey to one from Surveyor Management once it's instructed, then add its key dates from that Condition or Issue's own timeline.</p>
    </div>
  {:else}
    <div class="pg-grid-card">
      <div class="pg-scroll">
        <table class="pg-grid">
          <thead>
            <tr>
              <th class="c1">Item / Surveyor</th>
              <th class="c2">Organisation</th>
              <th class="c3">Discipline</th>
              {#each weeks as week}<th class="week">{week.label}</th>{/each}
            </tr>
          </thead>
          <tbody>
            <tr class="row-milestone">
              <td class="c1">Key Project Dates</td>
              <td class="c2"></td>
              <td class="c3"></td>
              {#each weeks as week}
                {@const chips = milestoneChipsForWeek(week.date)}
                <td class="week" on:click={() => chips.length === 0 && handleAddProjectDate(week.field)}>
                  {#each chips as chip}
                    <span class="chip-diamond" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click|stopPropagation={() => handleViewDate(chip)}></span>
                  {/each}
                </td>
              {/each}
            </tr>

            {#if conditionGroups.length}
              <tr class="row-section"><td colspan={3 + weeks.length}><span class="dot dot-cond"></span>Conditions Tracker</td></tr>
              {#each conditionGroups as g (g.id)}
                <tr class="row-cond">
                  <td class="c1">
                    <span class="item-title">{g.condition_number ? `Condition ${g.condition_number} — ` : ''}{g.title}</span>
                    <span class="item-meta">{g.quotes.length} linked quote{g.quotes.length !== 1 ? 's' : ''}</span>
                  </td>
                  <td class="c2"></td><td class="c3"></td>
                  {#each weeks as week}<td class="week"></td>{/each}
                </tr>
                {#each g.quotes as quote (quote.id)}
                  <tr class="row-sub under-cond">
                    <td class="c1"><span class="sub-org">{quote.surveyor_organisation || 'Unnamed surveyor'}</span></td>
                    <td class="c2">{quote.surveyor_organisation || '—'}</td>
                    <td class="c3"><span class="sub-discipline">{quote.discipline || '—'}</span></td>
                    {#each weeks as week}
                      {@const chips = quoteChipsForWeek(quote, week.date)}
                      <td class="week">
                        {#each chips as chip}
                          <span class="chip" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click={() => handleViewDate(chip)}>{chip.label}</span>
                        {/each}
                      </td>
                    {/each}
                  </tr>
                {/each}
              {/each}
            {/if}

            {#if issueGroups.length}
              <tr class="row-section"><td colspan={3 + weeks.length}><span class="dot dot-issue"></span>Progress (Issues) Tracker</td></tr>
              {#each issueGroups as g (g.id)}
                <tr class="row-issue">
                  <td class="c1">
                    <span class="item-title">{g.title}</span>
                    <span class="item-meta">{g.quotes.length} linked quote{g.quotes.length !== 1 ? 's' : ''}</span>
                  </td>
                  <td class="c2"></td><td class="c3"></td>
                  {#each weeks as week}<td class="week"></td>{/each}
                </tr>
                {#each g.quotes as quote (quote.id)}
                  <tr class="row-sub under-issue">
                    <td class="c1"><span class="sub-org">{quote.surveyor_organisation || 'Unnamed surveyor'}</span></td>
                    <td class="c2">{quote.surveyor_organisation || '—'}</td>
                    <td class="c3"><span class="sub-discipline">{quote.discipline || '—'}</span></td>
                    {#each weeks as week}
                      {@const chips = quoteChipsForWeek(quote, week.date)}
                      <td class="week">
                        {#each chips as chip}
                          <span class="chip" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click={() => handleViewDate(chip)}>{chip.label}</span>
                        {/each}
                      </td>
                    {/each}
                  </tr>
                {/each}
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <div class="pg-legend">
        <span class="pg-legend-item"><span class="pg-swatch" style="background:var(--color-primary-500)"></span>Site Visit</span>
        <span class="pg-legend-item"><span class="pg-swatch" style="background:var(--color-violet-600)"></span>Draft Report</span>
        <span class="pg-legend-item"><span class="pg-swatch" style="background:var(--color-emerald-500)"></span>Final Report</span>
        <span class="pg-legend-item"><span class="pg-swatch" style="background:var(--color-amber-500)"></span>Custom key date</span>
        <span class="pg-legend-item"><span class="chip-diamond" style="background:var(--color-primary-700)"></span>Project milestone</span>
      </div>
    </div>
  {/if}
</div>

<AddKeyDateModal
  bind:show={showAddKeyDateModal}
  {quotes}
  {projectId}
  type={keyDateType}
  {preSelectedDate}
  existingDate={existingDateForEdit}
  on:submit={handleSubmitDate}
  on:close={() => { showAddKeyDateModal = false; existingDateForEdit = null; }}
/>

<ViewDateModal
  show={showViewDateModal}
  date={selectedDate}
  on:edit={(e) => handleEditDate(e.detail)}
  on:delete={(e) => handleDeleteDate(e.detail)}
  on:close={() => { showViewDateModal = false; selectedDate = null; }}
/>

<style>
  .pg-tab { display: flex; flex-direction: column; gap: 1rem; height: 100%; }

  .pg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pg-header h2 { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--color-slate-800); }

  .pg-state, .pg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem 1.5rem;
    color: var(--color-slate-400);
    text-align: center;
  }
  .pg-state-error { color: var(--color-red-600); }
  .pg-empty-icon { font-size: 2rem; color: var(--color-slate-300); }
  .pg-empty-title { margin: 0; font-weight: 600; color: var(--color-slate-600); }
  .pg-empty-hint { margin: 0; max-width: 46ch; font-size: 0.85rem; line-height: 1.6; }

  .pg-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: pg-spin 0.8s linear infinite;
  }
  @keyframes pg-spin { to { transform: rotate(360deg); } }

  .pg-grid-card {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .pg-scroll { overflow-x: auto; }

  table.pg-grid {
    border-collapse: separate;
    border-spacing: 0;
    width: max-content;
    min-width: 100%;
    font-size: 0.8125rem;
  }

  table.pg-grid th, table.pg-grid td {
    padding: 0.5rem 0.65rem;
    border-bottom: 1px solid var(--color-slate-200);
    white-space: nowrap;
  }

  thead th {
    background: var(--color-slate-50);
    color: var(--color-slate-500);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    border-bottom: 1px solid var(--color-slate-300);
  }
  thead th.week { text-align: center; width: 48px; }

  .c1, .c2, .c3 { position: sticky; z-index: 1; background: white; }
  .c1 { left: 0; width: 230px; min-width: 230px; white-space: normal; }
  .c2 { left: 230px; width: 140px; min-width: 140px; }
  .c3 { left: 370px; width: 120px; min-width: 120px; box-shadow: 4px 0 8px -6px rgba(15, 23, 42, 0.25); }
  thead th.c1, thead th.c2, thead th.c3 { z-index: 2; background: var(--color-slate-50); }

  td.week { text-align: center; cursor: default; }
  tr.row-milestone td.week { cursor: pointer; }

  tr.row-section td {
    padding: 0.45rem 0.85rem;
    background: var(--color-slate-50);
    color: var(--color-slate-500);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--color-slate-300);
  }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.5rem; vertical-align: middle; }
  .dot-cond { background: var(--color-indigo-800); }
  .dot-issue { background: var(--color-amber-500); }

  tr.row-cond .c1, tr.row-issue .c1 { border-left: 3px solid transparent; }
  tr.row-cond .c1 { border-left-color: var(--color-indigo-800); background: var(--color-badge-indigo-bg); }
  tr.row-cond .c2, tr.row-cond .c3 { background: var(--color-badge-indigo-bg); }
  tr.row-issue .c1 { border-left-color: var(--color-amber-500); background: var(--color-badge-warning-bg); }
  tr.row-issue .c2, tr.row-issue .c3 { background: var(--color-badge-warning-bg); }

  .item-title { display: block; font-weight: 700; font-size: 0.83rem; }
  tr.row-cond .item-title { color: var(--color-badge-indigo-fg); }
  tr.row-issue .item-title { color: var(--color-badge-warning-fg); }
  .item-meta { display: block; font-size: 0.72rem; color: var(--color-slate-500); font-weight: 500; margin-top: 0.1rem; }

  tr.row-sub .c1 { padding-left: 1.85rem; border-left: 3px solid var(--color-slate-200); }
  tr.row-sub.under-cond .c1 { border-left-color: var(--color-indigo-800); }
  tr.row-sub.under-issue .c1 { border-left-color: var(--color-amber-500); }

  .sub-org { font-weight: 600; color: var(--color-slate-700); font-size: 0.8rem; }
  .sub-discipline { color: var(--color-slate-500); font-size: 0.75rem; }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    border-radius: 5px;
    font-size: 0.6rem;
    font-weight: 800;
    color: white;
    cursor: pointer;
    margin: 1px;
    transition: transform 0.12s ease;
  }
  .chip:hover { transform: scale(1.15); }

  .chip-diamond {
    display: inline-block;
    width: 11px; height: 11px;
    transform: rotate(45deg);
    cursor: pointer;
    margin: 1px;
  }

  .pg-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1.1rem;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    border-top: 1px solid var(--color-slate-200);
    font-size: 0.75rem;
    color: var(--color-slate-500);
  }
  .pg-legend-item { display: inline-flex; align-items: center; gap: 0.4rem; }
  .pg-swatch { width: 14px; height: 14px; border-radius: 4px; flex: none; }
</style>
