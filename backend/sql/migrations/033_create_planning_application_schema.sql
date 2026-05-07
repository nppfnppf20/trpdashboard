CREATE SCHEMA IF NOT EXISTS planning_applications;

-- Per-project per-issue notes (policy tiers + argument notes)
CREATE TABLE planning_applications.issue_notes (
  id                    SERIAL PRIMARY KEY,
  project_id            INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  track_id              INTEGER NOT NULL REFERENCES admin_console.project_issue_tracks(id) ON DELETE CASCADE,
  policy_national       TEXT,
  policy_local          TEXT,
  policy_neighbourhood  TEXT,
  policy_supplementary  TEXT,
  argument_for          TEXT,
  argument_against      TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, track_id)
);

-- Per-project prompt settings (key/value)
CREATE TABLE planning_applications.prompt_settings (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt_key  TEXT NOT NULL,
  prompt_text TEXT,
  UNIQUE (project_id, prompt_key)
);

-- Per-project document log
CREATE TABLE planning_applications.document_log (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  code             TEXT,
  document_summary TEXT,
  argument_points  JSONB NOT NULL DEFAULT '[]',
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON planning_applications.document_log(project_id, logged_at DESC);

-- Global draft types (e.g. Planning Statement, D&A Statement)
CREATE TABLE planning_applications.draft_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER DEFAULT 0
);

-- Global draft sections per type
CREATE TABLE planning_applications.draft_sections (
  id                SERIAL PRIMARY KEY,
  draft_type_id     INTEGER NOT NULL REFERENCES planning_applications.draft_types(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,
  generation_prompt TEXT,
  example_text      TEXT,
  sort_order        INTEGER DEFAULT 0,
  UNIQUE (draft_type_id, slug)
);

-- Per-project draft content
CREATE TABLE planning_applications.drafts (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_type_id INTEGER NOT NULL REFERENCES planning_applications.draft_types(id) ON DELETE CASCADE,
  content_html  TEXT,
  generated_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, draft_type_id)
);
