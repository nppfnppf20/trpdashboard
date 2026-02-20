// Agricultural land-specific report generator
// Consumes backend agricultural land analysis results and formats for UI display

const RISK_CONFIG = {
  7: { label: 'SHOWSTOPPER', description: 'Development likely not viable without major redesign', color: '#dc2626', bgColor: '#fef2f2' },
  6: { label: 'EXTREMELY HIGH RISK', description: 'Major constraints, extensive specialist input required', color: '#b91c1c', bgColor: '#fee2e2' },
  5: { label: 'HIGH RISK', description: 'Significant constraints, specialist assessment required', color: '#ea580c', bgColor: '#fff7ed' },
  4: { label: 'MEDIUM RISK', description: 'Notable constraints, proportionate assessment required', color: '#f59e0b', bgColor: '#fff7ed' },
  3: { label: 'MEDIUM-HIGH RISK', description: 'Moderate constraints, careful design required', color: '#d97706', bgColor: '#fffbeb' },
  2: { label: 'LOW RISK', description: 'Minimal constraints, standard mitigation measures', color: '#059669', bgColor: '#ecfdf5' },
  1: { label: 'LOW RISK', description: 'Minimal constraints, standard mitigation measures', color: '#059669', bgColor: '#ecfdf5' },
  0: { label: 'LOW RISK', description: 'Minimal constraints, standard mitigation measures', color: '#059669', bgColor: '#ecfdf5' }
};

/**
 * Resolve a risk summary object from either numeric or string overallRisk
 * @param {number | string} overallRisk
 */
function resolveRiskSummary(overallRisk) {
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
    return stringMap[/** @type {keyof typeof stringMap} */ (overallRisk)] || RISK_CONFIG[0];
  }
  return RISK_CONFIG[/** @type {keyof typeof RISK_CONFIG} */ (overallRisk)] || RISK_CONFIG[0];
}

/**
 * Build UI-ready agricultural land report from backend payload
 * @param {any} backend
 */
export function buildAgLandReport(backend) {
  const agLand = backend?.ag_land ?? [];
  const rules = Array.isArray(backend?.rules) ? backend.rules : [];
  const overallRisk = backend?.overallRisk ?? 0;

  // Server already provides human-readable rule content
  const triggeredRules = rules.map((/** @type {any} */ r) => ({
    id: r.id,  // Include rule ID for designation type grouping
    rule: r.rule,
    level: r.level,
    findings: r.findings,
    recommendation: r.recommendation || null,  // New format: single string
    recommendations: r.recommendations || []   // Old format: array (backward compat)
  }));

  // Simple designation summaries for UI
  const designationSummary = (() => {
    if (agLand.length === 0) {
      return ['No agricultural land data available for assessment area'];
    }

    const totalCoverage = agLand.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);
    const gradesSummary = agLand
      .sort((a, b) => {
        // Sort by grade quality (1 is best, 5 is worst)
        const gradeOrder = { '1': 1, 'Grade 1': 1, '2': 2, 'Grade 2': 2, '3a': 3, 'Grade 3a': 3, '3b': 4, 'Grade 3b': 4, '4': 5, 'Grade 4': 5, '5': 6, 'Grade 5': 6 };
        const aOrder = gradeOrder[a.grade] || 99;
        const bOrder = gradeOrder[b.grade] || 99;
        return aOrder - bOrder;
      })
      .map(area => `${area.grade}: ${area.percentage_coverage?.toFixed(1) || 0}%`)
      .join(', ');

    return [`Agricultural land covers ${totalCoverage.toFixed(1)}% of site (${gradesSummary})`];
  })();

  return {
    designationSummary,
    riskAssessment: {
      overallRisk,
      riskSummary: resolveRiskSummary(overallRisk),
      triggeredRules
    },
    lists: {
      agLand: {
        detailed: agLand,
        totalCoverage: agLand.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0)
      }
    },
    metadata: backend?.metadata || {}
  };
}