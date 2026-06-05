-- Starting documents for appeal-type draft generation (PA workspace).
-- Stores user-uploaded/pasted source documents (Decision Notice, Officer's Report etc.)
-- that get injected as {{VARIABLE}} placeholders into the generation prompt.

CREATE TABLE IF NOT EXISTS appeals.pa_draft_starting_docs (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_type_id INTEGER NOT NULL REFERENCES appeals.appeal_draft_types(id) ON DELETE CASCADE,
  slot_slug     TEXT NOT NULL,   -- e.g. 'decision_notice', 'officers_report', 'other'
  content_text  TEXT NOT NULL DEFAULT '',
  file_name     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, draft_type_id, slot_slug)
);

CREATE INDEX IF NOT EXISTS pa_draft_starting_docs_project_type
  ON appeals.pa_draft_starting_docs (project_id, draft_type_id);
