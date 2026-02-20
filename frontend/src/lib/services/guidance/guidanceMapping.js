/**
 * Frontend guidance mapping - maps discipline names to their guidance content
 * Guidance text is imported from the backend guidance.js file
 */

import {
  PLANNING_POLICY_GUIDANCE,
  LANDSCAPE_GUIDANCE,
  HERITAGE_GUIDANCE,
  AGRICULTURAL_LAND_GUIDANCE,
  FLOOD_GUIDANCE,
  ECOLOGY_GUIDANCE,
  TRANSPORT_GUIDANCE,
  AVIATION_GUIDANCE,
  NOISE_GUIDANCE,
  CONTAMINATED_LAND_GUIDANCE,
  TREES_GUIDANCE,
  BESS_GUIDANCE,
  SUMMARY_GUIDANCE
} from '../../../../../backend/src/rules/guidance.js';

/**
 * Mapping of discipline names to their guidance content
 * Each entry can have multiple sections that will be displayed in the modal
 */
export const DISCIPLINE_GUIDANCE = {
  'Heritage': {
    title: 'Heritage Guidance',
    sections: [
      { heading: 'Archaeology and Heritage', content: HERITAGE_GUIDANCE.general }
    ]
  },

  'Landscape': {
    title: 'Landscape Guidance',
    sections: [
      { heading: 'Landscape and Visual Effects', content: LANDSCAPE_GUIDANCE.general },
      { heading: 'Green Belt Sites', content: LANDSCAPE_GUIDANCE.greenBelt }
    ]
  },

  'Renewables Development': {
    title: 'Renewables Development Guidance',
    sections: [
      { heading: 'Nearby Applications', content: PLANNING_POLICY_GUIDANCE.nearbyApplications }
    ]
  },

  'Ecology': {
    title: 'Ecology Guidance',
    sections: [
      { heading: 'Ecology', content: ECOLOGY_GUIDANCE.general }
    ]
  },

  'Agricultural Land': {
    title: 'Agricultural Land Guidance',
    sections: [
      { heading: 'Agricultural Land Grade', content: AGRICULTURAL_LAND_GUIDANCE.general }
    ]
  },

  'Ancient Woodland': {
    title: 'Trees & Woodland Guidance',
    sections: [
      { heading: 'Trees', content: TREES_GUIDANCE.general }
    ]
  },

  'Other': {
    title: 'Drinking Water Guidance',
    sections: [
      { heading: 'Protection of Drinking Water Supply', content: ECOLOGY_GUIDANCE.drinkingWater }
    ]
  },

  'Flood': {
    title: 'Flood Risk Guidance',
    sections: [
      { heading: 'Flood Risk and Drainage', content: FLOOD_GUIDANCE.general }
    ]
  },

  'Aviation': {
    title: 'Aviation Guidance',
    sections: [
      { heading: 'Glint and Glare', content: AVIATION_GUIDANCE.general }
    ]
  },

  'Highways': {
    title: 'Highways Guidance',
    sections: [
      { heading: 'Transport and Construction Traffic', content: TRANSPORT_GUIDANCE.general }
    ]
  },

  'Amenity': {
    title: 'Amenity Guidance',
    sections: [
      { heading: 'Noise', content: NOISE_GUIDANCE.general }
    ]
  },

  'Airfields': {
    title: 'Airfields Guidance',
    sections: [
      { heading: 'Glint and Glare', content: AVIATION_GUIDANCE.general }
    ]
  }
};

/**
 * General guidance for the Summary section
 * Contains guidance that doesn't fit into specific disciplines
 */
export const SUMMARY_GENERAL_GUIDANCE = {
  title: 'General Guidance',
  sections: [
    { heading: 'Writing the Final Summary', content: SUMMARY_GUIDANCE.finalSummary },
    { heading: 'Planning Policy', content: PLANNING_POLICY_GUIDANCE.general },
    { heading: 'Survey Requirements Reference', content: SUMMARY_GUIDANCE.surveysReference },
    { heading: 'Extras / If Applicable', content: `BESS Sites:\n\n${BESS_GUIDANCE.general}\n\nContaminated Land:\n\n${CONTAMINATED_LAND_GUIDANCE.general}` }
  ]
};

/**
 * Get guidance for a specific discipline
 * @param {string} disciplineName - The name of the discipline
 * @returns {Object|null} The guidance object or null if not found
 */
export function getGuidanceForDiscipline(disciplineName) {
  return DISCIPLINE_GUIDANCE[disciplineName] || null;
}
