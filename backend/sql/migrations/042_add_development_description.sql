-- Add development_description to projects table for Planning Statement generation
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS development_description TEXT;
