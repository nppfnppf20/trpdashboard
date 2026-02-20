// Main report aggregator: combines heritage and landscape reports
// This is the primary entry point for all report generation

import { buildHeritageReport } from './heritage/heritageReportGenerator.js';
import { buildLandscapeReport } from './landscape/landscapeReportGenerator.js';
import { buildEcologyReport } from './ecology/ecologyReportGenerator.js';
import { buildAgLandReport } from './agland/agLandReportGenerator.js';

/**
 * Build renewables-specific report from backend analysis data
 * @param {any} renewablesData - Backend renewables analysis results
 */
function buildRenewablesReport(renewablesData) {
  const rules = renewablesData?.rules || [];
  const overallRisk = renewablesData?.overallRisk || null;
  const renewablesArray = renewablesData?.renewables || [];

  // Build designation summary for renewables
  const designationSummary = [];
  if (renewablesArray.length > 0) {
    const onSite = renewablesArray.filter(/** @param {any} r */ r => r.on_site).length;
    const nearby = renewablesArray.filter(/** @param {any} r */ r => !r.on_site).length;

    const summaryItems = [
      `${renewablesArray.length} renewable energy development${renewablesArray.length === 1 ? '' : 's'} identified`,
      onSite > 0 ? `${onSite} on-site` : null,
      nearby > 0 ? `${nearby} nearby` : null
    ].filter(/** @param {any} item */ item => Boolean(item));

    designationSummary.push(...summaryItems);
  }

  return {
    riskAssessment: {
      overallRisk,
      riskSummary: `${rules.length} renewable energy rule${rules.length === 1 ? '' : 's'} triggered`,
      triggeredRules: rules
    },
    designationSummary,
    metadata: renewablesData?.metadata || {}
  };
}

/**
 * Build trees-specific report from backend analysis data
 * @param {any} treesData - Backend trees analysis results
 */
function buildTreesReport(treesData) {
  const rules = treesData?.rules || [];
  const overallRisk = treesData?.overallRisk || null;
  const ancientWoodland = treesData?.ancient_woodland || [];

  // Server already provides human-readable rule content
  const triggeredRules = rules.map((/** @type {any} */ r) => ({
    rule: r.rule,
    level: r.level,
    findings: r.findings,
    recommendation: r.recommendation || null,
    recommendations: r.recommendations || []
  }));

  // Build designation summary for trees
  const designationSummary = [];
  if (ancientWoodland.length > 0) {
    const onSite = ancientWoodland.filter(/** @param {any} aw */ aw => aw.on_site).length;
    const nearby = ancientWoodland.filter(/** @param {any} aw */ aw => !aw.on_site).length;

    const summaryItems = [
      `${ancientWoodland.length} Ancient Woodland area${ancientWoodland.length === 1 ? '' : 's'} identified`,
      onSite > 0 ? `${onSite} on-site` : null,
      nearby > 0 ? `${nearby} nearby` : null
    ].filter(/** @param {any} item */ item => Boolean(item));

    designationSummary.push(...summaryItems);
  } else {
    designationSummary.push('No Ancient Woodland identified within 500m');
  }

  return {
    riskAssessment: {
      overallRisk,
      riskSummary: `${rules.length} trees rule${rules.length === 1 ? '' : 's'} triggered`,
      triggeredRules
    },
    designationSummary,
    lists: {
      ancientWoodland: {
        detailed: ancientWoodland,
        within500mCount: ancientWoodland.filter(/** @param {any} aw */ aw => !aw.on_site && aw.within_500m).length
      }
    },
    metadata: treesData?.metadata || {}
  };
}



/**
 * Resolve a risk summary object from either numeric or string overallRisk
 * @param {number | string} overallRisk
 */
export function resolveRiskSummary(overallRisk) {
  const stringMap = {
    showstopper: { label: 'SHOWSTOPPER', description: 'Development likely not viable without major redesign', color: '#dc2626', bgColor: '#fef2f2' },
    extremely_high_risk: { label: 'EXTREMELY HIGH RISK', description: 'Major constraints, extensive specialist input required', color: '#b91c1c', bgColor: '#fee2e2' },
    high_risk: { label: 'HIGH RISK', description: 'Significant constraints, specialist assessment required', color: '#ea580c', bgColor: '#fff7ed' },
    medium_risk: { label: 'MEDIUM RISK', description: 'Notable constraints, proportionate assessment required', color: '#f59e0b', bgColor: '#fff7ed' },
    medium_high_risk: { label: 'MEDIUM-HIGH RISK', description: 'Moderate constraints, careful design required', color: '#d97706', bgColor: '#fffbeb' },
    medium_low_risk: { label: 'MEDIUM-LOW RISK', description: 'Minor constraints, basic mitigation measures', color: '#10b981', bgColor: '#ecfdf5' },
    low_risk: { label: 'LOW RISK', description: 'Minimal constraints, standard mitigation measures', color: '#059669', bgColor: '#ecfdf5' }
  };
  
  if (typeof overallRisk === 'string') {
    return stringMap[/** @type {keyof typeof stringMap} */ (overallRisk)] || stringMap.low_risk;
  }
  
  // For numeric values, fall back to low risk
  return stringMap.low_risk;
}

/**
 * Determine overall risk across multiple domains
 * @param {...(string|number|null)} risks - Risk levels from each domain
 */
function determineOverallRisk(...risks) {
  // Risk hierarchy (highest to lowest)
  const riskHierarchy = [
    'showstopper',
    'extremely_high_risk',
    'high_risk',
    'medium_high_risk',
    'medium_risk',
    'medium_low_risk',
    'low_risk'
  ];

  const validRisks = risks.filter(Boolean);
  if (validRisks.length === 0) return 'low_risk';

  // Return the highest risk level found
  for (const riskLevel of riskHierarchy) {
    if (validRisks.includes(riskLevel)) return riskLevel;
  }

  return 'low_risk';
}

/**
 * Build combined heritage, landscape, renewables, ecology, agricultural land, and trees report
 * @param {any} heritageData - Backend heritage analysis results
 * @param {any} landscapeData - Backend landscape analysis results
 * @param {any} renewablesData - Backend renewables analysis results
 * @param {any} ecologyData - Backend ecology analysis results
 * @param {any} agLandData - Backend agricultural land analysis results
 * @param {any} treesData - Backend trees analysis results
 */
export function buildCombinedReport(heritageData, landscapeData, renewablesData, ecologyData, agLandData, treesData) {
  // Drinking water rules come separately from the backend (not mixed into ecology rules)
  const drinkingWaterRules = ecologyData?.drinkingWaterRules || [];

  // Compute "Other" (drinking water) risk
  const drinkingWaterOverallRisk = drinkingWaterRules.length > 0 ? drinkingWaterRules[0].level : null;

  const heritageReport = heritageData ? buildHeritageReport(heritageData) : null;
  const landscapeReport = landscapeData ? buildLandscapeReport(landscapeData) : null;
  const renewablesReport = renewablesData ? buildRenewablesReport(renewablesData) : null;
  const ecologyReport = ecologyData ? buildEcologyReport(ecologyData) : null;
  const agLandReport = agLandData ? buildAgLandReport(agLandData) : null;
  const treesReport = treesData ? buildTreesReport(treesData) : null;

  // Determine overall risk across all domains (including "Other")
  const overallRisk = determineOverallRisk(
    heritageReport?.riskAssessment?.overallRisk,
    landscapeReport?.riskAssessment?.overallRisk,
    renewablesReport?.riskAssessment?.overallRisk,
    agLandReport?.riskAssessment?.overallRisk,
    treesReport?.riskAssessment?.overallRisk,
    drinkingWaterOverallRisk
  );

  // Map drinking water rules to report format
  const drinkingWaterTriggeredRules = drinkingWaterRules.map((/** @type {any} */ r) => ({
    rule: r.rule,
    level: r.level,
    findings: r.findings,
    recommendation: r.recommendation || null,
    recommendations: r.recommendations || []
  }));

  // Combine triggered rules from all domains
  const allTriggeredRules = [
    ...(heritageReport?.riskAssessment?.triggeredRules || []),
    ...(landscapeReport?.riskAssessment?.triggeredRules || []),
    ...(renewablesReport?.riskAssessment?.triggeredRules || []),
    ...(ecologyReport?.riskAssessment?.triggeredRules || []),
    ...(agLandReport?.riskAssessment?.triggeredRules || []),
    ...(treesReport?.riskAssessment?.triggeredRules || []),
    ...drinkingWaterTriggeredRules
  ];

  // Combine designation summaries
  const combinedDesignationSummary = [
    ...(heritageReport?.designationSummary || []),
    ...(landscapeReport?.designationSummary || []),
    ...(renewablesReport?.designationSummary || []),
    ...(ecologyReport?.designationSummary || []),
    ...(agLandReport?.designationSummary || []),
    ...(treesReport?.designationSummary || [])
  ];

  // Build discipline-specific data for structured report
  // Use the rules that are already separated by domain in individual reports
  const disciplines = [];
  
  if (heritageReport) {
    const heritageTriggeredRules = heritageReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Heritage",
      overallRisk: heritageReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(heritageReport.riskAssessment?.overallRisk),
      triggeredRules: heritageTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: heritageData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: heritageData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: heritageData?.defaultNoRulesRecommendations || []
    });
  }
  
  if (landscapeReport) {
    const landscapeTriggeredRules = landscapeReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Landscape",
      overallRisk: landscapeReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(landscapeReport.riskAssessment?.overallRisk),
      triggeredRules: landscapeTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: landscapeData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: landscapeData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: landscapeData?.defaultNoRulesRecommendations || []
    });
  }
  
  if (renewablesReport) {
    const renewablesTriggeredRules = renewablesReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Renewables Development",
      overallRisk: renewablesReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(renewablesReport.riskAssessment?.overallRisk),
      triggeredRules: renewablesTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: renewablesData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: renewablesData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: renewablesData?.defaultNoRulesRecommendations || []
    });
  }
  
  if (ecologyReport) {
    const ecologyTriggeredRules = ecologyReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Ecology",
      overallRisk: ecologyReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(ecologyReport.riskAssessment?.overallRisk),
      triggeredRules: ecologyTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: ecologyData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: ecologyData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: ecologyData?.defaultNoRulesRecommendations || []
    });
  }

  if (agLandReport) {
    const agLandTriggeredRules = agLandReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Agricultural Land",
      overallRisk: agLandReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(agLandReport.riskAssessment?.overallRisk),
      triggeredRules: agLandTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: agLandData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: agLandData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: agLandData?.defaultNoRulesRecommendations || []
    });
  }

  if (treesReport) {
    const treesTriggeredRules = treesReport.riskAssessment?.triggeredRules || [];
    disciplines.push({
      name: "Ancient Woodland",
      overallRisk: treesReport.riskAssessment?.overallRisk,
      riskSummary: resolveRiskSummary(treesReport.riskAssessment?.overallRisk),
      triggeredRules: treesTriggeredRules,
      // New structure: single discipline recommendation
      disciplineRecommendation: treesData?.disciplineRecommendation || null,
      // Backward compatibility
      defaultTriggeredRecommendations: treesData?.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: treesData?.defaultNoRulesRecommendations || []
    });
  }

  // "Other" discipline for drinking water
  if (drinkingWaterRules.length > 0) {
    disciplines.push({
      name: "Other",
      overallRisk: drinkingWaterOverallRisk,
      riskSummary: resolveRiskSummary(drinkingWaterOverallRisk),
      triggeredRules: drinkingWaterTriggeredRules,
      disciplineRecommendation: null,
      defaultTriggeredRecommendations: [],
      defaultNoRulesRecommendations: []
    });
  }

  // Build risk by discipline summary for the summary section
  const riskByDiscipline = disciplines
    .filter(d => d.overallRisk) // Only include disciplines with risk data
    .map(d => ({
      name: d.name,
      risk: d.overallRisk,
      riskSummary: resolveRiskSummary(d.overallRisk)
    }));
  
  return {
    // EXISTING STRUCTURE - Keep for backward compatibility
    heritage: heritageReport,
    landscape: landscapeReport,
    renewables: renewablesReport,
    ecology: ecologyReport,
    agland: agLandReport,
    trees: treesReport,
    combined: {
      overallRisk,
      designationSummary: combinedDesignationSummary,
      triggeredRules: allTriggeredRules,
      riskSummary: heritageReport?.riskAssessment?.riskSummary || landscapeReport?.riskAssessment?.riskSummary || renewablesReport?.riskAssessment?.riskSummary || ecologyReport?.riskAssessment?.riskSummary || treesReport?.riskAssessment?.riskSummary
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      sectionsIncluded: [
        heritageData ? 'heritage' : null,
        landscapeData ? 'landscape' : null,
        renewablesData ? 'renewables' : null,
        ecologyData ? 'ecology' : null,
        agLandData ? 'agland' : null,
        treesData ? 'trees' : null,
        drinkingWaterRules.length > 0 ? 'other' : null
      ].filter(Boolean),
      totalRules: allTriggeredRules.length,
      totalRulesProcessed: (heritageReport?.metadata?.totalRulesProcessed || 0) + (landscapeReport?.metadata?.totalRulesProcessed || 0) + (renewablesReport?.metadata?.totalRulesProcessed || 0) + (ecologyReport?.metadata?.totalRulesProcessed || 0) + (agLandReport?.metadata?.totalRulesProcessed || 0) + (treesReport?.metadata?.totalRulesProcessed || 0),
      rulesTriggered: allTriggeredRules.length,
      rulesVersion: `combined-v2 (heritage: ${heritageReport?.metadata?.rulesVersion || 'n/a'}, landscape: ${landscapeReport?.metadata?.rulesVersion || 'n/a'}, renewables: ${renewablesReport?.metadata?.rulesVersion || 'n/a'}, ecology: ${ecologyReport?.metadata?.rulesVersion || 'n/a'}, agland: ${agLandReport?.metadata?.rulesVersion || 'n/a'}, trees: ${treesReport?.metadata?.rulesVersion || 'n/a'})`,
      heritageMetadata: heritageReport?.metadata,
      landscapeMetadata: landscapeReport?.metadata,
      renewablesMetadata: renewablesReport?.metadata,
      ecologyMetadata: ecologyReport?.metadata,
      aglandMetadata: agLandReport?.metadata,
      treesMetadata: treesReport?.metadata
    },

    // NEW STRUCTURED REPORT - New organized structure
    structuredReport: {
      summary: {
        site: "TBC - Site summary placeholder",
        riskByDiscipline,
        overallRisk,
        overallRiskSummary: resolveRiskSummary(overallRisk)
      },
      disciplines: disciplines.filter(d => d.overallRisk) // Only include disciplines with data
    }
  };
}

/**
 * Legacy function for backward compatibility - builds heritage report only
 * @param {any} backend 
 */
export { buildHeritageReport } from './heritage/heritageReportGenerator.js';