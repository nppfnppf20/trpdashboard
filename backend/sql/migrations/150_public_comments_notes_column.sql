-- Public Comments: the LLM extraction used to split what a commenter said
-- across `comment` and `further_info`. Going forward everything the LLM
-- extracts lands in `comment` alone, and `further_info` is replaced by a
-- new `notes` column that's purely manual/user-typed - the LLM never writes
-- to it. Existing `further_info` text is folded into `comment` so nothing
-- already extracted is lost.

ALTER TABLE planning_applications.public_comments
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE planning_applications.public_comments
SET comment = CASE
  WHEN NULLIF(TRIM(further_info), '') IS NULL THEN comment
  WHEN NULLIF(TRIM(comment), '') IS NULL THEN further_info
  ELSE comment || E'\n\n' || further_info
END
WHERE NULLIF(TRIM(further_info), '') IS NOT NULL;

ALTER TABLE planning_applications.public_comments
  DROP COLUMN IF EXISTS further_info;
