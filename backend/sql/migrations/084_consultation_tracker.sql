-- Consultation Tracker: statutory consultee responses per project

CREATE TABLE IF NOT EXISTS planning_applications.consultation_responses (
  id                  SERIAL PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consultee_name      TEXT NOT NULL,
  date_received       DATE,
  position            TEXT,
  comments            TEXT,
  consultant_response TEXT,
  response_issued     BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up           TEXT,
  source_file_name    TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_responses_project
  ON planning_applications.consultation_responses(project_id);

-- Project-level metadata (export/issue tracking)
CREATE TABLE IF NOT EXISTS planning_applications.consultation_tracker_meta (
  id                       SERIAL PRIMARY KEY,
  project_id               INTEGER UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  last_exported_at         TIMESTAMPTZ,
  last_issued_to_client_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Register as a document type so it appears in the guiding briefs admin dropdown
INSERT INTO planning_applications.draft_types (name, slug, description, sort_order)
VALUES ('Consultation Response', 'consultation_response', 'Statutory consultee response extraction and tracker', 98)
ON CONFLICT (slug) DO NOTHING;
