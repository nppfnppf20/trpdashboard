/**
 * Structured meeting guide content — single source of truth.
 * Served to the frontend via GET /api/planning-application/meeting-guide
 * (rendered in the Meeting Guide modal) and used to build the
 * briefing_transcript summary prompt in planningStatement.service.js,
 * so edits here change both the on-screen guide and the AI summary structure.
 *
 * Section titles are stored WITHOUT leading numbers — numbering is applied
 * by the consumer (buildGuide() on the frontend, buildMeetingGuideOutline()
 * here) based on position, since different doc types have different section
 * counts.
 */

export const BASE_SECTIONS = [
  {
    title: 'Project Overview',
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
    title: 'About the Applicant',
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
    title: 'Proposed Development',
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
    title: 'Site and Surroundings',
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
    title: 'Planning History',
    feedsLabel: 'Planning history',
    questions: [
      'Is there any relevant planning history on the site or immediately adjacent?',
      'Have any similar schemes been refused or appealed nearby?',
      'Has the client attempted this site before with a different scheme?'
    ]
  },
  {
    title: 'Pre-Application Engagement',
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
    title: 'EIA / Scoping',
    feedsLabel: 'EIA Scoping Response document summary',
    questions: [
      'Has an EIA scoping request been submitted? If so, what was the scoping opinion?',
      'Which topics were confirmed as requiring assessment in the Environmental Statement?',
      'Were any topics scoped out, and on what basis?',
      'Were there any unusual or onerous methodological requirements specified by the LPA or statutory consultees?'
    ]
  },
  {
    title: 'Community Consultation',
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
    title: 'Surveys and Specialists Required',
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
    title: 'Documents Outstanding',
    feedsLabel: 'Document log',
    questions: [
      'What documents has the client already provided to us?',
      'What key documents are still outstanding — design drawings, technical specs, land ownership details?',
      'Who is preparing the application drawings and when are they expected?',
      'Has the client confirmed they hold all necessary land interests for the application site?'
    ]
  },
  {
    title: 'Programme and Key Dates',
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
    title: 'Local Plan Policies to Note',
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
// the AI's briefing-transcript summary — see buildMeetingGuideOutline()).
//
// Sections here may carry two optional annotation fields, resolved against
// live project data by getMeetingGuide() in planningApplication.controller.js:
//   coveredByDocType — a planning_applications.document_summaries.doc_type
//     slug. If a summary of that type already exists for the project, the
//     section is flagged "On file" in the modal. NOT used by
//     planning_statement_v3 below — v3's generation prompt (migration 135)
//     only reads document_summaries rows of doc_type 'briefing_transcript'
//     (the Briefing Note itself), plus project_planning_history and the
//     project's drafting issues; the other v1-era doc_types (about_applicant,
//     proposed_development, site_surroundings, pre_app, eia_response, sci)
//     aren't read by v3 generation at all, so flagging sections against them
//     would be misleading.
//   priorToolNote — static text shown regardless of live data, for ground
//     that's typically already covered by a tool that runs earlier in the
//     workflow (Stage 1 Review, HLPV) but that this system can't yet detect
//     automatically per project.

const STAGE1_HLPV_NOTE = 'If a Stage 1 Review or HLPV has already been completed for this site, this is likely already covered — use the meeting to confirm and fill gaps rather than starting from scratch.';

// Built directly against the planning_statement_v3 master prompt (migration
// 135) and its Planning Policy / Planning Assessment splice prompts
// (migrations 132/133/147) — every section here maps to something that
// prompt actually reads or an output section it actually produces. Cut
// relative to the generic guide: About the Applicant and Local Plan Policies
// to Note (no corresponding output section — policy is populated on the
// Policy tab, independent of any meeting), Surveys and Specialists Required
// and Programme and Key Dates (project-management topics the generation
// prompt never reads). Added: Lawful Use, Planning Obligations and CIL, and
// Planning Benefits/Balance/Conclusion — all required by the prompt, none
// previously asked anywhere.
const PLANNING_STATEMENT_V3_BASE_SECTIONS = [
  {
    title: 'Site, Applicant and Scheme Basics',
    feedsLabel: 'Sanity check only — read from the project record, not this meeting',
    questions: [
      'Confirm the site address, applicant / SPV name, and determining LPA are set correctly on the project.',
      'Is there an exact or verbatim description of development that must be reproduced without alteration?',
      "Is there anything about the application strategy (e.g. outline vs full, phased submission) not already reflected in the project's setup?"
    ]
  },
  {
    title: 'Proposed Development',
    feedsLabel: 'Proposed Development section',
    questions: [
      'What is the rationale for the development — what need does it meet, and why was this form or layout chosen?',
      'What are the key components and quantities (land uses, capacity / floorspace / unit numbers, height, scale, massing, materials)?',
      'What are the access, parking, and servicing arrangements?',
      'What landscaping, ecology, drainage, and energy / sustainability measures are proposed?',
      'How has the design evolved (e.g. in response to pre-app feedback, surveys, consultation), and why?',
      'What is the proposed phasing or operational lifespan, if relevant?'
    ]
  },
  {
    title: 'Site and Surroundings',
    feedsLabel: 'Site Description and Context section',
    priorToolNote: STAGE1_HLPV_NOTE,
    questions: [
      'Describe the site — location, area, boundaries, existing use, buildings, access, topography, vegetation, water or drainage features, current condition.',
      'Describe the surrounding area — adjoining land, nearby uses, residential receptors, roads and transport, landscape character, heritage assets.',
      'What planning designations or constraints apply — allocations, conservation areas, listed buildings, Green Belt / MOL, flood zones, ecological or landscape designations, TPOs, public rights of way, minerals or infrastructure safeguarding?'
    ]
  },
  {
    title: 'Planning History',
    feedsLabel: 'Planning History section (table + narrative supplement)',
    priorToolNote: STAGE1_HLPV_NOTE,
    questions: [
      'Has the client (or anyone connected with the site) attempted this site before, under this or a different scheme, applicant, or agent? Anything unlikely to show up in a standard planning register search?',
      'Why does this history matter to the current application — e.g. addressed by a design change, informs a fallback position? Only relevant where there is history to report.'
    ]
  },
  {
    title: 'Lawful Use',
    feedsLabel: 'Lawful Uses section — only included where material',
    priorToolNote: STAGE1_HLPV_NOTE,
    questions: [
      'Is the established lawful use of the site clear, and how is it evidenced (planning permission, certificate of lawful use, historic use)?',
      'Are there different lawful uses across separate parts of the site?',
      'Are there any enforcement notices, fallback positions, or abandonment issues affecting the site?',
      'Is there any unresolved ambiguity about lawful use that needs to be flagged rather than assumed away?'
    ]
  },
  {
    title: 'Consultation and Pre-Application Engagement',
    feedsLabel: 'Consultation and Pre-Application Engagement section',
    questions: [
      'Has formal pre-application advice been sought? When, and what was the outcome or the LPA’s overall position?',
      'Which issues did the LPA flag as requiring detailed assessment? Is the application likely to go to committee?',
      'Have other statutory consultees (Natural England, Historic England, Environment Agency, etc.) been engaged pre-submission?',
      'Has any public or community consultation taken place — events held, key concerns raised, key points of support?',
      'Have any scheme changes been made in response to consultation or pre-app feedback, and why?',
      'Is a Statement of Community Involvement being submitted separately, or does this need to be captured here?'
    ]
  },
  {
    title: 'EIA / Scoping',
    feedsLabel: 'No dedicated output section — informs Technical Evidence used across the statement',
    questions: [
      'Has an EIA scoping request been submitted? If so, what was the scoping opinion?',
      'Which topics were confirmed as requiring assessment in the Environmental Statement, and which were scoped out, and why?',
      'Were there any unusual or onerous methodological requirements set by the LPA or statutory consultees?'
    ]
  }
];

// Generic per-issue checklist, applied to whatever drafting issues this
// project actually has (agricultural land, daylight/sunlight, landscape and
// visual, heritage, ecology, highways, noise, etc. — set on the Drafting
// Issues tab, not fixed here). Sharpened against what the Planning
// Assessment splice prompt (migration 132) actually consumes: linked
// policies, the consultant's compliance argument ("Policy Assessment Notes"
// — turned near-verbatim into drafted prose), and supporting evidence from
// specialist reports.
const PLANNING_STATEMENT_V3_ASSESSMENT_QUESTIONS = [
  'What is the specific constraint or sensitivity for this issue on this site?',
  'Which policies (national, local, supplementary) actually govern this issue, and does the scheme comply, partially comply, or conflict with each one?',
  "What is the consultant's compliance argument, in full? This is turned almost directly into the drafted assessment prose, so capture the reasoning itself, not just headline conclusions.",
  'What mitigation, design response, or conditions are proposed to address this issue?',
  'What supporting evidence exists or is planned — surveys, technical reports, specialist assessments — and what do they conclude?',
  'Did the LPA raise this issue specifically in pre-application advice, and what was their position?',
  'Are there directly comparable appeal decisions or consented schemes nearby that support the argument?'
];

// Shown once, above the per-issue sub-sections, to make the generic
// checklist concrete before running through whatever issues this project
// actually has.
const PLANNING_STATEMENT_V3_ASSESSMENT_EXAMPLES = [
  'For example, for an agricultural land issue: the constraint is the site’s Best and Most Versatile land classification; the compliance argument typically rests on an Agricultural Land Classification survey and the NPPF’s preference for lower-grade land; mitigation may be continued grazing or restoration of soil quality; the evidence is the ALC report itself.',
  'For a daylight / sunlight issue: the constraint is neighbouring residential amenity; the compliance argument typically rests on a BRE 209 assessment (VSC / APSH figures); mitigation may be massing or setback changes; the evidence is the Daylight and Sunlight Assessment.'
];

const PLANNING_STATEMENT_V3_TAIL_SECTIONS = [
  {
    title: 'Planning Obligations and Community Infrastructure Levy',
    feedsLabel: 'Planning Obligations and CIL section',
    questions: [
      'Is a Section 106 agreement anticipated? What are the likely heads of terms (affordable housing, transport contributions, highway works, employment or skills obligations, open space, biodiversity, carbon offset, monitoring fees, travel plans, car club, etc.)?',
      'Is CIL expected to apply? Is any exemption or relief being sought?',
      'Which matters are confirmed, and which are still under discussion or negotiation? Do not let the statement commit to anything beyond what is confirmed here.'
    ]
  },
  {
    title: 'Planning Benefits, Planning Balance and Conclusion',
    feedsLabel: 'The statement will not invent a benefit, harm, or weight — this must be captured explicitly',
    questions: [
      'What are the specific planning benefits of this scheme, and what is the factual basis for each — not just that it is good, but what makes it a benefit?',
      'What weight should be given to each benefit, if a view has been formed (e.g. substantial, significant, moderate, minor)?',
      'Is there any harm or policy tension that needs to be acknowledged in the final balance, and what weight does it carry?',
      'Does the scheme accord with the development plan when read as a whole, or is there a conflict that is justified by other material considerations?',
      'What is the intended overall conclusion — state it plainly now, rather than leaving the statement to infer it.'
    ]
  },
  {
    title: 'Submission Documents',
    feedsLabel: 'Submission Documents section — omitted entirely if nothing is named here',
    questions: [
      'What documents are being submitted alongside the Planning Statement (drawings, technical reports, Design and Access Statement, etc.)? Who is preparing each, and what is the reference, revision, or date if known?',
      'Are there any appendices that should be referenced by name?',
      'Has the client confirmed they hold all necessary land interests for the application site?'
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 Review v3
// ─────────────────────────────────────────────────────────────────────────────
//
// Built against the stage1_review_v3 master prompt (migration 137). Narrower
// than Planning Statement v3's "Required Document Structure": no Consultation,
// EIA, Lawful Use or Obligations/CIL sections exist in its output at all — it's
// an earlier-stage document. Two things it needs that Planning Statement
// doesn't:
//   - Next Steps / Strategy, both per-issue and consolidated. The prompt is
//     explicit that this can ONLY come from the Briefing Note: "Do not derive
//     a recommended next step from the Drafting Issue Notes, the High-Level
//     Planning Review, ... or general planning practice." Drafting Issues
//     records evidence about an existing report, not a recommended action, so
//     it's structurally incapable of supplying this.
//   - {{HIGH_LEVEL_PLANNING_REVIEW}} is a real, directly-read source (from
//     planning_applications.stage1_starting_docs, slot high_level_planning_
//     review) — a stronger signal than the generic Stage1/HLPV note used
//     elsewhere, since this document actually reads it, not just "might
//     already be covered by a separate tool."
//
// Planning History doesn't need a migration-147-style fix here: this prompt's
// own Planning History section already allows "further discussion... from
// the Project Briefing Note" after the table, unlike Planning Statement v3
// before that fix.

const STAGE1_HLPV_DIRECT_NOTE = 'This appraisal reads the HLPV starting document directly (see Starting Docs on this card). If one has already been uploaded, much of the site, constraints and preliminary policy picture is already captured — use this section to confirm and fill gaps, not restate it.';

const STAGE1_REVIEW_V3_BASE_SECTIONS = [
  {
    title: 'Site, Applicant and Scheme Basics',
    feedsLabel: 'Sanity check only — read from the project record, not this meeting',
    questions: [
      'Confirm the site address, applicant / SPV name, and determining LPA are set correctly on the project.',
      "Is there anything about the application strategy not already reflected in the project's setup that should shape how this appraisal is framed?"
    ]
  },
  {
    title: 'Proposed Development',
    feedsLabel: 'Proposed Development section',
    questions: [
      'What is proposed — describe the development type and principal components?',
      'What capacity, quantum, floorspace, or unit numbers are anticipated, even if only indicative at this stage?',
      'What layout, access, massing, or infrastructure principles are currently being worked to?',
      'What aspects of the design are still genuinely undecided, rather than fixed? Do not present a preliminary concept as settled.'
    ]
  },
  {
    title: 'Site, Surroundings and Constraints',
    feedsLabel: 'Site and Surroundings + Designations and Constraints sections',
    priorToolNote: STAGE1_HLPV_DIRECT_NOTE,
    questions: [
      'Describe the site — location, area, existing use, buildings, access, topography, boundaries.',
      'Describe the surrounding area — adjoining land, nearby uses, settlement pattern, landscape character.',
      'What planning designations or constraints apply — allocations, Green Belt, conservation areas, listed buildings, flood zones, ecological or landscape designations, TPOs, public rights of way, minerals or infrastructure safeguarding?',
      'Where the site has multiple parcels, how should they be distinguished, if at all?'
    ]
  },
  {
    title: 'Planning History',
    feedsLabel: 'Planning History section (table + any relevant discussion)',
    questions: [
      'Has the client (or anyone connected with the site) attempted this site before, under this or a different scheme, applicant, or agent? Anything unlikely to show up in a standard planning register search?',
      'Why does this history matter to the current proposal, if at all?'
    ]
  }
];

// Same generic per-issue checklist as Planning Statement v3 (same underlying
// admin_console.drafting_issues mechanism — see migration 137's own comment
// confirming this mirrors Planning Statement's approach), plus one addition:
// a recommended-next-step question, since the prompt explicitly forbids
// deriving that from the Drafting Issue Notes.
const STAGE1_REVIEW_V3_ASSESSMENT_QUESTIONS = [
  ...PLANNING_STATEMENT_V3_ASSESSMENT_QUESTIONS,
  'What should happen next on this issue specifically — e.g. a specialist survey to instruct, an assessment to commission, or engagement to pursue? This can only come from this meeting: it will not be inferred from the drafting issue notes, the policy position, or the constraint itself, however obvious the next step seems.'
];

const STAGE1_REVIEW_V3_ASSESSMENT_EXAMPLES = [
  'For example, for an agricultural land issue: the constraint is the site’s Best and Most Versatile land classification; the assessment rests on an Agricultural Land Classification survey and the NPPF’s preference for lower-grade land; the recommended next step might be commissioning the ALC survey now if it hasn’t been done, or testing the layout to reduce BMV loss.',
  'For a daylight / sunlight issue: the constraint is neighbouring residential amenity; the assessment typically rests on a BRE 209 approach; the recommended next step might be commissioning a Daylight and Sunlight Assessment early, or reviewing massing before submission.'
];

const STAGE1_REVIEW_V3_TAIL_SECTIONS = [
  {
    title: 'Strategy and Recommended Next Steps',
    feedsLabel: 'Strategy and Recommended Next Steps section — the appraisal will not invent a recommendation, this must be captured explicitly',
    questions: [
      'What is the overall recommended strategy for this project at this stage?',
      'What specific actions should happen next — surveys to instruct, assessments to commission, pre-application engagement to pursue, parties to engage with?',
      'Is there a sequence or priority to these actions? Anything time-critical?',
      'Do any of the per-issue next steps overlap, so they can be consolidated into one action here rather than repeated?'
    ]
  },
  {
    title: 'Reports Anticipated for the Application',
    feedsLabel: 'Reports Required for the Application section — omitted entirely if nothing is named here',
    questions: [
      'Which specialist reports or surveys are anticipated to support a future planning application, even if not yet commissioned?',
      'Is there a reasonable view yet on who would prepare each?'
    ]
  }
];

export const DOC_TYPE_GUIDES = {
  planning_statement_v3: {
    label: 'Planning Statement',
    baseSections: PLANNING_STATEMENT_V3_BASE_SECTIONS,
    issueQuestions: PLANNING_STATEMENT_V3_ASSESSMENT_QUESTIONS,
    issueSectionLabel: 'Planning Assessment',
    issueSectionFeedsLabel: 'Planning statement assessment section (per issue)',
    issueSectionExamples: PLANNING_STATEMENT_V3_ASSESSMENT_EXAMPLES,
    tailSections: PLANNING_STATEMENT_V3_TAIL_SECTIONS,
  },
  stage1_review_v3: {
    label: 'Stage 1 Review',
    baseSections: STAGE1_REVIEW_V3_BASE_SECTIONS,
    issueQuestions: STAGE1_REVIEW_V3_ASSESSMENT_QUESTIONS,
    issueSectionLabel: 'Planning Assessment',
    issueSectionFeedsLabel: 'Planning Assessment section (per issue) — Next Steps for each issue can only come from this meeting',
    issueSectionExamples: STAGE1_REVIEW_V3_ASSESSMENT_EXAMPLES,
    tailSections: STAGE1_REVIEW_V3_TAIL_SECTIONS,
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
      issueSectionExamples: [],
      tailSections: TAIL_SECTIONS,
    };
  }
  return {
    label: override.label,
    baseSections: override.baseSections ?? BASE_SECTIONS,
    issueQuestions: override.issueQuestions ?? ISSUE_QUESTIONS,
    issueSectionLabel: override.issueSectionLabel ?? 'Key Issues',
    issueSectionFeedsLabel: override.issueSectionFeedsLabel ?? 'Issue working notes, HLPV, planning statement assessment',
    issueSectionExamples: override.issueSectionExamples ?? [],
    tailSections: override.tailSections ?? TAIL_SECTIONS,
  };
}
