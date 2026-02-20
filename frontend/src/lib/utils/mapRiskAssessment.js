// Risk assessment utilities for map visualization
// These functions extract just the risk level logic from the backend rules
// to avoid the full rule processing overhead for map display

import { RISK_LEVELS } from './riskLevels.js';

/**
 * Determine risk level for a listed building based on its properties
 * Mirrors the logic from backend/src/rules/heritage/listedBuildingsRulesRich.js
 * @param {any} building
 */
export function getBuildingRiskLevel(building) {
  const { on_site, grade, dist_m } = building;

  // Grade I
  if (grade === 'I') {
    if (on_site) return RISK_LEVELS.SHOWSTOPPER;
    if (dist_m <= 100) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (dist_m <= 500) return RISK_LEVELS.HIGH_RISK;
    if (dist_m <= 1000) return RISK_LEVELS.MEDIUM_HIGH_RISK;
    if (dist_m <= 5000) return RISK_LEVELS.MEDIUM_RISK;
    return RISK_LEVELS.LOW_RISK;
  }

  // Grade II*
  if (grade === 'II*') {
    if (on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (dist_m <= 100) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (dist_m <= 500) return RISK_LEVELS.HIGH_RISK;
    if (dist_m <= 5000) return RISK_LEVELS.MEDIUM_RISK;
    return RISK_LEVELS.LOW_RISK;
  }

  // Grade II
  if (grade === 'II') {
    if (on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (dist_m <= 100) return RISK_LEVELS.HIGH_RISK;
    if (dist_m <= 250) return RISK_LEVELS.MEDIUM_RISK;
    if (dist_m <= 5000) return RISK_LEVELS.MEDIUM_LOW_RISK;
    return RISK_LEVELS.LOW_RISK;
  }

  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for a conservation area based on its properties
 * Mirrors the logic from backend/src/rules/heritage/conservationAreasRulesRich.js
 * @param {any} area
 */
export function getConservationAreaRiskLevel(area) {
  if (area.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (area.within_250m) return RISK_LEVELS.HIGH_RISK;
  if (area.within_1km) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for scheduled monuments based on its properties
 * Mirrors the logic from backend/src/rules/heritage/ScheduledMonumentsRulesRich.js
 * @param {any} monument
 */
export function getScheduledMonumentRiskLevel(monument) {
  if (monument.on_site) return RISK_LEVELS.HIGH_RISK;
  if (monument.within_50m) return RISK_LEVELS.HIGH_RISK;
  if (monument.within_100m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (monument.within_250m) return RISK_LEVELS.MEDIUM_RISK;
  if (monument.within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (monument.within_1km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (monument.within_3km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (monument.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for Green Belt based on its properties
 * Mirrors the logic from backend/src/rules/landscape/greenBeltRulesRich.js
 * @param {any} greenBelt
 */
export function getGreenBeltRiskLevel(greenBelt) {
  if (greenBelt.on_site) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (greenBelt.within_1km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for AONB based on its properties
 * Mirrors the logic from backend/src/rules/landscape/aonbRulesRich.js
 * @param {any} aonb
 */
export function getAONBRiskLevel(aonb) {
  if (aonb.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (aonb.within_50m) return RISK_LEVELS.HIGH_RISK;
  if (aonb.within_100m) return RISK_LEVELS.HIGH_RISK;
  if (aonb.within_250m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (aonb.within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (aonb.within_1km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (aonb.within_3km) return RISK_LEVELS.LOW_RISK;
  if (aonb.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for National Parks based on its properties
 * Mirrors the logic from backend/src/rules/landscape/nationalParksRulesRich.js
 * @param {any} nationalPark
 */
export function getNationalParksRiskLevel(nationalPark) {
  if (nationalPark.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (nationalPark.within_50m) return RISK_LEVELS.HIGH_RISK;
  if (nationalPark.within_100m) return RISK_LEVELS.HIGH_RISK;
  if (nationalPark.within_250m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (nationalPark.within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (nationalPark.within_1km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (nationalPark.within_3km) return RISK_LEVELS.LOW_RISK;
  if (nationalPark.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for Registered Parks and Gardens based on its properties
 * Mirrors the logic from backend/src/rules/heritage/registeredParksGardensRulesRich.js
 * @param {any} parkGarden
 */
export function getRegisteredParksGardensRiskLevel(parkGarden) {
  if (parkGarden.on_site) return RISK_LEVELS.SHOWSTOPPER;
  if (parkGarden.within_50m) return RISK_LEVELS.HIGH_RISK;
  if (parkGarden.within_100m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (parkGarden.within_250m) return RISK_LEVELS.MEDIUM_RISK;
  if (parkGarden.within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (parkGarden.within_1km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (parkGarden.within_3km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (parkGarden.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for World Heritage Sites based on its properties
 * Mirrors the logic from backend/src/rules/heritage/worldHeritageSitesRulesRich.js
 * @param {any} worldHeritageSite
 */
export function getWorldHeritageSiteRiskLevel(worldHeritageSite) {
  if (worldHeritageSite.on_site) return RISK_LEVELS.SHOWSTOPPER;
  if (worldHeritageSite.within_50m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (worldHeritageSite.within_100m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (worldHeritageSite.within_250m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (worldHeritageSite.within_500m) return RISK_LEVELS.HIGH_RISK;
  if (worldHeritageSite.within_1km) return RISK_LEVELS.HIGH_RISK;
  if (worldHeritageSite.within_3km) return RISK_LEVELS.MEDIUM_RISK;
  if (worldHeritageSite.within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for SSSI based on its properties
 * Mirrors the logic from backend/src/rules/ecology/sssiRulesRich.js
 * @param {any} sssi
 */
export function getSSSIRiskLevel(sssi) {
  if (sssi.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (sssi.within_50m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (sssi.within_100m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (sssi.within_250m) return RISK_LEVELS.HIGH_RISK;
  if (sssi.within_500m) return RISK_LEVELS.HIGH_RISK;
  if (sssi.within_1km) return RISK_LEVELS.MEDIUM_RISK;
  if (sssi.within_3km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (sssi.within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Determine risk level for renewables based on development status and proximity
 * Mirrors the logic from backend/src/rules/renewables/renewablesRulesRich.js
 * @param {any} renewable
 */
export function getRenewablesRiskLevel(renewable) {
  const {
    development_status_short: status,
    on_site, within_50m, within_100m, within_250m,
    within_500m, within_1km, within_3km, within_5km
  } = renewable;

  // Mirror the exact logic from backend renewablesRulesRich.js lines 82-127
  if (status === 'Appeal Refused' || status === 'Application Refused') {
    if (within_5km) return RISK_LEVELS.LOW_RISK;
  } else if (status === 'Application Submitted' || status === 'Awaiting Construction' || status === 'Revised') {
    if (on_site || within_50m || within_100m || within_250m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (within_500m || within_1km) return RISK_LEVELS.HIGH_RISK;
    if (within_3km) return RISK_LEVELS.MEDIUM_RISK;
    if (within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  } else if (status === 'Under Construction' || status === 'Operational') {
    if (on_site || within_50m || within_100m || within_250m) return RISK_LEVELS.SHOWSTOPPER;
    if (within_500m || within_1km) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (within_3km) return RISK_LEVELS.MEDIUM_HIGH_RISK;
    if (within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  }

  return RISK_LEVELS.LOW_RISK; // Default fallback
}

/**
 * Get risk level for National Nature Reserves
 * @param {any} nnr
 */
export function getNationalNatureReservesRiskLevel(nnr) {
  const { on_site, within_50m, within_100m, within_250m, within_500m, within_1km } = nnr;
  
  if (on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (within_50m || within_100m) return RISK_LEVELS.HIGH_RISK;
  if (within_250m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (within_1km) return RISK_LEVELS.LOW_RISK;
  
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Get risk level for Ancient Woodland
 * Mirrors the logic from backend/src/rules/trees/ancientWoodlandRulesRich.js
 * @param {any} ancientWoodland
 */
export function getAncientWoodlandRiskLevel(ancientWoodland) {
  if (ancientWoodland.on_site) return RISK_LEVELS.HIGH_RISK;
  if (ancientWoodland.within_50m) return RISK_LEVELS.MEDIUM_RISK;
  if (ancientWoodland.within_500m) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Get risk level for UK Airports
 * Mirrors the logic from backend/src/rules/airfields/ukAirportsRulesRich.js
 * @param {any} airport
 */
export function getUkAirportsRiskLevel(airport) {
  if (airport.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (airport.within_500m) return RISK_LEVELS.HIGH_RISK;
  if (airport.within_5km) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (airport.within_10km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Get risk level for Special Protection Areas (SPA)
 * Uses same risk levels as Ramsar (Habitats sites)
 * @param {any} spa
 */
export function getSPARiskLevel(spa) {
  if (spa.on_site) return RISK_LEVELS.SHOWSTOPPER;
  if (spa.within_50m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (spa.within_100m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (spa.within_250m) return RISK_LEVELS.HIGH_RISK;
  if (spa.within_500m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (spa.within_1km) return RISK_LEVELS.MEDIUM_RISK;
  if (spa.within_3km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (spa.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Get risk level for Special Areas of Conservation (SAC)
 * Uses same risk levels as Ramsar (Habitats sites)
 * @param {any} sac
 */
export function getSACRiskLevel(sac) {
  if (sac.on_site) return RISK_LEVELS.SHOWSTOPPER;
  if (sac.within_50m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (sac.within_100m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (sac.within_250m) return RISK_LEVELS.HIGH_RISK;
  if (sac.within_500m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (sac.within_1km) return RISK_LEVELS.MEDIUM_RISK;
  if (sac.within_3km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (sac.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Get risk level for Drinking Water Protected Areas
 * Risk based on total percentage coverage across all drinking water layers
 * @param {any[]} drinkingWaterAreas - Array of all drinking water areas
 */
export function getDrinkingWaterRiskLevel(drinkingWaterAreas) {
  if (!drinkingWaterAreas || drinkingWaterAreas.length === 0) return RISK_LEVELS.LOW_RISK;

  // Calculate total coverage
  const totalCoverage = drinkingWaterAreas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);
  const cappedCoverage = Math.min(totalCoverage, 100);

  if (cappedCoverage >= 80) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (cappedCoverage >= 40) return RISK_LEVELS.MEDIUM_RISK;
  return RISK_LEVELS.LOW_RISK;
}

/**
 * Check if a feature should be visible based on current risk filters
 * @param {string} riskLevel
 * @param {Record<string, boolean>} riskFilters
 */
export function isRiskLevelVisible(riskLevel, riskFilters) {
  return riskFilters[riskLevel] === true;
}