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

    // Calculate weeks needed to cover the latest date (plus 2 weeks buffer)
    let weeksNeeded = minWeeks;
    if (allDates.length > 0) {
      const maxDate = new Date(Math.max(...allDates));
      const maxDateWeek = getWeekCommencing(maxDate);
      maxDateWeek.setDate(maxDateWeek.getDate() + (2 * 7)); // 2 weeks after latest date
      const diffTime = maxDateWeek.getTime() - startWeek.getTime();
      const diffWeeks = Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000));
      weeksNeeded = Math.max(minWeeks, diffWeeks);
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
        width: 120,
        headerSort: false
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
          const events = cell.getValue() || [];
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
      },
      cellClick: function(e, cell) {
        // Skip if clicked on a date icon (handled by DOM event listener)
        if (e.target.classList.contains('date-icon')) {
          return;
        }

        const field = cell.getColumn().getField();
        const rowData = cell.getRow().getData();

        // Don't handle clicks on spacing rows
        if (rowData._rowType === 'spacing') {
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
  
  function handleContainerClick(e) {
    const target = e.target;

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
