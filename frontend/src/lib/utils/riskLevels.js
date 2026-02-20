// Shared risk level definitions for all planning domains
// This is the single source of truth for risk levels across heritage, landscape, and future domains
//
// NOTE: This file is copied from backend/src/rules/riskLevels.js for Vite compatibility
// Keep in sync with backend when risk levels change

export const RISK_LEVELS = {
  SHOWSTOPPER: 'showstopper',
  EXTREMELY_HIGH_RISK: 'extremely_high_risk',
  HIGH_RISK: 'high_risk',
  MEDIUM_RISK: 'medium_risk',
  MEDIUM_HIGH_RISK: 'medium_high_risk',
  MEDIUM_LOW_RISK: 'medium_low_risk',
  LOW_RISK: 'low_risk'
};
