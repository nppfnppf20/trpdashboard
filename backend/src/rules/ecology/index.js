import { processOSPriorityPondsRules } from './OSPriorityPondsRulesRich.js';
import { processRamsarRules } from './RamsarRulesRich.js';
import { processSPARules } from './SPARulesRich.js';
import { processSACRules } from './SACRulesRich.js';
import { processGCNRules } from './GCNRulesRich.js';
import { processSSSIRules } from './sssiRulesRich.js';
import { processNationalNatureReservesRules } from './nationalNatureReservesRulesRich.js';
import { processDrinkingWaterRules } from './drinkingWaterRulesRich.js';
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

/**
 * Aggregate ecology rules across layers
 * @param {{ os_priority_ponds?: any[], ramsar?: any[], spa?: any[], sac?: any[], gcn?: any[], sssi?: any[], national_nature_reserves?: any[], drinking_water?: any[] }} analysisData
 */
export function processEcologyRules(analysisData) {
  const ponds = processOSPriorityPondsRules(analysisData);
  const ramsar = processRamsarRules(analysisData);
  const spa = processSPARules(analysisData);
  const sac = processSACRules(analysisData);
  const gcn = processGCNRules(analysisData);
  const sssi = processSSSIRules(analysisData);
  const nnr = processNationalNatureReservesRules(analysisData);
  const drinkingWater = processDrinkingWaterRules(analysisData);

  // Ecology rules (excluding drinking water - it's in its own "Other" section)
  let rules = [...ponds.rules, ...ramsar.rules, ...spa.rules, ...sac.rules, ...gcn.rules, ...sssi.rules, ...nnr.rules].map(r => ({ ...r }));

  // Sort rules by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // Overall risk picks highest severity by order in arrays
  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY ecology rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  const disciplineRecommendation = getDisciplineRecommendation('ecology', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    os_priority_ponds: ponds.os_priority_ponds,
    ramsar: ramsar.ramsar,
    spa: spa.spa,
    sac: sac.sac,
    gcn: gcn.gcn,
    sssi: sssi.sssi,
    national_nature_reserves: nnr.national_nature_reserves,
    drinking_water: drinkingWater.drinking_water,
    // Drinking water rules kept separate - displayed under "Other" not ecology
    drinkingWaterRules: drinkingWater.rules || [],
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility during transition
    defaultTriggeredRecommendations: hasTriggeredRules ? [disciplineRecommendation] : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : [disciplineRecommendation]
  };
}
