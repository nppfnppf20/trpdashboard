-- Planning Statement v3's description column currently holds an internal note
-- about its prompt architecture ("Hybrid: one broad prompt for most
-- sections..."), not a reader-facing description of what the document is for.
-- Every other draft type's description is the latter (e.g. Planning
-- Statement v1: "A formal planning statement setting out the policy case for
-- the proposed development."), and that field is now surfaced to the model
-- as this document's stated purpose during quick highlight/whole-document AI
-- edits (see incorporateTargetedParagraphs in appeal.service.js) — without a
-- real purpose statement here, those edits had no signal for the document's
-- voice and tended to drift into narrating about "the Application" from
-- outside rather than writing as the document making the case.

UPDATE appeals.appeal_draft_types
SET description = 'A formal planning statement setting out the policy case for the proposed development, arguing directly for its acceptability against the development plan and other material considerations.'
WHERE slug = 'planning_statement_v3';
