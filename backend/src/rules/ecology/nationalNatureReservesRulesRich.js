import { RISK_LEVELS } from '../riskLevels.js';

/** @param {any[]} nnrSites */
export function checkNNROnSite(nnrSites) {
  const onSite = (nnrSites || []).filter(n => n.on_site);
  if (onSite.length === 0) return { triggered: false };
  return {
    id: 'nnr_on_site',
    triggered: true,
    level: RISK_LEVELS.EXTREMELY_HIGH_RISK,
    rule: 'National Nature Reserve On-Site',
    findings: `${onSite.length} National Nature Reserve${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendations: [
      'National Nature Reserve on site presents extremely high planning risk',
      'NNRs are premier wildlife conservation sites with the highest level of protection',
      'Ecological Impact Assessment (EcIA) essential',
      'Early consultation with Natural England mandatory',
      'Protected species surveys and habitat assessments required',
      'Development is unlikely to be acceptable without exceptional circumstances'
    ],
    areas: onSite
  };
}

/** @param {any[]} nnrSites */
export function checkNNRWithin50m(nnrSites) {
  const areas = (nnrSites || []).filter(n => !n.on_site && n.within_50m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'nnr_within_50m',
    triggered: true,
    level: RISK_LEVELS.HIGH_RISK,
    rule: 'National Nature Reserve Within 50m',
    findings: `${areas.length} National Nature Reserve${areas.length > 1 ? 's' : ''} within 50m of site`,
    recommendations: [
      'Proximity to National Nature Reserve presents high planning risk',
      'Ecological Impact Assessment (EcIA) required',
      'Consultation with Natural England essential',
      'Consider indirect impacts (dust, noise, runoff, lighting, disturbance)',
      'Robust mitigation measures will be critical'
    ],
    areas
  };
}

/** @param {any[]} nnrSites */
export function checkNNRWithin100m(nnrSites) {
  const areas = (nnrSites || []).filter(n => !n.on_site && !n.within_50m && n.within_100m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'nnr_within_100m',
    triggered: true,
    level: RISK_LEVELS.HIGH_RISK,
    rule: 'National Nature Reserve Within 100m',
    findings: `${areas.length} National Nature Reserve${areas.length > 1 ? 's' : ''} within 100m of site`,
    recommendations: [
      'Proximity to National Nature Reserve presents high planning risk',
      'Ecological Impact Assessment (EcIA) required',
      'Consider potential impacts on the NNR',
      'Mitigation measures will be required'
    ],
    areas
  };
}

/** @param {any[]} nnrSites */
export function checkNNRWithin250m(nnrSites) {
  const areas = (nnrSites || []).filter(n => !n.on_site && !n.within_100m && n.within_250m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'nnr_within_250m',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_HIGH_RISK,
    rule: 'National Nature Reserve Within 250m',
    findings: `${areas.length} National Nature Reserve${areas.length > 1 ? 's' : ''} within 250m of site`,
    recommendations: [
      'Ecological assessment recommended to assess potential impacts on NNR',
      'Consider potential indirect effects on the reserve'
    ],
    areas
  };
}

/** @param {any[]} nnrSites */
export function checkNNRWithin500m(nnrSites) {
  const areas = (nnrSites || []).filter(n => !n.on_site && !n.within_250m && n.within_500m);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'nnr_within_500m',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_RISK,
    rule: 'National Nature Reserve Within 500m',
    findings: `${areas.length} National Nature Reserve${areas.length > 1 ? 's' : ''} within 500m of site`,
    recommendations: [
      'Baseline ecological survey recommended',
      'Assess potential for impacts on NNR depending on development type'
    ],
    areas
  };
}

/** @param {any[]} nnrSites */
export function checkNNRWithin1km(nnrSites) {
  const areas = (nnrSites || []).filter(n => !n.on_site && !n.within_500m && n.within_1km);
  if (areas.length === 0) return { triggered: false };
  return {
    id: 'nnr_within_1km',
    triggered: true,
    level: RISK_LEVELS.LOW_RISK,
    rule: 'National Nature Reserve Within 1km',
    findings: `${areas.length} National Nature Reserve${areas.length > 1 ? 's' : ''} within 1km of site`,
    recommendations: [
      'National Nature Reserve noted within wider area',
      'No specific constraints expected due to distance'
    ],
    areas
  };
}

/** @param {{ national_nature_reserves?: any[] }} analysisData */
export function processNationalNatureReservesRules(analysisData) {
  const nnrSites = analysisData?.national_nature_reserves || [];
  const triggeredRules = [];
  const pipeline = [
    checkNNROnSite,
    checkNNRWithin50m,
    checkNNRWithin100m,
    checkNNRWithin250m,
    checkNNRWithin500m,
    checkNNRWithin1km
  ];
  for (const rule of pipeline) {
    const result = rule(nnrSites);
    if (result.triggered) triggeredRules.push(result);
  }
  return {
    rules: triggeredRules,
    national_nature_reserves: nnrSites
  };
}

