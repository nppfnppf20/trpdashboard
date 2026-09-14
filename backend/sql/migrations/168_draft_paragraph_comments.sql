-- Sticky-note comments anchored to a paragraph in a draft document (appeal or
-- planning application). Anchored by paragraph id (positional, matches the
-- p{idx} scheme RichTextEditor/PlanningDocIncorporatePanel already use) plus
-- the quoted excerpt so the UI can detect drift if paragraphs shift before
-- the comment is next viewed.

CREATE TABLE IF NOT EXISTS public.draft_paragraph_comments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_kind TEXT NOT NULL CHECK (draft_kind IN ('appeal', 'planning_application')),
  draft_type_id INTEGER NOT NULL,
  paragraph_id TEXT NOT NULL,
  quoted_text TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.user_profiles(id),
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_paragraph_comments_lookup
  ON public.draft_paragraph_comments(project_id, draft_kind, draft_type_id);

COMMENT ON TABLE public.draft_paragraph_comments IS 'Single sticky-note comments (no threads) left on a highlighted passage of a draft document, for a colleague to read/resolve.';
