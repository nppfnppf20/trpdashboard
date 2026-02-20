import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} ancientWoodland */
export function checkAncientWoodlandOnSite(ancientWoodland) {
  const onSite = (ancientWoodland || []).filter(aw => aw.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'ancient_woodland_on_site',
    triggered: true,
    level,
    rule: 'Ancient Woodland On-Site',
    findings: `${onSite.length} Ancient Woodland area${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('ancientWoodland', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} ancientWoodland */
export function checkAncientWoodlandWithin50m(ancientWoodland) {
  const areas = (ancientWoodland || []).filter(aw => !aw.on_site && aw.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'ancient_woodland_within_50m',
    triggered: true,
    level,
    rule: 'Ancient Woodland Within 50m',
    findings: `${areas.length} Ancient Woodland area${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('ancientWoodland', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} ancientWoodland */
export function checkAncientWoodlandWithin500m(ancientWoodland) {
  const areas = (ancientWoodland || []).filter(aw => !aw.on_site && !aw.within_50m && aw.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'ancient_woodland_within_500m',
    triggered: true,
    level,
    rule: 'Ancient Woodland Within 500m',
    findings: `${areas.length} Ancient Woodland area${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('ancientWoodland', isRiskMediumOrAbove(level)),
    areas
  };
}

/**
 * Process all ancient woodland rules and return triggered ones
 * @param {{ ancient_woodland?: any[] }} analysisData
 */
export function processAncientWoodlandRules(analysisData) {
  const ancientWoodland = analysisData?.ancient_woodland || [];
  const triggeredRules = [];

  const pipeline = [
    checkAncientWoodlandOnSite,
    checkAncientWoodlandWithin50m,
    checkAncientWoodlandWithin500m
  ];

  for (const rule of pipeline) {
    const result = rule(ancientWoodland);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    rules: triggeredRules,
    ancient_woodland: ancientWoodland
  };
}
