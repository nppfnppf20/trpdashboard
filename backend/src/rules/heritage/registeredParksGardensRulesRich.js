import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} parksGardens */
export function checkParksGardensOnSite(parksGardens) {
  const onSite = (parksGardens || []).filter(pg => pg.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.SHOWSTOPPER;
  return {
    id: 'registered_parks_gardens_on_site',
    triggered: true,
    level,
    rule: 'Registered Park/Garden On-Site',
    findings: `${onSite.length} Registered Park${onSite.length > 1 ? 's' : ''}/Garden${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin50m(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && pg.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'registered_parks_gardens_within_50m',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 50m',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin100m(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_50m && pg.within_100m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'registered_parks_gardens_within_100m',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 100m',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin250m(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_100m && pg.within_250m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'registered_parks_gardens_within_250m',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 250m',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin500m(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_250m && pg.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'registered_parks_gardens_within_500m',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 500m',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin1km(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_500m && pg.within_1km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'registered_parks_gardens_within_1km',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 1km',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin3km(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_1km && pg.within_3km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'registered_parks_gardens_within_3km',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 3km',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} parksGardens */
export function checkParksGardensWithin5km(parksGardens) {
  const areas = (parksGardens || []).filter(pg => !pg.on_site && !pg.within_3km && pg.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'registered_parks_gardens_within_5km',
    triggered: true,
    level,
    rule: 'Registered Park/Garden Within 5km',
    findings: `${areas.length} Registered Park${areas.length > 1 ? 's' : ''}/Garden${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('registeredParksGardensBattlefields', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {{ registered_parks_gardens?: any[] }} analysisData */
export function processRegisteredParksGardensRules(analysisData) {
  const parksGardens = analysisData?.registered_parks_gardens || [];
  const triggeredRules = [];
  const pipeline = [
    checkParksGardensOnSite,
    checkParksGardensWithin50m,
    checkParksGardensWithin100m,
    checkParksGardensWithin250m,
    checkParksGardensWithin500m,
    checkParksGardensWithin1km,
    checkParksGardensWithin3km,
    checkParksGardensWithin5km
  ];
  for (const rule of pipeline) {
    const result = rule(parksGardens);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    registered_parks_gardens: parksGardens
  };
}
