/**
 * Structured meeting guide content.
 * Each section maps to data the system can extract from the resulting transcript.
 * discipline_sections are rendered dynamically based on the project's active issue tracks.
 */

export const BASE_SECTIONS = [
  {
    title: '1. Project Overview',
    feedsLabel: 'Project fields',
    questions: [
      'What is the full name of the project and the site address?',
      'Who is the applicant and who is the SPV (if applicable)?',
      'Which local planning authority?',
      'What is the project type (Solar / Wind / Data Centre / Other)?',
      'What is the current project status — have we been instructed, and on what basis?',
      'Who is the project lead, project manager, and project director on our side?'
    ]
  },
  {
    title: '2. About the Applicant',
    feedsLabel: 'About the Applicant document summary',
    questions: [
      'Tell us about the applicant — who are they, where are they based, and how long have they been operating?',
      'What is their track record — how many schemes have they developed or consented?',
      'Have they worked with this LPA before? Any existing relationship?',
      'Who is our main point of contact and what is their role?',
      'Are there any sensitivities we should know about regarding the client relationship?'
    ]
  },
  {
    title: '3. Proposed Development',
    feedsLabel: 'Proposed Development document summary',
    questions: [
      'What is being proposed — describe the key components (panels, BESS, substations, fencing, tracks)?',
      'What is the total site area (hectares)?',
      'What is the total export capacity (MW)?',
      'What is the BESS capacity (MW / MWh)?',
      'What are the panel specifications — height, clearance from ground, tilt angle, number of panels?',
      'What is the proposed operational lifespan?',
      'What are the headline benefit figures — homes powered, GWh per year, CO₂ offset?',
      'Is there anything unusual or non-standard about the layout or design?'
    ]
  },
  {
    title: '4. Site and Surroundings',
    feedsLabel: 'Site and Surroundings document summary',
    questions: [
      'Describe the site — topography, current land use, field boundaries, vegetation.',
      'What are the site boundaries — roads, watercourses, hedgerows?',
      'Where is the proposed access point and from what road?',
      'Who are the nearest residential receptors and how far away are they?',
      'What settlements are in the surrounding area, and at what distance?',
      'Are there any public rights of way on or near the site?',
      'What statutory or non-statutory designations are on or near the site?',
      'What is the flood zone status of the site?'
    ]
  },
  {
    title: '5. Planning History',
    feedsLabel: 'Planning history',
    questions: [
      'Is there any relevant planning history on the site or immediately adjacent?',
      'Have any similar schemes been refused or appealed nearby?',
      'Has the client attempted this site before with a different scheme?'
    ]
  },
  {
    title: '6. Pre-Application Engagement',
    feedsLabel: 'Pre-app Response document summary',
    questions: [
      'Has pre-application advice been sought from the LPA? If so, when and what was the outcome?',
      'Which issues did the LPA flag as matters requiring detailed assessment?',
      'What was the LPA\'s overall position — supportive in principle, neutral, or opposed?',
      'Is the application likely to go to planning committee? Did the LPA confirm this?',
      'Have any other statutory consultees (Natural England, Historic England, Environment Agency) been engaged pre-submission?',
      'What is the name and contact details of the case officer (if known)?'
    ]
  },
  {
    title: '7. EIA / Scoping',
    feedsLabel: 'EIA Scoping Response document summary',
    questions: [
      'Has an EIA scoping request been submitted? If so, what was the scoping opinion?',
      'Which topics were confirmed as requiring assessment in the Environmental Statement?',
      'Were any topics scoped out, and on what basis?',
      'Were there any unusual or onerous methodological requirements specified by the LPA or statutory consultees?'
    ]
  },
  {
    title: '8. Community Consultation',
    feedsLabel: 'Statement of Community Involvement document summary',
    questions: [
      'Has any pre-application community consultation taken place?',
      'What events or engagement activities were held, and how many people attended?',
      'What were the key concerns raised by the community?',
      'What were the key points of support?',
      'Have any scheme changes been made in response to consultation feedback?',
      'What is the position of the local parish council(s)?',
      'Is a community benefit fund proposed? If so, at what level?'
    ]
  }
];

export const ISSUE_QUESTIONS = [
  'What is the specific constraint or sensitivity for this issue on this site?',
  'What is our initial risk assessment — and why?',
  'What is the strategy to address it in the ES / planning statement?',
  'Has any relevant survey work or evidence been commissioned already?',
  'Did the LPA flag any specific concerns about this issue in pre-app?',
  'Are there any nearby appeal decisions or consented schemes that are relevant precedent?'
];

export const TAIL_SECTIONS = [
  {
    title: '10. Surveys and Specialists Required',
    feedsLabel: 'Surveyor briefing tool',
    questions: [
      'Which specialist surveys are required and what are the survey window constraints?',
      'Who will be responsible for commissioning each survey — client or TRP?',
      'Are there any preferred or excluded specialist consultants?',
      'What are the programme constraints on survey delivery relative to the submission target?',
      'Are there any methodology requirements specified by the LPA or statutory consultees?',
      'What is the budget expectation for specialist surveys?'
    ]
  },
  {
    title: '11. Documents Outstanding',
    feedsLabel: 'Document log',
    questions: [
      'What documents has the client already provided to us?',
      'What key documents are still outstanding — design drawings, technical specs, land ownership details?',
      'Who is preparing the application drawings and when are they expected?',
      'Has the client confirmed they hold all necessary land interests for the application site?'
    ]
  },
  {
    title: '12. Programme and Key Dates',
    feedsLabel: 'Project date fields',
    questions: [
      'What is the client\'s target submission date?',
      'What is the target determination date?',
      'Are there any hard deadlines (grid connection milestones, land option expiry, investor requirements)?',
      'Are there any survey windows closing imminently that will affect programme?',
      'When does the client need to make final decisions on layout?'
    ]
  },
  {
    title: '13. Local Plan Policies to Note',
    feedsLabel: 'Project policies',
    questions: [
      'Are there any specific local plan policies the LPA has flagged as particularly relevant?',
      'Is there a renewable energy policy in the local plan — and is it permissive or restrictive?',
      'Are there any emerging local plan policies that may be a material consideration?',
      'Are there any neighbourhood plan policies in the area that are relevant?'
    ]
  }
];

/**
 * Build the full sections list for a given project.
 * issueTracks: array of { id, label, discipline } from the project
 */
export function buildGuide(issueTracks = []) {
  const issueSections = issueTracks.map((track, i) => ({
    title: `9.${i + 1} ${track.label}`,
    feedsLabel: 'Issue working notes + planning statement',
    questions: ISSUE_QUESTIONS
  }));

  const keyIssueHeader = {
    title: '9. Key Issues',
    feedsLabel: 'Issue working notes, HLPV, planning statement assessment',
    questions: issueTracks.length === 0
      ? ['No issue tracks set up yet — add tracks on the Stages tab first.']
      : [`The following sub-sections cover each active issue track (${issueTracks.length} total).`]
  };

  return [...BASE_SECTIONS, keyIssueHeader, ...issueSections, ...TAIL_SECTIONS];
}
