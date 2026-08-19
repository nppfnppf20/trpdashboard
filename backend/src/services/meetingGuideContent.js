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

// ─────────────────────────────────────────────────────────────────────────────
// HLPV v3
// ─────────────────────────────────────────────────────────────────────────────
//
// Built against the hlpv_v3 master prompt (hlpvV3.controller.js). Even
// lighter-touch than Stage 1 Review v3 — "an early-stage, desk-based
// preliminary appraisal, not a submission document" — and structurally
// different: the output is a single two-column Topic/Detail table (Site
// Details rows, then one row per constraint/opportunity), not sequential
// <h2>/<h3> prose sections, so there's no numbering concept to preserve.
// Same "recommendations only from the Briefing Transcript, never the
// Drafting Issue Notes" rule as Stage 1 and Planning Statement.
//
// Two tokens the prompt reads — {{DESIGNATIONS_AND_CONSTRAINTS}} and
// {{CORRESPONDENCE_DETAILS}} — have no backing data source anywhere in the
// system (always substituted "(not provided)"; see migration 138's own
// comment). No meeting questions built around them for the same reason
// Stage 1's now-inert guiding-brief fetch didn't get a question: there's
// nowhere for the answer to land yet.
//
// {{PLANNING_CONTEXT}} is explicitly light-touch here — "does not require a
// comprehensive policy schedule" — so no dedicated policy section, unlike
// Planning Statement.

const HLPV_V3_BASE_SECTIONS = [
  {
    title: 'Site, Proposal and Context',
    feedsLabel: 'Site and Proposal Information + Introductory Paragraphs',
    questions: [
      'Confirm the site name / address, determining LPA, and development type(s) are set correctly on the project.',
      'Is this being prepared as a letter to a named recipient, or as an internal/standalone note?',
      'Any limitation to state up front — e.g. desk-based only, no site visit undertaken?'
    ]
  },
  {
    title: 'Overall Preliminary View',
    feedsLabel: 'Overall Preliminary View section — written before the main table',
    questions: [
      "What's the overall sense of the site's apparent potential for this development, at this very early stage?",
      'Is there any apparent showstopping or fundamental constraint that should be flagged immediately?',
      'Any broad implication for layout or developable area worth noting up front?'
    ]
  },
  {
    title: 'Planning Context',
    feedsLabel: 'Development Plan / Relevant Planning Policy row — light touch only, no full policy schedule needed',
    questions: [
      'What is the broad local plan position for this type of development — supportive, restrictive, or silent — without needing a full policy schedule?',
      'Are there any specific policies the client or LPA has already flagged as particularly material?'
    ]
  },
  {
    title: 'Planning History',
    feedsLabel: 'Planning History row — only included where material',
    questions: [
      'Has the client (or anyone connected with the site) attempted this site before, under this or a different scheme, applicant, or agent? Anything unlikely to show up in a standard planning register search?',
      'Why does this history matter to the current proposal, if at all?'
    ]
  }
];

const HLPV_V3_ASSESSMENT_QUESTIONS = [
  'What is the apparent constraint or opportunity, and what site feature or baseline does it relate to?',
  "What's the preliminary implication for site layout, developable area, or design approach, if any?",
  'What further work or specialist input should happen next on this specifically? This can only come from this meeting — it will not be inferred from the drafting issue notes or the constraint itself.',
  'Is there a supporting figure or plan that should be referenced here, even just to note one exists?'
];

// Dev-type-specific worked examples, keyed to admin_console.development_types
// (migration 146) — resolved dynamically against the project's actual
// development_types (plural, multi-select) rather than shown as a fixed set,
// since what to screen for genuinely differs by scheme (glint and glare vs.
// shadow flicker vs. daylight/sunlight are not interchangeable). 'Other' is
// the fallback shown when none of the project's types match, or none are set.
const HLPV_V3_DEV_TYPE_EXAMPLES = {
  'Solar': 'For a solar scheme: the constraint is typically the site’s agricultural land classification and glint / glare to nearby receptors (roads, dwellings, airfields); the opportunity is renewable energy generation and grid capacity; further work might be an Agricultural Land Classification survey or a glint and glare assessment.',
  'Wind': 'For a wind scheme: the constraint is typically noise, shadow flicker, and aviation or MOD safeguarding zones; the opportunity is renewable energy generation; further work might be a noise assessment, a shadow flicker study, or early consultation with the Civil Aviation Authority or MOD.',
  'Synchronous condensers': 'For a synchronous condenser scheme: the constraint is typically noise from rotating plant and the visual impact of associated switchgear buildings; the opportunity is grid stability infrastructure supporting the wider renewable transition; further work might be a noise assessment or early engagement with National Grid on the connection case.',
  'Residential': 'For a residential scheme: the constraint is typically neighbouring residential amenity and daylight / sunlight; the opportunity might be housing delivery or an affordable housing contribution; further work might be a Daylight and Sunlight Assessment.',
  'Co-Living': 'For a co-living scheme: the constraint is often whether the local plan has a settled position on the co-living use class and appropriate amenity / management standards; the opportunity might be efficient land use; further work might be confirming the LPA’s position on co-living and reviewing communal facility provision.',
  'Commercial': 'For a commercial scheme: the constraint might be retail impact on the town centre or loss of existing employment floorspace; the opportunity might be job creation or town centre vitality; further work might be a retail impact assessment or sequential test.',
  'Mixed Use': 'For a mixed-use scheme: the constraint is often the interaction between different uses on site — noise or amenity conflicts between commercial and residential elements; the opportunity is efficient land use; further work might be a noise or odour assessment between uses, or confirming phasing.',
  'Industrial': 'For an industrial scheme: the constraint is typically noise, HGV movements, and separation from residential receptors; the opportunity is employment floorspace; further work might be a noise assessment or a transport assessment covering HGV routing.',
  'Change of Use': 'For a change of use: the constraint is typically the policy test for losing the existing use (employment, retail, agricultural) and evidencing the current lawful use; the opportunity is bringing a vacant or underused building back into active use; further work might be establishing the lawful use history or a marketing / viability exercise.',
  'Agricultural': 'For an agricultural development: the constraint is typically the agricultural land classification and any functional or occupancy tie to the holding; the opportunity is supporting the rural economy or farm diversification; further work might be an Agricultural Land Classification survey or confirming the functional need case.',
  'Other': 'Identify the constraint categories that actually apply to this development type, rather than defaulting to a generic list — what is the site feature, what is the implication, and what further work would resolve it?',
};

const HLPV_V3_TAIL_SECTIONS = [
  {
    title: 'Recommended Further Work',
    feedsLabel: 'Recommended Further Work section — optional, only included where a clear consolidated list exists',
    questions: [
      'Beyond the per-issue next steps above, is there an overall consolidated list of further work recommended before a firmer view can be reached?'
    ]
  }
];

// Full topic-by-topic screening checklist for solar HLPVs, based directly on
// TRP's internal solar HLPV guidance. Replaces the generic "Constraints and
// Opportunities" catch-all section (built from HLPV_V3_ASSESSMENT_QUESTIONS)
// with real, solar-specific substance when the project's development_types
// includes 'Solar' — see issueSectionTopicsByDevType / resolveIssueSectionTopics
// below. Condensed from prose into checklist bullets to match this guide's
// format; specifics (grades, distances, survey windows) preserved as given.
const HLPV_V3_SOLAR_TOPIC_SECTIONS = [
  {
    title: 'Planning Policy',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      "Check the local plan's renewables policy — does it simply follow the NPPF (support subject to criteria) or does it add anything unusual?",
      'Are there any planning designations affecting the site — Green Belt, site allocations, or similar?',
      'Check nearby applications, consents and refusals for comparable schemes.'
    ]
  },
  {
    title: 'Landscape and Visual',
    feedsLabel: 'Constraints and Opportunities — Solar (often the main issue)',
    questions: [
      'Landscape: any designated landscapes nearby (AONB etc.)? What is the topography, field size, land cover, and surrounding land use — large, flat, well-screened fields read better than small, undulating ones. Any existing large-scale infrastructure nearby (pylons, turbines, industrial estates) that changes the baseline?',
      'Visual: which public viewpoints can see the site — footpaths / PRoW (high sensitivity, avoid building too close), roads and railways (lower sensitivity but still relevant)? Any private receptors (residential properties) that raise objection risk?',
      'Longer-range views (1–3km): use OS mapping to identify likely cross-valley or long-range views and any sensitive receptors within them (designated areas, listed buildings, long-distance footpaths, settlements).',
      'A landscape and visual impact assessment plus photomontage / CGI will almost always be needed.',
      'Green Belt sites: any particular openness issues or conflict with the five GB purposes? Any potential very special circumstances beyond the standard climate / renewable energy case (e.g. ecological benefits, PRoW improvements)? Any other constraint compounding the GB issue (e.g. hilly terrain)?'
    ]
  },
  {
    title: 'Heritage and Archaeology',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Heritage: identify listed buildings (and grade), registered parks and gardens, or scheduled monuments on or near the site. What constitutes their setting, and is there intervisibility with the site (views, topography, vegetation, PRoW passing through)? Many rural listed buildings are farms, where the farm itself may be the setting.',
      'Archaeology: harder to assess without specialist data — check for obvious designations such as registered battlefields (which also carry a setting). A geophysical survey may be needed.',
      'A heritage statement and/or archaeological assessment will normally be required where assets are identified as potentially affected.'
    ]
  },
  {
    title: 'Agricultural Land',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'NPPF requires non-agricultural / previously developed land in preference to agricultural land, then lower-grade land (3b, 4, 5) in preference to higher-grade (1, 2, 3a) unless there are "most compelling" reasons otherwise.',
      "Natural England's mapping is crude and doesn't distinguish 3a from 3b — note the likely grade and BMV risk now; a site-specific Agricultural Land Classification survey will normally be required for the application."
    ]
  },
  {
    title: 'Flood Risk',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Ideally the site sits in flood zone 1; zones 2/3 are possible for solar as "essential infrastructure" subject to the sequential and exceptions tests — recommend a feasibility study if in zone 2/3.',
      'Where zone 3 is directly adjacent to a river, check whether it is "functional floodplain" (3b, via the Council\'s Strategic Flood Risk Assessment) — higher risk of an Environment Agency objection.',
      'A Flood Risk Assessment will always be required (sites are normally over 0.5ha).',
      'Also check surface water flooding — panels are typically raised around 80cm so some surface flooding is tolerable, but keep inverters and transformers out of higher-risk areas.'
    ]
  },
  {
    title: 'Ecology',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Any designated sites on or near the site — SSSI, SPA, Ramsar, SAC, LNR? These should be avoided on-site; check what they are designated for, since some (e.g. birds) can extend the relevant habitat beyond the boundary. Ramsar sites are often around estuaries and worth flagging.',
      'Check for ponds on or within 250m of the site — great crested newt surveys may be needed (survey window is April to late June, and mitigation can be costly if found); check Magic for recent surveys and results.',
      'A Preliminary Ecological Appraisal will always be needed, often with follow-up GCN or skylark surveys.'
    ]
  },
  {
    title: 'Drinking Water and Source Protection',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Ideally avoid Source Protection Zones 1 and 2 (most sensitive); Safeguard Zones are less sensitive but still need extra pollution control measures.',
      'Check with the client whether the proposed solar / BESS equipment contains PFAS — some water companies now require confirmation that panels and electrical equipment are PFAS-free.'
    ]
  },
  {
    title: 'Transport',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Operational traffic is negligible — the focus is construction traffic. Is access from the trunk road network suitable (few tight bends, no narrow sections, avoiding small villages), and is access to the fields themselves straightforward? Rarely a showstopper.',
      'A Construction Traffic Management Plan is normally commissioned for the application.'
    ]
  },
  {
    title: 'Aviation and Glint & Glare',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Rarely a major issue since panels are designed to absorb rather than reflect light — but note proximity to obviously sensitive receptors such as airports or airfields.'
    ]
  },
  {
    title: 'Noise and Amenity',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Panels themselves are silent; transformers and inverters produce some daytime operational noise. Battery storage (BESS), if included, can be noisier and operate at night — more sensitive in quiet rural locations. Rule of thumb: unlikely to be an issue beyond around 250m from a receptor.'
    ]
  },
  {
    title: 'Trees',
    feedsLabel: 'Constraints and Opportunities — Solar',
    questions: [
      'Layouts are almost always kept within existing field boundaries to avoid hedge / tree loss. Where trees need removing or pruning (e.g. for access), a tree survey may be required — form an initial view from aerial photography / Street View; note a topo survey (not Lidar or drone) will be needed if a tree survey proceeds.'
    ]
  },
  {
    title: 'Survey Requirements',
    feedsLabel: 'Constraints and Opportunities — Solar, typical survey needs for the application',
    questions: [
      'Always needed: Landscape and Visual Impact Assessment; Preliminary Ecological Appraisal (plus any follow-up protected species surveys); Flood Risk Assessment.',
      'Usually needed: archaeology and/or heritage assessment; Agricultural Land Classification survey; Construction Traffic Management Plan.',
      'Sometimes needed: glint and glare assessment; noise assessment; contaminated land assessment.'
    ]
  }
];

// Full topic-by-topic screening checklist for urban-site HLPVs, based
// directly on TRP's internal Urban Site HLPV process note. Applied to
// Residential, Co-Living, Commercial, Mixed Use, Industrial and Change of
// Use — the non-renewable dev types where the site sits in a settled/urban
// context. Deliberately NOT applied to Agricultural (rural context, not
// urban despite being non-renewable) or Other (no fixed profile) — see
// issueSectionTopicsByDevType below. As with Solar, the source note's
// opening "Overall Approach" (internal methodology) and closing "Output of
// the Assessment" (drafting guidance for the finished document, already
// covered by the Overall Preliminary View base section) aren't meeting
// questions, so aren't included as their own sections here.
const HLPV_V3_URBAN_TOPIC_SECTIONS = [
  {
    title: 'Site Allocations & Growth Area Context',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'Is the site specifically allocated, or within a growth, opportunity, regeneration or town-centre area?',
      'Is it subject to any site-specific development guidance?',
      'Where an allocation exists, what does it indicate for acceptable uses, development capacity, height and massing, access, public realm requirements, and site-specific constraints? Allocations often carry significant weight in establishing the principle of development.'
    ]
  },
  {
    title: 'Existing Use & Lawful Planning Position',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'What is the current lawful planning use of the site — from planning history, officer reports, decision notices, existing consents, or lawful development certificates?',
      "Where lawful use can't be conclusively established, what working assumption is being made, and what evidence supports it? Flag it clearly as an assumption, not a confirmed fact."
    ]
  },
  {
    title: 'Principle of Development & Use Acceptability',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'Is the proposed use, or mix of uses, supported by strategic policy, the Local Plan, and any site allocation?',
      'Does the existing use carry any policy protection, and is the proposal compatible with surrounding uses?',
      'Are there any policy restrictions or land-use designations that count against it?',
      "Where the use isn't clearly supported: which elements are problematic, would an alternative use be more policy-compliant, and could planning benefits help address the conflict?"
    ]
  },
  {
    title: 'Policy Framework',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'Which parts of the statutory development plan are actually relevant here — London Plan or equivalent strategic policy, Local Plan policies, SPDs, site allocations, emerging policy?',
      "Where policies pull in different directions, what's the read on how that should be weighed?"
    ]
  },
  {
    title: 'Planning History and Lawful Fallback',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'For any previous consent on the site: was permission granted, was any Section 106 agreement completed, was it implemented, and does it establish a lawful fallback position?'
    ]
  },
  {
    title: 'Housing Delivery, 5YHLS & Tilted Balance',
    feedsLabel: 'Constraints and Opportunities — Urban, residential / mixed-use schemes with a housing component only',
    questions: [
      'Does the LPA currently have a compliant five-year housing land supply, and is it passing the Housing Delivery Test? If not, the tilted balance may apply, affording greater weight to the benefits of housing in the planning balance.'
    ]
  },
  {
    title: 'Constraints, Height & Designations',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'What initial view can be formed on height, massing and site capacity — informed by allocation guidance, surrounding townscape, and nearby approved schemes?',
      'Which constraints actually apply here: heritage, townscape, ecology and trees, amenity, transport and access, flood risk, contaminated land, air quality, noise, utilities and servicing?',
      'Which of these are design-led and manageable, and which could materially affect the principle or deliverability of the scheme?'
    ]
  },
  {
    title: 'Amenity',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      "What's the likely impact on existing neighbours — daylight and sunlight, privacy and overlooking, noise, outlook, sense of enclosure?",
      "What's the likely quality of accommodation for future occupiers — noise, air quality, access to light, relationship with neighbouring uses?"
    ]
  },
  {
    title: 'Transport & Highways',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      "What's the public transport accessibility — in London, the PTAL rating — and does it support a car-free or low-car approach?",
      'What are the likely car parking expectations, servicing / delivery access, and pedestrian / cycle access?',
      'Any highway safety concerns, and how does the scheme sit against local and strategic transport policy?'
    ]
  },
  {
    title: 'Surveys & Technical Work',
    feedsLabel: 'Constraints and Opportunities — Urban, typical survey needs for the application',
    questions: [
      "Which of the following are likely needed, given the site's location, condition, surrounding uses and proposed development: ecology; arboriculture / trees; heritage; archaeology; townscape and visual impact; daylight and sunlight; highways and transport; flood risk and drainage; contaminated land; noise; air quality?"
    ]
  },
  {
    title: 'Nearby Consents and Appeals',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'Are there comparable nearby permissions or appeals — similar sites, similar uses, similar designations or constraints — that show how the LPA has interpreted policy in practice? What was the officer reasoning or appeal outcome?'
    ]
  },
  {
    title: 'CIL & PIL',
    feedsLabel: 'Constraints and Opportunities — Urban',
    questions: [
      'Is the LPA a CIL charging authority? In London, does Mayoral CIL apply, and does Borough CIL also apply? What does the relevant charging schedule say?',
      'Are there any PIL requirements to confirm where relevant?'
    ]
  }
];

// Wind and Synchronous condensers don't have their own written checklist —
// reuse the Solar one (same land-take/rural-siting screening logic broadly
// applies) but flagged with a caveat, since several Solar-specific points
// (agricultural land grading, glint and glare, panel-specific noise) won't
// map cleanly onto a turbine or grid-infrastructure scheme. Caveat attaches
// to the first section only, not every one, to avoid repeating it 12 times.
function withLeadingCaveat(sections, note) {
  return sections.map((s, i) => i === 0 ? { ...s, headerNote: note } : s);
}

const HLPV_V3_SOLAR_CHECKLIST_WITH_CAVEAT = withLeadingCaveat(
  HLPV_V3_SOLAR_TOPIC_SECTIONS,
  'This checklist is written for solar development — it’s the closest fit we have, but not every point will be relevant here. Use judgement on which apply and skip the rest.'
);

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
  },
  hlpv_v3: {
    label: 'HLPV',
    baseSections: HLPV_V3_BASE_SECTIONS,
    issueQuestions: HLPV_V3_ASSESSMENT_QUESTIONS,
    issueSectionLabel: 'Constraints and Opportunities',
    issueSectionFeedsLabel: 'Constraints and Opportunities rows (per issue) — further work can only come from this meeting',
    issueSectionExamplesByDevType: HLPV_V3_DEV_TYPE_EXAMPLES,
    issueSectionTopicsByDevType: {
      Solar: HLPV_V3_SOLAR_TOPIC_SECTIONS,
      Wind: HLPV_V3_SOLAR_CHECKLIST_WITH_CAVEAT,
      'Synchronous condensers': HLPV_V3_SOLAR_CHECKLIST_WITH_CAVEAT,
      Residential: HLPV_V3_URBAN_TOPIC_SECTIONS,
      'Co-Living': HLPV_V3_URBAN_TOPIC_SECTIONS,
      Commercial: HLPV_V3_URBAN_TOPIC_SECTIONS,
      'Mixed Use': HLPV_V3_URBAN_TOPIC_SECTIONS,
      Industrial: HLPV_V3_URBAN_TOPIC_SECTIONS,
      'Change of Use': HLPV_V3_URBAN_TOPIC_SECTIONS,
    },
    tailSections: HLPV_V3_TAIL_SECTIONS,
  }
};

/**
 * Resolve worked examples for the issue section. Most doc types carry a
 * fixed `issueSectionExamples` list. hlpv_v3 instead carries
 * `issueSectionExamplesByDevType`, resolved against the project's actual
 * development_types (plural, admin_console.development_types) so the
 * examples reflect what's actually being proposed rather than a generic
 * fixed set — matters more here than elsewhere since HLPV's whole purpose
 * is constraint/opportunity screening, and what to screen for genuinely
 * differs by scheme.
 */
function resolveIssueSectionExamples(config, developmentTypes) {
  if (!config?.issueSectionExamplesByDevType) return config?.issueSectionExamples ?? [];
  const map = config.issueSectionExamplesByDevType;
  const matched = (developmentTypes ?? [])
    .map(dt => map[dt])
    .filter(Boolean);
  if (matched.length) return matched;
  return map.Other ? [map.Other] : [];
}

/**
 * Resolve full topic sections for the issue slot (e.g. hlpv_v3's Solar and
 * Urban checklists) — real, substantive, dev-type-specific guidance rather
 * than a one-line example. When a match exists, these REPLACE the generic
 * single issue section entirely (avoids showing a generic catch-all
 * alongside genuinely differentiated content for the same slot). Returns []
 * when no dev type matches, so callers fall back to the generic single
 * section.
 *
 * Several dev types share the same underlying section array (e.g.
 * Residential and Commercial both point at HLPV_V3_URBAN_TOPIC_SECTIONS) —
 * dedupe by array identity first, so a project with both set doesn't get
 * the shared checklist twice.
 */
function resolveIssueSectionTopics(config, developmentTypes) {
  if (!config?.issueSectionTopicsByDevType) return [];
  const map = config.issueSectionTopicsByDevType;
  const matchedArrays = [...new Set((developmentTypes ?? []).map(dt => map[dt]).filter(Boolean))];
  return matchedArrays.flatMap(arr => arr);
}

/**
 * Resolve the guide content for a doc type, falling back to the generic
 * guide. developmentTypes: the project's development_types (plural) —
 * only consulted by doc types whose issue-section content varies by dev
 * type (currently just hlpv_v3); ignored otherwise.
 */
export function getGuideContent(docTypeSlug, developmentTypes = []) {
  const override = DOC_TYPE_GUIDES[docTypeSlug];
  if (!override) {
    return {
      label: null,
      baseSections: BASE_SECTIONS,
      issueQuestions: ISSUE_QUESTIONS,
      issueSectionLabel: 'Key Issues',
      issueSectionFeedsLabel: 'Issue working notes, HLPV, planning statement assessment',
      issueSectionExamples: [],
      issueSectionTopics: [],
      tailSections: TAIL_SECTIONS,
    };
  }
  return {
    label: override.label,
    baseSections: override.baseSections ?? BASE_SECTIONS,
    issueQuestions: override.issueQuestions ?? ISSUE_QUESTIONS,
    issueSectionLabel: override.issueSectionLabel ?? 'Key Issues',
    issueSectionFeedsLabel: override.issueSectionFeedsLabel ?? 'Issue working notes, HLPV, planning statement assessment',
    issueSectionExamples: resolveIssueSectionExamples(override, developmentTypes),
    issueSectionTopics: resolveIssueSectionTopics(override, developmentTypes),
    tailSections: override.tailSections ?? TAIL_SECTIONS,
  };
}
