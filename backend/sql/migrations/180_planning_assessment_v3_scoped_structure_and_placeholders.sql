-- Planning Assessment v3: two small additions on top of migration 179.
--
-- 1. Scope the Prescribed Structure override. 179 says a structure recorded
--    "for an issue" replaces the default for that issue, but never says it
--    stops there. Because every issue is generated in a single call, a
--    heavily reshaped subsection could be pattern-matched onto its
--    neighbours. This adds an explicit sentence: a prescribed structure
--    applies only to the issue (or the part of an issue, e.g. one policy) it
--    was given for; everything else keeps the default.
--
-- 2. "Placeholders Requested in the Briefing". Where the briefing notes /
--    transcript use the word "placeholder" for a matter, the model inserts a
--    bracketed [PLACEHOLDER: ...] marker at that point instead of drafting
--    it. The frontend already highlights any square-bracket text in the
--    editor and in the Word export (draftParagraphs.js#highlightPlaceholders),
--    so no UI change is needed. The trigger is deliberately the word
--    "placeholder" only -- other open points, doubts or follow-ups are NOT
--    turned into markers, and gaps/conflicts keep their existing
--    [INFORMATION REQUIRED] / [INCONSISTENCY TO BE RESOLVED] markers.
--    Adds one Final Check bullet.
--
-- The live prompt uses CRLF line endings, so every anchor is a single-line
-- string and inserted text is converted LF -> CRLF to match. The DO block
-- aborts (changing nothing) if an anchor is missing / not unique or the
-- change has already been applied, rather than silently doing nothing.
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

DO $$
DECLARE
  cur TEXT;
  anchor_scope  CONSTANT TEXT := 'Where no structure has been prescribed for an issue, use the default.';
  anchor_output CONSTANT TEXT := '## Output format -- clean HTML only';
  anchor_check  CONSTANT TEXT := '- where a structure was prescribed for an issue, it has been followed; and';

  scope_sentence TEXT := replace($sc$A prescribed structure applies only to the issue, or the part of an issue (for example a single policy), that it was given for. Every other issue, and every other part of the same issue, uses the default sequence, whatever structure its neighbours have. Do not copy a structure prescribed for one issue onto another.$sc$, E'\n', E'\r\n');

  placeholder_section TEXT := replace($ph$## Placeholders Requested in the Briefing

Where the briefing notes use the word "placeholder" in relation to a matter (for example "put a placeholder for the highways figures" or "placeholder for the ecologist's view"), do not draft that matter. Instead insert a marker at the point in the relevant issue's subsection where it belongs:

[PLACEHOLDER: <concise statement of what is to be added, checked or confirmed>]

Insert a marker only where the briefing notes use the word "placeholder". Do not create one for any other open point, doubt or follow-up, and do not use this marker for a missing fact or a conflict -- those keep [INFORMATION REQUIRED] and [INCONSISTENCY TO BE RESOLVED].

Do not write substantive text for the matter, and do not state as settled any conclusion that depends on it. Where the subsection's conclusion would otherwise depend on it, say that the conclusion is provisional pending that matter being resolved.

Place the marker in the subsection of the issue it relates to. Where it cannot be tied to one issue, place it in the most relevant issue's subsection. State the action neutrally: do not refer to the briefing notes, a meeting or a transcript inside the marker.$ph$, E'\n', E'\r\n');

  check_bullet TEXT := '- every placeholder requested in the briefing has been inserted, and no other point has been turned into a placeholder;';
BEGIN
  SELECT s.generation_prompt INTO cur
  FROM appeals.appeal_draft_sections s
  JOIN appeals.appeal_draft_types t ON t.id = s.draft_type_id
  WHERE t.slug = 'planning_statement_v3' AND s.slug = 'planning_assessment';

  IF cur IS NULL THEN RAISE EXCEPTION 'planning_assessment prompt not found'; END IF;
  IF position('## Placeholders Requested in the Briefing' IN cur) > 0 THEN RAISE EXCEPTION 'Placeholders section already present'; END IF;
  IF position('applies only to the issue, or the part of an issue' IN cur) > 0 THEN RAISE EXCEPTION 'scope sentence already present'; END IF;
  IF (length(cur) - length(replace(cur, anchor_scope,  ''))) / length(anchor_scope)  <> 1 THEN RAISE EXCEPTION 'scope anchor not found exactly once'; END IF;
  IF (length(cur) - length(replace(cur, anchor_output, ''))) / length(anchor_output) <> 1 THEN RAISE EXCEPTION 'output anchor not found exactly once'; END IF;
  IF (length(cur) - length(replace(cur, anchor_check,  ''))) / length(anchor_check)  <> 1 THEN RAISE EXCEPTION 'final check anchor not found exactly once'; END IF;

  cur := replace(cur, anchor_scope,  anchor_scope || E'\r\n\r\n' || scope_sentence);
  cur := replace(cur, anchor_output, placeholder_section || E'\r\n\r\n' || anchor_output);
  cur := replace(cur, anchor_check,  check_bullet || E'\r\n' || anchor_check);

  UPDATE appeals.appeal_draft_sections s
  SET generation_prompt = cur
  FROM appeals.appeal_draft_types t
  WHERE t.id = s.draft_type_id AND t.slug = 'planning_statement_v3' AND s.slug = 'planning_assessment';
END $$;
