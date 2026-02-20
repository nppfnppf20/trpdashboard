-- Analysis Versioning Tables
-- Creates tables for tracking original analysis, edited versions, and change history
-- Migration: 008_create_analysis_versioning_tables.sql

-- =============================================================================
-- Table 1: analysis_original
-- Stores the immutable original automated analysis results
-- This is saved automatically when analysis first runs, before any user edits
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_original (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,  -- nullable for one-off analyses
  site_name VARCHAR(255) NOT NULL,
  polygon_geojson TEXT NOT NULL,

  -- Discipline data (JSONB for flexibility)
  heritage_data JSONB,
  landscape_data JSONB,
  renewables_data JSONB,
  ecology_data JSONB,
  ag_land_data JSONB,
  trees_data JSONB,
  airfields_data JSONB,

  -- Frontend-only disciplines (user-entered, not from backend analysis)
  flood_data JSONB,
  aviation_data JSONB,
  highways_data JSONB,
  amenity_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- Table 2: analysis_edited
-- Stores the current edited version of the analysis
-- Overwrites on each save - always represents the latest user edits
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_edited (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL REFERENCES public.analysis_original(id) ON DELETE CASCADE,

  -- Discipline data (JSONB - same structure as original)
  heritage_data JSONB,
  landscape_data JSONB,
  renewables_data JSONB,
  ecology_data JSONB,
  ag_land_data JSONB,
  trees_data JSONB,
  airfields_data JSONB,

  -- Frontend-only disciplines
  flood_data JSONB,
  aviation_data JSONB,
  highways_data JSONB,
  amenity_data JSONB,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Only one edited version per original
  UNIQUE(original_id)
);

-- =============================================================================
-- Table 3: analysis_changes
-- Audit log of all field-level changes with reasons
-- Records every change made from original to edited version
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL REFERENCES public.analysis_original(id) ON DELETE CASCADE,

  -- What changed
  discipline VARCHAR(100) NOT NULL,  -- 'heritage', 'landscape', 'flood', etc.
  field_path VARCHAR(255) NOT NULL,  -- 'overallRisk', 'rules.0.findings', etc.

  -- Values
  old_value JSONB,
  new_value JSONB,

  -- Reason for change (required for risk level changes)
  reason TEXT,

  -- Metadata
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_analysis_original_project_id ON public.analysis_original(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_original_created_at ON public.analysis_original(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_edited_original_id ON public.analysis_edited(original_id);
CREATE INDEX IF NOT EXISTS idx_analysis_changes_original_id ON public.analysis_changes(original_id);
CREATE INDEX IF NOT EXISTS idx_analysis_changes_discipline ON public.analysis_changes(discipline);
CREATE INDEX IF NOT EXISTS idx_analysis_changes_changed_at ON public.analysis_changes(changed_at);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE TRIGGER update_analysis_edited_updated_at
  BEFORE UPDATE ON public.analysis_edited
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.analysis_original ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_edited ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_changes ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can read/write their own analyses
-- (Adjust these based on your specific access requirements)

-- analysis_original policies
CREATE POLICY "Users can insert own original analyses" ON public.analysis_original
  FOR INSERT WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Users can read all original analyses" ON public.analysis_original
  FOR SELECT USING (true);

-- analysis_edited policies
CREATE POLICY "Users can insert edited analyses" ON public.analysis_edited
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update edited analyses" ON public.analysis_edited
  FOR UPDATE USING (true);

CREATE POLICY "Users can read all edited analyses" ON public.analysis_edited
  FOR SELECT USING (true);

-- analysis_changes policies
CREATE POLICY "Users can insert changes" ON public.analysis_changes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read all changes" ON public.analysis_changes
  FOR SELECT USING (true);

-- =============================================================================
-- Comments for documentation
-- =============================================================================
COMMENT ON TABLE public.analysis_original IS 'Stores immutable original automated analysis results before any user edits';
COMMENT ON TABLE public.analysis_edited IS 'Stores current edited version of analysis, overwrites on each save';
COMMENT ON TABLE public.analysis_changes IS 'Audit log of field-level changes with optional reasons';

COMMENT ON COLUMN public.analysis_changes.field_path IS 'Dot-notation path to changed field, e.g. overallRisk or rules.0.findings';
COMMENT ON COLUMN public.analysis_changes.reason IS 'User-provided reason for change, required for risk level changes';
