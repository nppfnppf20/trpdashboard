CREATE TABLE IF NOT EXISTS public.appeal_prompt_settings (
  project_id  INTEGER PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  extract_points_template TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
