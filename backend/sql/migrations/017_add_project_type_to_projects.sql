-- Migration: 017_add_project_type_to_projects.sql
-- Adds project_type column to public.projects if it doesn't already exist.
-- Required by workflow.service.js to determine appeal vs standard stage seeding.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(100);

COMMENT ON COLUMN public.projects.project_type IS
  'Project type (e.g. ''Appeal'', ''Solar'', etc.). Used to seed the correct stage definitions.';
