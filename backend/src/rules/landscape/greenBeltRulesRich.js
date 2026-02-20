import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} greenBeltAreas */
export function checkGreenBeltOnSite(greenBeltAreas) {
  const onSiteAreas = (greenBeltAreas || []).filter(a => a.on_site);
  if (onSiteAreas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'green_belt_on_site',
    triggered: true,
    level,
    rule: 'Green Belt On-Site',
    findings: `Development site intersects with ${onSiteAreas.length} Green Belt area${onSiteAreas.length > 1 ? 's' : ''}`,
    recommendation: buildDesignationRecommendation('greenBelt', isRiskMediumOrAbove(level)),
    areas: onSiteAreas
  };
}

/** @param {any[]} greenBeltAreas */
export function checkGreenBeltWithin1km(greenBeltAreas) {
  const nearbyAreas = (greenBeltAreas || []).filter(a => !a.on_site && a.within_1km);
  if (nearbyAreas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'green_belt_within_1km',
    triggered: true,
    level,
    rule: 'Green Belt Within 1km',
    findings: `${nearbyAreas.length} Green Belt area${nearbyAreas.length > 1 ? 's' : ''} within 1km of development site`,
    recommendation: buildDesignationRecommendation('greenBelt', isRiskMediumOrAbove(level)),
    areas: nearbyAreas
  };
}

/** @param {{ green_belt?: any[] }} analysisData */
export function processGreenBeltRules(analysisData) {
  const greenBelt = analysisData?.green_belt || [];
  const triggeredRules = [];
  for (const rule of [checkGreenBeltOnSite, checkGreenBeltWithin1km]) {
    const result = rule(greenBelt);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    green_belt: greenBelt
  };
}
