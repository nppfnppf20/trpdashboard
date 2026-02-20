-- TRP Report Database Schema
-- Creates tables for storing site analyses and TRP report edits

-- Main table to store complete site analyses
CREATE TABLE IF NOT EXISTS site_analyses (
  id SERIAL PRIMARY KEY,
  unique_id VARCHAR(36) UNIQUE NOT NULL, -- UUID format
  site_name VARCHAR(255) NOT NULL,
  polygon_geojson TEXT NOT NULL,
  heritage_data JSONB,
  landscape_data JSONB,
  renewables_data JSONB,
  ecology_data JSONB,
  ag_land_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TRP report edits linked to site analyses
CREATE TABLE IF NOT EXISTS trp_reports (
  id SERIAL PRIMARY KEY,
  site_analysis_id INTEGER REFERENCES site_analyses(id) ON DELETE CASCADE,
  site_summary TEXT,
  overall_risk_estimation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_analysis_id) -- One TRP report per site analysis
);

-- TRP discipline risk level edits
CREATE TABLE IF NOT EXISTS trp_discipline_risks (
  id SERIAL PRIMARY KEY,
  trp_report_id INTEGER REFERENCES trp_reports(id) ON DELETE CASCADE,
  discipline_name VARCHAR(100) NOT NULL, -- 'Heritage', 'Landscape', 'Ecology', etc.
  risk_level VARCHAR(50) NOT NULL, -- 'showstopper', 'extremely_high_risk', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(trp_report_id, discipline_name) -- One risk level per discipline per report
);

-- TRP rule findings edits
CREATE TABLE IF NOT EXISTS trp_rule_edits (
  id SERIAL PRIMARY KEY,
  trp_report_id INTEGER REFERENCES trp_reports(id) ON DELETE CASCADE,
  discipline_name VARCHAR(100) NOT NULL,
  rule_title VARCHAR(500) NOT NULL,
  findings_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(trp_report_id, discipline_name, rule_title) -- One edit per rule per discipline per report
);

-- TRP recommendations edits
CREATE TABLE IF NOT EXISTS trp_recommendations (
  id SERIAL PRIMARY KEY,
  trp_report_id INTEGER REFERENCES trp_reports(id) ON DELETE CASCADE,
  discipline_name VARCHAR(100) NOT NULL,
  recommendation_text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0, -- To maintain order of recommendations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_site_analyses_unique_id ON site_analyses(unique_id);
CREATE INDEX IF NOT EXISTS idx_site_analyses_created_at ON site_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_trp_reports_site_analysis_id ON trp_reports(site_analysis_id);
CREATE INDEX IF NOT EXISTS idx_trp_discipline_risks_report_id ON trp_discipline_risks(trp_report_id);
CREATE INDEX IF NOT EXISTS idx_trp_rule_edits_report_id ON trp_rule_edits(trp_report_id);
CREATE INDEX IF NOT EXISTS idx_trp_recommendations_report_id ON trp_recommendations(trp_report_id);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_site_analyses_updated_at BEFORE UPDATE ON site_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trp_reports_updated_at BEFORE UPDATE ON trp_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trp_discipline_risks_updated_at BEFORE UPDATE ON trp_discipline_risks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trp_rule_edits_updated_at BEFORE UPDATE ON trp_rule_edits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trp_recommendations_updated_at BEFORE UPDATE ON trp_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();