/**
 * Flood findings text generator (frontend-only, no backend analysis)
 *
 * Source of truth for all text: backend/src/rules/recommendations.js → flood section
 * This file mirrors that text for frontend use since there is no backend API call for flood.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TEXT (mirrored from recommendations.js)
// ─────────────────────────────────────────────────────────────────────────────

const FLOOD_TEXT = {
  zoneCoverage: {
    full: 'The entirety of the site is within Flood Zone ZONE.',
    partial: 'Approximately PERCENT% of the site is within Flood Zone ZONE.',
    none: 'No part of the site is identified as being within Flood Zone ZONE.',
    unknown: 'Part of the site is within Flood Zone ZONE.'
  },

  fra: {
    zone2or3_over1ha: 'Given the site area exceeds 1 hectare and the site is located within Flood Zone ZONES, a site-specific Flood Risk Assessment (FRA) will be required to demonstrate that the proposed development will be safe and will not increase flood risk elsewhere.',
    zone2or3_notOver1ha: 'As the site is located within Flood Zone ZONES, a site-specific Flood Risk Assessment (FRA) may be required (subject to the vulnerability classification of the development and local policy) to demonstrate safety and that flood risk is not increased elsewhere.',
    noZone2or3_over1ha: 'As the site area exceeds 1 hectare, a site-specific Flood Risk Assessment (FRA) is likely to be required to demonstrate that the proposed development will be safe for its lifetime and will not increase flood risk elsewhere.',
    noZone2or3_notOver1ha: 'As the site area is 1 hectare or less, the need for a site-specific Flood Risk Assessment (FRA) will depend on the vulnerability of the proposed development, the identified flood risk, and local planning policy requirements.'
  },

  designAndSiting: 'Design and siting measures may help to reduce flood risk and improve resilience. Where possible, flood-vulnerable or critical infrastructure (for example, inverters, transformers, switchgear, and control equipment) should be located outside areas at risk of flooding, or set at an appropriate finished floor/installation level. Access routes should also be considered to ensure safe access for operation and maintenance during flood events.',

  surfaceWater: 'Sections of the site are identified as being at risk of surface water flooding.',
  surfaceWaterClimateCheck: '[CHECK: Review the risk of surface water flooding from climate change as well, note if any noticeable change]'
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate flood findings paragraphs from form inputs.
 * @param {{ zone1: boolean, zone2: boolean, zone3: boolean }} zones
 * @param {{ zone1: string, zone2: string, zone3: string }} coverage
 * @param {string} over1ha - 'yes' | 'no' | ''
 * @param {string} surfaceWater - 'yes' | 'no' | ''
 * @returns {string[]} Array of paragraph strings
 */
export function generateFloodFindings(zones, coverage, over1ha, surfaceWater) {
  const paragraphs = [];

  // 1) Flood zone coverage statements (Zone 3 first, then 2, then 1)
  const zoneEntries = [
    { checked: zones.zone3, pct: coverage.zone3, label: '3' },
    { checked: zones.zone2, pct: coverage.zone2, label: '2' },
    { checked: zones.zone1, pct: coverage.zone1, label: '1' }
  ];

  for (const z of zoneEntries) {
    if (!z.checked) continue;
    const raw = z.pct ? z.pct.trim() : '';
    const pct = raw !== '' ? parseInt(raw, 10) : null;
    if (pct !== null && pct >= 100) {
      paragraphs.push(FLOOD_TEXT.zoneCoverage.full.replace('ZONE', z.label));
    } else if (pct !== null && pct > 0) {
      paragraphs.push(
        FLOOD_TEXT.zoneCoverage.partial
          .replace('PERCENT', String(pct))
          .replace('ZONE', z.label)
      );
    } else if (pct === 0) {
      paragraphs.push(FLOOD_TEXT.zoneCoverage.none.replace('ZONE', z.label));
    } else {
      // No coverage entered — zone is checked but % left blank
      paragraphs.push(FLOOD_TEXT.zoneCoverage.unknown.replace('ZONE', z.label));
    }
  }

  // 2) FRA requirement statement (most specific match)
  const hasZone2or3 = zones.zone2 || zones.zone3;
  const zonesPresent = [
    zones.zone2 ? '2' : null,
    zones.zone3 ? '3' : null
  ].filter(Boolean);
  const zonesLabel = zonesPresent.join(' and ');

  if (hasZone2or3 && over1ha === 'yes') {
    paragraphs.push(FLOOD_TEXT.fra.zone2or3_over1ha.replace('ZONES', zonesLabel));
  } else if (hasZone2or3 && over1ha === 'no') {
    paragraphs.push(FLOOD_TEXT.fra.zone2or3_notOver1ha.replace('ZONES', zonesLabel));
  } else if (over1ha === 'yes') {
    paragraphs.push(FLOOD_TEXT.fra.noZone2or3_over1ha);
  } else if (over1ha === 'no') {
    paragraphs.push(FLOOD_TEXT.fra.noZone2or3_notOver1ha);
  }

  // 3) Design and siting mitigation (if zone 2, 3, or surface water present)
  if (zones.zone2 || zones.zone3 || surfaceWater === 'yes') {
    paragraphs.push(FLOOD_TEXT.designAndSiting);
  }

  // 4) Surface water flooding
  if (surfaceWater === 'yes') {
    paragraphs.push(FLOOD_TEXT.surfaceWater);
  }

  // 5) Climate change check (always shown once surface water question is answered)
  if (surfaceWater === 'yes' || surfaceWater === 'no') {
    paragraphs.push(FLOOD_TEXT.surfaceWaterClimateCheck);
  }

  return paragraphs;
}
