// Heritage-specific report generator
// Consumes backend heritage analysis results and formats for UI display

const RISK_CONFIG = {
  7: { label: 'SHOWSTOPPER', description: 'Development likely not viable without major redesign', color: '#dc2626', bgColor: '#fef2f2' },
  6: { label: 'EXTREMELY HIGH RISK', description: 'Major constraints, extensive specialist input required', color: '#b91c1c', bgColor: '#fee2e2' },
  5: { label: 'HIGH RISK', description: 'Significant constraints, specialist assessment required', color: '#ea580c', bgColor: '#fff7ed' },
  4: { label: 'MEDIUM-HIGH RISK', description: 'Moderate constraints, careful design required', color: '#d97706', bgColor: '#fffbeb' },
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
 * Build UI-ready heritage report from backend payload
 * @param {any} backend
 */
export function buildHeritageReport(backend) {
  const buildings = backend?.listed_buildings ?? [];
  const areas = backend?.conservation_areas ?? [];
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
    const bCount = buildings.length;
    const aCount = areas.length;
    const onSiteB = buildings.filter((/** @type {any} */ b) => b.on_site).length;
    const onSiteA = areas.filter((/** @type {any} */ a) => a.on_site).length;
    const parts = [];
    parts.push(
      bCount > 0
        ? `${bCount} listed building${bCount > 1 ? 's' : ''}${onSiteB > 0 ? ` (${onSiteB} on site)` : ''}`
        : 'No listed buildings identified within the search area'
    );
    parts.push(
      aCount > 0
        ? `${aCount} conservation area${aCount > 1 ? 's' : ''}${onSiteA > 0 ? ` (${onSiteA} intersecting)` : ''}`
        : 'No conservation areas identified within 1km'
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
      buildings: { detailed: buildings, within1kmCount: buildings.filter((/** @type {any} */ b) => !b.on_site && b.dist_m <= 1000).length },
      conservationAreas: { detailed: areas, within1kmCount: areas.filter((/** @type {any} */ a) => !a.on_site && a.dist_m <= 1000).length }
    },
    metadata: backend?.metadata || {}
  };
}
