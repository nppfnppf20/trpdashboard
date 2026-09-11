-- Additive FK columns linking project_lead/manager/director to a real app
-- account, alongside (not replacing) the existing free-text columns. Not
-- everyone named in those text fields has a login (e.g. a client-side
-- project_director), so the text fields stay as the fallback and these FKs
-- are populated only when the picked name happens to match a user_profiles
-- account (see EditProjectModal.svelte / AddProjectModal.svelte).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_lead_user_id UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS project_manager_user_id UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS project_director_user_id UUID REFERENCES public.user_profiles(id);

COMMENT ON COLUMN projects.project_lead_user_id IS 'Linked account for project_lead, when that name matches a synced user_profiles row. Null for client contacts / anyone without a login — project_lead (text) remains the display/fallback field.';
COMMENT ON COLUMN projects.project_manager_user_id IS 'Linked account for project_manager, when that name matches a synced user_profiles row. Null for client contacts / anyone without a login — project_manager (text) remains the display/fallback field.';
COMMENT ON COLUMN projects.project_director_user_id IS 'Linked account for project_director, when that name matches a synced user_profiles row. Null for client contacts / anyone without a login — project_director (text) remains the display/fallback field.';
