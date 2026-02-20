/**
 * Universal Document Template for TRP Reports
 * This template defines the structure, styling, and content organization
 * that should be consistent across both PDF and Word document exports.
 */

/**
 * Document formatting configuration
 */
export const DocumentConfig = {
  // Typography - Calibri Light Headings throughout
  fonts: {
    family: 'Calibri Light Headings',
    title: { size: 18, bold: false, family: 'Calibri Light Headings' },
    subtitle: { size: 14, bold: false, family: 'Calibri Light Headings' },
    heading1: { size: 14, bold: false, family: 'Calibri Light Headings' },
    heading2: { size: 13, bold: false, family: 'Calibri Light Headings' },
    heading3: { size: 12, bold: false, family: 'Calibri Light Headings' },
    body: { size: 10, bold: false, family: 'Calibri Light Headings' },
    bodyBold: { size: 10, bold: true, family: 'Calibri Light Headings' },
    caption: { size: 9, italic: true, family: 'Calibri Light Headings' },
    small: { size: 9, bold: false, family: 'Calibri Light Headings' },
  },

  // Color scheme - Dark blue headings, black body
  colors: {
    primary: '#1e3a8a',       // Dark blue - headers, titles
    secondary: '#000000',     // Black - body text
    accent: '#059669',        // Green - positive/success
    danger: '#dc2626',        // Red - high risk
    warning: '#d97706',       // Orange - medium risk
    success: '#16a34a',       // Green - low risk
    light: '#f3f4f6',         // Light gray - backgrounds
    neutral: '#6b7280',       // Medium gray - captions
  },

  // Spacing
  spacing: {
    titleSpacing: { before: 0, after: 12 },
    sectionSpacing: { before: 8, after: 6 },
    paragraphSpacing: { before: 0, after: 4 },
    listSpacing: { before: 0, after: 3 },
    imageSpacing: { before: 6, after: 8 },
  },

  // Layout
  layout: {
    pageMargin: 25,
    maxImageWidth: 400,
    maxImageHeight: 300,
    indentLevel1: 15,
    indentLevel2: 25,
    indentLevel3: 35,
  }
};

/**
 * Risk level styling configuration
 */
export const RiskLevelStyles = {
  'SHOWSTOPPER': { color: '#991b1b', label: 'SHOWSTOPPER' },
  'EXTREMELY_HIGH_RISK': { color: '#dc2626', label: 'EXTREMELY HIGH RISK' },
  'EXTREMELY HIGH RISK': { color: '#dc2626', label: 'EXTREMELY HIGH RISK' },
  'HIGH_RISK': { color: '#ea580c', label: 'HIGH RISK' },
  'HIGH RISK': { color: '#ea580c', label: 'HIGH RISK' },
  'MEDIUM_HIGH_RISK': { color: '#d97706', label: 'MEDIUM-HIGH RISK' },
  'MEDIUM HIGH RISK': { color: '#d97706', label: 'MEDIUM-HIGH RISK' },
  'MEDIUM-HIGH RISK': { color: '#d97706', label: 'MEDIUM-HIGH RISK' },
  'MEDIUM_RISK': { color: '#ca8a04', label: 'MEDIUM RISK' },
  'MEDIUM RISK': { color: '#ca8a04', label: 'MEDIUM RISK' },
  'MEDIUM_LOW_RISK': { color: '#65a30d', label: 'MEDIUM-LOW RISK' },
  'MEDIUM LOW RISK': { color: '#65a30d', label: 'MEDIUM-LOW RISK' },
  'MEDIUM-LOW RISK': { color: '#65a30d', label: 'MEDIUM-LOW RISK' },
  'LOW_RISK': { color: '#16a34a', label: 'LOW RISK' },
  'LOW RISK': { color: '#16a34a', label: 'LOW RISK' },
};

/**
 * Document structure template
 * Defines the sections and their order for consistent document generation
 */
export const DocumentStructure = {
  header: {
    title: "Technical Risk Profile",
    subtitle: "Development Risk Assessment Report",
    includeDate: true,
    includePageNumbers: true,
  },

  sections: [
    {
      id: 'metadata',
      title: 'Report Information',
      type: 'metadata',
      required: false,
    },
    {
      id: 'executive_summary',
      title: 'Executive Summary',
      type: 'summary',
      required: true,
      subsections: [
        { id: 'overall_risk', title: 'Overall Risk Assessment' },
        { id: 'risk_by_discipline', title: 'Risk Summary by Discipline' }
      ]
    },
    {
      id: 'disciplines',
      title: 'Detailed Assessment',
      type: 'disciplines',
      required: true,
      subsections: [
        { id: 'risk_level', title: 'Risk Level' },
        { id: 'assessment_rules', title: 'Assessment Rules' },
        { id: 'recommendations', title: 'Recommendations' },
        { id: 'images', title: 'Images' }
      ]
    },
    {
      id: 'appendices',
      title: 'Appendices',
      type: 'appendices',
      required: false,
      subsections: [
        { id: 'general_images', title: 'General Site Images' }
      ]
    }
  ]
};

/**
 * Get formatted risk level information
 * @param {string} riskLevel - Risk level string
 * @returns {Object} Formatted risk level with color and label
 */
export function getRiskLevelStyle(riskLevel) {
  if (!riskLevel) return { color: DocumentConfig.colors.secondary, label: 'Not Assessed' };

  const normalizedLevel = riskLevel.toUpperCase().trim();
  return RiskLevelStyles[normalizedLevel] || {
    color: DocumentConfig.colors.secondary,
    label: riskLevel
  };
}

/**
 * Remove redundant "risk" suffix from risk level labels
 * @param {string} riskLabel - Risk level label
 * @returns {string} Clean risk level without redundant "risk"
 */
export function cleanRiskLabel(riskLabel) {
  if (!riskLabel) return riskLabel;

  // Remove " RISK" suffix (case insensitive)
  return riskLabel.replace(/\s+risk$/i, '');
}

/**
 * Process document content into standardized structure
 * @param {Object} report - Raw report data
 * @returns {Object} Processed document content
 */
export function processDocumentContent(report) {
  const content = {
  generatedDate: null,
    metadata: null,
    executiveSummary: null,
    disciplines: [],
    appendices: null
  };

  // Process metadata - store date for subtitle
  content.generatedDate = formatDocumentDate(report.metadata?.generatedAt);

  // Keep other metadata for potential future use
  if (report.metadata) {
    content.metadata = {
      analyst: report.metadata.analyst,
      version: report.metadata.version,
      siteName: report.metadata.siteName
    };
  }

  // Process executive summary
  if (report.structuredReport?.summary) {
    content.executiveSummary = {
      siteSummary: report.structuredReport.summary.site,
      overallRisk: report.structuredReport.summary.overallRisk,
      riskByDiscipline: report.structuredReport.summary.riskByDiscipline || []
    };
  }

  // Process disciplines
  if (report.structuredReport?.disciplines) {
    content.disciplines = report.structuredReport.disciplines.map(discipline => ({
      name: discipline.name,
      riskSummary: discipline.riskSummary,
      triggeredRules: (discipline.triggeredRules || []).map(rule => ({
        title: rule.rule || rule.title || rule.name,
        findings: rule.findings,
        level: rule.level,
        recommendation: rule.recommendation || '',
        recommendations: rule.recommendations || []
      })),
      recommendations: getRecommendationsForDiscipline(discipline),
      hasScreenshots: true // Will be determined by screenshot service
    }));
  }

  return content;
}

/**
 * Get recommendations for a discipline, handling both editable and default recommendations
 * @param {Object} discipline - The discipline object
 * @returns {string[]} Array of recommendations
 */
export function getRecommendationsForDiscipline(discipline) {
  // Use editable recommendations if available
  if (discipline.recommendations && Array.isArray(discipline.recommendations)) {
    return discipline.recommendations.filter(rec => rec.trim());
  }

  // Fallback to original logic
  const allRecommendations = [];

  if (!discipline?.triggeredRules || discipline.triggeredRules.length === 0) {
    if (discipline?.defaultNoRulesRecommendations && Array.isArray(discipline.defaultNoRulesRecommendations)) {
      allRecommendations.push(...discipline.defaultNoRulesRecommendations);
    }
  } else {
    if (discipline?.defaultTriggeredRecommendations && Array.isArray(discipline.defaultTriggeredRecommendations)) {
      allRecommendations.push(...discipline.defaultTriggeredRecommendations);
    }

    discipline.triggeredRules.forEach(rule => {
      if (rule.recommendation && typeof rule.recommendation === 'string') {
        allRecommendations.push(rule.recommendation);
      }
      if (rule.recommendations && Array.isArray(rule.recommendations)) {
        allRecommendations.push(...rule.recommendations);
      }
    });
  }

  // Deduplicate recommendations
  const uniqueRecommendations = [];
  const seen = new Set();

  allRecommendations.forEach(rec => {
    const normalizedRec = rec.toLowerCase().trim();
    if (!seen.has(normalizedRec)) {
      seen.add(normalizedRec);
      uniqueRecommendations.push(rec);
    }
  });

  return uniqueRecommendations;
}

/**
 * Format date for display in documents
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date like "25th December 2025"
 */
export function formatDocumentDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();

  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();

  // Add ordinal suffix to day
  const getOrdinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${getOrdinalSuffix(day)} ${month} ${year}`;
}

/**
 * Generate filename for document export
 * @param {string} siteName - Site name
 * @param {string} extension - File extension (pdf, docx)
 * @returns {string} Generated filename
 */
export function generateFilename(siteName = 'TRP_Report', extension = 'pdf') {
  const date = new Date().toISOString().split('T')[0];
  const safeSiteName = siteName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeSiteName}_TRP_Report_${date}.${extension}`;
}

/**
 * Standard text content and labels
 */
export const DocumentLabels = {
  title: "High-Level Planning View",
  subtitle: "", // Will be replaced with date
  reportInfo: "Report Information",
  executiveSummary: "Executive Summary",
  siteSummary: "Site Summary",
  overallRisk: "Overall Risk Assessment",
  riskByDiscipline: "Risk Summary by Discipline",
  assessmentRules: "Assessment Rules Triggered",
  recommendations: "Recommendations",
  riskLevel: "Risk Level",
  images: "Images",
  generated: "",
  analyst: "Analyst",
  version: "Version",
  noRulesTriggered: "risk rules were triggered. Standard development considerations apply.",
  figure: "Figure"
};

/**
 * Content formatting helpers
 */
export const ContentFormatters = {
  /**
   * Format risk level text with proper spacing and capitalization
   */
  formatRiskLevel: (level) => {
    if (!level) return 'Not Assessed';
    return level.replace(/_/g, ' ').toUpperCase();
  },

  /**
   * Format rule title without numbering
   */
  formatRuleTitle: (rule, index) => {
    return `- ${rule.title || rule.rule || rule.name}`;
  },

  /**
   * Format bullet point text
   */
  formatBulletPoint: (text) => {
    return `- ${text}`;
  },

  /**
   * Format image caption
   */
  formatImageCaption: (caption) => {
    return caption ? `${DocumentLabels.figure}: ${caption}` : '';
  },

  /**
   * Format section title with discipline name
   */
  formatSectionTitle: (disciplineName, sectionType) => {
    switch (sectionType) {
      case 'recommendations':
        return `${disciplineName} ${DocumentLabels.recommendations}`;
      case 'images':
        return `${disciplineName} ${DocumentLabels.images}`;
      default:
        return sectionType;
    }
  }
};

export default {
  DocumentConfig,
  RiskLevelStyles,
  DocumentStructure,
  DocumentLabels,
  ContentFormatters,
  getRiskLevelStyle,
  cleanRiskLabel,
  processDocumentContent,
  getRecommendationsForDiscipline,
  generateFilename,
  formatDocumentDate
};