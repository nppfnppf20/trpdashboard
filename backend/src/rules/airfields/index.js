import { processUkAirportsRules } from './ukAirportsRulesRich.js';
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

/**
 * Aggregate airfields rules across layers
 * @param {{ uk_airports?: any[] }} analysisData
 */
export function processAirfieldsRules(analysisData) {
  const airports = processUkAirportsRules(analysisData);

  let rules = [...airports.rules].map(r => ({ ...r }));

  // Sort rules by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // Overall risk picks highest severity (first rule after sorting by risk level)
  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY airfields rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  const disciplineRecommendation = getDisciplineRecommendation('aviation', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    uk_airports: airports.uk_airports,
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility during transition
    defaultTriggeredRecommendations: hasTriggeredRules ? [disciplineRecommendation] : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : [disciplineRecommendation]
  };
}
