import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import fileSaver from 'file-saver';

const { saveAs } = fileSaver;

/**
 * Export HLPV findings to Word format with TRP formatting
 * @param {Object} reportData - The structured report data
 * @param {string} projectName - Optional project name
 */
export async function exportHLPVFindingsToWord(reportData, projectName = 'Site') {
  try {
    const doc = createWordDocumentFromReport(reportData, projectName);
    const blob = await Packer.toBlob(doc);
    
    // Generate filename
    const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${safeName}_Planning_Constraints_${timestamp}.docx`;

    saveAs(blob, filename);
    console.log('✅ Word document exported successfully:', filename);
  } catch (error) {
    console.error('❌ Error exporting to Word:', error);
    throw error;
  }
}

/**
 * Create Word document from HLPV report data using TRP formatting
 * @param {Object} reportData - The structured report data
 * @param {string} projectName - Project name
 * @returns {Document} Word document
 */
function createWordDocumentFromReport(reportData, projectName) {
  const children = [];
  const structuredReport = reportData?.structuredReport;
  const disciplines = structuredReport?.disciplines || [];

  // Title (H1 - 24pt Calibri Light Dark Blue)
  children.push(
    new Paragraph({
      text: 'High-Level Planning View',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 400 },
      style: 'Heading1'
    })
  );

  // Subtitle (H4 - 16pt Light Dark Blue)
  children.push(
    new Paragraph({
      text: `Site: ${projectName}`,
      heading: HeadingLevel.HEADING_4,
      spacing: { after: 200 }
    })
  );

  children.push(
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      spacing: { after: 400 }
    })
  );

  // ====== SUMMARY SECTION ======
  children.push(
    new Paragraph({
      text: 'Summary',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
      pageBreakBefore: false
    })
  );

  // Summary placeholder only (no summary content)
  children.push(
    new Paragraph({
      text: '[Insert summary of findings and overall risk level]',
      spacing: { after: 400 }
    })
  );

  // ====== DISCIPLINE SECTIONS ======
  disciplines.forEach((discipline, index) => {
    // Discipline heading (H2) - use spacing before for separation
    children.push(
      new Paragraph({
        text: discipline.name,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: index === 0 ? 400 : 200, after: 200 }
      })
    );

    // Overall Risk - just the risk level in bold, normal body font
    const riskLabel = discipline.riskSummary?.label || 'Unknown';
    const sentenceCaseRisk = riskLabel.charAt(0).toUpperCase() + riskLabel.slice(1).toLowerCase();
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: sentenceCaseRisk, bold: true })
        ],
        spacing: { after: 200 }
      })
    );

    // Frontend-only disciplines (Flood, Aviation, Highways) — text goes under Recommendations only
    if (discipline.findingsParagraphs) {
      children.push(
        new Paragraph({
          text: `${discipline.name} Recommendations`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 200 }
        })
      );

      if (discipline.findingsParagraphs.length > 0) {
        discipline.findingsParagraphs.forEach(paragraph => {
          children.push(
            new Paragraph({
              text: paragraph,
              spacing: { after: 150 }
            })
          );
        });

        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 }
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: 'No specific recommendations for this discipline.',
            spacing: { after: 400 }
          })
        );
      }
    } else {
      // Backend-driven disciplines — Triggered Rules + Recommendations sections
      if (discipline.triggeredRules && discipline.triggeredRules.length > 0) {
        children.push(
          new Paragraph({
            text: `${discipline.name} Assessment Rules Triggered`,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 200 }
          })
        );

        // Group rules if not Agricultural Land
        if (discipline.name === 'Agricultural Land') {
          discipline.triggeredRules.forEach(rule => {
            addRuleToDocument(children, rule);
          });
        } else {
          const groupedRules = groupRulesByType(discipline.triggeredRules);
          Object.entries(groupedRules).forEach(([baseType, rules]) => {
            const groupedRule = createGroupedRuleDisplay(baseType, rules);
            addGroupedRuleToDocument(children, groupedRule);
          });
        }
      } else {
        children.push(
          new Paragraph({
            text: `${discipline.name} Assessment Rules`,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 200 }
          })
        );

        children.push(
          new Paragraph({
            text: `No ${discipline.name.toLowerCase()} risk rules were triggered. Standard development considerations apply.`,
            spacing: { after: 400 }
          })
        );
      }

      // Recommendations
      children.push(
        new Paragraph({
          text: `${discipline.name} Recommendations`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 200 }
        })
      );

      const recommendations = getAggregatedRecommendations(discipline);
      if (recommendations && recommendations.length > 0) {
        recommendations.forEach(rec => {
          children.push(
            new Paragraph({
              text: rec,
              spacing: { after: 100 }
            })
          );
        });

        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 }
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: 'No specific recommendations for this discipline.',
            spacing: { after: 400 }
          })
        );
      }
    }
  });

  // Create document with TRP styling
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch = 1440 twips
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      children: children
    }],
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 48, // 24pt (size is in half-points)
            bold: false, // Changed to light weight
            color: '1F4E78', // Dark Blue
            font: 'Calibri Light'
          },
          paragraph: {
            spacing: {
              before: 480,
              after: 240
            }
          }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 32, // 16pt
            bold: false,
            color: '1F4E78', // Dark Blue
            font: 'Calibri Light'
          },
          paragraph: {
            spacing: {
              before: 400,
              after: 200
            }
          }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 26, // 13pt
            bold: false,
            color: '1F4E78', // Dark Blue
            font: 'Calibri Light'
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120
            }
          }
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 32, // 16pt
            bold: false,
            color: '1F4E78', // Dark Blue
            font: 'Calibri Light'
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 120
            }
          }
        }
      ],
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt (22 half-points)
            color: '000000'
          },
          paragraph: {
            spacing: {
              line: 240, // 1.0 line height (240 = single spacing)
              after: 120
            }
          }
        }
      }
    }
  });
}

/**
 * Add a single rule to the document
 */
function addRuleToDocument(children, rule) {
  // Rule title (bold)
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: rule.rule, bold: true })
      ],
      spacing: { before: 200, after: 50 }
    })
  );

  // Findings (no header, just the findings text)
  children.push(
    new Paragraph({
      text: formatFindings(rule.findings),
      spacing: { after: 100 }
    })
  );
}

/**
 * Add a grouped rule to the document
 */
function addGroupedRuleToDocument(children, groupedRule) {
  // Rule title (bold)
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: groupedRule.title, bold: true })
      ],
      spacing: { before: 200, after: 50 }
    })
  );

  // Split findings by newline and add each as a separate line (no "Findings:" header)
  const findingsLines = groupedRule.findings.split('\n');
  findingsLines.forEach((line, lineIndex) => {
    if (line.trim()) {
      children.push(
        new Paragraph({
          text: formatFindings(line),
          spacing: { after: lineIndex === findingsLines.length - 1 ? 100 : 50 }
        })
      );
    }
  });
}

// Helper functions from ReportGenerator

// Risk hierarchy for comparing rule severity (higher index = higher risk)
const RISK_HIERARCHY = ['low_risk', 'medium_low_risk', 'medium_risk', 'medium_high_risk', 'high_risk', 'extremely_high_risk', 'showstopper'];

/**
 * Extract base designation type from rule ID
 * e.g., 'ancient_woodland_on_site' -> 'ancient_woodland'
 *       'sssi_within_500m' -> 'sssi'
 */
function getDesignationType(ruleId) {
  if (!ruleId) return 'unknown';
  return ruleId
    .replace(/_on_site$/, '')
    .replace(/_within_\d+m$/, '')
    .replace(/_within_\d+km$/, '')
    .replace(/_between_\d+_\d+km$/, '');
}

function getAggregatedRecommendations(discipline) {
  const designationRecommendations = [];
  const disciplineRecommendations = [];

  if (!discipline?.triggeredRules || discipline.triggeredRules.length === 0) {
    if (discipline?.disciplineRecommendation) {
      disciplineRecommendations.push(discipline.disciplineRecommendation);
    } else if (discipline?.defaultNoRulesRecommendations && Array.isArray(discipline.defaultNoRulesRecommendations)) {
      disciplineRecommendations.push(...discipline.defaultNoRulesRecommendations);
    }
  } else {
    // Group rules by designation type and keep only highest-risk recommendation per type
    const rulesByDesignation = {};

    discipline.triggeredRules.forEach((rule) => {
      const designationType = getDesignationType(rule.id);
      const riskIndex = RISK_HIERARCHY.indexOf(rule.level);

      // Only keep this rule's recommendation if it's higher risk than any existing one for this designation
      if (!rulesByDesignation[designationType] || riskIndex > rulesByDesignation[designationType].riskIndex) {
        rulesByDesignation[designationType] = { rule, riskIndex };
      }
    });

    // Collect recommendations from highest-risk rule per designation type
    Object.values(rulesByDesignation).forEach(({ rule }) => {
      if (rule.recommendation && typeof rule.recommendation === 'string') {
        designationRecommendations.push(rule.recommendation);
      } else if (rule.recommendations && Array.isArray(rule.recommendations)) {
        designationRecommendations.push(...rule.recommendations);
      }
    });

    if (discipline?.disciplineRecommendation) {
      disciplineRecommendations.push(discipline.disciplineRecommendation);
    } else if (discipline?.defaultTriggeredRecommendations && Array.isArray(discipline.defaultTriggeredRecommendations)) {
      disciplineRecommendations.push(...discipline.defaultTriggeredRecommendations);
    }
  }

  const allRecommendations = [...designationRecommendations, ...disciplineRecommendations];
  const uniqueRecommendations = [];

  allRecommendations.forEach(rec => {
    if (!rec) return;

    const normalizedRec = rec.toLowerCase().trim();
    const isAlreadyCovered = uniqueRecommendations.some(existing => {
      const normalizedExisting = existing.toLowerCase().trim();
      return normalizedExisting === normalizedRec ||
             normalizedExisting.includes(normalizedRec) ||
             normalizedRec.includes(normalizedExisting);
    });

    if (!isAlreadyCovered) {
      uniqueRecommendations.push(rec);
    } else {
      const existingIndex = uniqueRecommendations.findIndex(existing => {
        const normalizedExisting = existing.toLowerCase().trim();
        return normalizedRec.includes(normalizedExisting) && normalizedRec !== normalizedExisting;
      });

      if (existingIndex !== -1) {
        uniqueRecommendations[existingIndex] = rec;
      }
    }
  });

  return uniqueRecommendations;
}

function groupRulesByType(rules) {
  const groups = {};
  
  rules.forEach((rule) => {
    let baseType = rule.rule
      .replace(/ On-Site$/, '')
      .replace(/ Within \d+m$/, '')
      .replace(/ Within \d+km$/, '')
      .replace(/ Within \d+-\d+km$/, '')
      .replace(/ \(.*\)$/, '');
    
    if (!groups[baseType]) {
      groups[baseType] = [];
    }
    groups[baseType].push(rule);
  });
  
  return groups;
}

function createGroupedRuleDisplay(baseType, rules) {
  const riskOrder = { 'showstopper': 7, 'extremely_high_risk': 6, 'high_risk': 5, 'medium_high_risk': 4, 'medium_risk': 3, 'medium_low_risk': 2, 'low_risk': 1 };
  const sortedRules = rules.sort((a, b) => (riskOrder[b.level] || 0) - (riskOrder[a.level] || 0));

  const findings = sortedRules.map((rule) => {
    const riskLabel = formatRiskLevelForFindings(rule.level);
    let simplifiedFindings = rule.findings;

    const withinMatch = rule.findings.match(/(\d+).*?within (\d+)([km]+)/i);
    if (withinMatch) {
      simplifiedFindings = `${withinMatch[1]} within ${withinMatch[2]}${withinMatch[3]} - ${riskLabel}`;
    } else if (rule.rule.includes('On-Site') || rule.findings.toLowerCase().includes('on site')) {
      const onSiteMatch = rule.findings.match(/(\d+)/);
      if (onSiteMatch) {
        simplifiedFindings = `${onSiteMatch[1]} on-site - ${riskLabel}`;
      }
    } else if (rule.findings.includes('between')) {
      const betweenMatch = rule.findings.match(/(\d+).*?between (\d+-\d+)([km]+)/i);
      if (betweenMatch) {
        simplifiedFindings = `${betweenMatch[1]} between ${betweenMatch[2]}${betweenMatch[3]} - ${riskLabel}`;
      }
    }

    return simplifiedFindings;
  }).join('\n');

  return {
    title: baseType,
    findings: findings,
    highestRisk: sortedRules[0].level
  };
}

function formatRiskLevel(riskLevel) {
  if (!riskLevel) return 'UNKNOWN';

  let formatted = riskLevel;
  formatted = formatted.replace('medium_high', 'medium-high');
  formatted = formatted.replace('medium_low', 'medium-low');
  formatted = formatted.replace(/_/g, ' ');

  return formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatRiskLevelForFindings(riskLevel) {
  if (!riskLevel) return 'unknown';

  let formatted = riskLevel;
  formatted = formatted.replace('medium_high', 'medium-high');
  formatted = formatted.replace('medium_low', 'medium-low');
  formatted = formatted.replace(/_/g, ' ');

  return formatted
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(' ');
}

function formatFindings(findings) {
  if (!findings) return findings;

  const distancePattern = /(\d+)m\s+([NSEW])\s*\([^)]+\)/g;
  return findings.replace(distancePattern, (match, meters, direction) => {
    const km = (parseInt(meters) / 1000).toFixed(1);
    return `${km}km ${direction}`;
  });
}

export default {
  exportHLPVFindingsToWord
};
