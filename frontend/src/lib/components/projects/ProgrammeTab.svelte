<script>
  import { tick } from 'svelte';
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
  import { getConditionsData, createConditionKeyDate, updateConditionKeyDate, deleteConditionKeyDate } from '$lib/api/conditions.js';
  import { getProgressData, createIssueKeyDate, updateIssueKeyDate, deleteIssueKeyDate } from '$lib/api/progressTracker.js';
  import { getConsultationData, createConsultationKeyDate, updateConsultationKeyDate, deleteConsultationKeyDate } from '$lib/api/consultation.js';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';
  import ViewDateModal from '$lib/components/admin-console/ViewDateModal.svelte';

  export let project;
  export let onClose = null; // set when embedded in a popup (e.g. from the Overview page) — renders a close button in the header

  $: projectId = project?.unique_id;
  $: projectPk = project?.id;

  let quotes = [];
  let programmeEvents = [];
  let quoteKeyDates = [];
  let conditions = [];
  let issues = [];
  let consultationResponses = [];
  let loading = true;
  let error = null;

  $: if (projectId && projectPk) load();

  async function load() {
    loading = true;
    error = null;
    try {
      const [q, pe, kd, condData, progData, consData] = await Promise.all([
        getQuotes({ projectId }),
        getProgrammeEvents(projectId),
        getQuoteKeyDates(projectId),
        getConditionsData(projectPk),
        getProgressData(projectPk),
        getConsultationData(projectPk)
      ]);
      quotes = q;
      programmeEvents = pe;
      quoteKeyDates = kd;
      conditions = condData.conditions || [];
      issues = progData.issues || [];
      consultationResponses = consData.responses || [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Group rows by tracker item — a row shows up if it has its own direct
  // key dates, or a linked quote (with or without dates yet), or both. No
  // longer gated on having a linked quote at all. ────────────────────────────
  function conditionNumberValue(num) {
    const digits = (num || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 999999;
  }

  function quotesLinkedTo(field, id) {
    return quotes.filter(q => (q[field] || []).some(link => link.id === id));
  }

  $: conditionGroups = conditions
    .map(c => ({
      id: c.id,
      title: c.title,
      condition_number: c.condition_number,
      sort_order: c.sort_order,
      key_dates: c.key_dates || [],
      kind: 'condition',
      quotes: quotesLinkedTo('linked_conditions', c.id)
    }))
    .filter(g => g.key_dates.length > 0 || g.quotes.length > 0)
    .sort((a, b) =>
      (a.sort_order ?? 999999) - (b.sort_order ?? 999999)
      || conditionNumberValue(a.condition_number) - conditionNumberValue(b.condition_number)
      || a.id - b.id
    );

  $: issueGroups = issues
    .map(i => ({
      id: i.id,
      title: i.title,
      sort_order: i.sort_order,
      key_dates: i.key_dates || [],
      kind: 'issue',
      quotes: quotesLinkedTo('linked_issues', i.id)
    }))
    .filter(g => g.key_dates.length > 0 || g.quotes.length > 0)
    .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999) || a.id - b.id);

  $: consultationGroups = consultationResponses
    .map(r => ({
      id: r.id,
      title: r.consultee_name,
      sort_order: r.sort_order,
      key_dates: r.key_dates || [],
      kind: 'consultation',
      quotes: quotesLinkedTo('linked_consultation_responses', r.id)
    }))
    .filter(g => g.key_dates.length > 0 || g.quotes.length > 0)
    .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999) || a.id - b.id);

  $: linkedQuoteIds = new Set([...conditionGroups, ...issueGroups, ...consultationGroups].flatMap(g => g.quotes.map(q => q.id)));
  $: visibleQuotes = quotes.filter(q => linkedQuoteIds.has(q.id));
  $: visibleKeyDates = quoteKeyDates.filter(kd => linkedQuoteIds.has(kd.quote_id));
  $: allDirectKeyDates = [...conditionGroups, ...issueGroups, ...consultationGroups].flatMap(g => g.key_dates);

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

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function shiftWeeks(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n * 7);
    return d;
  }

  // The data-driven minimum range — grows/shrinks with what's actually on
  // the programme. `now` is always included so the current week's column
  // exists even if every real date is weeks away from it.
  function computeBaseRange(events, keyDates, quotesForDates, directKeyDates) {
    const now = new Date();
    const allDates = [
      now,
      ...events.map(e => new Date(e.date)),
      ...keyDates.map(kd => new Date(kd.date)),
      ...directKeyDates.map(kd => new Date(kd.date)),
      ...quotesForDates.flatMap(q => [q.site_visit_date, q.report_draft_date, q.report_final_date])
        .filter(Boolean).map(d => new Date(d))
    ].filter(d => !Number.isNaN(d.getTime()));

    const start = getWeekCommencing(new Date(Math.min(...allDates)));
    start.setDate(start.getDate() - 14);

    const end = getWeekCommencing(new Date(Math.max(...allDates)));
    end.setDate(end.getDate() + 14);

    const minWeeks = 12;
    const spanWeeks = Math.round((end - start) / WEEK_MS) + 1;
    if (spanWeeks < minWeeks) end.setDate(end.getDate() + (minWeeks - spanWeeks) * 7);

    return { start, end };
  }

  function buildWeeksArray(start, end) {
    const currentWeekStart = getWeekCommencing(new Date());
    const spanWeeks = Math.round((end - start) / WEEK_MS) + 1;
    const weeks = [];
    const current = new Date(start);
    for (let i = 0; i < spanWeeks; i++) {
      weeks.push({
        date: new Date(current),
        label: `${current.getDate()}/${current.getMonth() + 1}`,
        field: current.toISOString().split('T')[0],
        isCurrent: current.getTime() === currentWeekStart.getTime()
      });
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }

  $: baseRange = computeBaseRange(programmeEvents, visibleKeyDates, visibleQuotes, allDirectKeyDates);

  // The actually-rendered range — starts from baseRange, then only ever
  // grows, either because the data-driven range widens, or because the user
  // scrolled near an edge (see handleGridScroll below). Never shrinks, so a
  // manual scroll-extension survives a data reload (e.g. after adding a date).
  let rangeStart = null;
  let rangeEnd = null;

  $: if (baseRange) {
    if (!rangeStart || baseRange.start < rangeStart) rangeStart = baseRange.start;
    if (!rangeEnd || baseRange.end > rangeEnd) rangeEnd = baseRange.end;
  }

  $: weeks = (rangeStart && rangeEnd) ? buildWeeksArray(rangeStart, rangeEnd) : [];

  // ── Land on the current week, past weeks reachable by scrolling left ───────
  // Only runs once, right after the first real set of weeks renders — later
  // recomputes of `weeks` (e.g. after adding a date) leave the scroll
  // position wherever the user left it.
  let scrollEl;
  let weekThEls = [];
  let hasScrolledToToday = false;

  // Gated on !loading, not just weeks.length — weeks is non-empty even
  // before the real data arrives (the base range always includes "now"), so
  // scrolling on that placeholder range could land on the wrong column
  // once the real date range shifts things after load() resolves.
  $: if (!loading && weeks.length && !hasScrolledToToday) {
    hasScrolledToToday = true;
    tick().then(scrollToCurrentWeek);
  }

  function scrollToCurrentWeek() {
    const idx = weeks.findIndex(w => w.isCurrent);
    const th = weekThEls[idx];
    if (idx < 0 || !th || !scrollEl) return;
    const stickyItemColWidth = 230;
    const delta = th.getBoundingClientRect().left - scrollEl.getBoundingClientRect().left - stickyItemColWidth;
    scrollEl.scrollLeft += delta;
  }

  // ── Semi-infinite scroll — open up more weeks as the user nears either
  // edge, rather than hard-stopping at whatever range the data happened to
  // produce. ───────────────────────────────────────────────────────────────
  const EDGE_THRESHOLD_PX = 400;
  const EXTEND_BY_WEEKS = 8;
  let extendingBack = false;
  let extendingForward = false;

  function handleGridScroll() {
    if (!scrollEl) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
    if (scrollLeft < EDGE_THRESHOLD_PX) extendBackward();
    if (scrollWidth - (scrollLeft + clientWidth) < EDGE_THRESHOLD_PX) extendForward();
  }

  async function extendBackward() {
    if (extendingBack || !rangeStart) return;
    extendingBack = true;
    const prevScrollWidth = scrollEl.scrollWidth;
    rangeStart = shiftWeeks(rangeStart, -EXTEND_BY_WEEKS);
    await tick();
    // Prepending columns pushes everything rightward by the new width —
    // compensate so the view doesn't visibly jump.
    scrollEl.scrollLeft += scrollEl.scrollWidth - prevScrollWidth;
    extendingBack = false;
  }

  async function extendForward() {
    if (extendingForward || !rangeEnd) return;
    extendingForward = true;
    rangeEnd = shiftWeeks(rangeEnd, EXTEND_BY_WEEKS);
    await tick();
    extendingForward = false;
  }

  // ── Chips per row/week ───────────────────────────────────────────────────
  function milestoneChipsForWeek(weekStart) {
    return programmeEvents
      .filter(pe => isDateInWeek(pe.date, weekStart))
      .map(pe => ({ id: pe.id, title: pe.title, date: pe.date, colour: pe.colour || 'var(--color-primary-700)', type: 'project' }));
  }

  // Direct key dates owned by a condition/issue/consultation row itself
  function directChipsForWeek(group, weekStart) {
    return group.key_dates
      .filter(kd => isDateInWeek(kd.date, weekStart))
      .map(kd => ({
        id: kd.id, title: kd.title, date: kd.date, colour: kd.colour || 'var(--color-amber-500)',
        label: (kd.title || '?').charAt(0).toUpperCase(), type: `direct-${group.kind}`
      }));
  }

  // All chips for a row's own cell: its direct key dates plus every linked
  // quote's dates, merged together rather than split onto a separate
  // per-quote row — the quote's dates belong under this item's umbrella,
  // not off on their own line.
  function allChipsForWeek(group, weekStart) {
    return [...directChipsForWeek(group, weekStart), ...group.quotes.flatMap(q => quoteChipsForWeek(q, weekStart))];
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

  // ── Add / view / edit / delete ──────────────────────────────────────────
  // Project milestones, row-owned dates (condition/issue/consultation) and
  // editing existing dates all happen here, from clicking the relevant cell.
  // Adding a NEW date to a linked quote still happens from that quote's own
  // place in Surveyor Management — quotes aren't owned by Programme.
  let showAddKeyDateModal = false;
  let showViewDateModal = false;
  let selectedDate = null;
  let keyDateType = 'project';
  let preSelectedDate = null;
  let existingDateForEdit = null;
  let targetRow = null; // { kind: 'condition'|'issue'|'consultation', id } — which row a new date is being added to

  function handleAddProjectDate(date = null) {
    keyDateType = 'project';
    preSelectedDate = date;
    existingDateForEdit = null;
    targetRow = null;
    showAddKeyDateModal = true;
  }

  function handleAddRowDate(group, date = null) {
    keyDateType = `direct-${group.kind}`;
    preSelectedDate = date;
    existingDateForEdit = null;
    targetRow = { kind: group.kind, id: group.id };
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
    keyDateType = date.type;
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
      } else if (date.type === 'direct-condition') {
        await deleteConditionKeyDate(date.id);
        await load();
      } else if (date.type === 'direct-issue') {
        await deleteIssueKeyDate(date.id);
        await load();
      } else if (date.type === 'direct-consultation') {
        await deleteConsultationKeyDate(date.id);
        await load();
      } else {
        alert('Site Visit, Draft Report and Final Report dates come from the quote itself — remove them from Surveyor Management.');
      }
    } catch (err) {
      alert('Failed to delete date: ' + err.message);
    }
  }

  async function handleSubmitDate(event) {
    const { type, data, isEdit } = event.detail;
    if (!isEdit) {
      try {
        if (type === 'direct-condition') {
          await createConditionKeyDate(targetRow.id, { title: data.title, date: data.date, colour: data.color });
          await load();
        } else if (type === 'direct-issue') {
          await createIssueKeyDate(targetRow.id, { title: data.title, date: data.date, colour: data.color });
          await load();
        } else if (type === 'direct-consultation') {
          await createConsultationKeyDate(targetRow.id, { title: data.title, date: data.date, colour: data.color });
          await load();
        } else {
          const newEvent = await createProgrammeEvent(projectId, { title: data.title, date: data.date, colour: data.color });
          programmeEvents = [...programmeEvents, newEvent];
        }
      } catch (err) {
        alert('Failed to save date: ' + err.message);
      }
      showAddKeyDateModal = false;
      targetRow = null;
      return;
    }
    try {
      if (type === 'project') {
        const updated = await updateProgrammeEvent(data.id, { title: data.title, date: data.date, colour: data.color });
        programmeEvents = programmeEvents.map(pe => pe.id === data.id ? { ...pe, ...updated } : pe);
      } else if (type === 'quote') {
        const updated = await updateQuoteKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
        quoteKeyDates = quoteKeyDates.map(kd => kd.id === data.id ? { ...kd, ...updated } : kd);
      } else if (type === 'direct-condition') {
        await updateConditionKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
        await load();
      } else if (type === 'direct-issue') {
        await updateIssueKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
        await load();
      } else if (type === 'direct-consultation') {
        await updateConsultationKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
        await load();
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
    <div class="pg-header-actions">
      <button class="btn btn-primary" on:click={() => handleAddProjectDate()}>
        <i class="las la-calendar-plus"></i> Add Project Date
      </button>
      {#if onClose}
        <button class="pg-close-btn" on:click={onClose} title="Close">&times;</button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="pg-state"><span class="pg-spinner"></span><p>Loading programme…</p></div>
  {:else if error}
    <div class="pg-state pg-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if conditionGroups.length === 0 && issueGroups.length === 0 && consultationGroups.length === 0 && programmeEvents.length === 0}
    <div class="pg-empty">
      <i class="las la-calendar-alt pg-empty-icon"></i>
      <p class="pg-empty-title">Nothing to schedule yet</p>
      <p class="pg-empty-hint">Programme shows key dates added directly to a Condition, Issue or Consultation response, plus dates from any survey quote linked to one. Add a key date from that item's own timeline in its tracker.</p>
    </div>
  {:else}
    <div class="pg-grid-card">
      <div class="pg-scroll" bind:this={scrollEl} on:scroll={handleGridScroll}>
        <table class="pg-grid">
          <thead>
            <tr>
              <th class="c1" rowspan="2">Item</th>
              <th class="weeks-heading" colspan={weeks.length}>
                Week Commencing <span class="weeks-heading-hint">Each column represents one week</span>
              </th>
            </tr>
            <tr>
              {#each weeks as week, i}
                <th class="week" class:week-current={week.isCurrent} bind:this={weekThEls[i]}>{week.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            <tr class="row-milestone">
              <td class="c1">Key Project Dates</td>
              {#each weeks as week}
                {@const chips = milestoneChipsForWeek(week.date)}
                <td class="week" class:week-current={week.isCurrent} on:click={() => chips.length === 0 && handleAddProjectDate(week.field)}>
                  {#each chips as chip}
                    <span class="chip-diamond" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click|stopPropagation={() => handleViewDate(chip)}></span>
                  {/each}
                </td>
              {/each}
            </tr>

            {#if conditionGroups.length}
              <tr class="row-section"><td colspan={1 + weeks.length}><span class="dot dot-cond"></span>Conditions Tracker</td></tr>
              {#each conditionGroups as g (g.id)}
                <tr class="row-cond">
                  <td class="c1">
                    <span class="item-title">{g.condition_number ? `Condition ${g.condition_number} — ` : ''}{g.title}</span>
                    <span class="item-meta">{g.quotes.length} linked quote{g.quotes.length !== 1 ? 's' : ''}</span>
                  </td>
                  {#each weeks as week}
                    {@const chips = allChipsForWeek(g, week.date)}
                    <td class="week" class:week-current={week.isCurrent} on:click={() => chips.length === 0 && handleAddRowDate(g, week.field)}>
                      {#each chips as chip}
                        <span class="chip" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click={() => handleViewDate(chip)}>{chip.label}</span>
                      {/each}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/if}

            {#if issueGroups.length}
              <tr class="row-section"><td colspan={1 + weeks.length}><span class="dot dot-issue"></span>Progress (Issues) Tracker</td></tr>
              {#each issueGroups as g (g.id)}
                <tr class="row-issue">
                  <td class="c1">
                    <span class="item-title">{g.title}</span>
                    <span class="item-meta">{g.quotes.length} linked quote{g.quotes.length !== 1 ? 's' : ''}</span>
                  </td>
                  {#each weeks as week}
                    {@const chips = allChipsForWeek(g, week.date)}
                    <td class="week" class:week-current={week.isCurrent} on:click={() => chips.length === 0 && handleAddRowDate(g, week.field)}>
                      {#each chips as chip}
                        <span class="chip" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click={() => handleViewDate(chip)}>{chip.label}</span>
                      {/each}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/if}

            {#if consultationGroups.length}
              <tr class="row-section"><td colspan={1 + weeks.length}><span class="dot dot-consultation"></span>Consultation Tracker</td></tr>
              {#each consultationGroups as g (g.id)}
                <tr class="row-consultation">
                  <td class="c1">
                    <span class="item-title">{g.title}</span>
                    <span class="item-meta">{g.quotes.length} linked quote{g.quotes.length !== 1 ? 's' : ''}</span>
                  </td>
                  {#each weeks as week}
                    {@const chips = allChipsForWeek(g, week.date)}
                    <td class="week" class:week-current={week.isCurrent} on:click={() => chips.length === 0 && handleAddRowDate(g, week.field)}>
                      {#each chips as chip}
                        <span class="chip" style="background:{chip.colour}" title="{chip.title} — {chip.date}" on:click={() => handleViewDate(chip)}>{chip.label}</span>
                      {/each}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<AddKeyDateModal
  bind:show={showAddKeyDateModal}
  {quotes}
  {projectId}
  type={keyDateType}
  typeLabel={keyDateType.startsWith('direct-') ? 'Key Date' : null}
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
  .pg-header-actions { display: flex; align-items: center; gap: 0.75rem; }
  .pg-close-btn {
    background: none; border: none; font-size: 1.6rem; color: var(--color-slate-500);
    cursor: pointer; line-height: 1; padding: 0; width: 2rem; height: 2rem;
  }
  .pg-close-btn:hover { color: var(--color-slate-800); }

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

  /* Vertical rule between every week column (and after the sticky Item
     column) — without this the grid had row separators but no column
     separators, so it was impossible to tell which week a cell belonged to. */
  th.week, td.week { border-left: 1px solid var(--color-slate-200); }

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

  .weeks-heading {
    text-align: center;
    font-size: 0.7rem;
  }
  .weeks-heading-hint {
    display: block;
    text-transform: none;
    letter-spacing: normal;
    font-weight: 400;
    font-size: 0.68rem;
    color: var(--color-slate-400);
    margin-top: 2px;
  }

  th.week-current { background: var(--color-slate-200); }
  td.week-current { background: var(--color-slate-100); }

  .c1 { position: sticky; left: 0; z-index: 1; background: white; width: 230px; min-width: 230px; white-space: normal; box-shadow: 4px 0 8px -6px rgba(15, 23, 42, 0.25); }
  thead th.c1 { z-index: 2; background: var(--color-slate-50); }

  td.week { text-align: center; cursor: default; }
  tr.row-milestone td.week,
  tr.row-cond td.week,
  tr.row-issue td.week,
  tr.row-consultation td.week { cursor: pointer; }
  tr.row-milestone td.week:hover,
  tr.row-cond td.week:hover,
  tr.row-issue td.week:hover,
  tr.row-consultation td.week:hover { background: var(--color-slate-100); }

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
  .dot-consultation { background: var(--color-violet-600); }

  tr.row-cond .c1, tr.row-issue .c1, tr.row-consultation .c1 { border-left: 3px solid transparent; }
  tr.row-cond .c1 { border-left-color: var(--color-indigo-800); background: var(--color-badge-indigo-bg); }
  tr.row-issue .c1 { border-left-color: var(--color-amber-500); background: var(--color-badge-warning-bg); }
  tr.row-consultation .c1 { border-left-color: var(--color-violet-600); background: var(--color-badge-purple-bg); }

  .item-title { display: block; font-weight: 700; font-size: 0.83rem; }
  tr.row-cond .item-title { color: var(--color-badge-indigo-fg); }
  tr.row-issue .item-title { color: var(--color-badge-warning-fg); }
  tr.row-consultation .item-title { color: var(--color-badge-purple-fg); }
  .item-meta { display: block; font-size: 0.72rem; color: var(--color-slate-500); font-weight: 500; margin-top: 0.1rem; }

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
</style>
