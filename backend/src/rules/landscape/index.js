import { processGreenBeltRules } from './greenBeltRulesRich.js';
import { processAONBRules } from './aonbRulesRich.js';
import { processNationalParksRules } from './nationalParksRulesRich.js';
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

/**
 * Aggregate landscape rules across layers
 * @param {{ green_belt?: any[], aonb?: any[], national_parks?: any[] }} analysisData
 */
export function processLandscapeRules(analysisData) {
  const gb = processGreenBeltRules(analysisData);
  const ab = processAONBRules(analysisData);
  const np = processNationalParksRules(analysisData);

  let rules = [...gb.rules, ...ab.rules, ...np.rules].map(r => ({ ...r }));

  // Sort rules by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // overallRisk picks highest severity (first rule after sorting by risk level)
  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY landscape rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  const disciplineRecommendation = getDisciplineRecommendation('landscape', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    green_belt: gb.green_belt,
    aonb: ab.aonb,
    national_parks: np.national_parks,
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility during transition
    defaultTriggeredRecommendations: hasTriggeredRules ? [disciplineRecommendation] : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : [disciplineRecommendation]
  };
}
