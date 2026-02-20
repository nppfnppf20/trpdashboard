import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} nationalParks */
export function checkNationalParkOnSite(nationalParks) {
  const onSite = (nationalParks || []).filter(np => np.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'national_park_on_site',
    triggered: true,
    level,
    rule: 'National Park On-Site',
    findings: `${onSite.length} National Park${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin50m(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && np.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'national_park_within_50m',
    triggered: true,
    level,
    rule: 'National Park Within 50m',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin100m(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_50m && np.within_100m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'national_park_within_100m',
    triggered: true,
    level,
    rule: 'National Park Within 100m',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin250m(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_100m && np.within_250m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'national_park_within_250m',
    triggered: true,
    level,
    rule: 'National Park Within 250m',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin500m(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_250m && np.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'national_park_within_500m',
    triggered: true,
    level,
    rule: 'National Park Within 500m',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin1km(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_500m && np.within_1km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'national_park_within_1km',
    triggered: true,
    level,
    rule: 'National Park Within 1km',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin3km(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_1km && np.within_3km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'national_park_within_3km',
    triggered: true,
    level,
    rule: 'National Park Within 3km',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} nationalParks */
export function checkNationalParkWithin5km(nationalParks) {
  const areas = (nationalParks || []).filter(np => !np.on_site && !np.within_3km && np.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'national_park_within_5km',
    triggered: true,
    level,
    rule: 'National Park Within 5km',
    findings: `${areas.length} National Park${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {{ national_parks?: any[] }} analysisData */
export function processNationalParksRules(analysisData) {
  const nationalParks = analysisData?.national_parks || [];
  const triggeredRules = [];
  const pipeline = [
    checkNationalParkOnSite,
    checkNationalParkWithin50m,
    checkNationalParkWithin100m,
    checkNationalParkWithin250m,
    checkNationalParkWithin500m,
    checkNationalParkWithin1km,
    checkNationalParkWithin3km,
    checkNationalParkWithin5km
  ];
  for (const rule of pipeline) {
    const result = rule(nationalParks);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    national_parks: nationalParks
  };
}
