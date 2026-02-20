import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

/** Distance bands for listed building proximity checks */
const DISTANCE_BANDS = [
  { id: 'on_site', onSite: true, label: 'On-Site', findingsLabel: 'found on development site' },
  { id: 'within_50m', minDist: 0, maxDist: 50, label: 'Within 50m', findingsLabel: 'within 50m of site' },
  { id: 'within_100m', minDist: 50, maxDist: 100, label: 'Within 100m', findingsLabel: 'within 50–100m of site' },
  { id: 'within_250m', minDist: 100, maxDist: 250, label: 'Within 250m', findingsLabel: 'within 100–250m of site' },
  { id: 'within_500m', minDist: 250, maxDist: 500, label: 'Within 500m', findingsLabel: 'within 250–500m of site' },
  { id: 'within_1km', minDist: 500, maxDist: 1000, label: 'Within 1km', findingsLabel: 'within 500m–1km of site' },
  { id: 'within_3km', minDist: 1000, maxDist: 3000, label: 'Within 3km', findingsLabel: 'within 1–3km of site' },
  { id: 'within_5km', minDist: 3000, maxDist: 5000, label: 'Within 5km', findingsLabel: 'within 3–5km of site' },
];

/** Risk levels per grade per distance band */
const GRADE_CONFIGS = [
  {
    grade: 'I',
    gradeKey: 'grade_i',
    recommendationKey: 'gradeIAndIIStar',
    riskByBand: {
      on_site: RISK_LEVELS.SHOWSTOPPER,
      within_50m: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_100m: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_250m: RISK_LEVELS.HIGH_RISK,
      within_500m: RISK_LEVELS.HIGH_RISK,
      within_1km: RISK_LEVELS.MEDIUM_HIGH_RISK,
      within_3km: RISK_LEVELS.MEDIUM_RISK,
      within_5km: RISK_LEVELS.MEDIUM_RISK,
    }
  },
  {
    grade: 'II*',
    gradeKey: 'grade_ii_star',
    recommendationKey: 'gradeIAndIIStar',
    riskByBand: {
      on_site: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_50m: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_100m: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_250m: RISK_LEVELS.HIGH_RISK,
      within_500m: RISK_LEVELS.HIGH_RISK,
      within_1km: RISK_LEVELS.MEDIUM_RISK,
      within_3km: RISK_LEVELS.MEDIUM_RISK,
      within_5km: RISK_LEVELS.MEDIUM_RISK,
    }
  },
  {
    grade: 'II',
    gradeKey: 'grade_ii',
    recommendationKey: 'gradeII',
    riskByBand: {
      on_site: RISK_LEVELS.EXTREMELY_HIGH_RISK,
      within_50m: RISK_LEVELS.HIGH_RISK,
      within_100m: RISK_LEVELS.HIGH_RISK,
      within_250m: RISK_LEVELS.MEDIUM_RISK,
      within_500m: RISK_LEVELS.MEDIUM_LOW_RISK,
      within_1km: RISK_LEVELS.MEDIUM_LOW_RISK,
      within_3km: RISK_LEVELS.MEDIUM_LOW_RISK,
      within_5km: RISK_LEVELS.MEDIUM_LOW_RISK,
    }
  }
];

/**
 * Filter buildings that match a grade and distance band
 * @param {any[]} buildings
 * @param {string} grade
 * @param {object} band
 */
function filterBuildingsForBand(buildings, grade, band) {
  return buildings.filter(b => {
    if (b.grade !== grade) return false;
    if (band.onSite) return b.on_site;
    return !b.on_site && b.dist_m > band.minDist && b.dist_m <= band.maxDist;
  });
}

/**
 * Process all listed buildings rules and return triggered ones
 * @param {{ listed_buildings?: any[] }} analysisData
 */
export function processListedBuildingsRules(analysisData) {
  const buildings = analysisData?.listed_buildings || [];
  const triggeredRules = [];

  // Process each grade (most serious first), then each distance band (closest first)
  for (const config of GRADE_CONFIGS) {
    for (const band of DISTANCE_BANDS) {
      const matched = filterBuildingsForBand(buildings, config.grade, band);
      if (matched.length === 0) continue;

      const level = config.riskByBand[band.id];
      triggeredRules.push({
        id: `${config.gradeKey}_${band.id}`,
        triggered: true,
        level,
        rule: `Grade ${config.grade} ${band.label}`,
        findings: `${matched.length} Grade ${config.grade} listed building(s) ${band.findingsLabel}`,
        recommendation: buildDesignationRecommendation(config.recommendationKey, isRiskMediumOrAbove(level)),
        buildings: matched
      });
    }
  }

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    buildings
  };
}
