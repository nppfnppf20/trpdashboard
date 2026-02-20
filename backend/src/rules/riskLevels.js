// Shared risk level definitions for all planning domains
// This is the single source of truth for risk levels across heritage, landscape, and future domains

export const RISK_LEVELS = {
  SHOWSTOPPER: 'showstopper',
  EXTREMELY_HIGH_RISK: 'extremely_high_risk',
  HIGH_RISK: 'high_risk',
  MEDIUM_HIGH_RISK: 'medium_high_risk',
  MEDIUM_RISK: 'medium_risk',
  MEDIUM_LOW_RISK: 'medium_low_risk',
  LOW_RISK: 'low_risk'
};

/**
 * Risk level hierarchy from highest to lowest severity
 */
export const RISK_HIERARCHY = [
  RISK_LEVELS.SHOWSTOPPER,
  RISK_LEVELS.EXTREMELY_HIGH_RISK,
  RISK_LEVELS.HIGH_RISK,
  RISK_LEVELS.MEDIUM_HIGH_RISK,
  RISK_LEVELS.MEDIUM_RISK,
  RISK_LEVELS.MEDIUM_LOW_RISK,
  RISK_LEVELS.LOW_RISK
];

/**
 * Check if a risk level is MEDIUM_RISK or above (higher sensitivity)
 * @param {string} level - The risk level to check
 * @returns {boolean} True if MEDIUM_RISK or higher severity
 */
export function isRiskMediumOrAbove(level) {
  const mediumOrAbove = [
    RISK_LEVELS.SHOWSTOPPER,
    RISK_LEVELS.EXTREMELY_HIGH_RISK,
    RISK_LEVELS.HIGH_RISK,
    RISK_LEVELS.MEDIUM_HIGH_RISK,
    RISK_LEVELS.MEDIUM_RISK
  ];
  return mediumOrAbove.includes(level);
}

/**
 * Get the highest risk level from an array of rules
 * @param {Array<{level: string}>} rules - Array of rules with level property
 * @returns {string} The highest risk level, or LOW_RISK if empty
 */
export function getHighestRiskLevel(rules) {
  if (!rules || rules.length === 0) return RISK_LEVELS.LOW_RISK;

  const sorted = [...rules].sort((a, b) =>
    RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level)
  );

  return sorted[0].level;
}
