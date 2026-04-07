-- Migration: Allow project-specific custom stages
-- Makes stage_definition_id nullable on project_stage_instances so a stage can be
-- project-specific (no global definition), with a custom_name and custom_display_order instead.
-- Migration: 022_custom_project_stages.sql

-- Make stage_definition_id nullable
ALTER TABLE admin_console.project_stage_instances
  ALTER COLUMN stage_definition_id DROP NOT NULL;

-- Add columns for custom stages
ALTER TABLE admin_console.project_stage_instances
  ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_display_order INTEGER;

-- Drop the global unique constraint (project, definition) — custom stages have no definition
ALTER TABLE admin_console.project_stage_instances
  DROP CONSTRAINT IF EXISTS project_stage_instances_project_id_stage_definition_id_key;

-- Ensure every row has either a definition or a custom name
ALTER TABLE admin_console.project_stage_instances
  ADD CONSTRAINT project_stage_instances_name_or_def
  CHECK (stage_definition_id IS NOT NULL OR custom_name IS NOT NULL);

-- Re-add unique constraint for standard stages only (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS project_stage_instances_project_def_unique
  ON admin_console.project_stage_instances (project_id, stage_definition_id)
  WHERE stage_definition_id IS NOT NULL;
