-- Conditions Tracker: planning conditions per project, with per-condition requirements

CREATE TABLE IF NOT EXISTS planning_applications.conditions (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  condition_number TEXT,
  title            TEXT NOT NULL,
  condition_type   TEXT,
  original_consultant       TEXT,
  original_consultant_email TEXT,
  wording          TEXT,
  reason           TEXT,
  initial_actions  TEXT,
  status           TEXT NOT NULL DEFAULT 'Not Started',
  source_file_name TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conditions_project
  ON planning_applications.conditions(project_id);

-- In case the table was created before these columns were added
ALTER TABLE planning_applications.conditions
  ADD COLUMN IF NOT EXISTS condition_type TEXT;
ALTER TABLE planning_applications.conditions
  ADD COLUMN IF NOT EXISTS original_consultant TEXT;
ALTER TABLE planning_applications.conditions
  ADD COLUMN IF NOT EXISTS original_consultant_email TEXT;

-- Separated requirements within a condition (e.g. parts (a), (b), (c))
CREATE TABLE IF NOT EXISTS planning_applications.condition_requirements (
  id               SERIAL PRIMARY KEY,
  condition_id     INTEGER NOT NULL REFERENCES planning_applications.conditions(id) ON DELETE CASCADE,
  requirement_text TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Outstanding',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_requirements_condition
  ON planning_applications.condition_requirements(condition_id);

-- Dated advancements: a running progress log per condition (typed notes or
-- pasted email trails). One paste can fan out to several conditions, each
-- getting its own row sharing the same date/full_text.
CREATE TABLE IF NOT EXISTS planning_applications.condition_advancements (
  id               SERIAL PRIMARY KEY,
  condition_id     INTEGER NOT NULL REFERENCES planning_applications.conditions(id) ON DELETE CASCADE,
  advancement_date DATE NOT NULL,
  summary          TEXT NOT NULL,
  full_text        TEXT,
  source_type      TEXT NOT NULL DEFAULT 'note',  -- 'note' | 'email'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_advancements_condition
  ON planning_applications.condition_advancements(condition_id);

-- Which separated requirements (if any) an advancement specifically relates to
CREATE TABLE IF NOT EXISTS planning_applications.condition_advancement_requirements (
  advancement_id INTEGER NOT NULL REFERENCES planning_applications.condition_advancements(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES planning_applications.condition_requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (advancement_id, requirement_id)
);

-- Project-level metadata (export/issue tracking)
CREATE TABLE IF NOT EXISTS planning_applications.conditions_tracker_meta (
  id                       SERIAL PRIMARY KEY,
  project_id               INTEGER UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  last_exported_at         TIMESTAMPTZ,
  last_issued_to_client_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
