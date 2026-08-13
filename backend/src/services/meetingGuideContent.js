/**
 * Structured meeting guide content — single source of truth.
 * Served to the frontend via GET /api/planning-application/meeting-guide
 * (rendered in the Meeting Guide modal) and used to build the
 * briefing_transcript summary prompt in planningStatement.service.js,
 * so edits here change both the on-screen guide and the AI summary structure.
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
      "What was the LPA's overall position — supportive in principle, neutral, or opposed?",
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
      "What is the client's target submission date?",
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

// ─────────────────────────────────────────────────────────────────────────────
// Doc-type-specific guides
// ─────────────────────────────────────────────────────────────────────────────
//
// The guide above is the generic fallback, used by any doc type without an
// entry in DOC_TYPE_GUIDES below (and still used, unmodified, to structure
// the AI's briefing-transcript summary — see buildMeetingGuideOutline() in
// planningStatement.service.js).
//
// Sections here may carry two optional annotation fields, resolved against
// live project data by getMeetingGuide() in planningApplication.controller.js:
//   coveredByDocType — a planning_applications.document_summaries.doc_type
//     slug. If a summary of that type already exists for the project, the
//     section is flagged "On file" in the modal rather than removed — still
//     worth a quick confirm, not a from-scratch discussion.
//   priorToolNote — static text shown regardless of live data, for ground
//     that's typically already covered by a tool that runs earlier in the
//     workflow (Stage 1 Review, HLPV) but that this system can't yet detect
//     automatically per project.

const STAGE1_HLPV_NOTE = 'If a Stage 1 Review or HLPV has already been completed for this site, this is likely already covered — use the meeting to confirm and fill gaps rather than starting from scratch.';

const PLANNING_STATEMENT_V3_BASE_SECTIONS = [
  BASE_SECTIONS[0], // 1. Project Overview
  { ...BASE_SECTIONS[1], coveredByDocType: 'about_applicant' },       // 2. About the Applicant
  { ...BASE_SECTIONS[2], coveredByDocType: 'proposed_development' },  // 3. Proposed Development
  { ...BASE_SECTIONS[3], coveredByDocType: 'site_surroundings', priorToolNote: STAGE1_HLPV_NOTE }, // 4. Site and Surroundings
  { ...BASE_SECTIONS[4], priorToolNote: STAGE1_HLPV_NOTE },           // 5. Planning History
  { ...BASE_SECTIONS[5], coveredByDocType: 'pre_app' },                // 6. Pre-Application Engagement
  { ...BASE_SECTIONS[6], coveredByDocType: 'eia_response' },           // 7. EIA / Scoping
  { ...BASE_SECTIONS[7], coveredByDocType: 'sci' },                    // 8. Community Consultation
];

// Sharpened for what the v3 assessment prompt actually consumes
// (buildPlanningAppIssueContext / generateIssueOrderedSection in
// planningStatement.service.js): linked policies, the consultant's
// compliance argument ("Policy Assessment Notes" — turned near-verbatim
// into drafted prose), and supporting evidence from specialist reports.
const PLANNING_STATEMENT_V3_ASSESSMENT_QUESTIONS = [
  'What is the specific constraint or sensitivity for this issue on this site?',
  'Which policies (national, local, supplementary) actually govern this issue, and does the scheme comply, partially comply, or conflict with each one?',
  "What is the consultant's compliance argument, in full? This is turned almost directly into the drafted assessment prose, so capture the reasoning itself, not just headline conclusions.",
  'What mitigation, design response, or conditions are proposed to address this issue?',
  'What supporting evidence exists or is planned — surveys, technical reports, specialist assessments — and what do they conclude?',
  'Did the LPA raise this issue specifically in pre-application advice, and what was their position?',
  'Are there directly comparable appeal decisions or consented schemes nearby that support the argument?'
];

const PLANNING_STATEMENT_V3_TAIL_SECTIONS = [
  TAIL_SECTIONS[0], // 10. Surveys and Specialists Required
  TAIL_SECTIONS[1], // 11. Documents Outstanding
  TAIL_SECTIONS[2], // 12. Programme and Key Dates
  { ...TAIL_SECTIONS[3], priorToolNote: STAGE1_HLPV_NOTE }, // 13. Local Plan Policies to Note
];

export const DOC_TYPE_GUIDES = {
  planning_statement_v3: {
    label: 'Planning Statement',
    baseSections: PLANNING_STATEMENT_V3_BASE_SECTIONS,
    issueQuestions: PLANNING_STATEMENT_V3_ASSESSMENT_QUESTIONS,
    issueSectionLabel: 'Planning Assessment',
    issueSectionFeedsLabel: 'Planning statement assessment section',
    tailSections: PLANNING_STATEMENT_V3_TAIL_SECTIONS,
  }
};

/** Resolve the guide content for a doc type, falling back to the generic guide. */
export function getGuideContent(docTypeSlug) {
  const override = DOC_TYPE_GUIDES[docTypeSlug];
  if (!override) {
    return {
      label: null,
      baseSections: BASE_SECTIONS,
      issueQuestions: ISSUE_QUESTIONS,
      issueSectionLabel: 'Key Issues',
      issueSectionFeedsLabel: 'Issue working notes, HLPV, planning statement assessment',
      tailSections: TAIL_SECTIONS,
    };
  }
  return {
    label: override.label,
    baseSections: override.baseSections ?? BASE_SECTIONS,
    issueQuestions: override.issueQuestions ?? ISSUE_QUESTIONS,
    issueSectionLabel: override.issueSectionLabel ?? 'Key Issues',
    issueSectionFeedsLabel: override.issueSectionFeedsLabel ?? 'Issue working notes, HLPV, planning statement assessment',
    tailSections: override.tailSections ?? TAIL_SECTIONS,
  };
}
