-- Migration: Create project workflow tables
-- Adds stage tracking and notification infrastructure to admin_console schema
-- Migration: 011_create_workflow_tables.sql

-- =============================================================================
-- Table 1: project_stage_definitions
-- Global ordered list of project stages (seed data included below)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_console.project_stage_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(display_order)
);

-- =============================================================================
-- Table 2: project_stage_instances
-- Per-project instance of each stage definition
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_console.project_stage_instances (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_definition_id INTEGER NOT NULL REFERENCES admin_console.project_stage_definitions(id) ON DELETE CASCADE,
  is_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, stage_definition_id)
);

-- =============================================================================
-- Table 3: project_issue_tracks
-- Project-level issue rows (left-hand side of the stage board)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_console.project_issue_tracks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  track_type VARCHAR(50) NOT NULL DEFAULT 'discipline', -- 'discipline' | 'custom'
  source_key VARCHAR(100),           -- HLPV discipline key e.g. 'heritage', 'ecology'
  label VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_key_issue BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_from_hlpv BOOLEAN NOT NULL DEFAULT FALSE,
  last_known_risk_level VARCHAR(50),  -- mirrors risk vocabulary: extremely_high_risk etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table 4: project_issue_stage_entries
-- Per-stage snapshot for each issue row (populated when a stage is completed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_console.project_issue_stage_entries (
  id SERIAL PRIMARY KEY,
  project_stage_instance_id INTEGER NOT NULL REFERENCES admin_console.project_stage_instances(id) ON DELETE CASCADE,
  issue_track_id INTEGER NOT NULL REFERENCES admin_console.project_issue_tracks(id) ON DELETE CASCADE,
  risk_level VARCHAR(50),   -- showstopper | extremely_high_risk | high_risk | medium_high_risk | medium_risk | medium_low_risk | low_risk
  summary TEXT,
  notes TEXT,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_stage_instance_id, issue_track_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_stage_instances_project ON admin_console.project_stage_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_stage_instances_complete ON admin_console.project_stage_instances(is_complete);
CREATE INDEX IF NOT EXISTS idx_stage_instances_target_date ON admin_console.project_stage_instances(target_date);

CREATE INDEX IF NOT EXISTS idx_issue_tracks_project ON admin_console.project_issue_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_tracks_key_issue ON admin_console.project_issue_tracks(is_key_issue);

CREATE INDEX IF NOT EXISTS idx_issue_entries_instance ON admin_console.project_issue_stage_entries(project_stage_instance_id);
CREATE INDEX IF NOT EXISTS idx_issue_entries_track ON admin_console.project_issue_stage_entries(issue_track_id);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
CREATE TRIGGER update_project_stage_definitions_updated_at
  BEFORE UPDATE ON admin_console.project_stage_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_stage_instances_updated_at
  BEFORE UPDATE ON admin_console.project_stage_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_issue_tracks_updated_at
  BEFORE UPDATE ON admin_console.project_issue_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_issue_stage_entries_updated_at
  BEFORE UPDATE ON admin_console.project_issue_stage_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Seed: global stage definitions (ordered)
-- =============================================================================
INSERT INTO admin_console.project_stage_definitions (name, display_order) VALUES
  ('Kick-off Meeting',         1),
  ('High-Level Planning View', 2),
  ('Stage 1 Review',           3),
  ('EIA',                      4),
  ('Pre-app',                  5),
  ('Surveyor Input',           6),
  ('Submission',               7),
  ('Discharge of Conditions',  8),
  ('Appeal Submission',        9)
ON CONFLICT (display_order) DO NOTHING;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE admin_console.project_stage_definitions IS 'Global ordered list of project stages shown across the top of the board';
COMMENT ON TABLE admin_console.project_stage_instances IS 'Per-project instance of each stage: tracks applicability, completion, and dates';
COMMENT ON TABLE admin_console.project_issue_tracks IS 'Project-level issue rows for the stage board; seeded from HLPV disciplines or created manually';
COMMENT ON TABLE admin_console.project_issue_stage_entries IS 'Snapshot of each issue row at a given stage, saved when a stage is completed';

COMMENT ON COLUMN admin_console.project_issue_tracks.source_key IS 'HLPV discipline identifier e.g. heritage, landscape, ecology, ag_land, renewables, trees, airfields, flood, aviation, highways, amenity';
COMMENT ON COLUMN admin_console.project_issue_tracks.last_known_risk_level IS 'Cached risk level from most recent completed stage entry or HLPV seed';
COMMENT ON COLUMN admin_console.project_issue_stage_entries.risk_level IS 'Allowed values: showstopper, extremely_high_risk, high_risk, medium_high_risk, medium_risk, medium_low_risk, low_risk';
