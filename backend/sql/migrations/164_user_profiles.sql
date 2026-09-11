-- Foundational identity table: one row per app account (auth.users), upserted
-- on login via POST /api/users/me/sync. Nothing else links to this yet — it's
-- the base a later migration can add project_lead_user_id/etc FKs on top of.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS 'One row per app account (auth.users), upserted on login via POST /api/users/me/sync. Foundational identity table for linking accounts to projects/tasks elsewhere in the schema.';
