<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator_simple.min.css';
  
  export let quotes = [];
  export let quoteKeyDates = [];
  export let programmeEvents = [];
  
  const dispatch = createEventDispatcher();

  let tableContainer;
  let tabulator;
  let showSurveyWindows = false;
  let showSurveyInfo = false;

  // Key ecological survey windows — month-based so they repeat automatically every year.
  // startMonth/endMonth use 1–12. Windows that wrap the year end (e.g. Oct–Mar) are
  // handled by the isWeekInWindow helper below.
  const surveyWindows = [
    { id: 1, name: 'Breeding Birds',         color: '#16a34a', startMonth: 3,  endMonth: 6  }, // Mar–start of Jul
    { id: 2, name: 'Wintering Birds',        color: '#3b82f6', startMonth: 10, endMonth: 2  }, // Oct–start of Mar
    { id: 3, name: 'Veg. Clearance (Avoid)', color: '#ef4444', startMonth: 3,  endMonth: 7  }, // Mar–start of Aug
    { id: 4, name: 'GCN eDNA Survey',        color: '#0d9488', startMonth: 4,  endMonth: 5  }, // Apr–start of Jun
    { id: 5, name: 'GCN Habitat Surveys',    color: '#0891b2', startMonth: 4,  endMonth: 8  }, // Apr–start of Sep
    { id: 6, name: 'Bat PRA (Optimal)',      color: '#8b5cf6', startMonth: 3,  endMonth: 9  }, // Mar–start of Oct
  ];

  function isWeekInWindow(weekDate, win) {
    const m = weekDate.getMonth() + 1; // 1–12
    if (win.startMonth <= win.endMonth) {
      return m >= win.startMonth && m <= win.endMonth;
    }
    // Wraps year boundary (e.g. Oct=10 → Mar=3)
    return m >= win.startMonth || m <= win.endMonth;
  }
  
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
        q.site_visit_date ? new Date(q.site_visit_date) : null,
        q.report_draft_date ? new Date(q.report_draft_date) : null,
        q.report_final_date ? new Date(q.report_final_date) : null
      ]).filter(Boolean)
    ];

    let startWeek;

    if (allDates.length === 0) {
      const now = new Date();
      startWeek = getWeekCommencing(now);
    } else {
      const minDate = new Date(Math.min(...allDates));
      startWeek = getWeekCommencing(minDate);
      startWeek.setDate(startWeek.getDate() - (2 * 7)); // 2 weeks before
    }

    // Calculate how many weeks fit on screen
    // Assuming frozen columns take ~420px, week columns are 45px each
    const screenWidth = window.innerWidth || 1920;
    const availableWidth = screenWidth - 420; // Account for frozen columns
    const weeksToShow = Math.floor(availableWidth / 45);
    const minWeeks = Math.max(weeksToShow, 20); // At least 20 weeks

    // Always extend at least 2 years ahead from startWeek so survey windows are fully visible
    const twoYearsOut = new Date(startWeek);
    twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
    const twoYearWeeks = Math.ceil((twoYearsOut - startWeek) / (7 * 24 * 60 * 60 * 1000));

    // Also cover any quote/event dates beyond the 2-year mark
    let weeksNeeded = Math.max(minWeeks, twoYearWeeks);
    if (allDates.length > 0) {
      const maxDate = new Date(Math.max(...allDates));
      const maxDateWeek = getWeekCommencing(maxDate);
      maxDateWeek.setDate(maxDateWeek.getDate() + (2 * 7)); // 2 weeks after latest date
      const diffTime = maxDateWeek.getTime() - startWeek.getTime();
      const diffWeeks = Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000));
      weeksNeeded = Math.max(weeksNeeded, diffWeeks);
    }

    const weeks = [];
    let current = new Date(startWeek);

    for (let i = 0; i < weeksNeeded; i++) {
      weeks.push({
        date: new Date(current),
        label: `${current.getDate()}/${current.getMonth() + 1}`,
        field: current.toISOString().split('T')[0]
      });
      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }
  
  function isDateInWeek(dateString, weekStart) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return date >= weekStart && date <= weekEnd;
  }
  
  function buildTable() {
    if (!tableContainer) return;
    
    const weeks = generateWeeks();
    
    // Build columns
    const columns = [
      {
        title: "Category",
        field: "discipline",
        frozen: true,
        width: 165,
        headerSort: false,
        formatter: (cell) => {
          const rowData = cell.getRow().getData();
          if (rowData._rowType === 'survey-windows-toggle') {
            const icon = showSurveyWindows ? '−' : '+';
            return `<span style="overflow:visible;white-space:nowrap;font-weight:600;color:#0369a1;">${icon} Key Survey Windows <button class="survey-info-btn" title="About these windows">ⓘ</button></span>`;
          }
          return cell.getValue() || '';
        }
      },
      { 
        title: "Organisation", 
        field: "organisation", 
        frozen: true,
        width: 150,
        headerSort: false
      },
      { 
        title: "Contact", 
        field: "contact", 
        frozen: true,
        width: 120,
        headerSort: false
      },
      ...weeks.map(week => ({
        title: week.label,
        field: week.field,
        width: 45,
        headerSort: false,
        headerHozAlign: "center",
        formatter: (cell) => {
          const val = cell.getValue();

          // Survey window row — render a solid colour band
          if (val && val._isWindow) {
            return `<div style="background:${val.color};height:100%;opacity:0.8;"></div>`;
          }

          const events = Array.isArray(val) ? val : [];
          if (events.length === 0) return '';

          return events.map((e, idx) =>
            `<span class="date-icon" data-event-index="${idx}" data-event-json="${encodeURIComponent(JSON.stringify(e))}" style="
              display: inline-block;
              width: 18px;
              height: 18px;
              background: ${e.color};
              border-radius: 3px;
              margin: 1px;
              font-size: 9px;
              color: white;
              text-align: center;
              line-height: 18px;
              font-weight: 600;
              cursor: pointer;
            " title="${e.title}">${e.label}</span>`
          ).join('');
        },
        hozAlign: "center"
      }))
    ];
    
    // Build data
    const data = [];

    // Add Key Project Dates row with actual programme events
    const keyDatesRow = {
      discipline: 'Key Project Dates',
      organisation: '',
      contact: '',
      _rowType: 'header' // Special marker for styling
    };
    weeks.forEach(week => {
      const events = programmeEvents
        .filter(pe => isDateInWeek(pe.date, week.date))
        .map(pe => ({
          id: pe.id,
          title: pe.title,
          date: pe.date,
          color: pe.colour || '#f59e0b',
          label: pe.title.substring(0, 1).toUpperCase(),
          type: 'project'
        }));
      keyDatesRow[week.field] = events;
    });
    data.push(keyDatesRow);

    // Key Survey Windows — toggle row (always shown, click to expand/collapse)
    const windowsToggleRow = {
      discipline: '',  // label rendered by column formatter
      organisation: '',
      contact: '',
      _rowType: 'survey-windows-toggle'
    };
    weeks.forEach(week => { windowsToggleRow[week.field] = []; });
    data.push(windowsToggleRow);

    // Survey window rows — always added; visibility toggled via row.show()/row.hide()
    surveyWindows.forEach(win => {
      const row = {
        discipline: win.name,
        organisation: '',
        contact: '',
        _rowType: 'survey-window'
      };
      weeks.forEach(week => {
        row[week.field] = isWeekInWindow(week.date, win)
          ? { _isWindow: true, color: win.color }
          : [];
      });
      data.push(row);
    });

    // Add blank spacing row
    const spacingRow = {
      discipline: '',
      organisation: '',
      contact: '',
      _rowType: 'spacing' // Special marker for styling
    };
    weeks.forEach(week => {
      spacingRow[week.field] = [];
    });
    data.push(spacingRow);
    
    // Add quote rows
    quotes.forEach(quote => {
      const row = {
        discipline: quote.discipline,
        organisation: quote.surveyor_organisation,
        contact: quote.contact_name || '-',
        _quoteId: quote.id
      };

      weeks.forEach(week => {
        const events = [];

        if (isDateInWeek(quote.site_visit_date, week.date)) {
          events.push({
            title: 'Site Visit',
            date: quote.site_visit_date,
            color: '#3b82f6',
            label: 'SV',
            type: 'quote-builtin',
            discipline: quote.discipline,
            surveyor_organisation: quote.surveyor_organisation
          });
        }
        if (isDateInWeek(quote.report_draft_date, week.date)) {
          events.push({
            title: 'Draft Report',
            date: quote.report_draft_date,
            color: '#8b5cf6',
            label: 'D',
            type: 'quote-builtin',
            discipline: quote.discipline,
            surveyor_organisation: quote.surveyor_organisation
          });
        }
        if (isDateInWeek(quote.report_final_date, week.date)) {
          events.push({
            title: 'Final Report',
            date: quote.report_final_date,
            color: '#10b981',
            label: 'F',
            type: 'quote-builtin',
            discipline: quote.discipline,
            surveyor_organisation: quote.surveyor_organisation
          });
        }

        // Add custom key dates
        const keyDates = quoteKeyDates.filter(kd =>
          kd.quote_id === quote.id && isDateInWeek(kd.date, week.date)
        );

        keyDates.forEach(kd => {
          events.push({
            id: kd.id,
            title: kd.title,
            date: kd.date,
            color: kd.colour || '#f59e0b',
            label: kd.title.substring(0, 1).toUpperCase(),
            type: 'quote',
            discipline: quote.discipline,
            surveyor_organisation: quote.surveyor_organisation
          });
        });

        row[week.field] = events;
      });

      data.push(row);
    });
    
    // Destroy existing table
    if (tabulator) {
      tabulator.destroy();
    }
    
    // Create new table
    tabulator = new Tabulator(tableContainer, {
      data: data,
      columns: columns,
      layout: "fitDataFill",
      height: "100%",
      rowHeight: 35,
      headerHeight: 35,
      rowFormatter: function(row) {
        const rowData = row.getData();
        if (rowData._rowType) {
          row.getElement().setAttribute('data-row-type', rowData._rowType);
        }
        // Make survey window rows slim; hide them if the section is collapsed
        if (rowData._rowType === 'survey-window') {
          const el = row.getElement();
          el.style.height = '20px';
          el.style.minHeight = '20px';
          el.style.overflow = 'hidden';
          el.style.display = showSurveyWindows ? '' : 'none';
        }
      },
      cellClick: function(e, cell) {
        // Skip if clicked on a date icon (handled by DOM event listener)
        if (e.target.classList.contains('date-icon')) {
          return;
        }

        const field = cell.getColumn().getField();
        const rowData = cell.getRow().getData();

        // Toggle row is handled by the native DOM listener (handleContainerClick)
        if (rowData._rowType === 'survey-windows-toggle') {
          return;
        }

        // Don't handle clicks on spacing or window rows
        if (rowData._rowType === 'spacing' || rowData._rowType === 'survey-window') {
          return;
        }

        // Only handle clicks on week columns (not frozen columns)
        if (field !== 'discipline' && field !== 'organisation' && field !== 'contact') {
          // Handle adding new dates
          if (rowData._rowType === 'header') {
            dispatch('addProjectMilestone', { date: field });
          } else {
            // Find the quote for this row
            const quote = quotes.find(q =>
              q.discipline === rowData.discipline &&
              q.surveyor_organisation === rowData.organisation
            );

            if (quote) {
              dispatch('addQuoteDate', {
                quote: quote,
                date: field
              });
            }
          }
        }
      }
    });

  }

  function applyWindowVisibility() {
    if (!tabulator) return;
    tabulator.getRows().forEach(row => {
      if (row.getData()._rowType === 'survey-window') {
        row.getElement().style.display = showSurveyWindows ? '' : 'none';
      }
    });
  }

  function updateToggleIndicator() {
    if (!tabulator) return;
    const toggleRow = tabulator.getRows().find(r => r.getData()._rowType === 'survey-windows-toggle');
    if (!toggleRow) return;
    const cell = toggleRow.getCell('discipline');
    if (!cell) return;
    const icon = showSurveyWindows ? '−' : '+';
    cell.getElement().innerHTML = `<span style="overflow:visible;white-space:nowrap;font-weight:600;color:#0369a1;">${icon} Key Survey Windows <button class="survey-info-btn" title="About these windows">ⓘ</button></span>`;
  }

  function handleContainerClick(e) {
    const target = e.target;

    // Open survey windows info modal
    if (target.closest('.survey-info-btn')) {
      e.stopPropagation();
      showSurveyInfo = true;
      return;
    }

    // Toggle the Key Survey Windows section (but not if the info button was clicked)
    if (target.closest('[data-row-type="survey-windows-toggle"]') && !target.closest('.survey-info-btn')) {
      showSurveyWindows = !showSurveyWindows;
      applyWindowVisibility();
      updateToggleIndicator();
      return;
    }

    // Check if clicked on a date icon
    if (target.classList.contains('date-icon')) {
      const eventJson = target.getAttribute('data-event-json');
      if (eventJson) {
        try {
          const dateEvent = JSON.parse(decodeURIComponent(eventJson));
          dispatch('viewDate', { date: dateEvent });
        } catch (err) {
          console.error('Failed to parse date event:', err);
        }
      }
    }
  }

  onMount(() => {
    buildTable();

    // Add click listener for date icons
    if (tableContainer) {
      tableContainer.addEventListener('click', handleContainerClick);
    }

    return () => {
      if (tableContainer) {
        tableContainer.removeEventListener('click', handleContainerClick);
      }
    };
  });
  
  $: if (quotes || quoteKeyDates || programmeEvents) {
    if (tableContainer) {
      buildTable();
    }
  }
</script>

<div class="gantt-grid-container" bind:this={tableContainer}></div>

{#if showSurveyInfo}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="info-overlay" on:click={() => (showSurveyInfo = false)}>
    <div class="info-modal" on:click|stopPropagation>
      <div class="info-modal-header">
        <h3>Key Survey Windows</h3>
        <button class="close-btn" on:click={() => (showSurveyInfo = false)}>×</button>
      </div>
      <div class="info-modal-body">
        <p>
          These are some of the key ecology survey windows - by no means an exhaustive list.
          Always check in with the project ecologist. Full details can also be found here:
        </p>
        <a
          href="https://www.sweco.co.uk/services/water-energy-industry/environmental-consultancy/ecology-biodiversity/ecology-calendar-download/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Sweco Ecology Calendar →
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .gantt-grid-container {
    width: 100%;
    height: 100%;
  }
  
  /* Style for key dates row */
  :global(.tabulator-row[data-row-type="header"]) {
    background: #e5e7eb !important;
    font-weight: 700 !important;
    border-top: 1px solid #000 !important;
    border-bottom: 1px solid #000 !important;
  }
  
  :global(.tabulator-row[data-row-type="header"] .tabulator-cell) {
    border-right: 1px solid #000 !important;
  }
  
  :global(.tabulator-row[data-row-type="header"]:hover) {
    background: #e5e7eb !important;
    cursor: default !important;
  }
  
  /* Style for spacing rows */
  :global(.tabulator-row[data-row-type="spacing"]) {
    background: white !important;
    pointer-events: none;
  }
  
  :global(.tabulator-row[data-row-type="spacing"]:hover) {
    background: white !important;
  }
  
  :global(.tabulator) {
    font-size: 11px;
    border: 1px solid #e2e8f0;
  }
  
  :global(.tabulator .tabulator-header) {
    background-color: #f8fafc;
    border-bottom: 2px solid #cbd5e1;
  }
  
  :global(.tabulator .tabulator-header .tabulator-col) {
    background-color: #f8fafc;
    border-right: 1px solid #e2e8f0;
    font-weight: 600;
    color: #475569;
  }
  
  :global(.tabulator .tabulator-row) {
    border-bottom: 1px solid #e2e8f0;
  }
  
  :global(.tabulator .tabulator-row:hover) {
    background-color: inherit;
  }
  
  :global(.tabulator .tabulator-cell) {
    border-right: 1px solid #e2e8f0;
    padding: 4px 6px;
    cursor: default;
  }
  
  :global(.tabulator .tabulator-cell:not(.tabulator-frozen):hover) {
    background-color: inherit;
  }
  
  :global(.tabulator .tabulator-frozen) {
    background-color: white;
    border-right: 2px solid #cbd5e1;
  }
  
  :global(.tabulator .tabulator-frozen-left) {
    border-right: 2px solid #cbd5e1;
  }

  :global(.tabulator .tabulator-cell:not(.tabulator-frozen)) {
    cursor: pointer;
  }

  /* Key Survey Windows toggle row */
  :global(.tabulator-row[data-row-type="survey-windows-toggle"]) {
    background: #f0f9ff !important;
    font-weight: 600 !important;
    border-top: 1px solid #bae6fd !important;
    border-bottom: 1px solid #bae6fd !important;
    cursor: pointer !important;
  }

  :global(.tabulator-row[data-row-type="survey-windows-toggle"]:hover) {
    background: #e0f2fe !important;
  }

  :global(.tabulator-row[data-row-type="survey-windows-toggle"] .tabulator-cell) {
    cursor: pointer !important;
  }

  /* Individual survey window rows */
  :global(.tabulator-row[data-row-type="survey-window"]) {
    background: #fafafa !important;
    font-size: 10px !important;
    color: #475569 !important;
  }

  :global(.tabulator-row[data-row-type="survey-window"]:hover) {
    background: #fafafa !important;
    cursor: default !important;
  }

  :global(.tabulator-row[data-row-type="survey-window"] .tabulator-cell) {
    padding: 0 !important;
    cursor: default !important;
    overflow: hidden;
    line-height: 20px;
  }

  /* Give frozen label cells a little horizontal breathing room */
  :global(.tabulator-row[data-row-type="survey-window"] .tabulator-frozen) {
    padding: 0 6px !important;
    font-size: 10px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Info button in Category column header */
  :global(.survey-info-btn) {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    color: #94a3b8;
    padding: 0 0 0 4px;
    line-height: 1;
    vertical-align: middle;
    transition: color 0.15s;
  }

  :global(.survey-info-btn:hover) {
    color: #0369a1;
  }

  /* Info modal */
  .info-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .info-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 420px;
    max-width: 90vw;
  }

  .info-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .info-modal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: #475569;
  }

  .info-modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info-modal-body p {
    margin: 0;
    font-size: 0.875rem;
    color: #475569;
    line-height: 1.6;
  }

  .info-modal-body a {
    font-size: 0.875rem;
    color: #0369a1;
    text-decoration: none;
    font-weight: 500;
  }

  .info-modal-body a:hover {
    text-decoration: underline;
  }

  :global(.date-icon) {
    pointer-events: auto !important;
    cursor: pointer !important;
    transition: transform 0.1s ease;
  }

  :global(.date-icon:hover) {
    transform: scale(1.15);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
</style>
