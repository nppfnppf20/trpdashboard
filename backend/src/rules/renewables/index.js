import { processRenewablesRules as processRenewablesRulesRich } from './renewablesRulesRich.js';

/**
 * Main renewables rules processor - aggregates all renewables rule checks
 * @param {Object} analysisResult - Raw analysis result from SQL
 * @returns {Object} Combined rules assessment with overall risk
 */
export function processRenewablesRules(analysisResult) {
  // Extract renewables data from analysis result
  const renewablesData = analysisResult.renewables || [];

  // Process renewables rules
  const renewablesAssessment = processRenewablesRulesRich(renewablesData);

  // Return combined assessment
  return {
    rules: renewablesAssessment.rules,
    overallRisk: renewablesAssessment.overallRisk,
    metadata: renewablesAssessment.metadata
  };
}
