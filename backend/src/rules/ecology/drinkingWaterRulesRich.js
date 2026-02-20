import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/**
 * Check drinking water protected areas coverage on site
 * Risk is based on total percentage coverage:
 * - 80-100% = Extremely High Risk
 * - 40-80% = Medium Risk
 * - 0-40% = Low Risk
 * @param {any[]} drinkingWaterAreas
 */
export function checkDrinkingWaterOnSite(drinkingWaterAreas) {
  const areas = drinkingWaterAreas || [];
  if (areas.length === 0) return { triggered: false };

  // Calculate total coverage across all drinking water layers
  const totalCoverage = areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);
  // Cap at 100% since multiple overlapping layers could exceed 100%
  const cappedCoverage = Math.min(totalCoverage, 100);

  if (cappedCoverage <= 0) return { triggered: false };

  let riskLevel, riskDescription;
  if (cappedCoverage >= 80) {
    riskLevel = RISK_LEVELS.EXTREMELY_HIGH_RISK;
    riskDescription = 'extremely high risk';
  } else if (cappedCoverage >= 40) {
    riskLevel = RISK_LEVELS.MEDIUM_RISK;
    riskDescription = 'medium risk';
  } else {
    riskLevel = RISK_LEVELS.LOW_RISK;
    riskDescription = 'low risk';
  }

  // Create breakdown by layer type
  const layerBreakdown = [];
  const safeguardSurface = areas.filter(a => a.source_layer === 'safeguard_surface');
  const protectedSurface = areas.filter(a => a.source_layer === 'protected_surface');
  const safeguardGroundwater = areas.filter(a => a.source_layer === 'safeguard_groundwater');

  if (safeguardSurface.length > 0) {
    const coverage = safeguardSurface.reduce((sum, a) => sum + (a.percentage_coverage || 0), 0);
    layerBreakdown.push(`Safeguard Zones Surface Water (${coverage.toFixed(1)}%)`);
  }
  if (protectedSurface.length > 0) {
    const coverage = protectedSurface.reduce((sum, a) => sum + (a.percentage_coverage || 0), 0);
    layerBreakdown.push(`Protected Areas Surface Water (${coverage.toFixed(1)}%)`);
  }
  if (safeguardGroundwater.length > 0) {
    const coverage = safeguardGroundwater.reduce((sum, a) => sum + (a.percentage_coverage || 0), 0);
    layerBreakdown.push(`Safeguard Zones Groundwater (${coverage.toFixed(1)}%)`);
  }

  return {
    id: 'drinking_water_on_site',
    triggered: true,
    level: riskLevel,
    rule: 'Drinking Water Protected Areas On-Site',
    findings: `${cappedCoverage.toFixed(1)}% of site covered by drinking water protection designations${layerBreakdown.length > 0 ? ': ' + layerBreakdown.join(', ') : ''}`,
    recommendation: buildDesignationRecommendation('drinkingWater', isRiskMediumOrAbove(riskLevel)),
    areas
  };
}

/**
 * Process all drinking water rules and return triggered ones
 * @param {{ drinking_water?: any[] }} analysisData
 */
export function processDrinkingWaterRules(analysisData) {
  const drinkingWater = analysisData?.drinking_water || [];
  const triggeredRules = [];

  const result = checkDrinkingWaterOnSite(drinkingWater);
  if (result.triggered) triggeredRules.push(result);

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    drinking_water: drinkingWater
  };
}
