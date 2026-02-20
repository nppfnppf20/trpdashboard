import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} sssiSites */
export function checkSSSIOnSite(sssiSites) {
  const onSite = (sssiSites || []).filter(s => s.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'sssi_on_site',
    triggered: true,
    level,
    rule: 'SSSI On-Site',
    findings: `${onSite.length} SSSI site${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin50m(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && s.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'sssi_within_50m',
    triggered: true,
    level,
    rule: 'SSSI Within 50m',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin100m(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_50m && s.within_100m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'sssi_within_100m',
    triggered: true,
    level,
    rule: 'SSSI Within 100m',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin250m(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_100m && s.within_250m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'sssi_within_250m',
    triggered: true,
    level,
    rule: 'SSSI Within 250m',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin500m(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_250m && s.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'sssi_within_500m',
    triggered: true,
    level,
    rule: 'SSSI Within 500m',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin1km(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_500m && s.within_1km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'sssi_within_1km',
    triggered: true,
    level,
    rule: 'SSSI Within 1km',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin3km(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_1km && s.within_3km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'sssi_within_3km',
    triggered: true,
    level,
    rule: 'SSSI Within 3km',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} sssiSites */
export function checkSSSIWithin5km(sssiSites) {
  const areas = (sssiSites || []).filter(s => !s.on_site && !s.within_3km && s.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'sssi_within_5km',
    triggered: true,
    level,
    rule: 'SSSI Within 5km',
    findings: `${areas.length} SSSI site${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('sssi', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {{ sssi?: any[] }} analysisData */
export function processSSSIRules(analysisData) {
  const sssiSites = analysisData?.sssi || [];
  const triggeredRules = [];
  const pipeline = [
    checkSSSIOnSite,
    checkSSSIWithin50m,
    checkSSSIWithin100m,
    checkSSSIWithin250m,
    checkSSSIWithin500m,
    checkSSSIWithin1km,
    checkSSSIWithin3km,
    checkSSSIWithin5km
  ];
  for (const rule of pipeline) {
    const result = rule(sssiSites);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    sssi: sssiSites
  };
}
