<script>
  export let quotes = [];
  export let quoteKeyDates = [];
  export let programmeEvents = [];
  export let scrollLeft = 0;

  const FROZEN_WIDTH = 390; // px - matches GanttGrid frozen column widths (120 + 150 + 120)
  const WEEK_WIDTH = 45;    // px - matches GanttGrid week column width
  const ROW_HEIGHT = 35;    // px - matches GanttGrid rowHeight

  let isExpanded = false;
  let scrollContainer;

  // Hardcoded survey windows (to be replaced with DB data later)
  const surveyWindows = [
    { id: 1, name: 'Bat Activity Survey',            start: '2025-03-15', end: '2025-10-31', color: '#7c3aed' },
    { id: 2, name: 'Breeding Bird Survey',           start: '2025-04-01', end: '2025-07-31', color: '#059669' },
    { id: 3, name: 'Reptile Survey',                 start: '2025-03-15', end: '2025-10-15', color: '#d97706' },
    { id: 4, name: 'Protected Species (Hazel D.)',   start: '2025-05-01', end: '2025-08-31', color: '#dc2626' },
    { id: 5, name: 'Otter / Water Vole Survey',      start: '2025-04-01', end: '2025-09-30', color: '#0284c7' },
  ];

  function getWeekCommencing(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  }

  function generateWeeks() {
    const allDates = [
      ...quoteKeyDates.map(kd => new Date(kd.date)),
      ...programmeEvents.map(pe => new Date(pe.date)),
      ...quotes.flatMap(q => [
        q.site_visit_date    ? new Date(q.site_visit_date)    : null,
        q.report_draft_date  ? new Date(q.report_draft_date)  : null,
        q.report_final_date  ? new Date(q.report_final_date)  : null,
      ]).filter(Boolean),
    ];

    let startWeek;
    if (allDates.length === 0) {
      startWeek = getWeekCommencing(new Date());
    } else {
      const minDate = new Date(Math.min(...allDates));
      startWeek = getWeekCommencing(minDate);
      startWeek.setDate(startWeek.getDate() - 14); // 2 weeks before
    }

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const availableWidth = screenWidth - 420;
    const minWeeks = Math.max(Math.floor(availableWidth / WEEK_WIDTH), 20);

    let weeksNeeded = minWeeks;
    if (allDates.length > 0) {
      const maxDate = new Date(Math.max(...allDates));
      const maxDateWeek = getWeekCommencing(maxDate);
      maxDateWeek.setDate(maxDateWeek.getDate() + 14);
      const diffWeeks = Math.ceil((maxDateWeek - startWeek) / (7 * 86400000));
      weeksNeeded = Math.max(minWeeks, diffWeeks);
    }

    const weeks = [];
    let current = new Date(startWeek);
    for (let i = 0; i < weeksNeeded; i++) {
      weeks.push({ date: new Date(current) });
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }

  function getWindowBar(win, weeks) {
    const startDate = new Date(win.start);
    const endDate   = new Date(win.end);
    let startIndex = -1;
    let endIndex   = -1;

    for (let i = 0; i < weeks.length; i++) {
      const wStart = weeks[i].date;
      const wEnd   = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);

      if (endDate >= wStart && startDate <= wEnd) {
        if (startIndex === -1) startIndex = i;
        endIndex = i;
      }
    }

    if (startIndex === -1) return null;

    return {
      left:  startIndex * WEEK_WIDTH,
      width: (endIndex - startIndex + 1) * WEEK_WIDTH - 2,
    };
  }

  $: weeks = generateWeeks();
  $: if (scrollContainer) scrollContainer.scrollLeft = scrollLeft;
</script>

<div class="key-windows-panel">
  <div class="toggle-bar">
    <button class="toggle-btn" on:click={() => (isExpanded = !isExpanded)}>
      <i class="las {isExpanded ? 'la-chevron-up' : 'la-chevron-down'}"></i>
      <span>Key Survey Windows</span>
      <span class="badge">{surveyWindows.length}</span>
    </button>
    {#if isExpanded}
      <span class="hint">Windows are hardcoded — live data coming soon</span>
    {/if}
  </div>

  {#if isExpanded}
    <div class="windows-body">
      <!-- Fixed label column — matches the Tabulator frozen columns width -->
      <div class="label-col" style="width: {FROZEN_WIDTH}px">
        {#each surveyWindows as win}
          <div
            class="window-label"
            style="height: {ROW_HEIGHT}px; border-left: 3px solid {win.color}"
          >
            <span class="dot" style="background: {win.color}"></span>
            {win.name}
          </div>
        {/each}
      </div>

      <!-- Scrollable timeline column — scroll driven by GanttGrid via scrollLeft prop -->
      <div class="timeline-col" bind:this={scrollContainer}>
        <div
          class="timeline-inner"
          style="width: {weeks.length * WEEK_WIDTH}px; height: {surveyWindows.length * ROW_HEIGHT}px"
        >
          {#each surveyWindows as win, rowIdx}
            {@const bar = getWindowBar(win, weeks)}
            {#if bar}
              <div
                class="window-bar"
                title="{win.name} — {win.start} to {win.end}"
                style="
                  top:    {rowIdx * ROW_HEIGHT + 7}px;
                  left:   {bar.left}px;
                  width:  {bar.width}px;
                  height: {ROW_HEIGHT - 14}px;
                  background: {win.color};
                "
              ></div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .key-windows-panel {
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    flex-shrink: 0;
  }

  .toggle-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 1.5rem;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }

  .toggle-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
  }

  .toggle-btn i {
    font-size: 0.75rem;
  }

  .badge {
    background: #e2e8f0;
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .hint {
    font-size: 0.7rem;
    color: #94a3b8;
    font-style: italic;
  }

  .windows-body {
    display: flex;
    border-top: 1px solid #e2e8f0;
    background: white;
  }

  .label-col {
    flex-shrink: 0;
    border-right: 2px solid #cbd5e1;
    background: white;
  }

  .window-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    font-size: 0.72rem;
    font-weight: 500;
    color: #475569;
    border-bottom: 1px solid #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .timeline-col {
    flex: 1;
    overflow: hidden; /* no scrollbar — driven by GanttGrid scroll */
    position: relative;
    background: white;
  }

  .timeline-inner {
    position: relative;
  }

  .window-bar {
    position: absolute;
    border-radius: 3px;
    opacity: 0.8;
    transition: opacity 0.15s;
  }

  .window-bar:hover {
    opacity: 1;
  }
</style>
