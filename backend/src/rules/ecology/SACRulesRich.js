import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} sacSites */
export function checkSACOnSite(sacSites) {
  const onSite = (sacSites || []).filter(s => s.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.SHOWSTOPPER;
  return {
    id: 'sac_on_site',
    triggered: true,
    level,
    rule: 'Special Area of Conservation On-Site',
    findings: `${onSite.length} SAC${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin50m(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && s.within_50m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'sac_within_50m',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 50m',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin100m(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_50m && s.within_100m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'sac_within_100m',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 100m',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin250m(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_100m && s.within_250m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'sac_within_250m',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 250m',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin500m(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_250m && s.within_500m);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'sac_within_500m',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 500m',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin1km(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_500m && s.within_1km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'sac_within_1km',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 1km',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin3km(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_1km && s.within_3km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'sac_within_3km',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 3km',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {any[]} sacSites */
export function checkSACWithin5km(sacSites) {
  const sites = (sacSites || []).filter(s => !s.on_site && !s.within_3km && s.within_5km);
  if (sites.length === 0) return { triggered: false };

  const level = RISK_LEVELS.LOW_RISK;
  return {
    id: 'sac_within_5km',
    triggered: true,
    level,
    rule: 'Special Area of Conservation Within 5km',
    findings: `${sites.length} SAC${sites.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('ramsar', isRiskMediumOrAbove(level)),
    areas: sites
  };
}

/** @param {{ sac?: any[] }} analysisData */
export function processSACRules(analysisData) {
  const sac = analysisData?.sac || [];
  const triggeredRules = [];
  const pipeline = [
    checkSACOnSite,
    checkSACWithin50m,
    checkSACWithin100m,
    checkSACWithin250m,
    checkSACWithin500m,
    checkSACWithin1km,
    checkSACWithin3km,
    checkSACWithin5km
  ];

  for (const rule of pipeline) {
    const result = rule(sac);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    sac
  };
}
