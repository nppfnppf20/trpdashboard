-- Planning Assessment v3: when an issue has Argument Notes (drafting_issues
-- .argument_for -- now surfaced in {{ISSUES_CONTEXT}} as "### Argument
-- Notes", see appeal.service.js#buildIssueSnippetContext), the model should
-- follow their structure/sequence for that issue's sub-section, but still
-- source factual substance from the briefing notes, specialist report and
-- policy material per the existing Source Priority order -- not treat the
-- Argument Notes prose itself as the primary factual source. Confirmed by
-- direct instruction: a consultant may draft Argument Notes from a
-- transcript via "Draft from Briefing Note" and then reorder/edit them by
-- hand, at which point the ordering is deliberate and should be respected,
-- while the transcript remains the source of truth for detail.
--
-- Where an issue has no Argument Notes, behaviour is unchanged: both
-- structure and content come straight from the briefing notes and the rest
-- of the supplied material.
--
-- Applied as a targeted REPLACE() against the existing "Source Priority"
-- paragraph, untouched by migration 144.
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = REPLACE(
  generation_prompt,
  $old1$An issue's working notes and the briefing notes may determine how the case is presented, but they must not override confirmed facts, policy wording or technical findings.$old1$,
  $new1$Where an issue's context above includes Argument Notes, treat them as the intended structure and sequence for that issue's sub-section: the order in which points, evidence and mitigation should be addressed. Follow that structure rather than devising a different one, unless it is clearly incomplete or is contradicted by a higher-priority source. Populate that structure with substantive detail -- facts, figures, specialist findings -- from the briefing notes, the specialist report and the policy material, applying the priority order above. Do not treat the wording of the Argument Notes themselves as the primary factual source for that detail.

Where an issue has no Argument Notes, construct both the structure and the content of that issue's sub-section directly from the briefing notes and the other supplied material.

Working notes and the briefing notes may otherwise determine how the case is presented, but they must not override confirmed facts, policy wording or technical findings.$new1$
)
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
