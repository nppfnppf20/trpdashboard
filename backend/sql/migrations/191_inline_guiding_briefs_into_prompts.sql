-- Moves the guiding brief (and style example) into the prompt text itself for
-- Statement of Case, Statement of Common Ground, Pre-application Request and
-- Stage 1 Review v2, so each prompt is self-contained (same treatment the v3
-- documents already have) and can be copied into another LLM as-is.
--
-- Nothing else in any prompt is touched: this replaces the {{GUIDING_BRIEF}} /
-- {{STYLE_GUIDE}} tokens with the exact text the app would have substituted at
-- generation time, so the assembled prompt is unchanged. Only the generic
-- (development_type IS NULL) brief is used; those are the only briefs that exist
-- for these four document types.
--
-- Style example per document:
--   pre_application_request  {{STYLE_GUIDE}} -> its guiding brief's style_example
--   stage1_review_v2         {{STYLE_GUIDE}} -> its document_style_templates row,
--                            if one exists. If none exists the token is left in
--                            place, because the app then falls back to the fixed
--                            stage1reviewexample.md file, which SQL cannot read.
--   statement_of_case / statement_of_common_ground  no style example is set
--
-- Socio-economic Baseline has no guiding brief, so it is not touched.
--
-- Safe to re-run: a token that is already gone is not replaced again. The
-- original text of every prompt it changes is kept in
-- admin_console.prompt_inline_backup so this can be undone.

CREATE TABLE IF NOT EXISTS admin_console.prompt_inline_backup (
  source        TEXT NOT NULL,
  key           TEXT NOT NULL,
  original_text TEXT,
  backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, key)
);

ALTER TABLE admin_console.prompt_inline_backup ENABLE ROW LEVEL SECURITY;

DO $inline$
DECLARE
  brief_text TEXT;
  style_text TEXT;
  slug_name  TEXT;
  n          INTEGER;
BEGIN
  -- ── Appeal-tool documents: appeals.appeal_draft_types.generation_prompt ──────
  FOREACH slug_name IN ARRAY ARRAY['statement_of_case', 'statement_of_common_ground', 'pre_application_request']
  LOOP
    SELECT NULLIF(btrim(guidance_content, E' \t\r\n'), ''),
           NULLIF(btrim(style_example,    E' \t\r\n'), '')
      INTO brief_text, style_text
      FROM admin_console.guiding_briefs
     WHERE document_type = slug_name AND development_type IS NULL;

    -- Only pre-app carries a {{STYLE_GUIDE}} token; the other two have no style example.
    IF slug_name <> 'pre_application_request' THEN
      style_text := NULL;
    END IF;

    INSERT INTO admin_console.prompt_inline_backup (source, key, original_text)
    SELECT 'appeals.appeal_draft_types', slug, generation_prompt
      FROM appeals.appeal_draft_types
     WHERE slug = slug_name
       AND (position('{{GUIDING_BRIEF}}' IN generation_prompt) > 0
         OR position('{{STYLE_GUIDE}}'   IN generation_prompt) > 0)
    ON CONFLICT (source, key) DO NOTHING;

    IF brief_text IS NOT NULL THEN
      UPDATE appeals.appeal_draft_types
         SET generation_prompt = replace(generation_prompt, '{{GUIDING_BRIEF}}', brief_text)
       WHERE slug = slug_name AND position('{{GUIDING_BRIEF}}' IN generation_prompt) > 0;
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE '% : guiding brief inlined (rows updated: %)', slug_name, n;
    ELSE
      RAISE NOTICE '% : no generic guiding brief found, {{GUIDING_BRIEF}} left in place', slug_name;
    END IF;

    IF style_text IS NOT NULL THEN
      UPDATE appeals.appeal_draft_types
         SET generation_prompt = replace(generation_prompt, '{{STYLE_GUIDE}}', style_text)
       WHERE slug = slug_name AND position('{{STYLE_GUIDE}}' IN generation_prompt) > 0;
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE '% : style example inlined (rows updated: %)', slug_name, n;
    END IF;
  END LOOP;

  -- ── Stage 1 Review v2: admin_console.llm_prompts ('stage1_review_v2') ────────
  SELECT NULLIF(btrim(guidance_content, E' \t\r\n'), '')
    INTO brief_text
    FROM admin_console.guiding_briefs
   WHERE document_type = 'stage1_review_v2' AND development_type IS NULL;

  SELECT NULLIF(btrim(dst.style_text, E' \t\r\n'), '')
    INTO style_text
    FROM admin_console.document_style_templates dst
    JOIN admin_console.guiding_briefs gb ON gb.id = dst.guiding_brief_id
   WHERE gb.document_type = 'stage1_review_v2' AND gb.development_type IS NULL
   ORDER BY dst.sort_order
   LIMIT 1;

  INSERT INTO admin_console.prompt_inline_backup (source, key, original_text)
  SELECT 'admin_console.llm_prompts', prompt_key, prompt_text
    FROM admin_console.llm_prompts
   WHERE prompt_key = 'stage1_review_v2'
     AND (position('{{GUIDING_BRIEF}}' IN prompt_text) > 0
       OR position('{{STYLE_GUIDE}}'   IN prompt_text) > 0)
  ON CONFLICT (source, key) DO NOTHING;

  IF brief_text IS NOT NULL THEN
    UPDATE admin_console.llm_prompts
       SET prompt_text = replace(prompt_text, '{{GUIDING_BRIEF}}', brief_text),
           updated_at = NOW()
     WHERE prompt_key = 'stage1_review_v2' AND position('{{GUIDING_BRIEF}}' IN prompt_text) > 0;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'stage1_review_v2 : guiding brief inlined (rows updated: %)', n;
  ELSE
    RAISE NOTICE 'stage1_review_v2 : no generic guiding brief found, {{GUIDING_BRIEF}} left in place';
  END IF;

  IF style_text IS NOT NULL THEN
    UPDATE admin_console.llm_prompts
       SET prompt_text = replace(prompt_text, '{{STYLE_GUIDE}}', style_text),
           updated_at = NOW()
     WHERE prompt_key = 'stage1_review_v2' AND position('{{STYLE_GUIDE}}' IN prompt_text) > 0;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'stage1_review_v2 : style template inlined (rows updated: %)', n;
  ELSE
    RAISE NOTICE 'stage1_review_v2 : no style template row, {{STYLE_GUIDE}} left in place (falls back to the stage1reviewexample.md file as before)';
  END IF;
END
$inline$;

-- To undo (example for Statement of Case):
--   UPDATE appeals.appeal_draft_types t SET generation_prompt = b.original_text
--     FROM admin_console.prompt_inline_backup b
--    WHERE b.source = 'appeals.appeal_draft_types' AND b.key = t.slug AND t.slug = 'statement_of_case';
