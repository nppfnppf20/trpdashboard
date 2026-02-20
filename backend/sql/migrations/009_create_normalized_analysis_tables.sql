-- Normalized Analysis Tables
-- Replaces JSONB blobs with proper relational structure
-- Migration: 009_create_normalized_analysis_tables.sql

-- =============================================================================
-- Table 1: analysis_sessions
-- One row per analysis run (replaces analysis_original for metadata)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  site_name VARCHAR(255) NOT NULL,
  polygon_geojson TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- Table 2: analysis_findings
-- One row per feature found (listed building, AONB, SSSI, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  -- Classification
  discipline VARCHAR(50) NOT NULL,  -- 'heritage', 'landscape', 'ecology', 'trees', 'renewables', 'airfields', 'ag_land'
  feature_type VARCHAR(100) NOT NULL,  -- 'listed_building', 'conservation_area', 'aonb', 'sssi', etc.

  -- Feature details
  feature_name TEXT,
  feature_id VARCHAR(255),  -- External ID if available (list_entry, reference, etc.)
  grade VARCHAR(50),  -- For listed buildings: 'I', 'II*', 'II'

  -- Location/proximity
  distance_m NUMERIC,
  direction VARCHAR(20),  -- 'N', 'NE', 'E', etc.
  on_site BOOLEAN DEFAULT FALSE,

  -- Proximity flags (vary by feature type)
  within_50m BOOLEAN DEFAULT FALSE,
  within_100m BOOLEAN DEFAULT FALSE,
  within_250m BOOLEAN DEFAULT FALSE,
  within_500m BOOLEAN DEFAULT FALSE,
  within_1km BOOLEAN DEFAULT FALSE,
  within_3km BOOLEAN DEFAULT FALSE,
  within_5km BOOLEAN DEFAULT FALSE,

  -- Additional data (flexible for different feature types)
  percentage_coverage NUMERIC,  -- For ag_land grades, drinking water, etc.
  additional_data JSONB,  -- Any extra fields specific to feature type

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table 3: analysis_rules_triggered
-- One row per rule that was triggered
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_rules_triggered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  discipline VARCHAR(50) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  risk_level VARCHAR(50) NOT NULL,  -- 'showstopper', 'extremely_high_risk', 'high_risk', etc.
  findings_text TEXT,
  recommendations TEXT[],  -- Array of recommendation strings

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table 4: analysis_discipline_summary
-- One row per discipline per session - stores overall risk and recommendations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_discipline_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  discipline VARCHAR(50) NOT NULL,
  overall_risk VARCHAR(50),  -- 'showstopper', 'extremely_high_risk', etc.
  discipline_recommendation TEXT,
  default_triggered_recommendations TEXT[],
  default_no_rules_recommendations TEXT[],

  -- Metadata from the analysis
  rules_version VARCHAR(50),
  total_rules_processed INTEGER,
  rules_triggered_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One summary per discipline per session
  UNIQUE(session_id, discipline)
);

-- =============================================================================
-- Table 5: analysis_edits
-- Tracks edits to discipline summaries (replaces analysis_edited)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  discipline VARCHAR(50) NOT NULL,
  edited_overall_risk VARCHAR(50),
  edited_recommendations TEXT[],

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- One edit record per discipline per session
  UNIQUE(session_id, discipline)
);

-- =============================================================================
-- Table 6: analysis_change_log
-- Audit trail of all changes (replaces analysis_changes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

  discipline VARCHAR(50) NOT NULL,
  field_path VARCHAR(255) NOT NULL,  -- 'overallRisk', 'recommendations', etc.
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,  -- Required for audit trail

  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_project_id ON public.analysis_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON public.analysis_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_findings_session_id ON public.analysis_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_findings_discipline ON public.analysis_findings(discipline);
CREATE INDEX IF NOT EXISTS idx_analysis_findings_feature_type ON public.analysis_findings(feature_type);

CREATE INDEX IF NOT EXISTS idx_analysis_rules_session_id ON public.analysis_rules_triggered(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_rules_discipline ON public.analysis_rules_triggered(discipline);

CREATE INDEX IF NOT EXISTS idx_analysis_summary_session_id ON public.analysis_discipline_summary(session_id);

CREATE INDEX IF NOT EXISTS idx_analysis_edits_session_id ON public.analysis_edits(session_id);

CREATE INDEX IF NOT EXISTS idx_analysis_change_log_session_id ON public.analysis_change_log(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_change_log_changed_at ON public.analysis_change_log(changed_at);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE TRIGGER update_analysis_edits_updated_at
  BEFORE UPDATE ON public.analysis_edits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_rules_triggered ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_discipline_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_change_log ENABLE ROW LEVEL SECURITY;

-- Policies: Allow authenticated users to read/write
CREATE POLICY "Users can insert analysis sessions" ON public.analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Users can read all analysis sessions" ON public.analysis_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert findings" ON public.analysis_findings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read all findings" ON public.analysis_findings
  FOR SELECT USING (true);

CREATE POLICY "Users can insert rules" ON public.analysis_rules_triggered
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read all rules" ON public.analysis_rules_triggered
  FOR SELECT USING (true);

CREATE POLICY "Users can insert summaries" ON public.analysis_discipline_summary
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read all summaries" ON public.analysis_discipline_summary
  FOR SELECT USING (true);

CREATE POLICY "Users can insert edits" ON public.analysis_edits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update edits" ON public.analysis_edits
  FOR UPDATE USING (true);

CREATE POLICY "Users can read all edits" ON public.analysis_edits
  FOR SELECT USING (true);

CREATE POLICY "Users can insert change log" ON public.analysis_change_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read all change log" ON public.analysis_change_log
  FOR SELECT USING (true);

-- =============================================================================
-- Comments for documentation
-- =============================================================================
COMMENT ON TABLE public.analysis_sessions IS 'One row per analysis run - stores session metadata';
COMMENT ON TABLE public.analysis_findings IS 'Individual features found during analysis (listed buildings, AONBs, SSSIs, etc.)';
COMMENT ON TABLE public.analysis_rules_triggered IS 'Rules that were triggered during analysis';
COMMENT ON TABLE public.analysis_discipline_summary IS 'Summary per discipline (overall risk, recommendations)';
COMMENT ON TABLE public.analysis_edits IS 'User edits to discipline summaries';
COMMENT ON TABLE public.analysis_change_log IS 'Audit trail of all changes with reasons';
