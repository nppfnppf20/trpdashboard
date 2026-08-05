// Shared title-block / footer drawing for the surveyor-management &
// conditions-tracker PDF exports, so multiple report sections combined into
// one document (see exportConditionsWithExtras) look like one consistent
// report rather than several stitched-together styles.

export const SLATE = [51, 65, 85];
export const HEADER_FILL = [241, 245, 249];

/**
 * Draws the standard section title block (bold title, project line, exported
 * date) at the top of whatever page the doc's cursor is currently on.
 * @returns {number} suggested startY for content below the block
 */
export function drawTitleBlock(doc, { title, projectLine, margin, pageWidth }) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (projectLine) doc.text(projectLine, margin, 19);

  doc.setTextColor(148, 163, 184);
  doc.text(
    `Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    pageWidth - margin, 19, { align: 'right' }
  );

  return 26;
}

/** Bottom-of-page footer: page number (+ total if provided) and project ref, left. */
export function drawPageFooter(doc, { pageWidth, pageHeight, margin, projectLine, pageNumber, totalPagesExp }) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const pageLabel = totalPagesExp ? `Page ${pageNumber} of ${totalPagesExp}` : `Page ${pageNumber}`;
  doc.text(pageLabel, pageWidth - margin, pageHeight - 5, { align: 'right' });
  if (projectLine) doc.text(projectLine, margin, pageHeight - 5);
}

export function projectLineFor(project) {
  return [project?.project_code || project?.project_reference || project?.project_id, project?.site_name || project?.project_name]
    .filter(Boolean).join(' - ');
}
