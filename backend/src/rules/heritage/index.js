import { processListedBuildingsRules } from './listedBuildingsRulesRich.js';
import { processConservationAreasRules } from './conservationAreasRulesRich.js';
import { processScheduledMonumentsRules } from './ScheduledMonumentsRulesRich.js';
import { processRegisteredParksGardensRules } from './registeredParksGardensRulesRich.js';
import { processWorldHeritageSitesRules } from './worldHeritageSitesRulesRich.js';
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

/**
 * Aggregate heritage rules across listed buildings, conservation areas, scheduled monuments, registered parks/gardens, and world heritage sites
 * @param {any} analysisData
 */
export function processHeritageRules(analysisData) {
  const lb = processListedBuildingsRules(analysisData);
  const ca = processConservationAreasRules(analysisData);
  const sm = processScheduledMonumentsRules(analysisData);
  const pg = processRegisteredParksGardensRules(analysisData);
  const whs = processWorldHeritageSitesRules(analysisData);

  let rules = [...lb.rules, ...ca.rules, ...sm.rules, ...pg.rules, ...whs.rules].map(r => ({ ...r }));

  // Sort rules by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // overallRisk picks highest severity (first rule after sorting by risk level)
  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY heritage rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  const disciplineRecommendation = getDisciplineRecommendation('heritage', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    buildings: lb.buildings,
    conservationAreas: ca.conservationAreas,
    scheduledMonuments: sm.scheduled_monuments,
    registered_parks_gardens: pg.registered_parks_gardens,
    world_heritage_sites: whs.world_heritage_sites,
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility during transition
    defaultTriggeredRecommendations: hasTriggeredRules ? [disciplineRecommendation] : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : [disciplineRecommendation]
  };
}
