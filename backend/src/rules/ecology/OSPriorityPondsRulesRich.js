import { RISK_LEVELS } from '../riskLevels.js';

/** @param {any[]} pondAreas */
export function checkOSPriorityPondsOnSite(pondAreas) {
  const onSite = (pondAreas || []).filter(p => p.on_site);
  if (onSite.length === 0) return { triggered: false };
  return {
    id: 'os_priority_ponds_on_site',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_RISK,
    rule: 'OS Priority Ponds On-Site',
    findings: `${onSite.length} OS Priority Pond${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendations: [
      'Great crested newt survey likely required',
    ],
    areas: onSite
  };
}

/** @param {any[]} pondAreas */
export function checkOSPriorityPondsWithin250m(pondAreas) {
  const areas = (pondAreas || []).filter(p => !p.on_site && p.within_250m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'os_priority_ponds_within_250m',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_LOW_RISK,
    rule: 'OS Priority Ponds Within 250m',
    findings: `${areas.length} OS Priority Pond${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendations: [
      'Great crested newt survey likely required',
    ],
    areas
  };
}

/** @param {{ os_priority_ponds?: any[] }} analysisData */
export function processOSPriorityPondsRules(analysisData) {
  const ponds = analysisData?.os_priority_ponds || [];
  const triggeredRules = [];
  const pipeline = [
    checkOSPriorityPondsOnSite,
    checkOSPriorityPondsWithin250m
  ];
  
  for (const rule of pipeline) {
    const result = rule(ponds);
    if (result.triggered) triggeredRules.push(result);
  }
  
  return {
    rules: triggeredRules,
    os_priority_ponds: ponds
  };
}

