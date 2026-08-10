/**
 * Stage 1 Review Controller
 * LLM-assisted generation of Stage 1 Planning Appraisal.
 */

import { pool } from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MODEL_SONNET, callLLM, resolveProvider } from '../services/llm.shared.js';
import { getGuidingBrief } from './guidingBriefs.controller.js';
import { getDocumentStyleTemplateByDocType } from './documentStyleTemplates.controller.js';
import { parseFile } from '../services/parser.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tone example at startup — used two ways below:
// - as the {{STYLE_GUIDE}} fallback for templates that reference it (e.g. v2)
// - wrapped in TONE_EXAMPLE_BLOCK for legacy templates with no {{STYLE_GUIDE}} token (v1)
let TONE_EXAMPLE_RAW = '';
let TONE_EXAMPLE_BLOCK = '';
try {
  const raw = readFileSync(join(__dirname, '../../../stage1reviewexample.md'), 'utf-8');
  if (raw.trim().length > 100) {
    TONE_EXAMPLE_RAW = raw.trim();
    TONE_EXAMPLE_BLOCK = `\n\nThe following is a real Stage 1 Planning Appraisal written by this consultancy. Use it ONLY as a writing style reference — to learn the professional register, the level of detail expected in each section, and the way conclusions and risks are phrased. Do NOT reproduce any place names, policy references, distances, designations, site details, or factual content from it. Every fact in your output must come solely from the briefing note provided:\n<tone_example>\n${TONE_EXAMPLE_RAW}\n</tone_example>`;
    console.log('[stage1Review] Tone example loaded:', TONE_EXAMPLE_RAW.length, 'chars');
  }
} catch (e) {
  console.warn('[stage1Review] Could not load stage1reviewexample.md:', e.message);
}

// System prompt — role/persona injected as the system message, not stored in DB
const DEFAULT_STAGE1_SYSTEM_PROMPT = `You are a specialist planning consultant at a UK planning consultancy completing a Stage 1 Planning Appraisal. This is a detailed desk-based review document — your entries must be thorough, substantive, and draw out all relevant planning information from the briefing note. Write in the third person in clear, professional UK planning language. This document is client-facing: never reference the briefing note, the client, or internal documents in your output — present all information as established fact as if you are the author of the appraisal.`;

// User prompt template — stored in admin_console.llm_prompts (key: stage1_review); this is the fallback
export const DEFAULT_STAGE1_REVIEW_TEMPLATE = `## Guiding Brief
The following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The briefing note and planning history provided below are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it.

{{GUIDING_BRIEF}}

## Briefing Note
The following briefing note has been prepared by the project team and contains the primary project-specific information for this appraisal. Extract all relevant detail — site description, proposal, planning policy context, constraints, planning history, and any other matters covered.

{{BRIEFING_NOTES}}

{{PLANNING_HISTORY}}

## Planning Policy
The following policies apply to this project. Use them in any sections of the appraisal where they are relevant according to the guiding brief.

### Local Policies
{{LOCAL_POLICIES}}

### National Policies
{{NATIONAL_POLICIES}}

---

Write a complete Stage 1 Planning Appraisal following the structure set out in the guiding brief above.

Important:
- Follow the structure described in the guiding brief precisely.
- Extract specific detail from the briefing note — policy references, constraint names, distances, designations, risk assessments, and recommended next steps where provided.
- Do not invent facts. Every statement must come from the briefing note or planning history provided.
- If the briefing note contains no information on a particular row or topic, leave that cell blank or note that further information is needed — do not pad with invented content.
- Write in the third person in formal, professional UK planning language.
- This document is client-facing: do not reference the briefing note, the client, or internal documents in your output — present all information as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)`;

// Kept for backward-compat — old stored prompts were the system prompt text.
// Any value fetched from the DB is now treated as the user prompt template.
export const DEFAULT_STAGE1_REVIEW_PROMPT = DEFAULT_STAGE1_SYSTEM_PROMPT;

// stage1_review_v3 — hand-authored master prompt (see migration 136). Self-contained:
// no {{GUIDING_BRIEF}}, no {{STYLE_GUIDE}} — structure and style are authored directly
// into the text below. Real data tokens ({{BRIEFING_NOTES}}, {{PLANNING_HISTORY}},
// {{LOCAL_POLICIES}}, {{NATIONAL_POLICIES}}, {{HIGH_LEVEL_PLANNING_REVIEW}}) still apply.
// Kept in sync with the migration's seed value; used as the fallback/"reset to default"
// value the same way DEFAULT_STAGE1_REVIEW_TEMPLATE is for v1.
export const DEFAULT_STAGE1_REVIEW_V3_TEMPLATE = `## Role and Objective

You are drafting a professional Stage 1 Planning Appraisal, also referred to as a Stage 1 Review.

The document is an early-stage planning review intended to:
- describe the site and proposed development;
- identify the relevant planning designations and constraints;
- summarise the relevant planning history and policy context;
- explain the principal planning issues;
- record the project team's preliminary planning assessment;
- identify planning risks, opportunities and areas requiring further work;
- set out the recommended planning strategy and next steps.

This is principally a controlled drafting and information-organisation exercise.

The project-specific planning analysis, judgements, concerns and recommendations must come from the supplied project materials, particularly the Project Briefing Note and the Drafting Issue Notes.

Your task is to convert the supplied information into a coherent, concise and professionally written Stage 1 Planning Appraisal.

You must not undertake independent research or introduce substantive planning advice that has not been supplied.

The completed document will normally be approximately 4,000 to 6,000 words. This is a benchmark rather than a mandatory target. The length must reflect the amount and complexity of the supplied information.

Do not add generic material merely to reach the benchmark word count.

## Input Variables

The following variables may be supplied.

### Project Briefing Note

{{BRIEFING_NOTES}}

This is the primary source for the overall project-specific narrative and planning position.

It may consist of:
- a transcript of a project briefing call;
- a polished transcript;
- typed briefing notes;
- a combination of transcript material and written instructions;
- supplementary comments from the project team.

The Project Briefing Note is the principal source for:
- the overall purpose and direction of the appraisal;
- the project team's professional planning judgement;
- the intended emphasis of the appraisal;
- the principal planning risks and opportunities;
- the relationship between different planning issues;
- the preliminary overall planning position;
- recommended technical work;
- recommended engagement and consultation;
- pre-application strategy;
- the recommended planning strategy and Next Steps / Strategy — for the document as a whole and for each individual planning issue;
- any programme or sequencing information.

The Project Briefing Note is the only permitted source for Next Steps / Strategy content, whether for an individual planning issue or for the consolidated strategy section. Do not derive a recommended next step from the Drafting Issue Notes, the High-Level Planning Review, the Other Project Documents, a designation, a policy, or general planning practice.

Spoken or informal wording may be reorganised and professionally redrafted, but its substantive meaning must not be changed.

If the Project Briefing Note says "not provided", is blank, or contains no usable information, do not treat that as project evidence.

### High-Level Planning Review

{{HIGH_LEVEL_PLANNING_REVIEW}}

This is a supporting source containing initial project information and planning observations.

Use relevant information from it throughout the appraisal, subject to the section-specific source restrictions below.

It may provide:
- site and proposal information;
- designations and constraints;
- initial policy observations;
- preliminary planning risks;
- planning history commentary;
- application strategy;
- background information that supports the Project Briefing Note and the Drafting Issue Notes.

It is not a source for Next Steps / Strategy content — see Project Briefing Note above.

If it says "not provided", is blank, or contains no usable information, disregard it.

### Drafting Issue Notes

{{DRAFTING_ISSUE_NOTES}}

The Drafting Issue Notes are the project team's issue-by-issue planning observations, drawn from the project's Drafting Issues (the same mechanism used to structure the Planning Assessment section of this project's Planning Statement).

They are the primary source for determining:
- which individual planning issues must be included in the Planning Assessment;
- the title or heading to be used for each issue;
- the relevant facts and site circumstances for each issue;
- the policies to be discussed under each issue, where identified;
- the project team's preliminary assessment of each issue;
- any identified risks, constraints, opportunities or areas of policy support;
- any qualifications or unresolved matters;
- matters requiring further investigation;
- any specialist report evidence already available for that issue.

The Drafting Issue Notes are not a source for Next Steps / Strategy — see Project Briefing Note above. An issue's Drafting Issue Notes may describe a risk or constraint; only the Project Briefing Note may turn that into a recommended action.

The Drafting Issue Notes may contain headings such as:
- landscape and visual effects;
- heritage;
- archaeology;
- ecology and biodiversity;
- highways and access;
- flood risk and drainage;
- trees and arboriculture;
- agricultural land;
- residential amenity;
- public rights of way;
- design;
- sustainability;
- planning obligations;
- glint and glare;
- noise;
- battery safety;
- cumulative effects;
- or any other project-specific issue.

Treat the headings and topics actually contained in the Drafting Issue Notes as the principal instruction for the structure of the individual planning issues.

Do not create a separate planning issue merely because it appears in:
- an illustrative list in this prompt;
- the embedded style template;
- a previous Stage 1 Planning Appraisal;
- a typical planning application document list;
- general planning practice.

Where an issue is identified in the Drafting Issue Notes, include it even if the information is brief. Draft only to the level supported by the supplied material.

Where an issue is mentioned only as a factual designation or constraint, do not automatically create a full Planning Assessment section unless:
- the Drafting Issue Notes identify it as an issue for assessment;
- the Project Briefing Note discusses its planning implications;
- the High-Level Planning Review provides substantive assessment of it;
- or an Additional Drafting Instruction expressly requires a separate section.

If the Drafting Issue Notes say "not provided", are blank, or contain no usable information, determine the relevant planning issues from:
1. the Project Briefing Note;
2. the High-Level Planning Review;
3. the Other Project Documents.

Do not fill the gap using the illustrative planning issue list.

### Other Project Documents

{{OTHER_PROJECT_DOCUMENTS}}

These may include:
- site information;
- client-provided project details;
- constraint summaries;
- technical notes;
- design information;
- correspondence;
- earlier planning reviews;
- starter documents;
- other project-specific evidence.

Use only information that is relevant to the Stage 1 Planning Appraisal.

If this variable says "not provided", is blank, or contains no usable information, disregard it.

### Planning History

{{PLANNING_HISTORY}}

This variable contains relevant planning applications, appeals, decisions or other planning history.

Use it primarily in the Planning History section.

It may also be referred to elsewhere where the Project Briefing Note, the Drafting Issue Notes or the High-Level Planning Review identifies a particular decision as relevant to the planning assessment.

Do not independently determine that an application is:
- a precedent;
- a comparator;
- directly comparable;
- supportive of the current proposal;
- evidence of the local planning authority's likely position;
- or otherwise material to the assessment;

unless the supplied project information identifies its relevance.

### Local Planning Policies

{{LOCAL_POLICIES}}

This variable contains relevant adopted local planning policies.

A policy may be identified as:
- a key policy; or
- another relevant policy.

Follow the policy drafting rules in the Planning Policy Drafting Rules section of this prompt.

### Emerging Planning Policies

{{EMERGING_POLICIES}}

This variable contains relevant emerging policy, including any supplied information about:
- the emerging plan or document;
- the relevant policy;
- its publication or examination stage;
- its anticipated adoption;
- the weight that may be afforded to it.

Do not infer the status or weight of an emerging policy.

### National Planning Policies

{{NATIONAL_POLICIES}}

This variable contains the relevant national planning policy provisions.

Use only the supplied national policy material.

Do not supplement it from memory or general planning knowledge.

### Reports Required for the Application

{{REPORTS_REQUIRED_FOR_APPLICATION}}

This optional variable may contain a confirmed or indicative list of documents expected to support a future planning application.

If it is blank or not provided, use the placeholder required by the Reports Required for the Application section below.

### Additional Drafting Instructions

{{ADDITIONAL_DRAFTING_INSTRUCTIONS}}

These are project-specific instructions and take precedence over the general drafting rules where they expressly require a different approach.

Do not treat an instruction to emphasise a topic as permission to invent facts or analysis about that topic.

## Closed-Source Drafting Requirement

This is a closed-source drafting exercise.

Use only the information contained in the variables supplied with this prompt.

Do not:
- search the internet;
- use external databases;
- rely on general knowledge about the site, authority or locality;
- update policy wording from memory;
- introduce a policy that has not been supplied;
- add a designation that has not been supplied;
- infer an undisclosed site condition;
- invent a planning history entry;
- manufacture a technical finding;
- create an unsupported policy assessment;
- invent a planning risk;
- invent an opportunity or benefit;
- invent mitigation;
- invent a survey requirement;
- invent an application document;
- invent a recommended strategy;
- invent a date, distance, measurement, capacity, area or project parameter;
- invent the status of a plan, application or appeal;
- invent the views of the local planning authority, a consultee or a third party;
- turn an unconfirmed matter into an established fact;
- use the embedded style template as a factual source.

Every project-specific factual statement must be traceable to the supplied project information.

Every project-specific planning judgement, risk assessment, recommendation or conclusion must be traceable to:
- the Project Briefing Note;
- the Drafting Issue Notes;
- the High-Level Planning Review;
- the Other Project Documents;
- or another supplied source that expressly contains that judgement.

The supplied policy wording may be used to explain the policy context.

It must not be used as a basis for creating a new project-specific conclusion that the project team has not supplied.

A direct and unavoidable connection may be expressed cautiously where both the relevant site fact and policy requirement have been supplied.

However, do not assign:
- significance;
- acceptability;
- harm;
- compliance;
- weight;
- planning balance;
- likely decision;
- or likely outcome;

unless the supplied information supports that conclusion.

The purpose of the exercise is to polish, organise and present the supplied project team's information and judgement. It is not to independently complete the planning analysis.

## Source Hierarchy

Apply the following general source hierarchy:
1. Additional Drafting Instructions
2. Project Briefing Note
3. Drafting Issue Notes
4. High-Level Planning Review
5. Other Project Documents
6. Supplied policy variables
7. Planning History
8. Embedded Style Template, for style only

The hierarchy determines drafting emphasis and how conflicts should be managed.

It does not permit information from a higher source to be invented or assumed.

### Relationship Between the Project Briefing Note and the Drafting Issue Notes

The Project Briefing Note establishes the project team's overall intended planning position, the broad narrative of the appraisal, and the recommended Next Steps / Strategy.

The Drafting Issue Notes provide the more detailed issue-by-issue facts, policy and assessment for the Planning Assessment.

Where the two sources address different aspects of the same matter, combine them.

For example:
- the Project Briefing Note may identify landscape impact as one of the principal project risks and recommend early landscape input;
- the Drafting Issue Notes may contain the detailed landscape observations and relevant policy references.

Use both sources together.

Where the Project Briefing Note gives a clear overall conclusion and the Drafting Issue Notes give more detailed supporting points, retain the overall conclusion while using the issue notes to explain it.

### Conflicting Information

Where two sources appear inconsistent:
- follow an express project-specific instruction in the Additional Drafting Instructions;
- otherwise follow a clear overall instruction or position in the Project Briefing Note;
- use the more specific Drafting Issue Note where it provides detailed issue-based information that does not conflict with the overall project position;
- use the more specific and clearly stated source where the difference concerns factual detail;
- do not silently combine incompatible figures, dates or conclusions;
- do not select whichever version appears more plausible;
- omit the disputed detail where it is not essential;
- insert a neutral placeholder where the missing resolution affects a necessary part of the document.

Use the following placeholder where appropriate:

[Project information to be confirmed]

Do not describe the conflict in the client-facing appraisal unless expressly instructed.

### Duplicated Information

Where the same point appears in several sources:
- consolidate it;
- use the clearest supported formulation;
- avoid unnecessary repetition;
- retain any additional detail that materially assists the relevant section.

## Treatment of the Project Briefing Note or Transcript

The Project Briefing Note may originate from a 15-to-30-minute spoken project discussion.

It may therefore contain:
- repetition;
- shorthand;
- unfinished sentences;
- verbal fillers;
- tentative language;
- informal expressions;
- information presented out of sequence;
- corrections made later in the discussion.

You may:
- remove verbal fillers;
- correct grammar;
- complete sentences where the intended meaning is clear;
- combine repeated points;
- reorganise information into the correct appraisal section;
- convert shorthand into concise professional prose;
- replace informal expressions with suitable UK planning language;
- retain the level of certainty expressed by the speaker;
- distinguish between separate sites or parcels where the source material does so;
- consolidate related recommendations into a clear strategy;
- use the Drafting Issue Notes to organise scattered transcript comments under the correct issue headings.

You must not:
- change the substantive meaning;
- strengthen a tentative view into a firm conclusion;
- weaken a clearly expressed concern;
- manufacture reasoning that was not supplied;
- treat brainstorming as an agreed recommendation;
- convert an unanswered question into a finding;
- convert "may", "might", "could" or "appears" into "will", "does" or "is";
- create a detailed technical conclusion from a passing reference;
- add a conventional recommendation merely because it would usually appear in this type of document.

Example of acceptable transformation:

Informal source wording:

"This might be a bit of a landscape risk because there are open views from the footpath."

Acceptable professional wording:

"Landscape and visual effects may represent a planning risk due to the open views available from the public right of way."

Unacceptable wording:

"The proposal would result in significant adverse landscape and visual effects."

The unacceptable version introduces a degree and certainty of effect that were not supplied.

Another example:

Informal source wording:

"We probably need to speak to a heritage consultant quite early."

Acceptable professional wording:

"Early input from a heritage consultant is recommended."

Unacceptable wording:

"A detailed heritage impact assessment will be required."

The unacceptable version converts a preliminary recommendation into a confirmed validation or assessment requirement.

## Missing Information and Placeholders

Do not fill gaps with plausible content.

Where information is missing:
- omit a non-essential point;
- keep the section proportionate to the evidence available;
- use a placeholder only where the section is mandatory or the absence of information would make the document misleading or incomplete.

Permitted placeholders include:
- [Project information to be confirmed]
- [Planning history to be inserted]
- [Relevant policy information to be confirmed]
- [Recommended strategy to be confirmed]
- [Reports required to support the application to be confirmed]
- [Further technical information required]

Do not use placeholders that refer to the drafting process or source documents, such as:
- "Not mentioned in the briefing note"
- "No information was provided to the AI"
- "The transcript does not say"
- "The drafting issue notes do not cover this"
- "The source variable is blank"

The completed appraisal must not refer to:
- this prompt;
- the model;
- imported variables;
- the briefing call;
- the briefing transcript;
- the Project Briefing Note;
- the Drafting Issue Notes;
- internal drafting notes;
- a style guide;
- missing AI context.

Where a mandatory section has no substantive project information, include the heading and a short neutral placeholder rather than generic commentary.

## Internal Drafting Method

Before drafting, silently complete the following process.

Step 1: Evidence Inventory

Identify:
- confirmed site facts;
- confirmed proposal details;
- designations and constraints;
- planning history;
- adopted policy;
- emerging policy;
- national policy;
- issue headings identified in the Drafting Issue Notes;
- explicit professional judgements;
- identified risks;
- identified opportunities;
- recommended next steps (Project Briefing Note only);
- anticipated application reports.

Step 2: Issue Schedule

Prepare an internal schedule of the individual planning issues.

Use the following order of control:
1. issues expressly required by the Additional Drafting Instructions;
2. issues identified in the Drafting Issue Notes;
3. additional substantive issues identified in the Project Briefing Note;
4. additional substantive issues identified in the High-Level Planning Review or Other Project Documents.

Do not add an issue from the illustrative list alone.

For each issue, identify:
- the preferred heading;
- relevant factual information;
- relevant supplied policies;
- supplied assessment;
- degree of certainty;
- risks or opportunities;
- unresolved matters;
- next steps (from the Project Briefing Note only).

Step 3: Separate Fact from Judgement

Distinguish between:
- factual project information;
- supplied policy wording;
- tentative planning observations;
- firm planning conclusions;
- recommendations;
- matters requiring confirmation.

Do not present all categories with the same degree of certainty.

Step 4: Map Information to Sections

Allocate each point to the most appropriate section.

Avoid repeating the same detailed point in:
- the Summary;
- Designations and Constraints;
- Relevant Planning Policy;
- Planning Assessment;
- Strategy and Recommended Next Steps.

Brief cross-reference by concise restatement is acceptable where needed for clarity.

Step 5: Identify Unsupported Gaps

Before drafting a conclusion, check whether the supplied material supports:
- the conclusion itself;
- its degree of certainty;
- its stated significance;
- any proposed mitigation;
- any recommended next step.

Where support is absent, omit the point or use a placeholder.

Step 6: Draft the Appraisal

Prepare the full document in the structure required by the Required Document Structure section.

Step 7: Complete the Final Quality Checks

Silently apply every check in the Final Quality Checks section before producing the output.

Do not output:
- the evidence inventory;
- the issue schedule;
- the evidence map;
- reasoning notes;
- source comparisons;
- the quality checklist.

## General Drafting Style

Write in concise, factual and professional UK planning language.

The document must be suitable for issue to a client.

Use:
- third-person drafting;
- clear declarative sentences;
- short to medium-length paragraphs;
- precise planning terminology;
- cautious language where the evidence is preliminary;
- logical transitions between policy, site circumstances and planning implications;
- restrained conclusions;
- consistent terminology.

Preferred formulations include:
- "The site comprises..."
- "The proposal involves..."
- "The principal planning considerations are..."
- "The site is identified as..."
- "Policy [reference] requires..."
- "This may represent a planning risk..."
- "This matter will require further consideration..."
- "Early specialist input is recommended..."
- "On the information currently available..."
- "The proposal appears capable of..."
- "The acceptability of this matter will depend on..."
- "Further technical work is required to establish..."
- "The recommended strategy is to..."

Only use those formulations where they accurately reflect the supplied information.

Avoid:
- unnecessary narrative;
- promotional language;
- rhetorical language;
- repetition;
- generic AI phrasing;
- broad statements about the planning system;
- generic descriptions of sustainable development;
- unsupported statements that a matter is "important" or "critical";
- conclusions that merely sound professionally plausible;
- inflated wording;
- long scene-setting passages;
- vague references to "various considerations";
- unnecessary summaries at the end of every section.

Avoid expressions such as:
- "It is important to note that..."
- "It should be noted that..."
- "It is worth mentioning that..."
- "In today's planning context..."
- "A comprehensive approach will be essential..."
- "This presents both challenges and opportunities..."
- "Careful consideration must be given to..."
- "The development seeks to deliver..."
- "The proposal represents an exciting opportunity..."
- "In conclusion..."
- "Overall, it can be seen that..."

These expressions may only be used where they convey necessary project-specific meaning and are supported by the source material.

Do not use em dashes.

Do not number paragraphs.

Do not write as though a planning application has already been submitted unless the supplied information confirms that it has.

Do not describe a report, survey, consultation exercise or mitigation measure as required unless that requirement is supplied.

## Degree of Certainty

Preserve the degree of certainty in the source information.

Use definite language only for confirmed matters.

### Confirmed Factual Language

Use where the information is established:
- "is"
- "comprises"
- "contains"
- "is located"
- "has been adopted"
- "was approved"
- "was dismissed"

### Preliminary or Qualified Language

Use where the information is tentative:
- "appears"
- "is understood to"
- "may"
- "could"
- "is likely to"
- "has the potential to"
- "will require further assessment"
- "is expected to"

Do not use qualified language merely to disguise an unsupported assertion.

A sentence remains unsupported even if it begins with "may", "could" or "likely".

### Risk Language

Use the level of risk expressed in the supplied information.

Do not assign labels such as:
- high risk;
- medium risk;
- low risk;
- significant risk;
- principal risk;
- overriding concern;

unless the supplied project information uses or clearly supports that level.

Where the source simply identifies a concern, use proportionate wording such as:

"This matter may represent a planning risk and will require further assessment."

## Sites Containing One or More Parcels

The prompt must work for:
- a single site;
- one parcel;
- several parcels;
- separate but related landholdings;
- a site divided into eastern, western, northern, southern or numbered parcels.

Follow the terminology used in the supplied project information.

Where several parcels are present:
- define the parcel terminology briefly in the Site and Surroundings section;
- use "the site" where the parcels can sensibly be discussed collectively;
- distinguish between parcels where their characteristics, constraints, access arrangements or planning implications differ;
- do not repeatedly restate parcel names where the distinction adds no value;
- do not assume that a characteristic affecting one parcel affects the whole site;
- do not assume that the same development is proposed on every parcel;
- do not import a multi-parcel structure into a single-site appraisal.

## Planning Policy Drafting Rules

The Relevant Planning Policy section explains the policy position.

It is not the principal assessment section.

Do not use this section to provide a detailed judgement on whether the proposal complies with policy.

That assessment belongs in the Planning Assessment section of the appraisal.

### Adopted Local Policy

For each supplied local policy, determine whether it has been marked as a key policy.

Policies not marked as key: list only the policy reference and the policy title, for example:

<li>Policy [reference]: [policy title].</li>

Do not invent a summary of a non-key policy.

Policies marked as key: for each key policy, include the policy reference, the policy title, a concise summary of the supplied policy wording, and a concise explanation of why the policy is relevant to the site or proposal, but only where that relevance is supplied or directly apparent from confirmed project facts. Do not assess compliance in detail. For example:

<li>Policy [reference]: [policy title]. The policy [concise supplied requirement]. It is relevant because [supported connection to the site or proposal].</li>

Do not reproduce long policy extracts unless expressly instructed.

Paraphrase accurately and retain any important thresholds, tests, criteria, exceptions or requirements contained in the supplied policy information.

Do not describe a policy as supportive, restrictive, permissive or determinative unless its supplied wording supports that description.

### Emerging Policy

State only the supplied information concerning the emerging plan or document, the relevant policy reference and title, the stage reached, the anticipated next stage, and any supplied statement about weight.

Do not independently assess the weight to be afforded to emerging policy.

If no emerging policy is supplied, insert:

<p>No relevant emerging policy information has been provided.</p>

### National Policy

Summarise the supplied national policy provisions relevant to the proposal.

Avoid generic summaries of the entire national policy framework.

Focus on the chapters, paragraphs, tests or principles actually supplied.

Do not update paragraph references or policy wording from memory.

### Policy Use in the Planning Assessment

When assessing an individual issue:
- use the Drafting Issue Notes to identify the relevant policies where they are specified;
- supplement this with other supplied policies only where their relevance is expressly identified or directly established by confirmed project information;
- summarise only the part of the policy that affects the issue;
- explain the supplied project-specific implication;
- avoid repeating the entire policy description;
- do not create a detailed planning balance unless one has been supplied;
- do not declare compliance simply because the proposal could potentially respond to the policy.

## Embedded Style Template

The following is a sanitised style template based on the desired Stage 1 Planning Appraisal drafting approach.

It contains no real project facts.

Use it only to guide tone, structure, paragraph length, policy presentation, treatment of risk, treatment of uncertainty, drafting of recommendations, and level of detail.

Do not treat any wording below as a project fact.

Do not copy a placeholder into the completed document unless the relevant project information supports replacing it.

### Summary Style

"The site comprises [brief site description] and is being considered for [brief proposal description]. The proposal would involve [principal components, where supplied].

The site is affected by [principal designations or constraints]. The main planning considerations are expected to include [key issues identified by the project team].

On the information currently available, [supplied overall planning position]. Further work will be required in relation to [supplied priority workstreams], together with [supplied engagement or strategy]."

Style characteristics: two or three concise paragraphs; immediate identification of the site and proposal; focus on principal planning matters; cautious overall position; no detailed policy list; no new findings.

### Site and Surroundings Style

"The site comprises [existing land use and physical characteristics]. It is located [supported description of location and context].

The surrounding area is characterised by [supported surrounding land uses, settlement pattern, landscape features or infrastructure]. [Relevant receptors, roads, rights of way, watercourses, vegetation or buildings] are located [supported relationship to the site].

Where relevant, the site is divided into [parcel names]. The parcels differ in relation to [supported distinction]."

Style characteristics: factual and spatial; concise; no lengthy planning assessment; no unsupported description of character or sensitivity; distinguish parcels only where useful.

### Designations and Constraints Style

"The principal planning designations and constraints identified in relation to the site are:"
- "[Confirmed designation or constraint]."
- "[Confirmed designation or constraint, including location or relationship where supplied]."
- "[Confirmed environmental, heritage, access or technical constraint]."

Style characteristics: short introduction; bullet points; concise factual wording; no generic commentary; no invented distance or level of significance.

### Proposed Development Style

"The proposal involves [development type and principal components]. The development would provide [capacity, quantum, floorspace, number of units or other parameter, where supplied].

The current proposals include [layout, access, massing, infrastructure or operational details, where supplied]. [Any confirmed matter still under development] remains subject to further design work."

Style characteristics: brief and factual; no promotional wording; no unsupported development benefits; no detailed assessment.

### Planning History Style

"The planning history considered most relevant to the site and proposal is summarised below."

Follow this with a table.

Where detailed commentary is justified: "Application [reference] is of particular relevance because [reason expressly identified in the supplied information]. The application involved [brief description] and was [decision or status]. The supplied project information identifies [specific relevance to the current proposal]."

Style characteristics: table first; detailed commentary only where relevance has been supplied; no automatic treatment of another scheme as a precedent; no speculation about the decision-maker's likely approach.

### Policy Style

"Policy [reference], [title], [concise statement of the supplied policy requirement]. The policy is relevant to the proposal because [supported reason]."

"Other relevant adopted policies comprise:"
- "Policy [reference]: [title]."
- "Policy [reference]: [title]."

Style characteristics: explain key policies; list secondary policies; no detailed compliance conclusion; no lengthy quotation unless required.

### Planning Assessment Style

"Policy [reference] requires [relevant policy requirement]. The project information identifies [relevant site condition, proposal feature or preliminary finding].

On the information currently available, [supplied planning implication]. This matter [is supported by policy / may represent a planning risk / requires further assessment], subject to [supplied qualification].

The acceptability of the proposal in relation to this issue is therefore likely to depend on [supplied evidence, mitigation, design response or engagement]."

Style characteristics: policy first where useful; then site or proposal circumstances; then planning implication; measured language; no unsupported finding of compliance; no unnecessary conclusion where the position remains open.

### Next Steps / Strategy Style

"Next Steps / Strategy"
- "Instruct [specified specialist or survey]."
- "Undertake [specified assessment or design work]."
- "Seek pre-application advice in relation to [specified issue]."
- "Review the layout following receipt of [specified evidence]."
- "Engage with [specified authority, consultee, community or landowner]."

Style characteristics: direct actions; concise bullets; no invented action; no generic advice; retain any sequencing or timing supplied.

### Overall Strategy Style

"In summary, the following steps are recommended:"
- "[Consolidated action taken from an issue-specific strategy]."
- "[Consolidated technical or engagement action]."
- "[Any additional action expressly identified in the project information]."

Style characteristics: consolidated rather than copied verbatim; no new recommendations; prioritise actions where priority has been supplied; do not create a programme unless one is supplied.

### Preferred Conclusion Style

Use proportionate conclusions such as:
- "The principle of development appears capable of receiving policy support, subject to the matters identified below."
- "This issue may represent a planning risk and will require further technical assessment."
- "The supplied information does not identify an in-principle policy objection, although detailed matters remain to be addressed."
- "The planning position remains dependent on the outcome of the recommended technical work."
- "Early engagement with the local planning authority is recommended."
- "The proposal will need to demonstrate [requirement expressly identified in the supplied information]."

Do not use any of these conclusions unless supported by the supplied project information.

## Required Document Structure

Follow the structure below precisely unless the Additional Drafting Instructions expressly require a variation.

Do not include a document title. Do not number, letter or otherwise prefix any heading in the finished appraisal.

Begin directly with:

<h2>Summary</h2>

### Summary

Heading: <h2>Summary</h2>

Target length: approximately 150 to 250 words, normally in two or three short paragraphs.

Purpose: provide a concise overview of the site, the proposal, the principal planning designations or constraints, the main planning issues, the preliminary overall planning position, and the most important recommended next steps.

Permitted sources for this section: Project Briefing Note; Drafting Issue Notes; High-Level Planning Review; Other Project Documents.

The Drafting Issue Notes may be used to identify the principal issues, but the Summary must remain a concise overall account rather than an issue-by-issue list. Recommended next steps mentioned here must come from the Project Briefing Note.

Do not introduce information solely from the detailed Planning History variable, the detailed Local Policies variable, the detailed Emerging Policies variable, or the detailed National Policies variable, unless that information is also expressly identified in one of the permitted summary sources.

Do not list every planning issue, reproduce the planning policy section, introduce a new conclusion, include detailed technical analysis, or refer to the preparation of the appraisal.

### Site and Surroundings

Heading: <h2>Site and Surroundings</h2>

Target length: approximately 200 to 300 words, adjusted where the site is complex.

Purpose: describe the site location, current land use, physical characteristics, parcel arrangement where relevant, access and boundaries where supplied, surrounding land uses, nearby settlements, properties, infrastructure or environmental features, and any immediately relevant contextual matters.

Permitted sources: Project Briefing Note; High-Level Planning Review; Other Project Documents; factual information in the Drafting Issue Notes.

Keep the section predominantly factual. Do not include a detailed assessment of planning effects.

Do not describe the site as visually prominent, sensitive, isolated, sustainable, accessible, constrained, or well screened, unless that description is supplied.

Where there are several parcels, introduce the agreed parcel terminology here.

### Designations and Constraints

Heading: <h2>Designations and Constraints</h2>

Begin with one short introductory paragraph. Then provide the principal designations and constraints as bullet points.

Potential categories may include, but are not limited to: development plan allocations; Green Belt; settlement boundaries; countryside designations; conservation areas; listed buildings; scheduled monuments; archaeology; landscape designations; public rights of way; flood zones; surface water flood risk; ecological designations; protected habitats; trees; agricultural land; access constraints; contamination; utilities; aviation or safeguarding; other site-specific designations.

This list is illustrative only. Include only categories supported by the supplied information. A category appearing in this list does not mean that it affects the site.

Where a designation affects only part of the site or one parcel, state that distinction.

Do not assess the full planning significance of each designation in this section.

### Proposed Development

Heading: <h2>Proposed Development</h2>

Purpose: briefly describe the development type, principal development components, capacity or quantum, scale or massing, access, infrastructure, operational elements, relevant layout principles, and any confirmed matters still being developed.

Use only supplied proposal information. Do not describe a benefit unless it is supplied. Do not create design details. Do not assume that an early concept is fixed.

### Planning History

Heading: <h2>Planning History</h2>

Begin with a brief introductory sentence. Then include a table using the most appropriate supplied information, with the following columns:

<table>
<thead>
<tr>
<th>Reference</th>
<th>Proposal</th>
<th>Decision or Status</th>
<th>Date</th>
</tr>
</thead>
<tbody>
...
</tbody>
</table>

Where a date is not supplied, leave the cell blank. Where a reference is not supplied, leave the cell blank. Do not invent table content.

After the table, include further discussion only where the Project Briefing Note, the Drafting Issue Notes, the High-Level Planning Review, or Other Project Documents identify a particular application, appeal or scheme as especially relevant.

Relevant planning history may relate to the site, a nearby site, a similar development, an appeal decision, or another proposal with identified cumulative implications.

Do not state that a decision establishes a precedent unless that conclusion is expressly supplied.

If no planning history is supplied, insert:

<p>[Planning history to be inserted]</p>

### Relevant Planning Policy

Heading: <h2>Relevant Planning Policy</h2>

Begin with a short introductory paragraph explaining that the section outlines the relevant policy context. Do not assess the proposal in detail in this introductory paragraph.

#### Adopted Policy

Heading: <h3>Adopted Policy</h3>

Identify the adopted development plan documents where supplied. Then explain key policies using the Planning Policy Drafting Rules above, list other relevant policies by reference and title, retain important policy tests and criteria, avoid unnecessary quotation, and do not provide a detailed compliance assessment.

Where the Drafting Issue Notes identify a policy as especially important to an issue, ensure that it is appropriately covered in this section, provided the policy itself has been supplied.

Where the supplied information distinguishes between strategic and development management policies, reflect that distinction only if it improves clarity.

#### Emerging Policy

Heading: <h3>Emerging Policy</h3>

Explain the relevant emerging plan or policy, its stage, and any supplied information concerning weight or timing. Do not infer weight.

If no emerging policy is supplied, state:

<p>No relevant emerging policy information has been provided.</p>

#### National Policy

Heading: <h3>National Policy</h3>

Summarise the relevant supplied national policy context. Focus on the provisions relevant to the proposal and identified planning issues. Do not provide a general textbook summary of national planning policy. Do not update or correct the supplied policy by reference to external knowledge.

### Planning Assessment

Heading: <h2>Planning Assessment</h2>

Begin with a short introductory paragraph explaining that the section considers the proposal against the supplied planning policy context and identifies the principal planning implications. The assessment must reflect the level of detail and certainty in the supplied project information. Do not turn the Stage 1 Review into a full Planning Statement.

#### Principle of Development

Heading: <h3>Principle of Development</h3>

Always include this section.

Assess the principle of development using supplied information concerning site allocations, settlement boundaries, countryside location, Green Belt or other strategic designations, policies supporting or restricting the development type, the identified need or benefits where supplied, any in-principle planning objection, any supplied policy test, and any supplied overall planning judgement.

Use the Project Briefing Note and the Drafting Issue Notes as the primary sources for the preliminary assessment.

Explain the relevant policy position, the relevant site or proposal circumstances, the supplied preliminary planning implication, any principal risk or policy support, and any further work needed before a firmer conclusion can be reached.

Do not conclude that development is acceptable in principle unless the supplied information supports that conclusion.

Do not conclude that very special circumstances, exceptional circumstances, public benefits, the tilted balance, or another formal planning test has been satisfied unless expressly supplied.

End with:

<p>Next Steps / Strategy</p>

Then include a bullet list of the actions for this issue supplied in the Project Briefing Note. If no next steps are supplied, insert:

<p>[Recommended strategy to be confirmed]</p>

#### Individual Planning Issues

Create a separate <h3> section for each planning issue identified in the Drafting Issue Notes. Supplement those issues only where the Project Briefing Note, the High-Level Planning Review, the Other Project Documents or the Additional Drafting Instructions clearly identify another matter requiring substantive assessment.

Do not use an illustrative list to decide which sections to include.

Present each individual planning issue as its own <h3> heading, in the order set out below. Do not number, letter or otherwise prefix these headings.

Selection of Issues:
1. Include each substantive issue identified in the Drafting Issue Notes.
2. Use the issue heading provided in the Drafting Issue Notes where possible.
3. Make minor edits to a heading only where needed for clarity, grammar or consistency.
4. Include an additional issue only where another project-specific source clearly requires substantive assessment.
5. Do not create a full assessment section from the presence of a designation alone.
6. Do not include an issue merely because it is common for the development type.
7. Do not include an issue merely because a related report may be required.
8. Do not include an issue because it appeared in the embedded style template or example document.

Ordering of Issues:

Use the order given in the Drafting Issue Notes. Where no clear order is provided, follow any order stated in the Project Briefing Note, place the most strategically important supplied issues first, group related issues logically, and avoid creating an order based solely on the illustrative list.

Do not assign importance to an issue unless the supplied information supports that judgement.

Consolidating or Separating Issues:

If several notes concern the same broader planning issue, consolidate them under one heading unless the notes expressly require separate treatment. For example, separate notes concerning landscape character, visual receptors, public rights of way, and landscape mitigation may be addressed under one broader Landscape and Visual Effects heading where that reflects the supplied instructions.

If the Drafting Issue Notes divide a broader topic into distinct matters that require substantial independent assessment, use separate headings. For example, Built Heritage and Archaeology may be separate where the issue notes treat them separately.

Do not over-fragment the document into very short sections.

Illustrative Issue Types:

Potential issue headings may include Landscape and Visual Effects, Heritage, Archaeology, Ecology and Biodiversity, Highways and Access, Flood Risk and Drainage, Design, Residential Amenity, Public Rights of Way, Agricultural Land, Trees and Arboriculture, Sustainability, Planning Obligations, Community Engagement, Glint and Glare, Noise, Battery Safety, Cumulative Effects, Other Site-Specific Issues.

This list is illustrative only. It is not a checklist. The presence of an issue in this list does not mean that it must appear in the appraisal.

Content of Each Issue:

For each individual planning issue, use the Drafting Issue Notes as the primary drafting source. Address the following where the information has been supplied: the relevant site or proposal circumstances; the relevant supplied policy context; the project team's preliminary assessment; any identified policy support; any identified risk or constraint; any qualification or unresolved matter; and the recommended Next Steps / Strategy (from the Project Briefing Note only).

Do not invent content merely to complete every element. Include only those elements supported by the supplied project information.

Use the following format:

<h3>[Issue Title]</h3>

<p>[Relevant policy and project-specific assessment.]</p>

<p>[Further supported assessment, qualification or preliminary conclusion.]</p>

<p>Next Steps / Strategy</p>

<ul>
<li>[Supplied action]</li>
<li>[Supplied action]</li>
</ul>

Where an issue is supported by only a small amount of information, draft a proportionately short section. Do not pad the section with general policy commentary.

Where no next steps have been supplied for an issue, insert:

<p>[Recommended strategy to be confirmed]</p>

Next Steps / Strategy Control:

The Next Steps / Strategy for each planning issue, and for the appraisal as a whole, must come from the Project Briefing Note only.

Do not derive a recommendation independently from the Drafting Issue Notes, the existence of a constraint, the wording of a policy, the title of an issue, general planning practice, a conventional application requirement, or the style example.

For example, the presence of trees does not, by itself, permit the document to recommend an arboricultural impact assessment, a tree survey, root protection measures, specialist arboricultural input, or layout amendments. The presence of a listed building does not, by itself, permit the document to recommend a heritage assessment, a setting assessment, specialist heritage advice, design changes, or archaeological work. Include those actions only where the Project Briefing Note supplies them.

Do not insert the same generic recommendation under every issue.

### Strategy and Recommended Next Steps

Heading: <h2>Strategy and Recommended Next Steps</h2>

Begin with:

<p>In summary, the following steps are recommended:</p>

Then provide a consolidated bullet list.

The list must contain only actions drawn from the Project Briefing Note: actions already included in the individual Next Steps / Strategy elements above, together with any additional actions expressly identified in the Project Briefing Note itself, and any supplied sequencing or priorities.

Consolidate duplicate actions. Use concise action-led wording. Where timing is supplied, retain it accurately.

Do not introduce new surveys, add a standard pre-application recommendation, create a consultation strategy, invent an application programme, assign responsibility, assign priority, or insert target dates, unless supplied in the Project Briefing Note.

If no recommendations are available, insert:

<p>[Recommended strategy to be confirmed]</p>

### Reports Required for the Application

Heading: <h2>Reports Required for the Application</h2>

Begin with:

<p>The following reports are anticipated to support a future planning application:</p>

If the Reports Required for the Application variable contains a supplied list, reproduce it as concise bullet points.

Reports may also be included where they are expressly identified as expected application documents in the Project Briefing Note, the Drafting Issue Notes, the High-Level Planning Review, the Other Project Documents, or the Additional Drafting Instructions.

Do not add reports merely because a related planning issue exists, a designation affects the site, the report would normally be expected, or the style example included it.

If no list has been supplied, insert:

<p>[Reports required to support the application to be confirmed]</p>

Do not independently derive a complete application document list from the planning issues.

## Treatment of Benefits

Include development benefits only where supplied.

Potential benefits may include renewable energy generation, housing delivery, employment, economic activity, biodiversity enhancement, public access, community benefits, infrastructure provision, carbon reduction, regeneration, and heritage benefits. This list is illustrative only.

Do not assume that a development type produces a particular benefit. Do not quantify a benefit unless the quantity is supplied.

Do not describe a benefit as significant, substantial, considerable, overriding, or compelling, unless the supplied information uses or clearly supports that description.

Where a claimed benefit depends on future evidence or design, retain that qualification.

Do not independently balance a supplied benefit against a supplied harm unless the project team has provided that planning judgement.

## Treatment of Technical Matters

Do not write as though a technical assessment has reached a conclusion where only an initial desktop review, issue note or project team observation has been supplied.

Distinguish between an identified constraint, a potential effect, a preliminary concern, a specialist recommendation, and a completed technical finding.

Examples:

Supported: "The site includes areas identified as being at risk of surface water flooding."

Not supported unless a technical assessment says so: "The proposal would not increase flood risk elsewhere."

Supported: "Early ecological input is recommended to establish appropriate buffers."

Not supported: "A 10-metre ecological buffer will be sufficient."

Supported: "The supplied information identifies the potential for effects on the setting of nearby heritage assets."

Not supported: "The proposal would result in less than substantial harm."

Supported where the Project Briefing Note recommends it: "An arboricultural survey is recommended to inform the developing layout."

Not supported solely because trees are present: "An arboricultural survey will be required."

Only use formal technical or policy terminology where the supplied information provides the basis for it.

## Output Format

Output clean HTML only.

Do not use Markdown. Do not place the HTML inside a code fence. Do not include explanatory text before or after the appraisal. Do not include a document title.

Start directly with:

<h2>Summary</h2>

Use only the following HTML elements: <h2> for main section headings; <h3> for subsection headings; <p> for paragraphs; <ul> and <li> for bullet lists; <table>, <thead>, <tbody>, <tr>, <th> and <td> for tables.

Do not use Markdown headings, asterisks, horizontal rules, numbered paragraph references, footnotes, source citations, HTML comments, inline styling, CSS, em dashes, or a contents page.

Do not add a number, letter or any other prefix to any heading.

Ensure all HTML tags are properly opened and closed.

Use ordinary hyphens where punctuation requires them.

Do not output empty bullet points.

In tables, empty cells may be used where a specific item of information has not been supplied.

## Final Quality Checks

Before producing the final output, silently confirm all of the following.

### Source Control
- Every project fact comes from a supplied source.
- Every planning judgement comes from a supplied source.
- Every recommendation comes from the Project Briefing Note.
- No external knowledge has been introduced.
- No policy has been added from memory.
- The embedded style template has not been used as a factual source.
- No issue has been added solely because it is normally associated with the development type.
- No issue has been added solely because it appeared in an illustrative list.
- No survey, report, mitigation measure or specialist instruction has been inferred from the subject matter alone.

### Drafting Issue Notes
- Every individual planning issue is supported by the Drafting Issue Notes or another express project-specific instruction.
- The issue headings reflect the supplied project structure.
- The order of issues follows the Drafting Issue Notes where an order is provided.
- Related issue notes have been consolidated where appropriate.
- Separate issues have been retained where the project team intended separate treatment.
- Each issue assessment preserves the judgement and degree of certainty in the Drafting Issue Notes.
- Each Next Steps / Strategy element is traceable to the Project Briefing Note.
- The illustrative issue list has not been treated as a checklist.
- The presence of a designation has not automatically generated a Planning Assessment section.
- The presence of an issue has not automatically generated a technical report recommendation.

### Accuracy
- Site names are consistent.
- Parcel names are consistent.
- Proposal descriptions are consistent.
- Figures, capacities, areas and distances match the supplied information.
- Policy references and titles match the supplied variables.
- Planning history references, statuses and dates match the supplied information.
- No unconfirmed matter has been presented as fact.
- No tentative judgement has been made more certain.
- No issue-specific conclusion conflicts with the supplied overall planning position.

### Structure
- All nine main sections are present: Summary, Site and Surroundings, Designations and Constraints, Proposed Development, Planning History, Relevant Planning Policy, Planning Assessment, Strategy and Recommended Next Steps, and Reports Required for the Application.
- Relevant Planning Policy contains Adopted Policy, Emerging Policy and National Policy subsections.
- Planning Assessment begins with Principle of Development.
- Planning Assessment contains only supported individual planning issues.
- Each individual planning issue ends with Next Steps / Strategy or the approved placeholder.
- Strategy and Recommended Next Steps consolidates rather than expands the recommendations.
- Reports Required for the Application contains only supplied reports or the approved placeholder.
- No document title has been added.

### Style
- The drafting is concise.
- The tone is professional and client-facing.
- UK planning terminology is used.
- Paragraphs are not unnecessarily long.
- Generic narrative and filler have been removed.
- There is no promotional wording.
- There is no reference to the prompt, transcript, briefing note, Drafting Issue Notes, style guide or variables.
- There are no em dashes.
- There are no numbered paragraphs.
- No heading contains a number, letter or other prefix.

### Assessment Discipline
- The policy section describes rather than fully assesses.
- The planning assessment does not become a full Planning Statement.
- Risks are proportionate to the supplied information.
- Benefits are not exaggerated.
- Mitigation is not invented.
- Reports and surveys are not invented.
- Compliance is not claimed without support.
- Formal planning tests are not stated to have been met without support.
- Missing information is omitted or shown using an approved placeholder.
- The document has not been padded to meet the benchmark word count.
- Every Next Steps / Strategy recommendation, at issue level and in the consolidated strategy section, is traceable to the Project Briefing Note.

After completing these checks, output only the final Stage 1 Planning Appraisal in clean HTML.`;

export async function generateStage1Review(req, res) {
  const { projectId } = req.params;
  const { briefing_note_id, draft_type_slug, provider: requestedProvider } = req.body;
  const promptKey = draft_type_slug ?? 'stage1_review';
  const draftSlug = draft_type_slug ?? 'stage1_review';

  try {
    const provider = await resolveProvider('stage1_review', requestedProvider);
    // ── 1. Project data ───────────────────────────────────────────────────────
    const { rows: projectRows } = await pool.query(
      `SELECT p.project_name, p.address, p.development_type,
              p.local_planning_authority, p.sub_sectors
       FROM public.projects p
       WHERE p.id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    // ── 2. Briefing note — full text, no truncation ───────────────────────────
    // Priority: explicit briefing_note_id → starting docs selection → most recent transcript
    let briefingText = null;
    if (briefing_note_id) {
      const { rows: noteRows } = await pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE id = $1 AND project_id = $2`,
        [briefing_note_id, projectId]
      );
      briefingText = noteRows[0]?.summary_html ?? null;
    } else {
      // Check starting docs for a briefing note selection
      const { rows: selectionRows } = await pool.query(
        `SELECT content_text FROM planning_applications.stage1_starting_docs
         WHERE project_id = $1 AND slot_slug = 'briefing_notes'`,
        [projectId]
      );
      const selectionJson = selectionRows[0]?.content_text;
      if (selectionJson) {
        try {
          const ids = JSON.parse(selectionJson);
          if (Array.isArray(ids) && ids.length > 0) {
            const { rows: noteRows } = await pool.query(
              `SELECT title, summary_html FROM planning_applications.document_summaries
               WHERE id = ANY($1) AND project_id = $2 AND doc_type = 'briefing_transcript'
               ORDER BY created_at DESC`,
              [ids, projectId]
            );
            if (noteRows.length) {
              briefingText = noteRows
                .map(r => `${r.title ? `[${r.title}]\n` : ''}${r.summary_html ?? ''}`)
                .join('\n\n---\n\n');
            }
          }
        } catch { /* malformed JSON */ }
      }
      // Fall back to most recent transcript
      if (!briefingText) {
        const { rows: noteRows } = await pool.query(
          `SELECT summary_html FROM planning_applications.document_summaries
           WHERE project_id = $1 AND doc_type = 'briefing_transcript'
           ORDER BY created_at DESC LIMIT 1`,
          [projectId]
        );
        briefingText = noteRows[0]?.summary_html ?? null;
      }
    }

    if (!briefingText?.trim()) {
      return res.status(400).json({ error: 'No briefing note found for this project. Please upload a briefing note first.' });
    }

    // Strip HTML tags — keep full text, no character cap
    const briefingPlain = briefingText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // ── 3. Policies ───────────────────────────────────────────────────────────
    const { rows: policyRows } = await pool.query(
      `SELECT policy_reference, policy_name, policy_text, policy_type
       FROM public.project_policies WHERE project_id = $1 ORDER BY policy_type, id`,
      [projectId]
    );
    const formatPolicies = rows => rows.length
      ? rows.map(p => {
          const header = `${p.policy_reference}${p.policy_name ? `: ${p.policy_name}` : ''}`;
          const text = p.policy_text?.trim() ? `\n${p.policy_text.trim()}` : '';
          return header + text;
        }).join('\n\n')
      : '(none recorded)';
    const localPolicies    = formatPolicies(policyRows.filter(p => p.policy_type === 'local'));
    const nationalPolicies = formatPolicies(policyRows.filter(p => p.policy_type === 'national'));

    // ── 3b. Drafting Issue Notes — same admin_console.drafting_issues table used by
    // Planning Statement v3 (project-scoped, visible in the same workspace's
    // "Drafting Issues" tab). Supplies facts/policy/assessment/risk per issue.
    // Deliberately does NOT supply Next Steps / Strategy — that comes from the
    // briefing note only (see stage1_review_v3's master prompt, migration 137).
    const { rows: draftingIssueRows } = await pool.query(
      `SELECT di.id, di.label, di.discipline, di.summary,
              di.policy_national, di.policy_local, di.policy_neighbourhood,
              di.policy_supplementary, di.policy_other,
              di.argument_for, di.argument_against, di.specialist_report
       FROM admin_console.drafting_issues di
       WHERE di.project_id = $1
       ORDER BY di.sort_order, di.id`,
      [projectId]
    );
    let linkedPoliciesByIssue = {};
    if (draftingIssueRows.length) {
      const { rows: linkRows } = await pool.query(
        `SELECT dipr.drafting_issue_id, pp.policy_reference, pp.policy_name
         FROM admin_console.drafting_issue_policy_relevance dipr
         JOIN public.project_policies pp ON pp.id = dipr.policy_id
         WHERE dipr.drafting_issue_id = ANY($1)`,
        [draftingIssueRows.map(r => r.id)]
      );
      linkedPoliciesByIssue = linkRows.reduce((map, r) => {
        (map[r.drafting_issue_id] ??= []).push(`${r.policy_reference}${r.policy_name ? `: ${r.policy_name}` : ''}`);
        return map;
      }, {});
    }
    const draftingIssueNotes = draftingIssueRows.length
      ? draftingIssueRows.map(issue => {
          const lines = [`### ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}`];
          const linkedPolicies = linkedPoliciesByIssue[issue.id];
          if (linkedPolicies?.length) lines.push(`Linked policies: ${linkedPolicies.join('; ')}`);
          const policyTiers = [
            issue.policy_national && `National: ${issue.policy_national}`,
            issue.policy_local && `Local: ${issue.policy_local}`,
            issue.policy_neighbourhood && `Neighbourhood: ${issue.policy_neighbourhood}`,
            issue.policy_supplementary && `Supplementary: ${issue.policy_supplementary}`,
            issue.policy_other && `Other: ${issue.policy_other}`,
          ].filter(Boolean);
          if (policyTiers.length) lines.push(`Policy notes — ${policyTiers.join('; ')}`);
          if (issue.argument_for) lines.push(`Supporting case: ${issue.argument_for}`);
          if (issue.argument_against) lines.push(`Opposing case / risk: ${issue.argument_against}`);
          if (issue.summary) lines.push(`Summary: ${issue.summary}`);
          if (issue.specialist_report) lines.push(`Specialist report evidence: ${issue.specialist_report}`);
          if (lines.length === 1) lines.push('(no further notes recorded for this issue)');
          return lines.join('\n');
        }).join('\n\n')
      : '(not provided)';

    // ── 4. Planning history ───────────────────────────────────────────────────
    const { rows: planningHistoryRows } = await pool.query(
      `SELECT section, planning_ref, description, decision, decision_date
       FROM public.project_planning_history
       WHERE project_id = $1
       ORDER BY section, id`,
      [projectId]
    );

    const formatHistoryPlain = (rows) => {
      if (!rows.length) return 'None recorded.';
      const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
      return rows.map(h => {
        const parts = [];
        if (h.planning_ref) parts.push(`Ref: ${h.planning_ref}`);
        if (h.description) parts.push(h.description);
        if (h.decision) parts.push(`Decision: ${h.decision}`);
        const d = formatDate(h.decision_date);
        if (d) parts.push(`Date: ${d}`);
        return parts.join(', ');
      }).join('\n');
    };

    const onSiteRows  = planningHistoryRows.filter(r => r.section === 'on_site');
    const nearbyRows  = planningHistoryRows.filter(r => r.section === 'nearby');

    const planningHistoryBlock = planningHistoryRows.length
      ? `## Planning History\n\n**On-site applications:**\n${formatHistoryPlain(onSiteRows)}\n\n**Nearby applications:**\n${formatHistoryPlain(nearbyRows)}`
      : '';

    // ── 5. Guiding brief + style template ─────────────────────────────────────
    // Scoped to promptKey (e.g. 'stage1_review_v2') so the v2 experimentation
    // track has its own guiding brief and style template, independent of v1.
    const guidingBrief = await getGuidingBrief(promptKey, project.development_type || null);
    const guidingBriefText = guidingBrief?.guidance_content?.trim() || '(no guiding brief set for this document type)';
    const styleTemplate = await getDocumentStyleTemplateByDocType(promptKey, project.development_type || null);

    // ── 6. Load user prompt template from DB; fall back to default ─────────────
    const { rows: promptRows } = await pool.query(
      `SELECT prompt_text FROM admin_console.llm_prompts WHERE prompt_key = $1`,
      [promptKey]
    );
    const promptTemplate = promptRows[0]?.prompt_text ?? DEFAULT_STAGE1_REVIEW_TEMPLATE;

    // ── 6b. Fetch starting docs ───────────────────────────────────────────────
    const { rows: startingDocRows } = await pool.query(
      `SELECT slot_slug, content_text FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1`,
      [projectId]
    );
    const startingDocs = Object.fromEntries(startingDocRows.map(r => [r.slot_slug, r.content_text]));
    const highLevelReview = startingDocs['high_level_planning_review']?.trim() || '(not provided)';

    // ── 7. Substitute variables ───────────────────────────────────────────────
    // OTHER_PROJECT_DOCUMENTS / EMERGING_POLICIES / REPORTS_REQUIRED_FOR_APPLICATION /
    // ADDITIONAL_DRAFTING_INSTRUCTIONS have no backing data source anywhere in the
    // system today (see stage1_review_v3's master prompt, migration 137, for why each
    // is kept as a token rather than stripped — schema/UI gaps, not just missing data).
    // Always substituted as "(not provided)" so the prompt's own built-in fallback
    // instructions take over; wire up a real source later without a prompt rewrite.
    const userPrompt = promptTemplate
      .replace(/\{\{GUIDING_BRIEF\}\}/g, guidingBriefText)
      .replace(/\{\{BRIEFING_NOTES\}\}/g, briefingPlain)
      .replace(/\{\{PLANNING_HISTORY\}\}/g, planningHistoryBlock)
      .replace(/\{\{HIGH_LEVEL_PLANNING_REVIEW\}\}/g, highLevelReview)
      .replace(/\{\{LOCAL_POLICIES\}\}/g, localPolicies)
      .replace(/\{\{NATIONAL_POLICIES\}\}/g, nationalPolicies)
      .replace(/\{\{DRAFTING_ISSUE_NOTES\}\}/g, draftingIssueNotes)
      .replace(/\{\{OTHER_PROJECT_DOCUMENTS\}\}/g, '(not provided)')
      .replace(/\{\{EMERGING_POLICIES\}\}/g, '(not provided)')
      .replace(/\{\{REPORTS_REQUIRED_FOR_APPLICATION\}\}/g, '(not provided)')
      .replace(/\{\{ADDITIONAL_DRAFTING_INSTRUCTIONS\}\}/g, '(not provided)')
      .replace(/\{\{STYLE_GUIDE\}\}/g, styleTemplate?.style_text?.trim() || TONE_EXAMPLE_RAW || '(no house style example set for this document type)');

    // Templates that reference {{STYLE_GUIDE}} (e.g. stage1_review_v2) carry the style
    // example in the user prompt instead — don't also append the legacy system-prompt block.
    // Templates with their own embedded style example (e.g. stage1_review_v3's hand-authored
    // master prompt — see migration 137) mark it with a "BEGIN STYLE EXAMPLE" line or an
    // "Embedded Style Template" section heading; don't append the generic file-based
    // example on top of either.
    const hasOwnStyleExample = promptTemplate.includes('BEGIN STYLE EXAMPLE') || promptTemplate.includes('Embedded Style Template');
    const systemPrompt = (promptTemplate.includes('{{STYLE_GUIDE}}') || hasOwnStyleExample)
      ? DEFAULT_STAGE1_SYSTEM_PROMPT
      : DEFAULT_STAGE1_SYSTEM_PROMPT + TONE_EXAMPLE_BLOCK;

    // ── 7. Call LLM — expect HTML output directly ─────────────────────────────
    const bodyHtml = (await callLLM({
      provider,
      model: MODEL_SONNET,
      maxTokens: 64000,
      system: systemPrompt,
      prompt: userPrompt,
      stream: true,
    })).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // ── 8. Build document HTML ────────────────────────────────────────────────
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const documentHtml = [
      `<h1>${project.project_name}</h1>`,
      `<p>Stage 1 Planning Appraisal</p>`,
      `<p>${now}</p>`,
      bodyHtml,
    ].join('\n');

    // ── 9. Save to drafts table ───────────────────────────────────────────────
    const { rows: typeRows } = await pool.query(
      `SELECT id FROM planning_applications.draft_types WHERE slug = $1 LIMIT 1`,
      [draftSlug]
    );
    if (typeRows.length) {
      const draftTypeId = typeRows[0].id;
      const { rows: draftRows } = await pool.query(
        `INSERT INTO planning_applications.drafts
           (project_id, draft_type_id, content_html, generated_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (project_id, draft_type_id)
         DO UPDATE SET content_html = $3, generated_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [projectId, draftTypeId, documentHtml]
      );
      return res.json(draftRows[0]);
    }

    res.json({ html: documentHtml });
  } catch (err) {
    console.error('stage1Review.generate error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStage1StartingDocs(req, res) {
  const { projectId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT slot_slug, content_text, file_name, updated_at
       FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getStage1StartingDocs error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function upsertStage1StartingDoc(req, res) {
  const { projectId, slotSlug } = req.params;
  try {
    let contentText = '';
    let fileName = null;

    if (req.file) {
      const { text } = await parseFile(req.file.buffer, req.file.originalname);
      contentText = text;
      fileName = req.file.originalname;
    } else {
      contentText = req.body.content_text ?? '';
      fileName = req.body.file_name ?? null;
    }

    const { rows } = await pool.query(
      `INSERT INTO planning_applications.stage1_starting_docs
         (project_id, slot_slug, content_text, file_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id, slot_slug)
       DO UPDATE SET content_text = $3, file_name = $4, updated_at = NOW()
       RETURNING slot_slug, content_text, file_name, updated_at`,
      [projectId, slotSlug, contentText, fileName]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertStage1StartingDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteStage1StartingDoc(req, res) {
  const { projectId, slotSlug } = req.params;
  try {
    await pool.query(
      `DELETE FROM planning_applications.stage1_starting_docs
       WHERE project_id = $1 AND slot_slug = $2`,
      [projectId, slotSlug]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteStage1StartingDoc error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStage1Context(req, res) {
  const { projectId } = req.params;
  try {
    const [projectRows, briefRows] = await Promise.all([
      pool.query(`SELECT development_type FROM public.projects WHERE id = $1`, [projectId]),
      pool.query(
        `SELECT summary_html FROM planning_applications.document_summaries
         WHERE project_id = $1 AND doc_type = 'briefing_transcript'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      )
    ]);
    const developmentType = projectRows.rows[0]?.development_type ?? null;
    const guidingBrief = await getGuidingBrief('stage1_review', developmentType);
    res.json({
      guidingBrief: guidingBrief ? { name: guidingBrief.name, content: guidingBrief.guidance_content ?? null } : null,
      projectBrief: briefRows.rows[0]?.summary_html ?? null,
      toneExampleLoaded: TONE_EXAMPLE_BLOCK.length > 0,
    });
  } catch (err) {
    console.error('stage1Review.getContext error:', err);
    res.status(500).json({ error: err.message });
  }
}
