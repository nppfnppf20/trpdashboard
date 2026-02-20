import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import fileSaver from 'file-saver';
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

const { saveAs } = fileSaver;

/**
 * Generate and download a Word document from TRP report data
 * @param {any} editableReport - The editable TRP report data
 * @param {string} siteName - Name of the site for the filename
 */
export async function generateWordReport(editableReport, siteName = 'TRP_Report') {
  try {
    const doc = await createWordDocument(editableReport);
    const blob = await Packer.toBlob(doc);
    const filename = generateFilename(siteName, 'docx');

    saveAs(blob, filename);
    console.log('✅ Word document generated successfully:', filename);
  } catch (error) {
    console.error('❌ Error generating Word document:', error);
    throw error;
  }
}

/**
 * Create a Word document from TRP report data using the universal template
 * @param {any} report - The TRP report data
 * @returns {Document} Word document
 */
async function createWordDocument(report) {
  const children = [];

  // Process content using universal template
  const content = processDocumentContent(report);

  // Initialize figure counter for the document (use object for pass-by-reference)
  const figureCounter = { value: 1 };

  // Document helpers
  const helpers = createWordHelpers();

  // Title Section
  children.push(...addTitleSection(content));

  // Skip metadata section - date is now in subtitle

  // Executive Summary
  if (content.executiveSummary) {
    children.push(...addExecutiveSummarySection(content.executiveSummary, helpers));
  }

  // Discipline Sections
  for (const discipline of content.disciplines) {
    const disciplineParagraphs = await addDisciplineSection(discipline, helpers, figureCounter);
    children.push(...disciplineParagraphs);
  }

  // General Site Screenshots
  const generalScreenshots = await addScreenshotsForSection('General Site', figureCounter);
  if (generalScreenshots.length > 0) {
    children.push(...generalScreenshots);
  }

  return new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });
}

/**
 * Create Word helper functions
 */
function createWordHelpers() {
  return {
    createHeading(text, level = 1) {
      const headingLevel = level === 1 ? HeadingLevel.HEADING_1 :
                          level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      const fontSize = level === 1 ? DocumentConfig.fonts.heading1.size * 2 :
                      level === 2 ? DocumentConfig.fonts.heading2.size * 2 :
                      DocumentConfig.fonts.heading3.size * 2;

      return new Paragraph({
        children: [
          new TextRun({
            text: text,
            bold: false, // Calibri Light - no bold
            size: fontSize,
            color: DocumentConfig.colors.primary.replace('#', ''), // All headings dark blue
            font: DocumentConfig.fonts.family,
          }),
        ],
        heading: headingLevel,
        spacing: { before: level === 1 ? 200 : 100, after: 200 }, // Reduced spacing before all headings
      });
    },

    createText(text, options = {}) {
      const defaultOptions = {
        size: DocumentConfig.fonts.body.size * 2, // Word uses half-points
        bold: false,
        italic: false,
        color: null,
        spacing: { after: 100 }
      };

      const mergedOptions = { ...defaultOptions, ...options };

      const textRunOptions = {
        text: text,
        size: mergedOptions.size,
        bold: mergedOptions.bold,
        italics: mergedOptions.italic,
        font: DocumentConfig.fonts.family,
      };

      if (mergedOptions.color) {
        textRunOptions.color = mergedOptions.color.replace('#', '');
      }

      return new Paragraph({
        children: [new TextRun(textRunOptions)],
        spacing: mergedOptions.spacing,
      });
    },

    createBulletPoint(text, options = {}) {
      const defaultOptions = {
        size: DocumentConfig.fonts.body.size * 2,
        spacing: { after: 50 } // Reduced spacing after bullet points
      };

      const mergedOptions = { ...defaultOptions, ...options };

      return new Paragraph({
        children: [
          new TextRun({
            text: ContentFormatters.formatBulletPoint(text),
            size: mergedOptions.size,
            font: DocumentConfig.fonts.family,
          }),
        ],
        spacing: mergedOptions.spacing,
      });
    },

    createFieldPair(label, value, options = {}) {
      const defaultOptions = {
        spacing: { after: 100 }
      };

      const mergedOptions = { ...defaultOptions, ...options };

      return new Paragraph({
        children: [
          new TextRun({
            text: `${label}: `,
            bold: true,
            size: DocumentConfig.fonts.bodyBold.size * 2,
            font: DocumentConfig.fonts.family,
          }),
          new TextRun({
            text: value,
            size: DocumentConfig.fonts.body.size * 2,
            font: DocumentConfig.fonts.family,
          }),
        ],
        spacing: mergedOptions.spacing,
      });
    },

    createSectionDivider() {
      return new Paragraph({
        text: "",
        spacing: { after: 400 },
      });
    }
  };
}

/**
 * Add title section
 */
function addTitleSection(content) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: DocumentLabels.title,
          bold: false, // Calibri Light Headings
          size: DocumentConfig.fonts.title.size * 2,
          color: DocumentConfig.colors.primary.replace('#', ''),
          font: DocumentConfig.fonts.family,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: content.generatedDate,
          size: DocumentConfig.fonts.subtitle.size * 2,
          color: DocumentConfig.colors.secondary.replace('#', ''),
          font: DocumentConfig.fonts.family,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 400 },
    })
  ];
}

/**
 * Add metadata section
 */
function addMetadataSection(metadata, helpers) {
  const paragraphs = [
    helpers.createHeading(DocumentLabels.reportInfo),
    helpers.createText(metadata.generatedAt, { bold: true })
  ];

  if (metadata.analyst) {
    paragraphs.push(helpers.createFieldPair(DocumentLabels.analyst, metadata.analyst));
  }

  if (metadata.version) {
    paragraphs.push(helpers.createFieldPair(DocumentLabels.version, metadata.version));
  }

  paragraphs.push(helpers.createSectionDivider());

  return paragraphs;
}

/**
 * Add executive summary section
 */
function addExecutiveSummarySection(summary, helpers) {
  const paragraphs = [
    // Removed Executive Summary heading - content starts directly with Site Summary
  ];

  // Site Summary - only show if value exists and is not empty
  if (summary.siteSummary && summary.siteSummary.trim()) {
    paragraphs.push(helpers.createHeading(DocumentLabels.siteSummary, 2));
    paragraphs.push(helpers.createText(summary.siteSummary));
  }

  // Overall Risk
  if (summary.overallRisk) {
    paragraphs.push(
      helpers.createFieldPair(
        DocumentLabels.overallRisk,
        summary.overallRisk,
        {
          color: DocumentConfig.colors.danger,
          spacing: { after: 200 }
        }
      )
    );
  }

  // Risk by discipline summary
  if (summary.riskByDiscipline && summary.riskByDiscipline.length > 0) {
    paragraphs.push(helpers.createHeading(DocumentLabels.riskByDiscipline, 2));

    summary.riskByDiscipline.forEach(discipline => {
      // Convert risk level to sentence case and remove redundant "risk"
      const riskLabel = discipline.riskSummary?.label || 'Not assessed';
      const cleanLabel = riskLabel === 'Not assessed' ? riskLabel : cleanRiskLabel(riskLabel);
      const sentenceCaseRisk = cleanLabel === 'Not assessed' ? cleanLabel :
        cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: discipline.name + ': ',
              bold: true,
              size: DocumentConfig.fonts.body.size * 2,
              font: DocumentConfig.fonts.family,
            }),
            new TextRun({
              text: sentenceCaseRisk,
              size: DocumentConfig.fonts.body.size * 2,
              font: DocumentConfig.fonts.family,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    });

    paragraphs.push(helpers.createSectionDivider());
  }

  return paragraphs;
}

/**
 * Add discipline section
 */
async function addDisciplineSection(discipline, helpers, figureCounter) {
  const paragraphs = [
    helpers.createHeading(discipline.name)
  ];

  // Risk level without description
  if (discipline.riskSummary) {
    const riskStyle = getRiskLevelStyle(discipline.riskSummary.label);
    // Convert to proper sentence case and remove redundant "risk"
    const cleanLabel = cleanRiskLabel(riskStyle.label);
    const sentenceCaseRisk = cleanLabel.toLowerCase().charAt(0).toUpperCase() + cleanLabel.toLowerCase().slice(1);
    let riskText = `Risk level: ${sentenceCaseRisk}`;
    // Remove description - just show risk level

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: riskText,
            size: DocumentConfig.fonts.body.size * 2,
            color: DocumentConfig.colors.secondary.replace('#', ''), // Use standard black text
            font: DocumentConfig.fonts.family,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // Assessment Rules
  paragraphs.push(helpers.createHeading(DocumentLabels.assessmentRules, 2));

  if (discipline.triggeredRules && discipline.triggeredRules.length > 0) {
    discipline.triggeredRules.forEach((rule, index) => {
      // Rule title with numbering
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: ContentFormatters.formatRuleTitle(rule, index),
              bold: true,
              size: DocumentConfig.fonts.bodyBold.size * 2,
              color: DocumentConfig.colors.primary.replace('#', ''), // Blue for headings
              font: DocumentConfig.fonts.family,
            }),
          ],
          spacing: { before: 0, after: 50 }, // No spacing before rule title
        })
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
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: combinedText,
                size: DocumentConfig.fonts.body.size * 2,
                font: DocumentConfig.fonts.family,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Removed empty paragraph - no extra spacing between assessment rules
    });
  } else {
    paragraphs.push(
      helpers.createText(
        `No ${discipline.name.toLowerCase()} ${DocumentLabels.noRulesTriggered}`,
        {
          italic: true,
          color: DocumentConfig.colors.accent,
          spacing: { after: 200 }
        }
      )
    );
  }

  // Recommendations
  if (discipline.recommendations.length > 0) {
    // Add line break before recommendations section
    paragraphs.push(new Paragraph({ text: "", spacing: { after: 100 } }));
    paragraphs.push(helpers.createHeading(ContentFormatters.formatSectionTitle(discipline.name, 'recommendations'), 2));

    discipline.recommendations.forEach(recommendation => {
      if (recommendation.trim()) {
        paragraphs.push(helpers.createBulletPoint(recommendation));
      }
    });
  }

  // Add screenshots for this discipline
  const screenshotParagraphs = await addScreenshotsForSection(discipline.name, figureCounter);
  paragraphs.push(...screenshotParagraphs);

  paragraphs.push(helpers.createSectionDivider());

  return paragraphs;
}

/**
 * Convert base64 image to buffer for Word document
 */
function base64ToBuffer(base64Data) {
  try {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    // Validate base64 string
    if (!base64 || base64.length === 0) {
      throw new Error('Empty base64 data');
    }

    // Convert base64 to binary string
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  } catch (error) {
    console.error('Error converting base64 to buffer:', error);
    throw error;
  }
}

/**
 * Add screenshots to document for a specific section
 */
async function addScreenshotsForSection(sectionName, figureCounter) {
  let screenshots = getScreenshotsBySection(sectionName);
  const imageParagraphs = [];

  // Use document-level figure counter

  if (screenshots.length > 0) {
    // Skip screenshots heading - images will appear without title

    // Add each screenshot
    for (const screenshot of screenshots) {
      try {
        if (screenshot.dataUrl) {
          try {
            const imageBuffer = base64ToBuffer(screenshot.dataUrl);

            // Add spacing before image
            imageParagraphs.push(
              new Paragraph({
                children: [],
                spacing: { after: 200 }
              })
            );

            // Add image with reasonable dimensions that maintain better proportions
            imageParagraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: DocumentConfig.layout.maxImageWidth,
                      height: Math.round(DocumentConfig.layout.maxImageWidth * 0.75), // 4:3 aspect ratio
                    },
                    type: 'jpg', // Specify image type explicitly
                  }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 50 },
              })
            );
            console.log(`✅ Added image to Word doc for ${sectionName}`);
          } catch (imageError) {
            console.error(`❌ Error processing image for ${sectionName}:`, imageError);
            // Fallback to placeholder
            imageParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Screenshot: ${screenshot.caption || 'Image could not be embedded'}]`,
                    bold: true,
                    color: DocumentConfig.colors.primary.replace('#', ''),
                    size: DocumentConfig.fonts.body.size * 2,
                    font: DocumentConfig.fonts.family,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              })
            );
          }

          // Add figure number and caption
          const figureNumber = figureCounter.value++;
          const captionText = screenshot.caption && screenshot.caption.trim()
            ? `Figure ${figureNumber}: ${screenshot.caption}`
            : `Figure ${figureNumber}`;

          imageParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: captionText,
                  italics: true,
                  size: DocumentConfig.fonts.caption.size * 2,
                  color: DocumentConfig.colors.secondary.replace('#', ''),
                  font: DocumentConfig.fonts.family,
                }),
              ],
              alignment: AlignmentType.LEFT,
              spacing: { after: 200 },
            })
          );
        }
      } catch (error) {
        console.error(`Error adding screenshot for ${sectionName}:`, error);
        // Add error note instead of failing completely
        imageParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[Image could not be included: ${screenshot.caption || 'Screenshot'}]`,
                italics: true,
                color: DocumentConfig.colors.secondary.replace('#', ''), // Black for body text
                size: DocumentConfig.fonts.caption.size * 2,
                font: DocumentConfig.fonts.family,
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    }
  }

  return imageParagraphs;
}