-- Marketing tool: card-based content generation per project

CREATE SCHEMA IF NOT EXISTS marketing;

CREATE TABLE IF NOT EXISTS marketing.draft_types (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS marketing.drafts (
  id              serial PRIMARY KEY,
  project_id      integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_type_id   integer NOT NULL REFERENCES marketing.draft_types(id),
  content_html    text,
  generated_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, draft_type_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_drafts_project ON marketing.drafts(project_id);

INSERT INTO marketing.draft_types (slug, name, description, sort_order) VALUES
  ('now_linkedin',    '"Now" LinkedIn Post', 'A short, punchy LinkedIn update — what is happening right now on this project.', 0),
  ('short_linkedin',  'Short LinkedIn Post',  'A standard professional LinkedIn post for a broad audience.', 10),
  ('long_newsletter', 'Long Newsletter',       'A long-form newsletter article covering the project in depth.', 20)
ON CONFLICT (slug) DO NOTHING;
