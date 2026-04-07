-- Migration: Add project-level display order to stage instances
-- Allows per-project stage ordering (including custom stages) independent of
-- the global project_stage_definitions.display_order.
-- Migration: 023_project_stage_instance_order.sql

ALTER TABLE admin_console.project_stage_instances
  ADD COLUMN IF NOT EXISTS project_display_order FLOAT;
