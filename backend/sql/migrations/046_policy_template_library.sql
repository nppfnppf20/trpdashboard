-- Add development_type to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS development_type VARCHAR(100);

-- Policy template library
CREATE TABLE IF NOT EXISTS planning_applications.assessment_policy_templates (
  id               SERIAL PRIMARY KEY,
  discipline       VARCHAR(100) NOT NULL,
  development_type VARCHAR(100) NOT NULL,
  policy_national_text TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discipline, development_type)
);
