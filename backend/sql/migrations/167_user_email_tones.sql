-- Per-user email tones for the project-chat "Email" feature: each user can
-- save one or more named tones (pasted examples of emails they've actually
-- sent), pick one as their universal default, and select a different one
-- per chat session when asking the assistant to draft an email.

CREATE TABLE IF NOT EXISTS public.user_email_tones (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sample_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_email_tones_user_id ON public.user_email_tones(user_id);

COMMENT ON TABLE public.user_email_tones IS 'User-authored email tones (pasted example emails) used by project chat to style drafted emails. Exactly one row per user should have is_default = true, enforced in the service layer rather than a DB constraint.';
