// Frontend landscape report builder: consume server-provided rules and overallRisk
// Handles landscape-specific risk assessment and report formatting

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
 * @param {any} backend
 */
export function buildLandscapeReport(backend) {
  const greenBelt = backend?.green_belt ?? [];
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
    const gbCount = greenBelt.length;
    const onSiteGb = greenBelt.filter((/** @type {any} */ gb) => gb.on_site).length;
    const parts = [];
    parts.push(
      gbCount > 0
        ? `${gbCount} Green Belt area${gbCount > 1 ? 's' : ''}${onSiteGb > 0 ? ` (${onSiteGb} intersecting)` : ''}`
        : 'No Green Belt areas identified within 5km'
    );
    return parts;
  })();

  return {
    designationSummary,
    riskAssessment: {
      overallRisk,
      riskSummary: resolveRiskSummary(overallRisk),
      triggeredRules
    },
    lists: {
      greenBelt: { 
        detailed: greenBelt, 
        within1kmCount: greenBelt.filter((/** @type {any} */ gb) => !gb.on_site && gb.within_1km).length 
      }
    },
    metadata: backend?.metadata || {}
  };
}
