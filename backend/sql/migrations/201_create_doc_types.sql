-- Document types for the conversational "Create" card (planning application workspace).
--
-- Each type says which Word template the finished document exports with and,
-- optionally, an example document and structure notes the AI is given as a
-- guide to tone, layout and level of detail. Managed in the admin console
-- (Create Doc Types). Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS admin_console.create_doc_types (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  -- Path of a .docx in frontend/static, exactly as used by the Word export
  -- (e.g. '/letter.docx'); NULL falls back to the basic document template.
  word_template   text,
  -- An example document of this type, given to the AI as a style guide
  -- (tone, structure, level of detail). Never a source of facts.
  example_text    text,
  -- Free-text guidance on structure/contents for this type of document.
  structure_notes text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO admin_console.create_doc_types (name, slug, word_template, sort_order) VALUES
  ('General document',          'general',                    '/basicdocument.docx',                                   10),
  ('Letter',                    'letter',                     '/letter.docx',                                          20),
  ('Planning statement',        'planning_statement',         '/planning%20statement%20template%20c%20and%20s.docx',   30),
  ('Statement of Case',         'statement_of_case',          '/appeal%20soc%20template%20c%20and%20s.docx',           40),
  ('Statement of Common Ground','statement_of_common_ground', '/appeal%20socg%20template%20c%20and%20s.docx',         50),
  ('Stage 1 review',            'stage1_review',              '/stage1reviewtemplate.docx',                            60)
ON CONFLICT (slug) DO NOTHING;
