-- Planning Statement v3 (main body): add an optional Pre-application Letter source.
--
-- The main body prompt reads the project brief, the briefing notes and the
-- planning history. This adds a fourth, optional input, {{PRE_APPLICATION_LETTER}}
-- (filled from the "Pre-application Letter" box in Sources), so the Council's
-- pre-application advice can be used on its own or alongside the briefing notes.
--
-- It inserts ONE new section, "Pre-Application Letter", immediately before the
-- "## Source Priority and Conflicts" heading. The section carries the input itself
-- and says everything the prompt needs to know about it:
--   - it is a permitted source, despite the closed-source list elsewhere in the prompt;
--   - it is a source for the same matters as the project brief and briefing notes,
--     and is where the Consultation and Engagement material comes from first;
--   - it is the record of what the Council said and advised (reported accurately,
--     not overstated), ranking after the planning history record and above the
--     briefing notes for that, but it reflects the proposal as it stood when it was
--     written, so more current facts in the brief or notes win;
--   - it can stand in for the briefing notes when they are blank, and is treated
--     the same way if its content was uploaded as a briefing note;
--   - it is referred to in the finished document as the Council's pre-application
--     advice, never as an input.
--
-- Nothing else in the prompt is touched, so it does not depend on any other wording
-- in the stored prompt. The only text it needs to find is the heading
-- "## Source Priority and Conflicts", which must appear exactly once. If it does
-- not, or the section is already present, the migration raises an error and changes
-- nothing. The original prompt is saved first in admin_console.prompt_inline_backup
-- (key 'planning_statement_v3').
--
-- Only the main body prompt (appeals.appeal_draft_types, slug planning_statement_v3)
-- is changed. The Planning Policy and Planning Assessment section prompts are not,
-- and the code does not pass the letter to them.
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

DO $edit$
DECLARE
  cur         TEXT;
  had_crlf    BOOLEAN;
  anchor      CONSTANT TEXT := '## Source Priority and Conflicts';
  n_anchor    INTEGER;
  new_section TEXT;
BEGIN
  SELECT generation_prompt INTO cur FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3';
  IF cur IS NULL THEN RAISE EXCEPTION 'planning_statement_v3 prompt not found in appeals.appeal_draft_types'; END IF;

  IF position('{{PRE_APPLICATION_LETTER}}' IN cur) > 0 THEN
    RAISE EXCEPTION 'planning_statement_v3: the Pre-application Letter section is already present. Nothing was changed.';
  END IF;

  had_crlf := position(E'\r\n' IN cur) > 0;
  cur := replace(cur, E'\r\n', E'\n');

  n_anchor := (length(cur) - length(replace(cur, anchor, ''))) / length(anchor);
  IF n_anchor <> 1 THEN
    RAISE EXCEPTION 'planning_statement_v3: expected the heading "%" exactly once, found % times. Nothing was changed.', anchor, n_anchor;
  END IF;

  new_section := $sec$### Pre-Application Letter

{{PRE_APPLICATION_LETTER}}

The pre-application letter above is the Council's written advice on the proposal, where one has been added. If it says "not provided" or is blank, disregard this section.

It is a permitted source. It is project-specific material expressly inserted into this prompt, and the closed-source drafting rule applies to it in the same way as to the project brief and the briefing notes.

It may contain:
- the proposal as it was described to the Council;
- the site and its context as described to the Council;
- the issues the Council raised, and the advice it gave on each;
- the Council's view on the principle of development;
- the documents and assessments the Council asked to be submitted;
- the pre-application process, including dates and meetings; and
- any consultation or engagement the Council recommended or noted.

It is a source for the same matters as the project brief and the briefing notes. Wherever this prompt says to draw on the project brief and briefing notes, also draw on the pre-application letter where it covers the same matter. For the Consultation and Pre-Application Engagement section, draw on the pre-application letter first.

It is the authoritative record of what the Council said and advised. For that purpose it ranks below exact fields in the project brief, confirmed technical findings and the planning history record, and above the briefing notes.

Report the Council's advice accurately and attribute it to the Council. Do not overstate it. Pre-application advice is not a determination and does not bind the Council.

Do not treat anything in it as agreed or resolved unless the letter records it as such.

The letter reflects the proposal as it stood when it was written. Where the project brief or the briefing notes give a more current description, quantity or fact, use those, and present the letter only as what was put to the Council at that stage.

The pre-application letter may be supplied on its own, with the project brief, or with the project brief and the briefing notes. It is most useful alongside the briefing notes, which add the project team's current intentions and instructions.

Where the briefing notes are blank, say "not provided", or contain no usable information, draft from the project brief and the pre-application letter. Treat anything that only the briefing notes could have supplied as missing information. Do not invent it.

If the content of a pre-application letter has been supplied within the briefing notes instead, treat it in the same way as a pre-application letter.

In the finished document, refer to it as the Council's pre-application advice, giving its date or reference where supplied. Do not describe it as an input or as "the pre-application letter", and do not quote it at length.

$sec$;

  cur := replace(cur, anchor, new_section || anchor);

  INSERT INTO admin_console.prompt_inline_backup (source, key, original_text)
  SELECT 'appeals.appeal_draft_types', 'planning_statement_v3', generation_prompt
    FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3'
  ON CONFLICT (source, key) DO NOTHING;

  IF had_crlf THEN cur := replace(cur, E'\n', E'\r\n'); END IF;

  UPDATE appeals.appeal_draft_types SET generation_prompt = cur WHERE slug = 'planning_statement_v3';
  RAISE NOTICE 'planning_statement_v3 main body prompt updated (Pre-Application Letter section added).';
END
$edit$;

-- To undo:
--   UPDATE appeals.appeal_draft_types t SET generation_prompt = b.original_text
--     FROM admin_console.prompt_inline_backup b
--    WHERE b.source = 'appeals.appeal_draft_types' AND b.key = 'planning_statement_v3' AND t.slug = 'planning_statement_v3';
