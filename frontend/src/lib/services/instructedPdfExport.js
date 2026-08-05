import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTitleBlock, drawPageFooter, projectLineFor, sortQuotesByDiscipline } from './pdfExportShared.js';

// A4 landscape export of the Instructed Surveyors page: the instructed
// table (optionally with Key Dates / Progress columns mirroring the
// Conditions Tracker's advancement history), and a weekly programme
// timeline section — one row per instructed quote plus a Key Project Dates
// row, spanning from today to the latest date recorded anywhere in the
// programme. Both sections are reusable (drawInstructedTable /
// drawProgrammeTimeline) so the Conditions Tracker export can bundle them
// into the same combined PDF (see conditionsPdfExport.js).

const SLATE = [51, 65, 85];
const HEADER_FILL = [241, 245, 249];

// Matches the on-screen Gantt (GanttGrid.svelte) colour choices
const SITE_VISIT_COLOR = '#3b82f6';
const DRAFT_COLOR = '#8b5cf6';
const FINAL_COLOR = '#10b981';
const DEFAULT_EVENT_COLOR = '#f59e0b';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function hexToRgb(hex) {
  if (!hex) return [148, 163, 184];
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getWeekStart(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function isInWeek(dateStr, weekStart) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const weekEnd = addWeeks(weekStart, 1);
  return d >= weekStart && d < weekEnd;
}

function weekLabel(d) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Weeks from today to the latest date recorded anywhere in the programme
// (not a fixed horizon) — collapses to just the current week if every
// recorded date is already in the past.
function buildProgrammeWeeks(quotes, programmeEvents, quoteKeyDates) {
  const allDates = [
    ...programmeEvents.map(pe => pe.date),
    ...quoteKeyDates.map(kd => kd.date),
    ...quotes.flatMap(q => [q.site_visit_date, q.report_draft_date, q.report_final_date]),
  ].filter(Boolean).map(d => new Date(d));

  const startWeek = getWeekStart(new Date());
  if (allDates.length === 0) return [];

  const maxDate = new Date(Math.max(...allDates));
  const endWeek = maxDate > startWeek ? getWeekStart(maxDate) : startWeek;

  const weeks = [];
  let cur = new Date(startWeek);
  while (cur <= endWeek) {
    weeks.push(new Date(cur));
    cur = addWeeks(cur, 1);
  }
  return weeks;
}

// Events falling in a given week for a quote's built-in dates + its custom key dates
function eventsForQuoteWeek(quote, keyDates, weekStart) {
  const events = [];
  if (isInWeek(quote.site_visit_date, weekStart)) {
    events.push({ label: 'Site Visit', color: SITE_VISIT_COLOR });
  }
  if (isInWeek(quote.report_draft_date, weekStart)) {
    events.push({ label: 'Draft Report', color: DRAFT_COLOR });
  }
  if (isInWeek(quote.report_final_date, weekStart)) {
    events.push({ label: 'Final Report', color: FINAL_COLOR });
  }
  keyDates
    .filter(kd => kd.quote_id === quote.id && isInWeek(kd.date, weekStart))
    .forEach(kd => events.push({ label: kd.title || 'Key Date', color: kd.colour || DEFAULT_EVENT_COLOR }));
  return events;
}

// Widest single word across a set of labels, at the doc's current font —
// used so a week column is never narrower than its longest unsplittable word.
function longestWordWidth(doc, labels) {
  let max = 0;
  for (const label of labels) {
    for (const word of String(label).split(/\s+/)) {
      if (!word) continue;
      const w = doc.getTextWidth(word);
      if (w > max) max = w;
    }
  }
  return max;
}

function weekCellStyles(events) {
  if (!events.length) return {};
  // Weekly buckets are coarse enough that more than one event in the same
  // cell is rare; when it happens the first event's colour wins the fill.
  return { fillColor: hexToRgb(events[0].color), textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' };
}

/**
 * Draws the Instructed table (+ optional Key Dates / Progress columns)
 * onto the given doc, starting at the top of whatever page it's currently
 * on. Returns the Y position after the table, or null if nothing was drawn
 * (all three options false).
 */
export function drawInstructedTable(doc, { project, quotes, actionsByQuote, quoteKeyDates, margin, pageWidth, pageHeight, totalPagesExp, options }) {
  const { includeTable = true, includeProgress = true, includeKeyDates = true } = options || {};
  if (!includeTable && !includeProgress && !includeKeyDates) return null;

  quotes = sortQuotesByDiscipline(quotes);
  const projectLine = projectLineFor(project);
  const cursorY = drawTitleBlock(doc, { title: 'Instructed Surveyors', projectLine, margin, pageWidth });

  // Column descriptors, in display order — width omitted means the column
  // stretches to fill remaining page width (used for the free-text columns).
  const columns = [
    { header: 'Discipline', width: 26, cell: q => ({ content: q.discipline || '', styles: { fontStyle: 'bold' } }) },
    { header: 'Organisation', width: 40, cell: q => ({ content: q.surveyor_organisation || '' }) },
    { header: 'Contact', width: 28, cell: q => ({ content: q.contact_name || '' }) },
  ];

  if (includeTable) {
    columns.push(
      {
        header: 'Instructed Total', width: 26,
        cell: q => ({
          content: q.instruction_status === 'partially instructed'
            ? `${formatCurrency(q.partially_instructed_total)} (partial)`
            : formatCurrency(q.total),
          styles: { halign: 'right', fontStyle: 'bold' },
        }),
      },
      { header: 'Work Status', width: 24, cell: q => ({ content: q.work_status || 'In progress' }) },
      { header: 'Dependencies', width: 32, cell: q => ({ content: q.dependencies || '' }) },
    );
  }

  if (includeKeyDates) {
    columns.push({
      header: 'Key Dates',
      width: 50,
      cell: q => {
        const dates = (quoteKeyDates || [])
          .filter(kd => kd.quote_id === q.id)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return { content: dates.map(kd => `${formatDate(kd.date)} - ${kd.title || ''}`).join('\n') };
      },
    });
  }

  if (includeProgress) {
    columns.push({
      header: 'Progress',
      cell: q => {
        const progress = (actionsByQuote?.[q.id] || [])
          .map(a => `${formatDate(a.action_date)} - ${a.summary}`)
          .join('\n\n');
        return { content: progress };
      },
    });
  }

  const head = [columns.map(c => c.header)];
  const body = quotes.map(q => columns.map(c => c.cell(q)));
  const columnStyles = Object.fromEntries(
    columns.map((c, i) => [i, c.width ? { cellWidth: c.width } : {}])
  );

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    margin: { left: margin, right: margin, top: 13, bottom: 11 },
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 7, cellPadding: 1.8, textColor: SLATE,
      lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEADER_FILL, textColor: [51, 65, 85], fontSize: 7.5,
      fontStyle: 'bold', valign: 'middle', lineColor: [203, 213, 225],
    },
    columnStyles,
    didDrawPage: (data) => {
      drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
    },
  });

  return doc.lastAutoTable.finalY;
}

/**
 * Draws the Programme Timeline title + weekly band tables onto the given
 * doc, starting at the top of whatever page it's currently on.
 */
export function drawProgrammeTimeline(doc, { project, quotes, programmeEvents, quoteKeyDates, margin, pageWidth, pageHeight, totalPagesExp }) {
  quotes = sortQuotesByDiscipline(quotes);
  const projectLine = projectLineFor(project);
  let cursorY = drawTitleBlock(doc, { title: 'Programme Timeline', projectLine, margin, pageWidth });

  const weeks = buildProgrammeWeeks(quotes, programmeEvents, quoteKeyDates);

  if (weeks.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No programme dates recorded for this project.', margin, cursorY + 4);
    return;
  }

  const labelColumns = [
    { header: 'Discipline', width: 24 },
    { header: 'Organisation', width: 30 },
    { header: 'Contact', width: 20 },
  ];

  // Narrow week columns, sized to fill the page — full event text wraps
  // onto multiple lines and grows the row, but never splits a single word
  // mid-character, so the column is widened to fit the longest word actually
  // present in the data if the default narrow width is too tight for it.
  const usableWidth = pageWidth - margin * 2;
  const labelWidth = labelColumns.reduce((sum, c) => sum + c.width, 0);
  const weekCellPadding = 0.8;
  doc.setFont('helvetica', 'bold'); // matches weekCellStyles' fontStyle for event cells
  doc.setFontSize(5);
  const longestWord = longestWordWidth(doc, [
    'Site Visit', 'Draft Report', 'Final Report',
    ...programmeEvents.map(pe => pe.title || 'Milestone'),
    ...quoteKeyDates.map(kd => kd.title || 'Key Date'),
  ]);
  const weekColWidth = Math.max(9, longestWord + weekCellPadding * 2 + 0.5);
  const weeksPerBand = Math.max(8, Math.floor((usableWidth - labelWidth) / weekColWidth));

  for (let bandStart = 0; bandStart < weeks.length; bandStart += weeksPerBand) {
    const bandWeeks = weeks.slice(bandStart, bandStart + weeksPerBand);
    const totalCols = labelColumns.length + bandWeeks.length;

    // The band's date-range title is a spanning row inside the table itself
    // (rather than drawn separately above it) so pageBreak:'avoid' below
    // keeps the title, column headers and rows together as one unit instead
    // of splitting the table across a page boundary.
    const head = [
      [{
        content: `${formatDate(bandWeeks[0])} - ${formatDate(addWeeks(bandWeeks[bandWeeks.length - 1], 1))}`,
        colSpan: totalCols,
        styles: { halign: 'left', fontStyle: 'bold', fontSize: 7.5, fillColor: [226, 232, 240], textColor: [51, 65, 85] },
      }],
      [...labelColumns.map(c => c.header), ...bandWeeks.map(weekLabel)],
    ];

    const body = [];

    // Key Project Dates row
    const keyDatesRow = [
      { content: 'Key Project Dates', styles: { fontStyle: 'bold', fillColor: HEADER_FILL } },
      { content: '', styles: { fillColor: HEADER_FILL } },
      { content: '', styles: { fillColor: HEADER_FILL } },
    ];
    bandWeeks.forEach(week => {
      const events = programmeEvents
        .filter(pe => isInWeek(pe.date, week))
        .map(pe => ({ label: pe.title || 'Milestone', color: pe.colour || DEFAULT_EVENT_COLOR }));
      keyDatesRow.push({ content: events.map(e => e.label).join('\n'), styles: { ...weekCellStyles(events), ...(events.length ? {} : { fillColor: HEADER_FILL }) } });
    });
    body.push(keyDatesRow);

    // One row per instructed quote
    for (const q of quotes) {
      const row = [
        { content: q.discipline || '' },
        { content: q.surveyor_organisation || '' },
        { content: q.contact_name || '' },
      ];
      bandWeeks.forEach(week => {
        const events = eventsForQuoteWeek(q, quoteKeyDates, week);
        row.push({ content: events.map(e => e.label).join('\n'), styles: weekCellStyles(events) });
      });
      body.push(row);
    }

    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      margin: { left: margin, right: margin, top: 13, bottom: 11 },
      theme: 'grid',
      pageBreak: 'avoid',
      styles: {
        font: 'helvetica', fontSize: 5, cellPadding: 0.8, textColor: SLATE,
        lineColor: [226, 232, 240], lineWidth: 0.15, valign: 'top', overflow: 'linebreak',
      },
      headStyles: {
        fillColor: HEADER_FILL, textColor: [51, 65, 85], fontSize: 5.4,
        fontStyle: 'bold', valign: 'middle', lineColor: [203, 213, 225], halign: 'center',
      },
      columnStyles: {
        ...Object.fromEntries(labelColumns.map((c, i) => [i, { cellWidth: c.width, fontSize: 6, fontStyle: i === 0 ? 'bold' : 'normal' }])),
        ...Object.fromEntries(bandWeeks.map((_, i) => [labelColumns.length + i, { cellWidth: weekColWidth }])),
      },
      didDrawPage: (data) => {
        drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber: data.pageNumber, totalPagesExp });
      },
    });

    cursorY = doc.lastAutoTable.finalY + 8;
  }
}

export function exportInstructedPdf(project, quotes, actionsByQuote, programmeEvents, quoteKeyDates, options) {
  const { includeTable = true, includeProgress = true, includeProgramme = true, includeKeyDates = true } = options || {};

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const totalPagesExp = '{total_pages_count_string}';

  const sectionDrawn = drawInstructedTable(doc, {
    project, quotes, actionsByQuote, quoteKeyDates, margin, pageWidth, pageHeight, totalPagesExp,
    options: { includeTable, includeProgress, includeKeyDates },
  }) !== null;

  if (includeProgramme) {
    if (sectionDrawn) doc.addPage();
    drawProgrammeTimeline(doc, {
      project, quotes, programmeEvents: programmeEvents || [], quoteKeyDates: quoteKeyDates || [],
      margin, pageWidth, pageHeight, totalPagesExp,
    });
  }

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  const projectRef = project?.project_reference || project?.project_code || project?.site_name || 'Project';
  doc.save(`${projectRef} Instructed Surveyors.pdf`);
}
