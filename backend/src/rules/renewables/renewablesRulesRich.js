import { RISK_LEVELS } from '../riskLevels.js';

// Default recommendations that always appear when ANY renewables rules are triggered
const DEFAULT_TRIGGERED_RECOMMENDATIONS = [
  // TODO: Add default recommendations for when renewables rules are triggered
];

// Default recommendations when NO renewables rules are triggered
const DEFAULT_NO_RULES_RECOMMENDATIONS = [
  // TODO: Add default recommendations for when no renewables rules are triggered
];

/**
 * Process renewables rules and generate rich output for UI
 * @param {Array} renewablesData - Array of renewable energy developments
 * @returns {Object} Rules assessment with triggered rules and overall risk
 */
export function processRenewablesRules(renewablesData) {
  if (!Array.isArray(renewablesData) || renewablesData.length === 0) {
    return {
      rules: [],
      overallRisk: null,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 0,
        rulesTriggered: 0,
        rulesVersion: 'renewables-rules-v1'
      }
    };
  }

  let triggeredRules = [];

  // Process each renewable development
  renewablesData.forEach(development => {
    const { 
      site_name, 
      development_status_short, 
      technology_type, 
      installed_capacity_mw,
      on_site, 
      within_50m, 
      within_100m, 
      within_250m, 
      within_500m, 
      within_1km, 
      within_3km, 
      within_5km,
      dist_m,
      direction 
    } = development;

    const techType = technology_type || 'Renewable';
    const siteName = site_name || `${techType} Development ${development.id}`;
    const status = development_status_short;
    const capacity = installed_capacity_mw || 'Unknown';

    // Determine closest buffer zone
    let closestBuffer = 'Beyond 5km';
    let riskLevel = null;
    let ruleTitle = '';
    let explanation = '';

    if (on_site) {
      closestBuffer = 'On-site';
    } else if (within_50m) {
      closestBuffer = '50m';
    } else if (within_100m) {
      closestBuffer = '100m';
    } else if (within_250m) {
      closestBuffer = '250m';
    } else if (within_500m) {
      closestBuffer = '500m';
    } else if (within_1km) {
      closestBuffer = '1km';
    } else if (within_3km) {
      closestBuffer = '3km';
    } else if (within_5km) {
      closestBuffer = '5km';
    }

    // Apply status and buffer-specific rules
    if (status === 'Appeal Refused' || status === 'Application Refused') {
      // Refused applications - low risk but informative
      if (within_5km) {
        riskLevel = RISK_LEVELS.LOW_RISK;
        ruleTitle = `${techType} Development Previously Refused (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} was previously refused at ${closestBuffer} from the site. This refusal may indicate the Council's decision-making process and likelihood of approval for similar developments. The previous refusal could be due to planning policy, landscape impact, or technical concerns that may be relevant to assess for future proposals in the area.`;
      }
    } else if (status === 'Application Submitted' || status === 'Awaiting Construction' || status === 'Revised') {
      // Active applications - high risk levels
      if (on_site || within_50m || within_100m || within_250m) {
        riskLevel = RISK_LEVELS.EXTREMELY_HIGH_RISK;
        ruleTitle = `Active ${techType} Development Application (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} has an active planning application and is located ${closestBuffer} from the site. This represents an extremely high risk as the development may proceed and could significantly impact the local area through landscape change, infrastructure requirements, and cumulative development pressure.`;
      } else if (within_500m || within_1km) {
        riskLevel = RISK_LEVELS.HIGH_RISK;
        ruleTitle = `Active ${techType} Development Application (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} has an active planning application and is located ${closestBuffer} from the site. This represents a high risk as the development may proceed and could impact the wider area through visual effects, traffic during construction, and grid infrastructure changes.`;
      } else if (within_3km) {
        riskLevel = RISK_LEVELS.MEDIUM_RISK;
        ruleTitle = `Active ${techType} Development Application (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} has an active planning application and is located ${closestBuffer} from the site. This represents a medium risk as the development may proceed and could contribute to cumulative renewable energy development in the area.`;
      } else if (within_5km) {
        riskLevel = RISK_LEVELS.MEDIUM_LOW_RISK;
        ruleTitle = `Active ${techType} Development Application (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} has an active planning application and is located ${closestBuffer} from the site. This represents a medium-low risk but should be monitored as it indicates renewable energy development activity in the wider area.`;
      }
    } else if (status === 'Under Construction' || status === 'Operational') {
      // Committed developments - highest risk levels
      if (on_site || within_50m || within_100m || within_250m) {
        riskLevel = RISK_LEVELS.SHOWSTOPPER;
        ruleTitle = `${status} ${techType} Development (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} is ${status.toLowerCase()} and located ${closestBuffer} from the site. This represents a showstopper risk as the development is committed/operational and will have significant direct impacts including landscape change, infrastructure presence, and potential grid connection requirements.`;
      } else if (within_500m || within_1km) {
        riskLevel = RISK_LEVELS.EXTREMELY_HIGH_RISK;
        ruleTitle = `${status} ${techType} Development (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} is ${status.toLowerCase()} and located ${closestBuffer} from the site. This represents an extremely high risk as the development is committed/operational and will have substantial impacts on the immediate area including visual effects, changed land use, and associated infrastructure.`;
      } else if (within_3km) {
        riskLevel = RISK_LEVELS.MEDIUM_HIGH_RISK;
        ruleTitle = `${status} ${techType} Development (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} is ${status.toLowerCase()} and located ${closestBuffer} from the site. This represents a medium-high risk as the development is committed/operational and contributes to the renewable energy landscape in the area.`;
      } else if (within_5km) {
        riskLevel = RISK_LEVELS.MEDIUM_LOW_RISK;
        ruleTitle = `${status} ${techType} Development (${closestBuffer})`;
        explanation = `A large-scale ${techType.toLowerCase()} development (${capacity} MW) at ${siteName} is ${status.toLowerCase()} and located ${closestBuffer} from the site. This represents a medium-low risk but indicates established renewable energy development in the wider area.`;
      }
    }

    // Add rule if triggered (map to shared report schema: rule, level, findings, impact, requirements)
    if (riskLevel) {
      /** Build findings sentence aligned with report expectations */
      const findings = `Large-scale ${techType.toLowerCase()} development (${capacity} MW) ${on_site ? 'on-site' : `at ${dist_m}m ${direction}`} (${closestBuffer}). Status: ${status}.`;

      /** Map context-specific recommendations to the shared 'recommendations' field */
      /** @type {string[]} */
      let recommendations = [];
      if (status === 'Appeal Refused' || status === 'Application Refused') {
        recommendations = [
          "Refusal nearby - review of decision notice and reasons for refusal may indicate council's current policy position",
          "Monitor for any resubmissions or appeals"
        ];
      } else if (status === 'Application Submitted' || status === 'Awaiting Construction' || status === 'Revised') {
        recommendations = [
          "Monitor application progress and committee dates",
        ];
      } else if (status === 'Under Construction' || status === 'Operational') {
        recommendations = [
          "Account for cumulative effects along with operational/committed development",
        ];
      }

      triggeredRules.push({
        id: `renewables-${development.id}`,
        triggered: true,
        level: riskLevel,
        rule: ruleTitle,
        findings,
        recommendations
      });
    }
  });

  // Calculate overall risk level
  const overallRisk = calculateOverallRisk(triggeredRules);

  // Check if any showstoppers are present (for recommendation logic)
  const hasShowstoppers = triggeredRules.some(r => r.level === RISK_LEVELS.SHOWSTOPPER);

  return {
    rules: triggeredRules,
    overallRisk,
    defaultTriggeredRecommendations: (triggeredRules.length > 0 && !hasShowstoppers) ? DEFAULT_TRIGGERED_RECOMMENDATIONS : [],
    defaultNoRulesRecommendations: triggeredRules.length === 0 ? DEFAULT_NO_RULES_RECOMMENDATIONS : [],
    metadata: {
      generatedAt: new Date().toISOString(),
      totalRulesProcessed: renewablesData.length,
      rulesTriggered: triggeredRules.length,
      rulesVersion: 'renewables-rules-v1'
    }
  };
}

/**
 * Calculate overall risk from triggered rules
 * @param {Array} rules - Array of triggered rules
 * @returns {string|null} Overall risk level
 */
function calculateOverallRisk(rules) {
  if (rules.length === 0) return null;

  const riskLevels = [
    RISK_LEVELS.SHOWSTOPPER,
    RISK_LEVELS.EXTREMELY_HIGH_RISK,
    RISK_LEVELS.HIGH_RISK,
    RISK_LEVELS.MEDIUM_HIGH_RISK,
    RISK_LEVELS.MEDIUM_RISK,
    RISK_LEVELS.MEDIUM_LOW_RISK,
    RISK_LEVELS.LOW_RISK
  ];

  // Find the highest risk level among triggered rules
  for (const level of riskLevels) {
    if (rules.some(rule => rule.level === level)) {
      return level;
    }
  }

  return RISK_LEVELS.LOW_RISK;
}
