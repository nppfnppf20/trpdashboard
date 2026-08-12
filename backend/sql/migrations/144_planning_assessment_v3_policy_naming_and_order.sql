-- Planning Assessment v3: tighten policy source identification and impose a
-- national -> development plan -> other guidance ordering within each issue's
-- policy framework, following on from the code change in appeal.service.js
-- (buildIssueSnippetContext) that now:
--   - splits each issue's policy context into three presentation groups
--     (National Policy / Development Plan Policy / Other Policy and
--     Guidance) in that order, instead of one flat list ordered by DB tier;
--   - carries a supplied plan name (public.policy_documents.plan_name, via
--     the new project_policies.plan_id join in
--     appeal.controller.js#fetchLinkedPoliciesForDraftType) inline with each
--     Development Plan / guidance-tier policy, where one has been recorded.
--
-- "National" here means the NPPF specifically. NPPG and other national
-- guidance (e.g. a Written Ministerial Statement or NPS) are grouped with
-- Other Policy and Guidance, after the development plan -- confirmed by
-- direct instruction, since NPPG/WMS/NPS carry different statutory weight to
-- the NPPF itself even though issue_types labels them "national" text
-- fields.
--
-- Applied as three targeted REPLACE()s against the existing prompt text
-- (rather than retyping the whole ~600-line prompt, which includes a long
-- verbatim style example) so the bulk of migration 132's prompt, including
-- that example, is untouched.
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = REPLACE(
  REPLACE(
    REPLACE(
      generation_prompt,
      $old1$Do not select the version that is most favourable to the proposal without evidential support.

## Scope$old1$,
      $new1$Do not select the version that is most favourable to the proposal without evidential support.

## Policy Source, Naming and Order

Always identify the source of a policy or guidance requirement rather than citing a reference in isolation. Do not write "Policy E4 requires..." where the policy's source document has been supplied -- write "[Plan Name] Policy E4 requires..." instead.

Where a policy's source document has been supplied, use its full name on first reference within this section, followed by a short abbreviation in brackets, then use the abbreviation consistently thereafter. For example:

"The Alderwick Local Plan (ALP) Policy SA3 allocates the Site for mixed-use regeneration..."
"ALP Policy E4 requires..."

Apply the same approach to any other named policy document supplied more than once (a neighbourhood plan, a design guide, a written ministerial statement). Do not invent the name of a policy document or an abbreviation where its source has not been supplied -- where a policy's source document is unknown, refer to it generically by its stated policy tier instead (for example "the development plan" or "national policy").

Within each issue, present the policy framework in this order:

1. National Policy -- the NPPF only. Only refer to it where relevant National Policy content has actually been supplied for that issue. Do not introduce it merely because the topic would ordinarily attract a national policy test.
2. Development Plan Policy -- the Local Plan and any Neighbourhood Plan, both being statutory development plan documents.
3. Other Policy and Guidance -- the NPPG, other national guidance (for example a Written Ministerial Statement or National Policy Statement), supplementary planning documents, design guides, and any other supplied guidance. The NPPG is guidance, not the National Planning Policy Framework itself, and belongs in this group, after the development plan.

Where no National Policy content has been supplied for an issue, begin with Development Plan Policy. Where no Development Plan Policy has been supplied either, move directly to Other Policy and Guidance.

Where several policies from the same source contain overlapping requirements, combine them into one concise statement rather than discussing each separately.

## Scope$new1$
    ),
    $old2$### Policy

Briefly identify the relevant policy test.
Do not provide a general history of the policy topic.
Do not repeat the full policy review contained elsewhere in the Planning Statement.
Where several policies contain similar requirements, summarise them together rather than discussing each in a separate paragraph.
Quote policy wording only where:
- the exact wording has been supplied;
- the wording is material to the assessment; and
- paraphrasing would lose an important distinction.
Otherwise, summarise the policy accurately.

### Proposal and Evidence$old2$,
    $new2$### Policy

Briefly identify the relevant policy test, applying the source, naming and order requirements set out in Policy Source, Naming and Order above: National Policy first where supplied, then Development Plan Policy, then Other Policy and Guidance.
Do not provide a general history of the policy topic.
Do not repeat the full policy review contained elsewhere in the Planning Statement.
Where several policies contain similar requirements, summarise them together rather than discussing each in a separate paragraph.
Quote policy wording only where:
- the exact wording has been supplied;
- the wording is material to the assessment; and
- paraphrasing would lose an important distinction.
Otherwise, summarise the policy accurately.

### Proposal and Evidence$new2$
  ),
  $old3$## Policy Discussion

The assessment should apply policy rather than reproduce it.
Use policy as the framework for the planning judgement.
Suitable concise constructions include:
- "Policy [reference] requires..."
- "At the national level..."
- "National policy supports..."
- "The relevant policy test is whether..."
- "Policy [reference] permits..."
- "The development plan seeks to..."
- "The proposal responds to this requirement by..."
Vary the wording naturally, but do not use different introductory expressions merely for stylistic variety where a direct formulation would be clearer.$old3$,
  $new3$## Policy Discussion

The assessment should apply policy rather than reproduce it.
Use policy as the framework for the planning judgement.
Where a policy's source document has been supplied, express the reference in source-specific form rather than a bare policy number, per Policy Source, Naming and Order above. Suitable concise constructions include:
- "The NPPF requires..." / "National policy requires..."
- "The Alderwick Local Plan (ALP) Policy SA3 requires..." on first reference; "ALP Policy E4 requires..." thereafter
- "The NPPG advises..."
- "The Alderwick Design Guide advises..."
- "Neighbourhood Plan Policy D1 requires..."
- "Policy [reference] permits..." only where no source document has been supplied for that policy
Vary the wording naturally, but do not use different introductory expressions merely for stylistic variety where a direct formulation would be clearer.$new3$
)
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
