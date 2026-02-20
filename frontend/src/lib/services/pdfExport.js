import jsPDF from 'jspdf';
import { getScreenshotsBySection } from './screenshotManager.js';
import {
  DocumentConfig,
  DocumentStructure,
  DocumentLabels,
  ContentFormatters,
  getRiskLevelStyle,
  cleanRiskLabel,
  processDocumentContent,
  generateFilename
} from './documentTemplate.js';

/**
 * Generate and download a PDF document from TRP report data
 * @param {any} editableReport - The editable TRP report data
 * @param {string} siteName - Name of the site for the filename
 */
export async function generatePDFReport(editableReport, siteName = 'TRP_Report') {
  try {
    const doc = await createPDFDocument(editableReport);
    const filename = generateFilename(siteName, 'pdf');

    doc.save(filename);
    console.log('✅ PDF document generated successfully:', filename);
  } catch (error) {
    console.error('❌ Error generating PDF document:', error);
    throw error;
  }
}

/**
 * Create a PDF document from TRP report data using the universal template
 * @param {any} report - The TRP report data
 * @returns {jsPDF} PDF document
 */
async function createPDFDocument(report) {
  const doc = new jsPDF();

  // Set default font to ensure consistency throughout
  doc.setFont('helvetica', 'normal'); // Use helvetica as closest to Calibri

  let yPosition = 25; // Start from top margin
  const margin = DocumentConfig.layout.pageMargin;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const maxWidth = pageWidth - (margin * 2);
  let pageNumber = 1;

  // Initialize figure counter for PDF
  const figureCounter = { value: 1 };

  // Process content using universal template
  const content = processDocumentContent(report);

  // Document state helpers
  const state = {
    yPosition,
    pageNumber,
    colors: DocumentConfig.colors,
    fonts: DocumentConfig.fonts,
    spacing: DocumentConfig.spacing
  };

  // Helper functions
  const helpers = createPDFHelpers(doc, state, margin, maxWidth, pageWidth, pageHeight);

  // Skip header - using clean universal template

  // Generate document title
  await addTitleSection(doc, state, helpers, content);

  // Skip metadata section - date is now in subtitle

  // Add executive summary
  if (content.executiveSummary) {
    await addExecutiveSummarySection(doc, state, helpers, content.executiveSummary);
  }

  // Add discipline sections
  for (const discipline of content.disciplines) {
    await addDisciplineSection(doc, state, helpers, discipline, figureCounter);
  }

  // Add general site screenshots
  state.yPosition = await addScreenshotsForSection(
    doc, 'General Site', state.yPosition, margin, maxWidth, pageHeight, helpers.checkPageBreak, state.colors, figureCounter
  );

  // Skip footer - using clean universal template

  return doc;
}

/**
 * Create PDF helper functions
 */
function createPDFHelpers(doc, state, margin, maxWidth, pageWidth, pageHeight) {
  return {

    checkPageBreak(requiredSpace = 20) {
      if (state.yPosition + requiredSpace > pageHeight - 40) {
        doc.addPage();
        state.pageNumber++;
        state.yPosition = 25; // Start from top margin
        return true;
      }
      return false;
    },

    addText(text, fontConfig = state.fonts.body, addSpacing = true, color = null, indent = 0) {
      doc.setFontSize(fontConfig.size);
      doc.setFont('helvetica', fontConfig.bold ? 'bold' : 'normal');

      if (color) {
        doc.setTextColor(color);
      } else {
        doc.setTextColor(state.colors.secondary); // Black for body text
      }

      const lines = doc.splitTextToSize(text, maxWidth - indent);
      const lineHeight = fontConfig.size * 0.5; // Tighter line spacing
      const totalHeight = lines.length * lineHeight;

      this.checkPageBreak(totalHeight + (addSpacing ? fontConfig.size * 0.5 : 0));

      lines.forEach(line => {
        doc.text(line, margin + indent, state.yPosition);
        state.yPosition += lineHeight;
      });

      if (addSpacing) {
        state.yPosition += fontConfig.size * 0.3; // Smaller spacing after paragraphs
      }

      doc.setTextColor(state.colors.secondary); // Reset to black
      return state.yPosition;
    },

    addHeading(text, level = 1) {
      const fontConfig = level === 1 ? state.fonts.heading1 :
                        level === 2 ? state.fonts.heading2 : state.fonts.heading3;

      this.checkPageBreak(fontConfig.size * 1.5 + 10);

      state.yPosition += level === 1 ? 4 : 2; // Reduced spacing before all headings

      doc.setFontSize(fontConfig.size);
      doc.setFont('helvetica', 'normal'); // Consistent font, no bold for clean look
      doc.setTextColor(state.colors.primary); // All headings dark blue
      doc.text(text, margin, state.yPosition);
      state.yPosition += fontConfig.size * 0.6; // Smaller spacing after heading text

      state.yPosition += level === 1 ? 6 : 4; // Smaller spacing after headings

      doc.setTextColor(state.colors.secondary); // Reset to black
      return state.yPosition;
    },

    addBulletPoint(text, fontConfig = state.fonts.body, indent = 0) {
      this.addText(ContentFormatters.formatBulletPoint(text), fontConfig, false, null, indent);
      // Add smaller spacing after bullet points
      state.yPosition += fontConfig.size * 0.15; // Half the normal spacing
    },

    addSectionDivider() {
      state.yPosition += 8; // Just add spacing without drawing a line
    }
  };
}

/**
 * Add title section
 */
async function addTitleSection(doc, state, helpers, content) {
  state.yPosition += 10;

  // Main title
  doc.setFontSize(state.fonts.title.size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(state.colors.primary);
  const title = DocumentLabels.title;
  doc.text(title, 25, state.yPosition); // Left-aligned with margin
  state.yPosition += 12;

  // Subtitle (date)
  doc.setFontSize(state.fonts.subtitle.size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(state.colors.secondary);
  const subtitle = content.generatedDate;
  doc.text(subtitle, 25, state.yPosition); // Left-aligned with margin
  state.yPosition += 8; // Reduced spacing after subtitle

  // Reset text color
  doc.setTextColor(state.colors.secondary);

  // Small spacing after title section
  state.yPosition += 6; // Reduced spacing before Report Information
}

/**
 * Add metadata section
 */
async function addMetadataSection(doc, state, helpers, metadata) {
  helpers.addHeading(DocumentLabels.reportInfo);

  helpers.addText(metadata.generatedAt, state.fonts.bodyBold);

  if (metadata.analyst) {
    helpers.addText(`${DocumentLabels.analyst}: ${metadata.analyst}`, state.fonts.bodyBold);
  }

  if (metadata.version) {
    helpers.addText(`${DocumentLabels.version}: ${metadata.version}`, state.fonts.bodyBold);
  }

  helpers.addSectionDivider();
}

/**
 * Add executive summary section
 */
async function addExecutiveSummarySection(doc, state, helpers, summary) {
  // Removed Executive Summary heading - content starts directly with Site Summary

  // Site Summary - only show if value exists and is not empty
  if (summary.siteSummary && summary.siteSummary.trim()) {
    helpers.addHeading(DocumentLabels.siteSummary, 2);
    helpers.addText(summary.siteSummary, state.fonts.body, true, state.colors.secondary);
  }

  // Overall Risk - only show if value exists and is not empty
  if (summary.overallRisk && summary.overallRisk.trim()) {
    // Format the overall risk level and remove redundant "risk"
    const cleanLabel = cleanRiskLabel(summary.overallRisk);
    const formattedRisk = cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);

    // Custom text with mixed formatting
    const requiredSpace = state.fonts.body.size * 2;
    helpers.checkPageBreak(requiredSpace);

    // Bold label part
    doc.setFontSize(state.fonts.bodyBold.size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(state.colors.secondary);
    const labelText = `${DocumentLabels.overallRisk}: `;
    doc.text(labelText, DocumentConfig.layout.pageMargin, state.yPosition);

    // Get width of label to position value text
    const labelWidth = doc.getTextWidth(labelText);

    // Normal text for value
    doc.setFontSize(state.fonts.body.size);
    doc.setFont('helvetica', 'normal');
    doc.text(formattedRisk, DocumentConfig.layout.pageMargin + labelWidth, state.yPosition);

    state.yPosition += state.fonts.body.size * 0.5;
    state.yPosition += state.fonts.body.size * 0.3; // Spacing after paragraph
  }

  // Risk by discipline summary
  if (summary.riskByDiscipline && summary.riskByDiscipline.length > 0) {
    helpers.addHeading(DocumentLabels.riskByDiscipline, 2);

    summary.riskByDiscipline.forEach(discipline => {
      // Convert risk level to sentence case and remove redundant "risk"
      const riskLabel = discipline.riskSummary?.label || 'Not assessed';
      const cleanLabel = riskLabel === 'Not assessed' ? riskLabel : cleanRiskLabel(riskLabel);
      const sentenceCaseRisk = cleanLabel === 'Not assessed' ? cleanLabel :
        cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);
      const riskText = `${discipline.name}: ${sentenceCaseRisk}`;
      helpers.addBulletPoint(riskText, state.fonts.body);
    });

    helpers.addSectionDivider();
  }
}

/**
 * Add discipline section
 */
async function addDisciplineSection(doc, state, helpers, discipline, figureCounter) {
  helpers.addHeading(discipline.name);

  // Risk level without description
  if (discipline.riskSummary) {
    // Reduce spacing before risk level text
    state.yPosition -= 6;
    const riskStyle = getRiskLevelStyle(discipline.riskSummary.label);
    // Convert to proper sentence case and remove redundant "risk"
    const cleanLabel = cleanRiskLabel(riskStyle.label);
    const sentenceCaseRisk = cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);
    let riskText = `Risk level: ${sentenceCaseRisk}`;
    // Remove description - just show risk level
    helpers.addText(riskText, state.fonts.body, true, state.colors.secondary, 0); // Use standard black text
  }

  // Assessment Rules
  helpers.addHeading(DocumentLabels.assessmentRules, 2);

  if (discipline.triggeredRules && discipline.triggeredRules.length > 0) {
    discipline.triggeredRules.forEach((rule, index) => {
      // Rule title with numbering
      helpers.addText(
        ContentFormatters.formatRuleTitle(rule, index),
        state.fonts.bodyBold,
        false,
        state.colors.primary,
        0
      );

      // Combine findings and risk level on one line
      let combinedText = '';
      if (rule.findings) {
        combinedText = rule.findings;
      }
      if (rule.level) {
        const riskStyle = getRiskLevelStyle(rule.level);
        // Convert to proper sentence case and remove redundant "risk"
        const cleanLabel = cleanRiskLabel(riskStyle.label);
        const sentenceCaseRisk = cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);
        if (combinedText) {
          combinedText += `. Risk level: ${sentenceCaseRisk}`;
        } else {
          combinedText = `Risk level: ${sentenceCaseRisk}`;
        }
      }

      if (combinedText) {
        helpers.addText(combinedText, state.fonts.body, true, null, 0);
      }

      // No extra spacing between assessment rules - matches Word formatting
    });
  } else {
    helpers.addText(
      `No ${discipline.name.toLowerCase()} ${DocumentLabels.noRulesTriggered}`,
      state.fonts.body,
      true,
      state.colors.accent,
      0
    );
  }

  // Recommendations
  if (discipline.recommendations.length > 0) {
    helpers.addHeading(ContentFormatters.formatSectionTitle(discipline.name, 'recommendations'), 2);

    discipline.recommendations.forEach(recommendation => {
      if (recommendation.trim()) {
        helpers.addBulletPoint(recommendation, state.fonts.body);
      }
    });
  }

  // Add screenshots for this discipline
  state.yPosition = await addScreenshotsForSection(
    doc, discipline.name, state.yPosition, DocumentConfig.layout.pageMargin,
    doc.internal.pageSize.width - (DocumentConfig.layout.pageMargin * 2),
    doc.internal.pageSize.height, helpers.checkPageBreak, state.colors, figureCounter
  );

  helpers.addSectionDivider();
}

/**
 * Add screenshots to PDF for a specific section (unchanged from original)
 */
async function addScreenshotsForSection(doc, sectionName, currentY, margin, maxWidth, pageHeight, checkPageBreak, colors, figureCounter) {
  const screenshots = getScreenshotsBySection(sectionName);
  let yPosition = currentY;

  if (screenshots.length > 0) {
    if (yPosition + 40 > pageHeight - margin) {
      doc.addPage();
      yPosition = 25; // Use consistent margin
    }

    // Skip images heading - images will appear without title
    doc.setTextColor(colors.secondary);

    // Add each screenshot
    for (const screenshot of screenshots) {
      try {
        if (screenshot.dataUrl) {
          // Add spacing before image (1 normal line break + 1 extra)
          yPosition += (DocumentConfig.fonts.body.size * 0.5) * 2; // 2 line breaks worth of spacing

          // Smaller, more reasonable image size to match Word document
          const imgWidth = Math.min(maxWidth * 0.6, 300); // Smaller than before
          const imgHeight = Math.round(imgWidth * 0.75); // 4:3 aspect ratio like Word
          const captionHeight = 15; // Space for figure caption
          const totalImageSpace = imgHeight + captionHeight + 20;

          if (yPosition + totalImageSpace > pageHeight - margin) {
            doc.addPage();
            yPosition = 25; // Use consistent margin
          }

          try {
            // Add image left-aligned (at margin, not centered)
            doc.addImage(screenshot.dataUrl, 'JPEG', margin, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 5;

            // Add figure number and caption (matching Word format)
            const figureNumber = figureCounter.value++;
            const captionText = screenshot.caption && screenshot.caption.trim()
              ? `Figure ${figureNumber}: ${screenshot.caption}`
              : `Figure ${figureNumber}`;

            doc.setFontSize(DocumentConfig.fonts.caption.size);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(colors.secondary);

            const captionLines = doc.splitTextToSize(captionText, maxWidth);
            captionLines.forEach(line => {
              doc.text(line, margin, yPosition); // Left-aligned caption
              yPosition += 10;
            });

            yPosition += 10; // Space after caption
            console.log(`✅ Added image to PDF for ${sectionName}`);
          } catch (imageError) {
            console.error(`❌ Error processing image for ${sectionName}:`, imageError);
            doc.setFontSize(DocumentConfig.fonts.body.size);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.secondary); // Black for body text
            doc.text(`[Screenshot: ${screenshot.caption || 'Image could not be embedded'}]`, margin, yPosition);
            yPosition += 20;
          }
        }
      } catch (error) {
        console.error(`Error adding screenshot for ${sectionName}:`, error);
        doc.setFontSize(DocumentConfig.fonts.caption.size);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(colors.secondary); // Black for body text
        doc.text(`[Image could not be included: ${screenshot.caption || 'Screenshot'}]`, margin, yPosition);
        yPosition += 20;
      }
    }
  }

  return yPosition;
}