/**
 * Central recommendations file for all disciplines and designations
 * This is the single source of truth for all recommendation text
 */

export const RECOMMENDATIONS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DISCIPLINE-LEVEL RECOMMENDATIONS
  // These are triggered once per discipline based on whether any designations triggered
  // ═══════════════════════════════════════════════════════════════════════════

  disciplines: {
    heritage: {
      anyTrigger: `Where any heritage designation is present, national planning policy requires applicants to describe the significance of affected heritage assets, including any contribution made by their setting, with a level of detail proportionate to the asset's importance and sufficient to understand the potential impact of the proposal (NPPF para. 207). This applies to both designated and non-designated heritage assets.

Early heritage input is recommended to inform understanding of significance, the role of setting, and opportunities for design-led mitigation.

A Heritage Statement or Heritage Impact Assessment will be required to support a planning application, proportionate to the sensitivity of the asset(s) and the likely level of effect. Where setting is a key consideration, more focused assessment of visual and spatial relationships is likely to be required.

Mitigation may involve screening in the form of vegetation planning as well as changes to siting, layout, or scale to avoid adverse effects on setting, key views, and the wider historic context. A desk-based archaeological survey will also be required at a minimum to understand the potential for artefacts located beneath the site. Further survey work, including a geophysical survey and trial trenching are a likely requirement prior to determination. `

,

      noTrigger: `No heritage constraints are currently apparent from this high-level review. However, input from a heritage specialist is still highly recommended given the potential for previously unidentified assets or archaeological interest. A proportionate review or Heritage Statement may still be required to confirm baseline conditions and inform site design. A desk-based archaeological survey will also be required at a minimum to understand the potential for artefacts located beneath the site. Further survey work, including a geophysical survey and trial trenching are a likely requirement prior to determination.`
    },

    landscape: {
      anyTrigger: `National planning policy requires development to be sympathetic to local character and history, including the surrounding built environment and landscape setting (NPPF para. 135(c)). Where landscape sensitivity or visual receptors are present, landscape and visual effects are a key planning consideration.

Engagement with a landscape specialist is recommended at an early stage to inform site layout, scale, and mitigation design. Where significant landscape or visual effects are likely, a Landscape and Visual Impact Assessment will be required to demonstrate how the proposal responds to landscape character and visual sensitivity. Depending on scale, context, and the presence of other schemes, further visual analysis or cumulative assessment may also be necessary.`,

      noTrigger: `Whilst no landscape designation triggers have been identified in this initial high-level review, national planning policy requires development to be sympathetic to local character and history, including the surrounding built environment and landscape setting (NPPF para. 135(c)). Where landscape sensitivity or visual receptors are present, landscape and visual effects are a key planning consideration.

Engagement with a landscape specialist is recommended at an early stage to inform site layout, scale, and mitigation design. Where significant landscape or visual effects are likely, a Landscape and Visual Impact Assessment will be required to demonstrate how the proposal responds to landscape character and visual sensitivity. Depending on scale, context, and the presence of other schemes, further visual analysis or cumulative assessment may also be necessary.`
    },

    ecology: {
      anyTrigger: `National planning policy requires planning decisions to protect and enhance biodiversity and apply the mitigation hierarchy.

Where ecological constraints are identified, early engagement with an ecologist is recommended to establish baseline conditions and inform survey requirements. A Preliminary Ecological Appraisal and Biodiversity Net Gain baseline assessment will be required to identify habitats, constraints, and the need for further surveys. Where suitable habitat or evidence of protected species is present, species-specific surveys are likely to be required. For schemes with the potential to give rise to significant ecological effects, an Ecological Impact Assessment may be necessary.

Survey timing and seasonal constraints should also be considered, as these can influence project programming. Where habitats sites are present, ecological assessment is typically coordinated alongside the Habitats Regulations Assessment process, with scope and content aligned to avoid duplication. All developments in England are required to demonstrate a minimum of 10% uplift in terms of onsite habitats as part of the Biodiversity Regulations 2024.`,

      noTrigger: `No specific ecological constraints have been identified through initial screening. However, there is only so much that can be learned from desk-based ecology work. 

Early engagement with a qualified ecologist will be essential to establish baseline conditions and inform survey requirements. 

A Preliminary Ecological Appraisal and Biodiversity Net Gain baseline assessment will be required to identify habitats, constraints, and the need for further surveys. Where suitable habitat or evidence of protected species is present, species-specific surveys are likely to be required. For schemes with the potential to give rise to significant ecological effects, an Ecological Impact Assessment may be necessary.

Survey timing and seasonal constraints should also be considered, as these can influence project programming. Where habitats sites are present, ecological assessment is typically coordinated alongside the Habitats Regulations Assessment process, with scope and content aligned to avoid duplication. All developments in England are required to demonstrate a minimum of 10% uplift in terms of onsite habitats as part of the Biodiversity Regulations 2024.`
    },

    trees: {
      // Trees uses designation-specific recommendations only (Ancient Woodland)
      anyTrigger: null,
      noTrigger: null
    },

    aviation: {
      anyTrigger: `National Planning Policy Guidance on Renewable and low carbon energy requires LPAs to consider the effect on solar proposals on glint and glare and aircraft safety.

Glint (a momentary flash of bright light) and glare (a sustained reflection) have the potential to affect air traffic control operations and pilot visibility, particularly in relation to control towers, approach paths, and visual circuits. Where a site falls within an aerodrome’s consultation distance, a proportionate glint and glare assessment is typically expected to demonstrate whether reflective effects could be distracting or hazardous to aviation operations.

Where a solar development is located within the safeguarding consultation zone of an aerodrome, heliport, or other aviation receptor, potential glint and glare effects are a recognised planning consideration. National aviation guidance emphasises the importance of early engagement with aerodrome safeguarding authorities to identify relevant receptors and agree an appropriate assessment approach.
  
A robust assessment is usually geometry-based and considers panel layout and orientation, aviation receptors, solar position, and the duration and intensity of any predicted reflections. 
 
Mitigation, where required, is typically design-led and may include adjustments to panel tilt or orientation, or other layout refinements to eliminate or reduce reflective effects.
`,

      noTrigger: `National Planning Policy Guidance on Renewable and low carbon energy requires LPAs to consider the effect on solar proposals on glint and glare and aircraft safety.

Upon initial review, it does not appear that any aerodromes, heliports, or other aviation receptors are present within relevant safeguarding consultation distances. In these circumstances, no glint and glare assessment is normally required, and planning risk associated with aviation effects is considered low. However, as UK-wide airfield datasets are not fully comprehensive, further review would be necessary to confirm this position.`
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DESIGNATION-LEVEL RECOMMENDATIONS
  // These explain how individual designations elevate planning sensitivity
  // Each has: intro (always shown), mediumOrAbove, mediumLowOrBelow
  // ═══════════════════════════════════════════════════════════════════════════

  designations: {
    // ─────────────────────────────────────────────────────────────────────────
    // HERITAGE DESIGNATIONS
    // ─────────────────────────────────────────────────────────────────────────

    gradeIAndIIStar: {
      intro: `Grade I or Grade II* listed buildings are heritage assets of the highest significance, and their setting is a key planning consideration. National policy states that any harm to the significance of a designated heritage asset, including from development within its setting, requires clear and convincing justification, and that substantial harm to assets of the highest significance should be 'wholly exceptional' (NPPF para. 213).`,

      mediumOrAbove: `Given the presence of these assets in close proximity to the site, planning sensitivity is very high. 

This significantly increases the risk that the scale, layout, height, or visibility of the proposal could be considered harmful to significance.`,

      mediumLowOrBelow: `As there is a level of separation between the site and the listed building(s), planning risk may be reduced but remains elevated relative to lower-grade assets. Long-distance views, landscape context, and cumulative effects may still be relevant depending on topography and scheme scale.`
    },

    gradeII: {
      intro: `Grade II listed building - national policy states that any harm to the significance of a designated heritage asset, including from development within its setting, requires clear and convincing justification.`,

      mediumOrAbove: `Given the presence of a Grade II listed building in close proximity to the site, impacts upon it's setting which may arise from the proposed development will be a key planning consideration.`,

      mediumLowOrBelow: `Distance between the site and the Grade II listed building does lower the level of planning risk, although long-distance views, landscape context, and cumulative effects may still be relevant depending on topography and scheme scale.`
    },

    conservationAreas: {
      intro: `With regards to the Conservation area - national policy seeks to preserve or enhance Conservation areas and their setting.`,

      mediumOrAbove: `Given the site's proximity to the CA, care should be taken to limit adverse impacts on its setting.`,

      mediumLowOrBelow: `With increased distance, planning risk is typically reduced, with effects usually limited to long-range views or cumulative visual effects.`
    },

    scheduledMonuments: {
      intro: `Scheduled Monuments are designated assets of the highest significance and are subject to the highest level of policy protection. National policy indicates that causing substantial harm to such assets should only be when 'wholly exceptional' (NPPF para. 213).`,

      mediumOrAbove: ``,

      mediumLowOrBelow: `The relatively large distance to the nearest Scheduled Monument is beneficial, although setting and cumulative landscape effects may remain relevant for larger schemes.`
    },

    worldHeritageSites: {
      intro: `World Heritage Sites and their settings are subject to the most stringent policy protection. Development must conserve the attributes that convey Outstanding Universal Value, and substantial harm should be wholly exceptional (NPPF para. 213).`,

      mediumOrAbove: ``,

      mediumLowOrBelow: `Where development is more distant, risk is reduced but may still arise where large-scale proposals affect key views or attributes contributing to Outstanding Universal Value.`
    },

    registeredParksGardensBattlefields: {
      intro: null,

      mediumOrAbove: `Registered Parks and Gardens/Battlefields - As stated in the NPPF, these designations are a material consideration in planning decisions, with LPAs being required to give great weight to the conservation of registered battlefields. Any proposed harm to a Registered Battlefield or Park and Garden requires 'clear and convincing justification', and substantial harm should be 'wholly exceptional'. This may represent a significant planning risk.`,

      mediumLowOrBelow: `Registered Parks and Gardens/Battlefields - As stated in the NPPF, these designations are a material consideration in planning decisions, with LPAs being required to give great weight to the conservation of registered battlefields. Any proposed harm to a Registered Battlefield or Park and Garden requires 'clear and convincing justification', and substantial harm should be 'wholly exceptional'. This may represent a significant planning risk.`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LANDSCAPE DESIGNATIONS
    // ─────────────────────────────────────────────────────────────────────────

    greenBelt: {
      intro: null,

      mediumOrAbove: `Inappropriate development (such as renewables development) is considered harmful to the Green Belt and will only be approved in very special circumstances (VSCs)(NPPF para. 153). Substantial weight is given to any harm to the Green Belt's five purposes. Planning risk, with regards to Green Belt, relates both to the principle of development and to its spatial and visual effects. A robust case of VSCs will need to be made in order to justify development.`,

      mediumLowOrBelow: `Where development is outside but close to the Green Belt, risk is generally lower and relates primarily to effects on openness or the perception of sprawl.`
    },

    aonbNationalParks: {
      intro: null,

      mediumOrAbove: `AONB/National Park - renewable energy development within or affecting nationally designated landscapes carries significant sensitivity. Great weight is given to conserving and enhancing landscape and scenic beauty in National Parks and National Landscapes (NPPF para. 189).`,

      mediumLowOrBelow: `AONB/National Park - renewable energy development within or affecting nationally designated landscapes carries significant sensitivity. Great weight is given to conserving and enhancing landscape and scenic beauty in National Parks and National Landscapes (NPPF para. 189). Given the distance here, planning risk is typically lower, although visibility and cumulative effects may still be relevant for larger schemes.`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ECOLOGICAL DESIGNATIONS
    // ─────────────────────────────────────────────────────────────────────────

    sssi: {
      intro: null,

      mediumOrAbove: `Development likely to have an adverse effect on an SSSI, either alone or in combination, should not normally be permitted unless the benefits of the proposal clearly outweigh both the impact on the site's special scientific interest and broader impacts on the national SSSI network (NPPF para. 193(b)).

Note: This analysis has identified SSSIs based on centroid point location only. Further review is recommended to confirm whether the SSSI boundary actually overlaps with or adjoins the site.`,

      mediumLowOrBelow: `Given the distance between the SSSI and the site, the planning risk is typically lower, although indirect effects may still require consideration given the site's location within the 5km SSSI buffer zone.

Note: This analysis has identified SSSIs based on centroid point location only. Further review is recommended to confirm actual distances to the SSSI boundary.`
    },

    ramsar: {
      intro: null,

      mediumOrAbove: `Habitats sites such as SPA, SAC and Ramsar sites are afforded the highest level of protection under national policy (NPPF para. 194). The presumption in favour of sustainable development does not apply where a proposal is likely to have a significant effect on a habitats site, unless an appropriate assessment has concluded that there will be no adverse effect on site integrity, either alone or in combination (NPPF para. 195).

In these circumstances, a Habitats Regulations Assessment is likely to be required.`,

      mediumLowOrBelow: `Habitats sites such as SPA, SAC and Ramsar sites are afforded the highest level of protection under national policy (NPPF para. 194). The presumption in favour of sustainable development does not apply where a proposal is likely to have a significant effect on a habitats site, unless an appropriate assessment has concluded that there will be no adverse effect on site integrity, either alone or in combination (NPPF para. 195).

Given the distance from the site, planning risk is reduced but not eliminated, particularly where functional linkage or cumulative effects may arise.`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // OTHER ENVIRONMENTAL DESIGNATIONS
    // ─────────────────────────────────────────────────────────────────────────

    ancientWoodland: {
      intro: null,

      mediumOrAbove: `Ancient woodland is an irreplaceable habitat. Development resulting in its loss or deterioration should be refused unless there are wholly exceptional reasons and a suitable compensation strategy exists (NPPF para. 193(c)). Risks may arise from direct loss, shading, root damage, hydrological change, or construction disturbance.

Early arboricultural input is recommended to identify constraints and inform site layout. Where trees are present or potentially affected, an Arboricultural Impact Assessment is required.`,

      mediumLowOrBelow: `Ancient woodland is an irreplaceable habitat. Development resulting in its loss or deterioration should be refused unless there are wholly exceptional reasons and a suitable compensation strategy exists (NPPF para. 193(c)). Risks may arise from direct loss, shading, root damage, hydrological change, or construction disturbance.

As the ancient woodland is not directly on site, planning risk is reduced. However, early arboricultural input is still recommended to identify constraints and inform site layout. Where trees are present or potentially affected, an Arboricultural Impact Assessment is required.`
    },

    // ─────────────────────────────────────────────────────────────────────────
    // AIRFIELDS DESIGNATIONS
    // ─────────────────────────────────────────────────────────────────────────

    airfield: {
      intro: null,

      mediumOrAbove: `[PLACEHOLDER - Airfield medium or above risk text]

TODO: Add designation-level recommendation text for when airfield proximity is at medium risk or higher (on-site, within 500m, within 5km).`,

      mediumLowOrBelow: `[PLACEHOLDER - Airfield medium-low or below risk text]

TODO: Add designation-level recommendation text for when airfield proximity is at medium-low risk or lower (within 10km).`
    },

    drinkingWater: {
      intro: null,

      mediumOrAbove: `The site falls within a Drinking Water Protected Area or Safeguard Zone. Development within these areas may require additional assessment to demonstrate that proposals will not adversely affect drinking water quality. Consultation with the Environment Agency is recommended at an early stage to understand any specific requirements or constraints that may apply.`,

      mediumLowOrBelow: `A small portion of the site falls within a Drinking Water Protected Area or Safeguard Zone. Whilst the coverage is limited, consultation with the Environment Agency may still be advisable to confirm whether any specific constraints apply to development in this location.`
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOOD (frontend-only, no backend analysis)
  // Text used by the frontend flood form to generate findings paragraphs.
  // Mirrored in frontend/src/lib/services/flood/floodFindings.js
  // ═══════════════════════════════════════════════════════════════════════════

  flood: {
    // 1) Flood zone coverage statements (templates — replace ZONE and PERCENT)
    zoneCoverage: {
      full: 'The entirety of the site is within Flood Zone ZONE.',
      partial: 'Approximately PERCENT% of the site is within Flood Zone ZONE.',
      none: 'No part of the site is identified as being within Flood Zone ZONE.',
      unknown: 'Part of the site is within Flood Zone ZONE.'
    },

    // 2) FRA requirement statements
    fra: {
      zone2or3_over1ha: 'Given the site area exceeds 1 hectare and the site is located within Flood Zone ZONES, a site-specific Flood Risk Assessment (FRA) will be required to demonstrate that the proposed development will be safe and will not increase flood risk elsewhere.',
      zone2or3_notOver1ha: 'As the site is located within Flood Zone ZONES, a site-specific Flood Risk Assessment (FRA) may be required (subject to the vulnerability classification of the development and local policy) to demonstrate safety and that flood risk is not increased elsewhere.',
      noZone2or3_over1ha: 'As the site area exceeds 1 hectare, a site-specific Flood Risk Assessment (FRA) is likely to be required to demonstrate that the proposed development will be safe for its lifetime and will not increase flood risk elsewhere.',
      noZone2or3_notOver1ha: 'As the site area is 1 hectare or less, the need for a site-specific Flood Risk Assessment (FRA) will depend on the vulnerability of the proposed development, the identified flood risk, and local planning policy requirements.'
    },

    // 3) Design and siting mitigation (shown when zone 2, zone 3, or surface water flooding present)
    designAndSiting: 'Design and siting measures may help to reduce flood risk and improve resilience. Where possible, flood-vulnerable or critical infrastructure (for example, inverters, transformers, switchgear, and control equipment) should be located outside areas at risk of flooding, or set at an appropriate finished floor/installation level. Access routes should also be considered to ensure safe access for operation and maintenance during flood events.',

    // 4) Surface water flooding
    surfaceWater: 'Sections of the site are identified as being at risk of surface water flooding.',
    surfaceWaterClimateCheck: '[CHECK: Review the risk of surface water flooding from climate change as well, note if any noticeable change]'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AVIATION (frontend-only, no backend analysis)
  // Text used by the frontend aviation form to generate findings paragraphs.
  // Mirrored in frontend/src/lib/services/aviation/aviationFindings.js
  // ═══════════════════════════════════════════════════════════════════════════

  aviation: {
    // Buffer-distance fragments (just count + distance, no intro/outro — replace COUNT)
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

    // Consultation text per buffer group
    consultation: {
      within5km: 'Consultation with the relevant aerodrome(s) will be required, and a glint and glare assessment should be undertaken to assess potential impacts on aviation operations. Note that some aerodromes may request consultation for developments up to 30km away, depending on their safeguarding requirements.'
    }
  }
};

/**
 * Helper function to build recommendation text for a designation
 * @param {string} designationKey - Key from RECOMMENDATIONS.designations
 * @param {boolean} isMediumOrAbove - Whether risk level is MEDIUM_RISK or above
 * @returns {string} Combined recommendation text
 */
export function buildDesignationRecommendation(designationKey, isMediumOrAbove) {
  const designation = RECOMMENDATIONS.designations[designationKey];
  if (!designation) return '';

  const parts = [];

  // Add intro if present
  if (designation.intro) {
    parts.push(designation.intro);
  }

  // Add risk-appropriate text
  const riskText = isMediumOrAbove ? designation.mediumOrAbove : designation.mediumLowOrBelow;
  if (riskText) {
    parts.push(riskText);
  }

  return parts.join('\n\n');
}

/**
 * Get discipline recommendation based on trigger state
 * @param {string} disciplineKey - Key from RECOMMENDATIONS.disciplines
 * @param {boolean} hasAnyTrigger - Whether any designations triggered
 * @returns {string|null} Discipline recommendation text
 */
export function getDisciplineRecommendation(disciplineKey, hasAnyTrigger) {
  const discipline = RECOMMENDATIONS.disciplines[disciplineKey];
  if (!discipline) return null;

  return hasAnyTrigger ? discipline.anyTrigger : discipline.noTrigger;
}
