-- Stage 1 Planning Appraisal v3: hand-authored master prompt rewrite.
--
-- Same treatment migration 135 gave Planning Statement v3: replace the thin,
-- indirection-heavy template (which just said "follow the guiding brief" and
-- pulled {{GUIDING_BRIEF}} / {{STYLE_GUIDE}} from admin_console at runtime)
-- with one self-contained prompt that carries its own structural guidance and
-- its own embedded style example directly in the text.
--
-- Deliberately dropped as runtime imports:
--   {{GUIDING_BRIEF}} -- the 10-part structure it described is now authored
--     directly into this prompt's per-section instructions instead.
--   {{STYLE_GUIDE}}   -- no admin_console.document_style_templates row is
--     created for this slug; a sanitised style example is embedded directly
--     in the prompt text instead (fictional site/facts -- style only, per
--     the same "no reused facts" rule migration 135 applies to its own
--     embedded example).
--
-- Kept as real, substituted variables (unchanged from the v1/v2 template):
--   {{BRIEFING_NOTES}}, {{PLANNING_HISTORY}}, {{LOCAL_POLICIES}},
--   {{NATIONAL_POLICIES}}, {{HIGH_LEVEL_PLANNING_REVIEW}}
--
-- Single LLM call -- no draft_sections rows, no per-issue notes mechanism.
-- Scoped to a new stage1_review_v3 draft type; stage1_review (v1) and
-- stage1_review_v2 are untouched.

INSERT INTO planning_applications.draft_types (name, slug, description, sort_order)
VALUES (
  'Stage 1 Planning Appraisal v3',
  'stage1_review_v3',
  'Master-prompt rewrite of the Stage 1 appraisal: self-contained structure and style guidance, no imported guiding brief or style template',
  102
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO admin_console.llm_prompts (prompt_key, prompt_text)
VALUES (
  'stage1_review_v3',
  $stage1v3$## Closed-Source Drafting Rule

Treat this as a closed-source drafting exercise.

Every project-specific factual statement in the finished Stage 1 Planning Appraisal must be traceable to the imported project material below.

Use only:
- the briefing note;
- the planning history;
- the local and national policies provided; and
- the high-level planning review, where provided.

Do not rely on:
- general planning knowledge;
- assumed planning practice or policy wording;
- facts remembered from other sites or projects;
- facts contained in the embedded style example below; or
- invented consultees, dates, references, designations or risk ratings.

The embedded style example controls writing style and register only. It is not a factual source.

Where required information has not been supplied, either omit that point (where the appraisal can still be drafted accurately without it) or insert:

[INFORMATION REQUIRED: identify the missing information briefly]

Do not fill gaps with plausible-sounding wording.

## Purpose of this Document

A Stage 1 Planning Appraisal is an early-stage, desk-based planning appraisal. It gives the team and client a clear, proportionate, commercially useful view of the planning position at an early stage: the relevant designations, the policy context, the principal constraints, the likely planning balance, and what should happen next.

It should read as a standalone document. Do not assume any prior planning review has been prepared or read.

It is an internal appraisal for the client and project team, not a document submitted to a Local Planning Authority. Write with the direct, practical register of a planning consultant advising a client on risk and strategy, not the formal register of a submission document.

## Required Structure

Use the following fixed section order. All headings are unnumbered — do not add `1.0`, `2.0`, decimal numbering, Roman numerals, letters or any other prefix before a heading, regardless of any numbering used in the briefing note or planning history.

- Introduction
- Site and Surrounding Context
- Planning Designations and Constraints
- Planning Policy Context
- Principle of Development
- Planning History and Nearby Applications
- Planning Balance
- Technical Work Required
- Risks and Opportunities
- Conclusion and Next Steps

Do not display this list in the finished appraisal. Do not add, remove, reorder or merge these sections.

### Introduction

State the purpose of the appraisal, a short summary of the site and proposal, and the scope of advice given. Keep this brief — it is orientation, not a summary of conclusions.

### Site and Surrounding Context

Describe the site location, its existing use, the surrounding land uses, and any other contextual factors supplied in the briefing note (access, topography, vegetation, watercourses, occupation, condition). Describe only — do not assess acceptability here.

### Planning Designations and Constraints

Identify the designations and constraints affecting the site (for example Green Belt or Grey Belt, landscape or AONB designations, heritage assets, ecological designations, flood risk, highways and access, residential amenity, agricultural land classification, or others actually supplied). For each, explain its planning significance: whether it is likely to weigh for or against the proposal, whether it may require technical assessment, and whether it is likely to be central to the planning balance.

Where the briefing note supports it, present this as an HTML table with columns: Matter, Constraint / Designation, Planning Implication, Initial Risk Level. Only populate a row where you have a real basis for each column from the imported material — do not invent a risk level. Where there is not enough supplied detail to populate a table meaningfully, present the same content as descriptive paragraphs instead.

Do not simply list designations. Explain what each one means for this proposal.

### Planning Policy Context

Identify the relevant development plan, neighbourhood plan policies, supplementary guidance, national policy and any topic-specific policy documents supplied. Explain what each principal policy requires, and what planning issue it brings into focus — go beyond listing policy references and numbers.

Do not assess overall compliance here; that belongs in Principle of Development and Planning Balance.

### Principle of Development

State whether the proposed development is likely to be acceptable in principle, and identify which policy or policies actually control that question for this site (this may be a spatial strategy policy, a settlement boundary policy, a topic-specific policy such as a renewable energy or employment policy, or a general development management policy — do not assume a residential-style structure applies if the briefing note or policies point elsewhere). State the main policy support and the main policy restrictions.

### Planning History and Nearby Applications

Only include this section where relevant planning history or nearby applications have been supplied. Present as an HTML table where practical (columns such as Reference, Description, Decision/Status, Date, Relevance). Extract planning intelligence — what the council focused on, what was accepted or refused, what mitigation or evidence was required — rather than simply listing entries. Do not add a relevance note that has not been supplied, and do not assume that no other planning history exists beyond what has been provided.

### Planning Balance

Bring together the benefits and harms or policy tensions actually identified in the briefing note, local/national policies, and planning history. For each:
- state the benefit, harm or tension;
- give its factual basis; and
- state its likely weight only where the briefing note actually supports a view on that weight — do not invent a level of harm or benefit, and do not assign "significant", "moderate" or "minor" weight without a supplied basis.

State the likely overall outcome of the balance and how a planning officer is likely to approach the proposal. Do not repeat the full designations or policy discussion here — refer back to it briefly instead of restating it.

### Technical Work Required

Identify the technical work likely to be needed to support a planning application or further feasibility work (for example landscape and visual assessment, ecological survey, heritage assessment, transport review, flood risk assessment, or others relevant to this proposal). Explain briefly why each item is needed and which planning risk it relates to.

### Risks and Opportunities

Give a clear, practical summary of the main planning risks (for example policy conflict, landscape or heritage harm, ecological constraint, objection risk) and the main opportunities (for example policy support, brownfield status, limited receptors, mitigation potential). State plainly whether any risk looks like a potential showstopper. This section should help the client see where planning effort needs to focus — do not pad it with matters already resolved elsewhere in the appraisal.

### Conclusion and Next Steps

Give a clear planning judgement: whether the proposal appears acceptable in principle, the main support and the main risks, and whether it appears capable of being progressed through further work. State recommended next steps (for example specific technical assessments, pre-application engagement, site layout refinement, or further policy review). Avoid a vague conclusion — give a clear steer even where further evidence is still needed. Do not repeat the detailed Planning Balance reasoning; summarise the outcome only.

## Output Format

Produce clean HTML only.

Use only:
- `<h2>` for each of the ten section headings above;
- `<h3>` for any subsections;
- `<p>` for paragraphs;
- `<ul>` / `<li>` for bullet lists; and
- `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` for tables.

Do not include a document title, a cover page, Markdown formatting, code fences, or commentary before or after the document. Start directly with `<h2>Introduction</h2>`.

Do not number paragraphs or headings. Do not use an em dash — use a comma, semicolon, colon or parentheses instead.

## Style and Register

Write in formal but direct British English, in the third person, as an experienced UK planning consultant advising a client at an early stage — proportionate and practical, not a submission-grade planning statement. Use "would" for the anticipated effect of the proposal and "will" only for a confirmed or fixed matter.

This document is client-facing: never refer to the briefing note, the planning history material, the client, this prompt, or any internal document. Present all information as the appraisal's own established analysis.

Avoid AI-generated-sounding language:
- Never use: "delve into", "underscores", "underpins", "robust", "seamless", "holistic", "testament to", "leverage", "elevate", "vibrant", "tapestry", "in today's [x]", "it is important to note that", "it should be noted that", "plays a crucial/vital/pivotal role".
- Do not open sentences with "Moreover,", "Furthermore," or "Additionally," more than once across the whole document.
- Do not hedge or throat-clear before making a point — state the planning judgement directly.
- Do not manufacture false balance ("on the one hand... on the other hand...") unless the material genuinely presents two sides.
- Vary sentence length and structure; do not fall into a repetitive rhythm of short declarative sentences.

BEGIN STYLE EXAMPLE

The following is a writing-style reference only. Do not reuse any place name, address, applicant, policy reference, distance, designation or other fact from it — every fact in your output must come solely from the briefing note, planning history and policies actually provided above.

Site and Surrounding Context

The site comprises a single parcel of agricultural land on the northern edge of the settlement, in arable use with existing hedgerow along its boundaries and a belt of mature trees screening the northern edge. The nearest residential receptors lie approximately 150m to the south, across an intervening lane. A public right of way crosses the eastern part of the site.

Planning Designations and Constraints

| Matter | Constraint / Designation | Planning Implication | Initial Risk Level |
|---|---|---|---|
| Landscape | Site lies within a locally designated area of landscape sensitivity | Potential for landscape and visual harm; an LVIA is likely to be required | Medium |
| Heritage | Grade II listed farmhouse approximately 200m north of the site | Potential effect on setting; will need to be assessed, though intervening screening may limit this | Medium |
| Ecology | No statutory ecological designation on site; County Wildlife Site adjoins the eastern boundary | Ecological survey work is likely to be required given proximity | Medium |
| Policy Support | Site benefits from an allocation for employment use in the adopted local plan | Weighs positively in the planning balance | Positive |

Planning Balance

The principal benefit is the site's existing employment allocation, which provides clear policy support for development of this type in this location. This is a significant benefit and is likely to carry considerable weight given the local plan explicitly identifies the site for this use.

The main tension is the site's landscape sensitivity designation, which will need to be addressed through siting, scale and landscaping. On the information available, this appears capable of being mitigated rather than representing a fundamental conflict, though this should be confirmed through an LVIA before the strategy is finalised.

Overall, the proposal appears well supported in principle. A planning officer is likely to focus scrutiny on the landscape and heritage setting matters rather than the principle of development itself.

END STYLE EXAMPLE

## Imported Project Material

### Briefing Note

The following briefing note has been prepared by the project team and is the primary source of project-specific information for this appraisal. Extract all relevant detail: site description, proposal, planning policy context, constraints, planning history, and any other matters covered.

{{BRIEFING_NOTES}}

### High Level Planning Review

The following is a high-level planning review prepared by the project team, where one exists. Build on it and bring forward all relevant information into the appraisal — expand and add detail as the rest of this prompt requires. If it says "(not provided)", disregard this section.

{{HIGH_LEVEL_PLANNING_REVIEW}}

### Planning History

{{PLANNING_HISTORY}}

### Planning Policy

Use the following policies in whichever sections above they are relevant to.

#### Local Policies
{{LOCAL_POLICIES}}

#### National Policies
{{NATIONAL_POLICIES}}

## Final Check

Before producing the final output, confirm silently that:
- every project-specific fact is supported by the briefing note, planning history, high-level planning review or the policies above, and nothing has been drawn from general knowledge or the style example;
- all ten sections are present, unnumbered, and in the fixed order set out above;
- the Designations and Constraints table (where used) contains no invented risk rating;
- the Planning Balance section does not invent a benefit, harm, weight or conclusion, and does not repeat the detailed designations/policy discussion;
- no em dash, Markdown, document title or numbered heading appears anywhere; and
- the document reads as a coherent, proportionate Stage 1 Planning Appraisal, not a submission-grade planning statement.

Write the Stage 1 Planning Appraisal now.$stage1v3$
)
ON CONFLICT (prompt_key) DO NOTHING;
