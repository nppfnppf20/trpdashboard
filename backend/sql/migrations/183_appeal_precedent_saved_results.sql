-- The latest Appeal Precedent search results for a project, so they survive leaving or reloading the page.
-- One row per project, shared by everyone on the project. Holds our own summaries, findings and the short verified
-- quotes with the Appealbase link for each decision; never the full decision text (Appealbase licence).

CREATE TABLE IF NOT EXISTS public.appeal_precedent_saved (
  project_id INTEGER PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.appeal_precedent_saved IS 'Latest saved Appeal Precedent results per project: records (summaries, findings, short quotes, Appealbase link), the setup form, ticked references and chat. No decision full text.';
