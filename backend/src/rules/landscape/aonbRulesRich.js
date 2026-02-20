import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} aonbAreas */
export function checkAONBOnSite(aonbAreas) {
  const onSite = (aonbAreas || []).filter(a => a.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'aonb_on_site',
    triggered: true,
    level,
    rule: 'AONB On-Site',
    findings: `${onSite.length} AONB area${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin50m(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && a.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'aonb_within_50m',
    triggered: true,
    level,
    rule: 'AONB Within 50m',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin100m(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_50m && a.within_100m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'aonb_within_100m',
    triggered: true,
    level,
    rule: 'AONB Within 100m',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin250m(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_100m && a.within_250m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'aonb_within_250m',
    triggered: true,
    level,
    rule: 'AONB Within 250m',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin500m(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_250m && a.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'aonb_within_500m',
    triggered: true,
    level,
    rule: 'AONB Within 500m',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin1km(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_500m && a.within_1km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'aonb_within_1km',
    triggered: true,
    level,
    rule: 'AONB Within 1km',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin3km(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_1km && a.within_3km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'aonb_within_3km',
    triggered: true,
    level,
    rule: 'AONB Within 3km',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} aonbAreas */
export function checkAONBWithin5km(aonbAreas) {
  const areas = (aonbAreas || []).filter(a => !a.on_site && !a.within_3km && a.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'aonb_within_5km',
    triggered: true,
    level,
    rule: 'AONB Within 5km',
    findings: `${areas.length} AONB area${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {{ aonb?: any[] }} analysisData */
export function processAONBRules(analysisData) {
  const aonb = analysisData?.aonb || [];
  const triggeredRules = [];
  const pipeline = [
    checkAONBOnSite,
    checkAONBWithin50m,
    checkAONBWithin100m,
    checkAONBWithin250m,
    checkAONBWithin500m,
    checkAONBWithin1km,
    checkAONBWithin3km,
    checkAONBWithin5km
  ];
  for (const rule of pipeline) {
    const result = rule(aonb);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    aonb
  };
}
