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
--
-- Also adds {{DOCUMENT_GUIDING_BRIEF}}, carrying the main planning_statement_v3
-- guiding brief alongside this section's own (planning_policy_v3) — see the
-- matching note in migration 129.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policyprompt$You are writing the Planning Policy section of the Planning Statement for the project "{{PROJECT_NAME}}", covering every issue below in turn.

## About This Document
This section is one part of the larger Planning Statement — not a standalone document. Read this so you understand the document as a whole, its purpose, its tone, and how this section fits within it, before reading this section's own specific instructions below.

{{DOCUMENT_GUIDING_BRIEF}}

## This Section's Specific Instructions
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

## Style Example — THIS IS THE TONE YOU MUST WRITE IN
Here is a real document of this type we've previously written. This is not a loose reference — it is the exact tone, register, vocabulary, sentence structure, and paragraph rhythm you are to reproduce here. Match it as closely as you can: how formal or plain the language is, how long sentences and paragraphs run, how directly claims are stated, how transitions between points are handled. It's from a different project — do not use any information, facts, figures, or policy references from it. It's there only so you write exactly the way we write, not what we say.

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
