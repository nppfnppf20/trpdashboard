import { processAncientWoodlandRules } from './ancientWoodlandRulesRich.js';
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

/**
 * Aggregate trees rules across layers
 * @param {{ ancient_woodland?: any[] }} analysisData
 */
export function processTreesRules(analysisData) {
  const ancientWoodland = processAncientWoodlandRules(analysisData);

  let rules = [...ancientWoodland.rules].map(r => ({ ...r }));

  // Sort rules by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // Overall risk picks highest severity (first rule after sorting by risk level)
  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY trees rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  // Note: Trees discipline has null for anyTrigger/noTrigger (uses designation-specific only)
  const disciplineRecommendation = getDisciplineRecommendation('trees', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    ancient_woodland: ancientWoodland.ancient_woodland,
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility during transition
    defaultTriggeredRecommendations: hasTriggeredRules ? (disciplineRecommendation ? [disciplineRecommendation] : []) : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : (disciplineRecommendation ? [disciplineRecommendation] : [])
  };
}
