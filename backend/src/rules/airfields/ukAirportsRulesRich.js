import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** @param {any[]} ukAirports */
export function checkUkAirportOnSite(ukAirports) {
  const onSite = (ukAirports || []).filter(a => a.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'uk_airport_on_site',
    triggered: true,
    level,
    rule: 'UK Airport On-Site',
    findings: `${onSite.length} UK Airport${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('airfield', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

/** @param {any[]} ukAirports */
export function checkUkAirportWithin500m(ukAirports) {
  const areas = (ukAirports || []).filter(a => !a.on_site && a.within_500m);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.HIGH_RISK;
  return {
    id: 'uk_airport_within_500m',
    triggered: true,
    level,
    rule: 'UK Airport Within 500m',
    findings: `${areas.length} UK Airport${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendation: buildDesignationRecommendation('airfield', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} ukAirports */
export function checkUkAirportWithin5km(ukAirports) {
  const areas = (ukAirports || []).filter(a => !a.on_site && !a.within_500m && a.within_5km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_HIGH_RISK;
  return {
    id: 'uk_airport_within_5km',
    triggered: true,
    level,
    rule: 'UK Airport Within 5km',
    findings: `${areas.length} UK Airport${areas.length > 1 ? 's' : ''} within 5km of site`,
    recommendation: buildDesignationRecommendation('airfield', isRiskMediumOrAbove(level)),
    areas
  };
}

/** @param {any[]} ukAirports */
export function checkUkAirportWithin10km(ukAirports) {
  const areas = (ukAirports || []).filter(a => !a.on_site && !a.within_5km && a.within_10km);
  if (areas.length === 0) return { triggered: false };

  const level = RISK_LEVELS.MEDIUM_LOW_RISK;
  return {
    id: 'uk_airport_within_10km',
    triggered: true,
    level,
    rule: 'UK Airport Within 10km',
    findings: `${areas.length} UK Airport${areas.length > 1 ? 's' : ''} within 10km of site`,
    recommendation: buildDesignationRecommendation('airfield', isRiskMediumOrAbove(level)),
    areas
  };
}

/**
 * Process all UK airports rules and return triggered ones
 * @param {{ uk_airports?: any[] }} analysisData
 */
export function processUkAirportsRules(analysisData) {
  const ukAirports = analysisData?.uk_airports || [];
  const triggeredRules = [];

  const pipeline = [
    checkUkAirportOnSite,
    checkUkAirportWithin500m,
    checkUkAirportWithin5km,
    checkUkAirportWithin10km
  ];

  for (const rule of pipeline) {
    const result = rule(ukAirports);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    uk_airports: ukAirports
  };
}
