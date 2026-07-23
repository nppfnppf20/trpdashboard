-- Rewrite v3's Planning Assessment section prompt around the Drafting Issues
-- tab's working notes as the primary source, with the briefing transcript as
-- secondary supporting detail. Also switches this section from one LLM call
-- per issue to a single call covering every issue together (see
-- generateIssueOrderedSection in appeal.service.js) — the old per-issue
-- calls were mutually blind to each other and reliably re-introduced the
-- same boilerplate (e.g. the Section 38(6) statutory basis) in every
-- sub-section, since no call knew another had already covered it.
--
-- Adds:
--   - Full-library policy context for all five tiers (previously only
--     Local/National had a {{...}} variable — see substituteAppealPromptVariables
--     in appeal.controller.js, which now also fills {{NEIGHBOURHOOD_POLICIES}},
--     {{SUPPLEMENTARY_POLICIES}}, {{OTHER_POLICIES}}).
--   - An explicit {{STYLE_GUIDE}} block with bespoke framing (tone/language
--     only, not content) instead of relying on the generic auto-appended
--     "Example Document" block.
--   - {{ISSUE_LIST}} / {{ISSUES_CONTEXT}} (plural — every issue in one call)
--     replacing the old singular {{ISSUE_LABEL}} / {{ISSUE_DISCIPLINE}} /
--     {{ISSUE_CONTEXT}}.
--   - A four-part structure per issue: policy position tier by tier, the
--     compliance argument (grounded in that issue's tier notes/argument
--     notes/specialist report), acknowledging any non-compliance, then a
--     conclusion that names the specific policies cited earlier.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $assessprompt$You are writing the Planning Assessment section of the Planning Statement for the project "{{PROJECT_NAME}}", covering every issue below in turn.

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
The following sets out, issue by issue, the policies specifically linked to it, any development-type-specific policy snippets recorded for it, and the working assessment notes for that issue (tier notes, argument notes, specialist report findings). Use a given issue's context, and its own linked policies, only for that issue's sub-section — not for another issue's. Each issue's notes are your primary source for that issue's argument — you are polishing that material into a properly written planning argument, not inventing a new one. The project's briefing notes/transcript, provided separately below, are secondary throughout: use them only to add supporting detail behind something already raised in an issue's notes, never to introduce a new argument, policy position, or conclusion that isn't grounded there. Where the two would conflict, the notes below take precedence.

{{ISSUES_CONTEXT}}

For each issue listed above, in order, write one sub-section in four parts, as flowing prose (no sub-headings other than the issue heading itself):

1. Set out what the relevant policy says for this issue, tier by tier — national policy first, then local policy, then any other national guidance, neighbourhood policy, or supplementary guidance that's been linked or is otherwise relevant to it. Reference each policy by its exact name and number. Do not cite policies not present in that issue's context above.
2. Make the case for why the proposal complies with that policy (or, where it doesn't fully comply, why it should still be accepted — e.g. planning benefits, policy unviability, mitigation). This is the crux of the sub-section. Where a specialist report is recorded for this issue, work its key findings in here as supporting evidence for the position taken.
3. If the notes describe any non-compliance, tension, or harm for this issue, acknowledge it honestly and explain the justification given in the notes for why it's still acceptable.
4. Conclude with a clear statement that the proposal complies with the specific policies cited above for this issue, naming them again (or, if the notes describe a justified departure, conclude with that justification instead).

If an issue's context above says nothing has been recorded for it, write only that issue's heading and a single short sentence noting that no assessment has yet been recorded for it — do not invent content to fill the gap.

Since you are writing every issue in this section together, in the same response: do not include any statement of the statutory basis for decision-making (Section 38(6) of the Planning and Compulsory Purchase Act 2004, development plan primacy, or similar) anywhere in this section — that belongs only in the separate Planning Policy section, generated independently of this one, not here. And do not repeat the same framing, phrasing, or boilerplate across multiple issues — you can see everything you're about to write, so keep each sub-section focused on what's actually specific to that issue.

Important:
- Do not invent facts, effects, mitigation, or justification not grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
- Follow any instructions above about how to use specific policy snippets (e.g. quoting verbatim) — those instructions take precedence over your own judgement.

Output format — clean HTML only:
- One <h3>Issue Label</h3> per issue, in the order listed above, each followed by flowing paragraphs for that issue — no other headings of any kind
- <p> for body paragraphs
- No markdown characters (**, *, #, ---) and no em dashes (—)
- Do not include a section-level heading (e.g. <h2>) — start directly with the first issue's <h3>$assessprompt$
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
