-- Same single-call rewrite as migration 129, applied to the Planning Policy
-- section. This section's guiding brief (planning_policy_v3) explicitly says
-- it "should begin by identifying the statutory basis" — under the old
-- one-call-per-issue architecture there was no real "beginning" for that
-- instruction to attach to, so it was likely being written fresh in every
-- issue's sub-section. A single call restores a genuine "beginning": one
-- opening paragraph, written once, before the per-issue policy listings.
--
-- Also adds the three missing policy-tier variables ({{NEIGHBOURHOOD_POLICIES}},
-- {{SUPPLEMENTARY_POLICIES}}, {{OTHER_POLICIES}}) alongside the existing
-- Local/National ones, matching migration 129.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policyprompt$You are writing the Planning Policy section of the Planning Statement for the project "{{PROJECT_NAME}}", covering every issue below in turn.

{{GUIDING_BRIEF}}

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

## Style Example
Here is an example of a document of this type we've previously written, so you can see the tone, language, and phrasing we use. It's from a different project — do not use any information, facts, figures, or policy references from it. It's there only so you understand the style, not the content.

{{STYLE_GUIDE}}

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
- Do not include a section-level heading (e.g. <h2>) — start directly with the opening paragraph$policyprompt$
WHERE slug = 'planning_policy'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
