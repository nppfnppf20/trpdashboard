-- Similar Schemes the team has picked and saved against a project (from the PlanIt search).
-- One row per project and PlanIt application, shared by everyone on the project. Holds a snapshot of the PlanIt
-- record (description, address, status, dates, council link) plus the AI's reason it was relevant, if there was one.

CREATE TABLE IF NOT EXISTS public.similar_schemes_saved (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  planit_name TEXT NOT NULL,
  data JSONB NOT NULL,
  saved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, planit_name)
);

CREATE INDEX IF NOT EXISTS idx_similar_schemes_saved_project ON public.similar_schemes_saved (project_id, saved_at DESC);

COMMENT ON TABLE public.similar_schemes_saved IS 'Planning applications saved against a project from the Similar Schemes PlanIt search: snapshot of the PlanIt record plus the AI reason it was relevant.';
