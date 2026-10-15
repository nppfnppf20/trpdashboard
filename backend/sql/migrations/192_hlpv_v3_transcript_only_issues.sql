-- HLPV v3: stop using Drafting Issue Notes. The issue rows (which issues appear,
-- their headings and their order) now come from the meeting notes alone.
--
-- Companion to the code change that always passes "(not provided)" for
-- {{DRAFTING_ISSUE_NOTES}} for this document. This removes the Drafting Issue
-- Notes input section, the places that rank or rely on it, and rewrites
-- "Selection of Planning Issues", "Issue Headings" and "Issue Order" so the
-- Project Briefing Transcript decides them. Nothing else in the prompt changes.
-- The label "Project Briefing Transcript" is left as it is.
--
-- Edits are matched on exact text, each of which must occur exactly once. If any
-- piece of text is missing or has been edited in the app, or the migration has
-- already been applied, it raises ONE error that lists every edit that did not
-- match, and changes nothing. The original prompt is saved first in
-- admin_console.prompt_inline_backup (key 'hlpv_v3').
--
-- Works whether the stored prompt uses LF or CRLF line endings.

CREATE TABLE IF NOT EXISTS admin_console.prompt_inline_backup (
  source        TEXT NOT NULL,
  key           TEXT NOT NULL,
  original_text TEXT,
  backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, key)
);

ALTER TABLE admin_console.prompt_inline_backup ENABLE ROW LEVEL SECURITY;

-- Edits that did not match are recorded here, then reported together at the end.
CREATE TEMP TABLE hlpv_edit_problems (label TEXT, detail TEXT);

-- Replace one piece of text that must appear exactly once. A miss is recorded and
-- the text is returned unchanged.
CREATE FUNCTION pg_temp.replace_once(txt TEXT, old_text TEXT, new_text TEXT, label TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $f$
DECLARE n INTEGER;
BEGIN
  n := (length(txt) - length(replace(txt, old_text, ''))) / length(old_text);
  IF n <> 1 THEN
    INSERT INTO hlpv_edit_problems VALUES (label, 'expected the text exactly once, found ' || n || ' times');
    RETURN txt;
  END IF;
  RETURN replace(txt, old_text, new_text);
END
$f$;

-- Delete everything from start_marker up to (not including) end_marker.
CREATE FUNCTION pg_temp.cut_between(txt TEXT, start_marker TEXT, end_marker TEXT, label TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $f$
DECLARE
  n_start INTEGER; n_end INTEGER; p_start INTEGER; p_end INTEGER;
BEGIN
  n_start := (length(txt) - length(replace(txt, start_marker, ''))) / length(start_marker);
  n_end   := (length(txt) - length(replace(txt, end_marker,   ''))) / length(end_marker);
  IF n_start <> 1 OR n_end <> 1 THEN
    INSERT INTO hlpv_edit_problems VALUES (label, 'expected each marker exactly once (start ' || n_start || ', end ' || n_end || ')');
    RETURN txt;
  END IF;
  p_start := position(start_marker IN txt);
  p_end   := position(end_marker IN txt);
  IF p_end <= p_start THEN
    INSERT INTO hlpv_edit_problems VALUES (label, 'end marker comes before the start marker');
    RETURN txt;
  END IF;
  RETURN left(txt, p_start - 1) || substr(txt, p_end);
END
$f$;

DO $edit$
DECLARE
  cur       TEXT;
  had_crlf  BOOLEAN;
  remaining INTEGER;
  problems  TEXT;
BEGIN
  SELECT prompt_text INTO cur FROM admin_console.llm_prompts WHERE prompt_key = 'hlpv_v3';
  IF cur IS NULL THEN RAISE EXCEPTION 'hlpv_v3 prompt not found in admin_console.llm_prompts'; END IF;

  INSERT INTO admin_console.prompt_inline_backup (source, key, original_text)
  VALUES ('admin_console.llm_prompts', 'hlpv_v3', cur)
  ON CONFLICT (source, key) DO NOTHING;

  had_crlf := position(E'\r\n' IN cur) > 0;
  cur := replace(cur, E'\r\n', E'\n');

  -- ── Remove the Drafting Issue Notes as an input and as a ranked source ─────
  cur := pg_temp.replace_once(cur,
    ', particularly the Project Briefing Transcript and the Drafting Issue Notes.',
    ', particularly the Project Briefing Transcript.', 'role: sources');

  cur := pg_temp.replace_once(cur,
    'Do not derive a recommendation from the Drafting Issue Notes, a designation, a policy, or general planning practice.',
    'Do not derive a recommendation from a designation, a policy, or general planning practice.', 'recommendations');

  cur := pg_temp.cut_between(cur,
    E'### Drafting Issue Notes\n\n{{DRAFTING_ISSUE_NOTES}}',
    E'### Site and Proposal Information', 'input section');

  cur := pg_temp.replace_once(cur,
    E'- the Drafting Issue Notes identify the policy as material;\n', '', 'policy: material');

  cur := pg_temp.replace_once(cur,
    'where supplied separately from the Drafting Issue Notes.', 'where supplied separately.', 'designations input');

  cur := pg_temp.replace_once(cur,
    E'- the Drafting Issue Notes;\n', '', 'traceability list');

  cur := pg_temp.replace_once(cur,
    E'2. Project Briefing Transcript\n3. Drafting Issue Notes\n4. Site and Proposal Information\n5. Planning Context\n6. Designations and Constraints\n7. Other Project Documents\n8. Relevant Planning History\n9. Embedded Style Template, for style only',
    E'2. Project Briefing Transcript\n3. Site and Proposal Information\n4. Planning Context\n5. Designations and Constraints\n6. Other Project Documents\n7. Relevant Planning History\n8. Embedded Style Template, for style only',
    'source hierarchy');

  cur := pg_temp.cut_between(cur,
    E'### Relationship Between the Transcript and the Drafting Issue Notes',
    E'### Conflicting Information', 'relationship section');

  cur := pg_temp.replace_once(cur,
    E'- use the more specific Drafting Issue Note where it does not conflict with the overall position;\n', '', 'conflicts bullet');

  cur := pg_temp.replace_once(cur,
    E'- use the Drafting Issue Notes to organise scattered comments;\n', '', 'polish bullet');

  cur := pg_temp.replace_once(cur,
    'drawn from the Designations and Constraints information and the Drafting Issue Notes;',
    'drawn from the Designations and Constraints information;', 'designations bullet');

  -- ── The transcript now decides the issue rows, their headings and their order ──
  cur := pg_temp.replace_once(cur,
    E'The Drafting Issue Notes are the primary source for selecting the issue rows in the Constraints and Opportunities section.\n\nApply the following order of control:\n1. issues expressly required by the Additional Drafting Instructions;\n2. issues identified in the Drafting Issue Notes;\n3. substantive issues identified in the Project Briefing Transcript;\n4. substantive issues identified in other project-specific sources.',
    E'The Project Briefing Transcript is the source for selecting the issue rows in the Constraints and Opportunities section.\n\nInclude an issue where the project team says something substantive about it. Do not include a topic that is only mentioned in passing.\n\nApply the following order of control:\n1. issues expressly required by the Additional Drafting Instructions;\n2. substantive issues identified in the Project Briefing Transcript;\n3. substantive issues identified in other project-specific sources.',
    'selection of issues');

  cur := pg_temp.replace_once(cur,
    'Use the heading supplied in the Drafting Issue Notes where possible.',
    'Use the name the project team uses for the issue in the Project Briefing Transcript. Where they give no clear name, use a short standard planning heading, such as "Landscape and Visual".',
    'issue headings');

  -- Only the first sentence is replaced. The "Where no order is supplied..." fallback after it is left as it is.
  cur := pg_temp.replace_once(cur,
    'Use the order provided in the Drafting Issue Notes.',
    'Use the order the project team gives in the Project Briefing Transcript.',
    'issue order');

  cur := pg_temp.replace_once(cur,
    'Where several notes relate to one broader matter, consolidate them where this improves readability. For example, notes about landscape character',
    'Where several comments relate to one broader matter, consolidate them where this improves readability. For example, comments about landscape character',
    'consolidating (1)');

  cur := pg_temp.replace_once(cur,
    'Where the supplied notes clearly distinguish separate issues',
    'Where the Project Briefing Transcript clearly distinguishes separate issues',
    'consolidating (2)');

  cur := pg_temp.replace_once(cur,
    'Identify which issue rows are required and their correct order.',
    'Identify, from the Project Briefing Transcript, which issue rows are required and their correct order.',
    'step 3');

  cur := pg_temp.replace_once(cur,
    E'### Drafting Issue Notes\n- The Project Briefing Transcript has been professionally polished',
    E'### Issue Rows and the Transcript\n- The Project Briefing Transcript has been professionally polished',
    'final check heading');

  cur := pg_temp.replace_once(cur,
    '- The issue rows reflect the Drafting Issue Notes.',
    '- The issue rows are the issues the project team discussed in the Project Briefing Transcript.',
    'final check: rows');

  cur := pg_temp.replace_once(cur,
    '- The order of issues follows the supplied instructions where an order is provided.',
    '- The order of issues follows the importance the project team gave, otherwise the order they were discussed.',
    'final check: order');

  -- If any edit did not match, report all of them together and change nothing.
  SELECT string_agg('  - ' || label || ': ' || detail, E'\n') INTO problems FROM hlpv_edit_problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'hlpv_v3: these edits did not match the stored prompt, so nothing was changed:\n%', problems;
  END IF;

  -- Anything still mentioning the Drafting Issue Notes should only be the rules that
  -- say not to refer to them in the finished document.
  remaining := (length(cur) - length(replace(lower(cur), 'drafting issue', ''))) / length('drafting issue');
  RAISE NOTICE 'hlpv_v3: remaining mentions of "drafting issue": % (expected 3, all in the do-not-mention rules)', remaining;

  IF had_crlf THEN cur := replace(cur, E'\n', E'\r\n'); END IF;

  UPDATE admin_console.llm_prompts SET prompt_text = cur, updated_at = NOW() WHERE prompt_key = 'hlpv_v3';
  RAISE NOTICE 'hlpv_v3 prompt updated.';
END
$edit$;

-- To undo:
--   UPDATE admin_console.llm_prompts p SET prompt_text = b.original_text, updated_at = NOW()
--     FROM admin_console.prompt_inline_backup b
--    WHERE b.source = 'admin_console.llm_prompts' AND b.key = 'hlpv_v3' AND p.prompt_key = 'hlpv_v3';
