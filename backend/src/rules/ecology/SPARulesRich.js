import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} spaSites */
export function checkSPAOnSite(spaSites) {
  const onSite = (spaSites || []).filter(s => s.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.SHOWSTOPPER;
  return {
    id: 'spa_on_site',
    triggered: true,
    level,
    rule: 'Special Protection Area On-Site',
    findings: `${onSite.length} SPA${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin50m(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && s.within_50m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'spa_within_50m',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 50m',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin100m(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_50m && s.within_100m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'spa_within_100m',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 100m',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin250m(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_100m && s.within_250m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'spa_within_250m',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 250m',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin500m(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_250m && s.within_500m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'spa_within_500m',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 500m',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin1km(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_500m && s.within_1km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'spa_within_1km',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 1km',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin3km(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_1km && s.within_3km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'spa_within_3km',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 3km',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} spaSites */
export function checkSPAWithin5km(spaSites) {
  const sites = (spaSites || []).filter(s => !s.on_site && !s.within_3km && s.within_5km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'spa_within_5km',
    triggered: true,
    level,
    rule: 'Special Protection Area Within 5km',
    findings: `${sites.length} SPA${sites.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {{ spa?: any[] }} analysisData */
export function processSPARules(analysisData) {
  const spa = analysisData?.spa || [];
  const triggeredRules = [];
  const pipeline = [
    checkSPAOnSite,
    checkSPAWithin50m,
    checkSPAWithin100m,
    checkSPAWithin250m,
    checkSPAWithin500m,
    checkSPAWithin1km,
    checkSPAWithin3km,
    checkSPAWithin5km
  ];

  for (const rule of pipeline) {
    const result = rule(spa);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    spa
  };
}
