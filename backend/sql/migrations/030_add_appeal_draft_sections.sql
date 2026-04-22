ALTER TABLE appeals.appeal_draft_types
  DROP COLUMN IF EXISTS generation_prompt,
  DROP COLUMN IF EXISTS example_document;

CREATE TABLE IF NOT EXISTS appeals.appeal_draft_sections (
  id                SERIAL PRIMARY KEY,
  draft_type_id     INTEGER NOT NULL REFERENCES appeals.appeal_draft_types(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  generation_prompt TEXT,
  example_text      TEXT,
  UNIQUE (draft_type_id, slug)
);
