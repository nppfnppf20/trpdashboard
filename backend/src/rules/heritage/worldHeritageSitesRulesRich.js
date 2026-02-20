import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteOnSite(worldHeritageSites) {
  const onSite = (worldHeritageSites || []).filter(whs => whs.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.SHOWSTOPPER;
  return {
    id: 'world_heritage_site_on_site',
    triggered: true,
    level,
    rule: 'World Heritage Site On-Site',
    findings: `${onSite.length} UNESCO World Heritage Site${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin50m(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && whs.within_50m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'world_heritage_site_within_50m',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 50m',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin100m(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_50m && whs.within_100m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'world_heritage_site_within_100m',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 100m',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin250m(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_100m && whs.within_250m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'world_heritage_site_within_250m',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 250m',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin500m(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_250m && whs.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'world_heritage_site_within_500m',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 500m',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin1km(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_500m && whs.within_1km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'world_heritage_site_within_1km',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 1km',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin3km(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_1km && whs.within_3km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_RISK;
  return {
    id: 'world_heritage_site_within_3km',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 3km',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 3km of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} worldHeritageSites */
export function checkWorldHeritageSiteWithin5km(worldHeritageSites) {
  const areas = (worldHeritageSites || []).filter(whs => !whs.on_site && !whs.within_3km && whs.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'world_heritage_site_within_5km',
    triggered: true,
    level,
    rule: 'World Heritage Site Within 5km',
    findings: `${areas.length} UNESCO World Heritage Site${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('worldHeritageSites', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {{ world_heritage_sites?: any[] }} analysisData */
export function processWorldHeritageSitesRules(analysisData) {
  const worldHeritageSites = analysisData?.world_heritage_sites || [];
  const triggeredRules = [];
  const pipeline = [
    checkWorldHeritageSiteOnSite,
    checkWorldHeritageSiteWithin50m,
    checkWorldHeritageSiteWithin100m,
    checkWorldHeritageSiteWithin250m,
    checkWorldHeritageSiteWithin500m,
    checkWorldHeritageSiteWithin1km,
    checkWorldHeritageSiteWithin3km,
    checkWorldHeritageSiteWithin5km
  ];
  for (const rule of pipeline) {
    const result = rule(worldHeritageSites);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    world_heritage_sites: worldHeritageSites
  };
}
