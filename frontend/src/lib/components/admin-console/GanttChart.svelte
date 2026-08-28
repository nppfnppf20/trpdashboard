<script>
  export let quotes = [];
  export let quoteKeyDates = [];
  export let programmeEvents = [];
  
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  
  function getWeekCommencing(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(d.setDate(diff));
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  }
  
  function getWeekColumns() {
    // Get min and max dates from all events
    const allDates = [
      ...quoteKeyDates.map(kd => new Date(kd.date)),
      ...programmeEvents.map(pe => new Date(pe.date)),
      ...quotes.flatMap(q => [
        q.site_visit_date ? new Date(q.site_visit_date) : null,
        q.report_draft_date ? new Date(q.report_draft_date) : null
      ]).filter(Boolean)
    ];
    
    let startWeek, endWeek;
    
    if (allDates.length === 0) {
      // Default to 20 weeks from now if no dates
      const now = new Date();
      startWeek = getWeekCommencing(now);
      endWeek = new Date(startWeek);
      endWeek.setDate(endWeek.getDate() + (20 * 7));
    } else {
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));
      
      // Get week commencing dates
      startWeek = getWeekCommencing(minDate);
      endWeek = getWeekCommencing(maxDate);
      
      // Add buffer weeks
      startWeek.setDate(startWeek.getDate() - (2 * 7)); // 2 weeks before
      endWeek.setDate(endWeek.getDate() + (8 * 7)); // 8 weeks after
      
      // Ensure minimum of 20 weeks
      const weeksDiff = Math.floor((endWeek - startWeek) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff < 20) {
        endWeek = new Date(startWeek);
        endWeek.setDate(endWeek.getDate() + (20 * 7));
      }
    }
    
    const weeks = [];
    let current = new Date(startWeek);
    
    while (current <= endWeek) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weeks.push({
        start: new Date(current),
        end: weekEnd,
        label: `w/c ${current.getDate()}/${current.getMonth() + 1}`,
        fullLabel: current.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      });
      
      current.setDate(current.getDate() + 7);
    }
    
    return { weeks, startWeek, endWeek };
  }
  
  function getDatePosition(dateString, startDate, totalDays) {
    if (!dateString) return null;
    const date = new Date(dateString);
    const daysSinceStart = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    return (daysSinceStart / totalDays) * 100;
  }
  
  function getQuoteKeyDatesForQuote(quoteId) {
    return quoteKeyDates.filter(kd => kd.quote_id === quoteId);
  }
  
  $: timeline = getWeekColumns();
  $: totalDays = Math.floor((timeline.endWeek - timeline.startWeek) / (1000 * 60 * 60 * 24));
</script>

<div class="gantt-container">
  <div class="gantt-header">
    <div class="gantt-sidebar-header">Item / Surveyor</div>
    <div class="gantt-timeline-header">
      {#each timeline.weeks as week}
        <div class="week-col" title="{week.fullLabel}">
          {week.label}
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Project-level events -->
  {#if programmeEvents.length > 0}
    <div class="gantt-section-title">Project Milestones</div>
    <div class="gantt-row project-row">
      <div class="gantt-sidebar">
        <div class="row-title">Project Events</div>
      </div>
      <div class="gantt-timeline">
        <!-- Week separators -->
        {#each timeline.weeks as week, i}
          <div class="week-separator" style="left: {i * 35}px"></div>
        {/each}
        
        {#each programmeEvents as event}
          {@const position = getDatePosition(event.date, timeline.startWeek, totalDays)}
          {#if position !== null}
            <div 
              class="milestone" 
              style="left: {position}%; background-color: {event.color || '#3b82f6'}"
              title="{event.title} - {formatDate(event.date)}"
            >
              <div class="milestone-label">{event.title}</div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Quote rows -->
  {#if quotes.length > 0}
    <div class="gantt-section-title">Surveyor Work</div>
    {#each quotes as quote}
      {@const keyDates = getQuoteKeyDatesForQuote(quote.id)}
      <div class="gantt-row">
        <div class="gantt-sidebar">
          <div class="row-title">{quote.discipline}</div>
          <div class="row-subtitle">{quote.surveyor_organisation}</div>
          <div class="row-status">
            <span class="mini-badge status-{quote.work_status?.replace(' ', '-')}">
              {quote.work_status || 'not started'}
            </span>
          </div>
        </div>
        <div class="gantt-timeline">
          <!-- Week separators -->
          {#each timeline.weeks as week, i}
            <div class="week-separator" style="left: {i * 35}px"></div>
          {/each}
          
          <!-- Site visit date -->
          {#if quote.site_visit_date}
            {@const position = getDatePosition(quote.site_visit_date, timeline.startWeek, totalDays)}
            {#if position !== null}
              <div 
                class="milestone site-visit" 
                style="left: {position}%"
                title="Site Visit - {formatDate(quote.site_visit_date)}"
              >
                <div class="milestone-label">Site Visit</div>
              </div>
            {/if}
          {/if}
          
          <!-- Draft report date -->
          {#if quote.report_draft_date}
            {@const position = getDatePosition(quote.report_draft_date, timeline.startWeek, totalDays)}
            {#if position !== null}
              <div 
                class="milestone report-draft" 
                style="left: {position}%"
                title="Draft Report - {formatDate(quote.report_draft_date)}"
              >
                <div class="milestone-label">Draft</div>
              </div>
            {/if}
          {/if}
          
          <!-- Custom key dates -->
          {#each keyDates as keyDate}
            {@const position = getDatePosition(keyDate.date, timeline.startWeek, totalDays)}
            {#if position !== null}
              <div 
                class="milestone custom" 
                style="left: {position}%; background-color: {keyDate.color || '#8b5cf6'}"
                title="{keyDate.title} - {formatDate(keyDate.date)}"
              >
                <div class="milestone-label">{keyDate.title}</div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .gantt-container {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    overflow-x: auto;
  }

  .gantt-header {
    display: flex;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .gantt-sidebar-header {
    width: 150px;
    min-width: 150px;
    padding: 0.5rem 0.5rem;
    font-weight: 600;
    color: var(--color-slate-600);
    border-right: 1px solid var(--color-slate-200);
    font-size: 0.75rem;
  }

  .gantt-timeline-header {
    display: flex;
    flex: 1;
    overflow-x: auto;
  }

  .week-col {
    flex: 0 0 35px;
    width: 35px;
    padding: 0.375rem 0.125rem;
    text-align: center;
    font-weight: 600;
    color: var(--color-slate-600);
    font-size: 0.5625rem;
    border-right: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .week-col:last-child {
    border-right: none;
  }

  .gantt-section-title {
    padding: 0.375rem 0.75rem;
    background: var(--color-slate-100);
    font-weight: 600;
    color: var(--color-slate-700);
    font-size: 0.75rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .gantt-row {
    display: flex;
    border-bottom: 1px solid var(--color-slate-200);
    min-height: 40px;
  }

  .gantt-row.project-row {
    background: var(--color-badge-warning-bg);
  }

  .gantt-sidebar {
    width: 150px;
    min-width: 150px;
    padding: 0.5rem;
    border-right: 1px solid var(--color-slate-200);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .row-title {
    font-weight: 600;
    color: var(--color-slate-800);
    font-size: 0.75rem;
    margin-bottom: 0.125rem;
  }

  .row-subtitle {
    font-size: 0.6875rem;
    color: var(--color-slate-500);
    margin-bottom: 0.25rem;
  }
  
  .row-status {
    margin-top: 0.125rem;
  }
  
  .mini-badge {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: capitalize;
  }
  
  .mini-badge.status-pending {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .mini-badge.status-instructed {
    background: var(--color-badge-info-bg);
    color: var(--color-badge-info-fg);
  }

  .mini-badge.status-in-progress {
    background: var(--color-badge-indigo-bg);
    color: var(--color-badge-indigo-fg);
  }

  .mini-badge.status-completed {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .mini-badge.status-not-started {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }

  .gantt-timeline {
    flex: 1;
    position: relative;
    min-height: 40px;
  }

  .week-separator {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--color-slate-200);
    z-index: 1;
  }
  
  .milestone {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 5;
  }
  
  .milestone:hover {
    transform: translate(-50%, -50%) scale(2);
    z-index: 10;
  }
  
  .milestone:hover .milestone-label {
    display: block;
  }
  
  .milestone-label {
    display: none;
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-slate-800);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.6875rem;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .milestone-label::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: var(--color-slate-800);
  }

  .milestone.site-visit {
    background-color: var(--color-primary-500);
  }

  .milestone.report-draft {
    background-color: var(--color-violet-600);
  }

  .milestone.custom {
    background-color: var(--color-amber-500);
  }
</style>

