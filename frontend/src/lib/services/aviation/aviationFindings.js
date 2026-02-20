/**
 * Aviation findings text generator (frontend-only, no backend analysis)
 *
 * Source of truth for all text: backend/src/rules/recommendations.js → aviation section
 * Discipline-level text: backend/src/rules/recommendations.js → disciplines.aviation
 * This file mirrors that text for frontend use since there is no backend API call for aviation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TEXT (mirrored from recommendations.js)
// ─────────────────────────────────────────────────────────────────────────────

const AVIATION_TEXT = {
  // Discipline-level recommendations (mirrored from recommendations.js → disciplines.aviation)
  discipline: {
    anyTrigger: `National Planning Policy Guidance on Renewable and low carbon energy requires LPAs to consider the effect on solar proposals on glint and glare and aircraft safety.

Glint (a momentary flash of bright light) and glare (a sustained reflection) have the potential to affect air traffic control operations and pilot visibility, particularly in relation to control towers, approach paths, and visual circuits. Where a site falls within an aerodrome's consultation distance, a proportionate glint and glare assessment is typically expected to demonstrate whether reflective effects could be distracting or hazardous to aviation operations.

Where a solar development is located within the safeguarding consultation zone of an aerodrome, heliport, or other aviation receptor, potential glint and glare effects are a recognised planning consideration. National aviation guidance emphasises the importance of early engagement with aerodrome safeguarding authorities to identify relevant receptors and agree an appropriate assessment approach.

A robust assessment is usually geometry-based and considers panel layout and orientation, aviation receptors, solar position, and the duration and intensity of any predicted reflections.

Mitigation, where required, is typically design-led and may include adjustments to panel tilt or orientation, or other layout refinements to eliminate or reduce reflective effects.`,

    noTrigger: `National Planning Policy Guidance on Renewable and low carbon energy requires LPAs to consider the effect on solar proposals on glint and glare and aircraft safety.

Upon initial review, it does not appear that any aerodromes, heliports, or other aviation receptors are present within relevant safeguarding consultation distances. In these circumstances, no glint and glare assessment is normally required, and planning risk associated with aviation effects is considered low. However, as UK-wide airfield datasets are not fully comprehensive, further review would be necessary to confirm this position.`
  },

  // Buffer-distance fragments (just count + distance, no intro/outro)
  buffers: {
    within500m: 'COUNT aerodrome(s) within 500m of the site',
    within500mTo1km: 'COUNT aerodrome(s) within 500m–1km of the site',
    within1to5km: 'COUNT aerodrome(s) within 1–5km of the site'
  },

  // Wrapper intro/outro for buffer findings
  intro: 'From initial assessment, it appears that',
  outro: 'Further review would be needed to confirm operational status, flight paths, and safeguarding requirements.',

  // Fallback when no aerodromes found
  noneWithin5km: 'From initial assessment, no certified, licensed, or safeguarded aerodromes have been identified within 5km of the site. Further review would be needed to confirm this is the case.',

  // Consultation text per buffer group (appended after the combined intro sentence)
  consultation: {
    within5km: 'Consultation with the relevant aerodrome(s) will be required, and a glint and glare assessment should be undertaken to assess potential impacts on aviation operations. Note that some aerodromes may request consultation for developments up to 30km away, depending on their safeguarding requirements.'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RISK CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Risk hierarchy (closest band with count > 0 determines risk):
 *   within 500m       → extremely_high_risk
 *   500m – 1km        → high_risk
 *   1 – 5km           → medium_risk
 *   none within 5km   → null (no risk)
 *
 * @param {{ within500m: string, within500mTo1km: string, within1to5km: string }} counts
 * @returns {string|null}
 */
export function calculateAviationRisk(counts) {
  const bands = [
    { key: 'within500m', risk: 'extremely_high_risk' },
    { key: 'within500mTo1km', risk: 'high_risk' },
    { key: 'within1to5km', risk: 'medium_risk' }
  ];

  for (const band of bands) {
    const val = parseInt(counts[band.key], 10);
    if (val > 0) return band.risk;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate aviation findings paragraphs from form inputs.
 * Builds a single intro sentence listing all buffer bands, then consultation
 * text per group, then the outro and discipline-level recommendation.
 *
 * @param {{ within500m: string, within500mTo1km: string, within1to5km: string }} counts
 * @returns {string[]} Array of paragraph strings
 */
export function generateAviationFindings(counts) {
  const paragraphs = [];

  // Collect fragments for each band that has a count > 0
  const bands = [
    { key: 'within500m', group: 'within5km' },
    { key: 'within500mTo1km', group: 'within5km' },
    { key: 'within1to5km', group: 'within5km' }
  ];

  const fragments = [];
  const activeGroups = new Set();

  for (const band of bands) {
    const val = parseInt(counts[band.key], 10) || 0;
    if (val > 0) {
      fragments.push(AVIATION_TEXT.buffers[band.key].replace('COUNT', String(val)));
      activeGroups.add(band.group);
    }
  }

  const hasAny = fragments.length > 0;

  if (hasAny) {
    // Join fragments: "2 aerodrome(s) within 500m of the site and 1 aerodrome(s) within 1–5km of the site"
    let joined;
    if (fragments.length === 1) {
      joined = fragments[0];
    } else {
      joined = fragments.slice(0, -1).join(', ') + ' and ' + fragments[fragments.length - 1];
    }

    // Intro sentence with all bands
    paragraphs.push(`${AVIATION_TEXT.intro} ${joined}.`);

    // Consultation text
    if (activeGroups.has('within5km')) {
      paragraphs.push(AVIATION_TEXT.consultation.within5km);
    }

    // Outro
    paragraphs.push(AVIATION_TEXT.outro);
  } else {
    // No aerodromes
    paragraphs.push(AVIATION_TEXT.noneWithin5km);
  }

  // Discipline-level recommendation
  paragraphs.push(hasAny ? AVIATION_TEXT.discipline.anyTrigger : AVIATION_TEXT.discipline.noTrigger);

  return paragraphs;
}
