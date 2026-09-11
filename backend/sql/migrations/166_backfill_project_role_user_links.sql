-- One-time backfill for projects created before 165_project_role_user_links.sql:
-- links project_lead/manager/director wherever the free-text name is an exact
-- match to a synced user_profiles.display_name. Exact match only — no fuzzy
-- matching, so a project with no exact match simply stays NULL, same as any
-- other unlinked name (client contact, typo, name predating the account, etc).
-- Idempotent — safe to re-run, since each UPDATE only touches rows still NULL.

UPDATE projects p
SET project_lead_user_id = up.id
FROM public.user_profiles up
WHERE p.project_lead_user_id IS NULL
  AND p.project_lead = up.display_name;

UPDATE projects p
SET project_manager_user_id = up.id
FROM public.user_profiles up
WHERE p.project_manager_user_id IS NULL
  AND p.project_manager = up.display_name;

UPDATE projects p
SET project_director_user_id = up.id
FROM public.user_profiles up
WHERE p.project_director_user_id IS NULL
  AND p.project_director = up.display_name;
