import { RISK_LEVELS } from '../riskLevels.js';

/** @param {any[]} gcnAreas */
export function checkGCNOnSite(gcnAreas) {
  const onSite = (gcnAreas || []).filter(g => g.on_site);
  if (onSite.length === 0) return { triggered: false };
  return {
    id: 'gcn_on_site',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_RISK,
    rule: 'GCN Class Survey License Returns On-Site',
    findings: `${onSite.length} GCN Class Survey License Return${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendations: [
      'Great crested newt survey likely required',
    ],
    areas: onSite
  };
}

/** @param {any[]} gcnAreas */
export function checkGCNWithin250m(gcnAreas) {
  const areas = (gcnAreas || []).filter(g => !g.on_site && g.within_250m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'gcn_within_250m',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_LOW_RISK,
    rule: 'GCN Class Survey License Returns Within 250m',
    findings: `${areas.length} GCN Class Survey License Return${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendations: [
     'Great crested newt survey likely required',
    ],
    areas
  };
}

/** @param {{ gcn?: any[] }} analysisData */
export function processGCNRules(analysisData) {
  const gcn = analysisData?.gcn || [];
  const triggeredRules = [];
  const pipeline = [
    checkGCNOnSite,
    checkGCNWithin250m
  ];

  for (const rule of pipeline) {
    const result = rule(gcn);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    rules: triggeredRules,
    gcn
  };
}