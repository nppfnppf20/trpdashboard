-- Planning Assessment v3: make the Policy -> Evidence -> Assessment ->
-- Conclusion sequence a DEFAULT rather than a fixed template.
--
-- Before this, the "Required Approach to Each Subsection" section said each
-- subsection "should normally contain" those four elements, and several
-- efficiency rules (summarise similar policies together, don't repeat a
-- policy requirement, don't split into multiple paragraphs, word-count
-- guides) pulled the model toward a formulaic shape even where the
-- consultant had said, in the briefing transcript or the issue's argument
-- notes, exactly how that issue should be argued.
--
-- This adds a "Prescribed Structure" section immediately before "Required
-- Approach": where the argument notes or transcript record a decision on how
-- an issue is to be argued, follow it; it overrides the concision / grouping
-- / repetition guidance (and the length follows the structure) but never the
-- accuracy, source, evidence or style rules. If argument notes and a
-- transcript both prescribe a structure and differ, the argument notes win.
-- It also adds one Final Check bullet.
--
-- The live prompt uses CRLF line endings, so both anchors are single-line
-- strings and the inserted text is converted LF -> CRLF to match. The DO
-- block aborts (changing nothing) if either anchor is missing or the change
-- has already been applied, rather than silently doing nothing.
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

DO $$
DECLARE
  cur TEXT;
  anchor1 CONSTANT TEXT := '## Required Approach to Each Subsection';
  anchor2 CONSTANT TEXT := '- every sentence contributes to the policy assessment.';
  new_section TEXT := replace($ps$## Prescribed Structure

The sequence set out under "Required Approach to Each Subsection" below is the default. Where the argument notes or the transcript for an issue record a decision on how that issue is to be argued -- its structure, the order of points, which policies are grouped or treated separately, or where the emphasis lies -- follow that instead, and use the default elements only to fill gaps. Where both the argument notes and a transcript prescribe a structure and they differ, follow the argument notes.

A prescribed structure takes precedence over the concision, grouping and repetition guidance in this prompt, and the length of the subsection follows the structure. It does not take precedence over the accuracy, source, evidence and style rules. Where no structure has been prescribed for an issue, use the default.$ps$, E'\n', E'\r\n');
  new_bullet TEXT := '- where a structure was prescribed for an issue, it has been followed; and';
BEGIN
  SELECT s.generation_prompt INTO cur
  FROM appeals.appeal_draft_sections s
  JOIN appeals.appeal_draft_types t ON t.id = s.draft_type_id
  WHERE t.slug = 'planning_statement_v3' AND s.slug = 'planning_assessment';

  IF cur IS NULL THEN RAISE EXCEPTION 'planning_assessment prompt not found'; END IF;
  IF position('## Prescribed Structure' IN cur) > 0 THEN RAISE EXCEPTION 'Prescribed Structure already present'; END IF;
  IF (length(cur) - length(replace(cur, anchor1, ''))) / length(anchor1) <> 1 THEN RAISE EXCEPTION 'anchor 1 not found exactly once'; END IF;
  IF (length(cur) - length(replace(cur, anchor2, ''))) / length(anchor2) <> 1 THEN RAISE EXCEPTION 'anchor 2 not found exactly once'; END IF;

  cur := replace(cur, anchor1, new_section || E'\r\n\r\n' || anchor1);
  cur := replace(cur, anchor2, new_bullet || E'\r\n' || anchor2);

  UPDATE appeals.appeal_draft_sections s
  SET generation_prompt = cur
  FROM appeals.appeal_draft_types t
  WHERE t.id = s.draft_type_id AND t.slug = 'planning_statement_v3' AND s.slug = 'planning_assessment';
END $$;
