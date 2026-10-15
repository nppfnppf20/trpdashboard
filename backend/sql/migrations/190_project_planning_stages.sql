-- Project planning stages: where each project is in the seven planning stages, shown as a strip of pills
-- in the project workspace header. Safe to re-run.
--
--   project_planning_stages   one row per project per stage, with a status and when it last changed
--   projects.planning_stages_applicable   false hides the whole strip for a project (e.g. not a planning job)
--
-- stage_key values: appraisal (1a), pre_app (2), eia_screening (3), surveys (4a), public_engagement (5),
-- prepare_application (6), post_submission (7). The API keeps the names and order.
--
-- A stage with no row means "not started", so existing projects need no backfill: the API fills in the
-- seven stages with that default and creates the row the first time a stage is changed. Several stages
-- can be in progress at once. A status of 'na' means that one stage does not apply; hiding the whole strip
-- is the separate column on projects, so turning it back on restores the stage statuses.
--
-- The only change to an existing table is one new column with a default, so every existing project and
-- query behaves as before. Deleting a project removes its stage rows.

CREATE TABLE IF NOT EXISTS public.project_planning_stages (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL CHECK (stage_key IN (
    'appraisal', 'pre_app', 'eia_screening', 'surveys', 'public_engagement', 'prepare_application', 'post_submission'
  )),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete', 'na')),
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, stage_key)
);

CREATE INDEX IF NOT EXISTS idx_project_planning_stages_project ON public.project_planning_stages (project_id);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS planning_stages_applicable BOOLEAN NOT NULL DEFAULT true;

-- The app reaches this through the backend's own database connection. Row level security with no policies
-- keeps it closed to the public Supabase API (anon / authenticated keys).
ALTER TABLE public.project_planning_stages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.project_planning_stages IS 'Planning stage status per project (not_started, in_progress, complete, na). A missing row means not started.';
COMMENT ON COLUMN public.projects.planning_stages_applicable IS 'False hides the planning stage strip for this project. Stage statuses are kept.';
