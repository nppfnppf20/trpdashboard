-- Migration: 045_add_suggest_template_to_prompt_settings.sql
-- Adds a per-project editable prompt template for the argument suggestion flow.

ALTER TABLE public.appeal_prompt_settings
  ADD COLUMN IF NOT EXISTS suggest_argument_template TEXT;
