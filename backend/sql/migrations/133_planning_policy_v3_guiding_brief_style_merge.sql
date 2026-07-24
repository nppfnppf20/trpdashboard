-- Folds this section's own guiding brief and style example directly into
-- its generation_prompt as literal text, replacing {{GUIDING_BRIEF}} and
-- {{STYLE_GUIDE}} with the actual prose -- same treatment as migration 131
-- for the top-level planning_statement_v3 document prompt. The point is to
-- have the whole section prompt visible and editable as one piece of text
-- in the "Configure sections" UI, rather than needing to cross-reference a
-- separate guiding_briefs row to know what the section actually says.
--
-- Also drops {{DOCUMENT_GUIDING_BRIEF}} and its "About This Document" framing
-- entirely (superseding the original version of this migration, which kept
-- it as a live import) -- planning_statement_v3 is being run without any
-- guiding brief at all, as a test, so appeal.controller.js no longer fetches
-- or substitutes one for this document type's sections. This is a stopgap:
-- the Planning Policy section's prompt content itself hasn't been rewritten
-- yet the way Planning Assessment's was (migration 132) -- only the dead
-- {{DOCUMENT_GUIDING_BRIEF}} token has been removed so generation doesn't
-- send that literal placeholder text to the model.
--
-- The guiding_briefs row for document_type='planning_policy_v3' is untouched
-- by this migration -- only this section's generation_prompt changes.
--
-- Scoped to Planning Statement v3's Planning Policy section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policymerge$You are writing the Planning Policy section of the Planning Statement for the project "{{PROJECT_NAME}}", covering every issue below in turn.

## 7.0 Planning Policy Context

It should begin by identifying the statutory basis for decision-making. In particular, it should state that Section 38(6) of the Planning and Compulsory Purchase Act 2004 requires applications to be determined in accordance with the development plan unless material considerations indicate otherwise.

The section should then identify all relevant policy documents and material considerations that apply to the proposal.

This section is not where the proposal is assessed against the policies. It should set out the policy framework only. The assessment happens in the separate Planning Considerations and Assessment section.

The Planning Policy Context section should include, where relevant: national planning policy; National Planning Policy Framework; Planning Practice Guidance; regional policy; London Plan or other regional spatial strategy, where applicable; adopted Local Plan; site allocation documents; neighbourhood plans; area action plans; supplementary planning documents; design guides; local planning guidance; emerging policy; other material considerations.

The section should clearly identify the adopted development plan. This may include: local plan documents; core strategies; development management policies; site allocations plans; area action plans; minerals and waste plans; neighbourhood plans; regional plans where these form part of the development plan.

For each relevant development plan document, provide a subheading and list the relevant policies within that document. Policies should usually be ordered with the most relevant first. Include any policy that is materially relevant to the proposal, even if it is not central, but avoid unnecessary commentary in this section.

The Planning Statement should also identify relevant material considerations. These may include: National Planning Policy Framework; Planning Practice Guidance; supplementary planning documents; design guides; local planning guidance; conservation area appraisals; masterplans; development briefs; infrastructure plans; emerging planning policy; appeal decisions, where relevant; case-specific evidence or strategies, where relevant.

The Planning Policy Context section should flag relevant emerging policy. This may include: emerging national planning policy; emerging Local Plan documents; emerging site allocations; emerging supplementary guidance; draft neighbourhood plans.

The section should give a brief assessment of the weight that may be afforded to emerging policy, depending on how advanced it is. For example: early-stage emerging policy, such as a Regulation 18 draft Local Plan, may attract only limited weight; more advanced emerging policy may attract moderate or substantial weight, depending on its stage, unresolved objections, and consistency with national policy.

The assessment of weight should be brief in the policy context section. Detailed implications for the proposal should be addressed later in the Planning Considerations and Assessment section.

This section should not assess the proposal against policy. It should only identify and summarise the relevant policy framework.

## Local Policy Context
The full list of local policies identified as relevant to this proposal. Not all of these will apply to every issue — only reference the ones genuinely relevant to a given issue.

{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Neighbourhood Policy Context
{{NEIGHBOURHOOD_POLICIES}}

## Supplementary Guidance Context
{{SUPPLEMENTARY_POLICIES}}

## Other Policy/Guidance Context
{{OTHER_POLICIES}}

## Issues to cover, in order
{{ISSUE_LIST}}

## Context for each issue
The following sets out, issue by issue, the policies specifically linked to it and any development-type-specific policy snippets recorded for it. Use a given issue's context, and its own linked policies, only for that issue's sub-section — not for another issue's.

{{ISSUES_CONTEXT}}

Begin with a brief opening paragraph identifying the statutory basis for decision-making: state that Section 38(6) of the Planning and Compulsory Purchase Act 2004 requires applications to be determined in accordance with the development plan unless material considerations indicate otherwise, and identify the development plan documents that apply. Write this once, at the very start of the section, before any of the individual issues below — not per issue.

Then, for each issue listed above, in order, write one sub-section setting out which policies apply to that issue and what they require. Reference each policy by its exact name and number. Do not cite policies not present in that issue's context above. Do not assess or judge compliance in this section — that happens in the separate Planning Assessment section, generated independently of this one.

If an issue's context above says nothing has been recorded for it, write only that issue's heading and a single short sentence noting that no policy position has yet been recorded for it — do not invent content to fill the gap.

Since you are writing every issue in this section together, in the same response, do not repeat the same framing, phrasing, or boilerplate across multiple issues — you can see everything you're about to write, so keep each sub-section focused on what's actually specific to that issue.

Important:
- Do not invent policies, references, or wording not supplied above.
- Write in formal planning language appropriate for submission to a local planning authority.
- Follow any instructions above about how to use specific policy snippets (e.g. quoting verbatim) — those instructions take precedence over your own judgement.

Output format — clean HTML only:
- The opening statutory-basis paragraph(s) first, as <p> tags with no heading
- Then one <h3>Issue Label</h3> per issue, in the order listed above, each followed by flowing paragraphs for that issue — no other headings of any kind
- <p> for body paragraphs
- No markdown characters (**, *, #, ---) and no em dashes (—)
- Do not include a section-level heading (e.g. <h2>) — start directly with the opening paragraph$policymerge$
WHERE slug = 'planning_policy'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
