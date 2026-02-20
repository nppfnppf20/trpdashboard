-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  unique_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Required fields
  project_id VARCHAR(100) NOT NULL,
  project_name VARCHAR(255) NOT NULL,

  -- Optional fields (all nullable)
  local_planning_authority JSONB, -- Array of LPA names
  project_lead VARCHAR(255),
  project_manager VARCHAR(255),
  project_director VARCHAR(255),
  address TEXT,
  polygon_geojson TEXT, -- Site boundary geometry
  area VARCHAR(100), -- Can be auto-calculated or manually entered
  client VARCHAR(255),
  client_spv_name VARCHAR(255),
  sector VARCHAR(100),
  project_type VARCHAR(100),
  designations_on_site TEXT, -- Could be comma-separated or longer description
  relevant_nearby_designations TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);

-- GIN index for JSONB array search (local_planning_authority)
CREATE INDEX IF NOT EXISTS idx_projects_lpa ON projects USING GIN (local_planning_authority);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Add project_id to site_analyses for linking
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE site_analyses DROP CONSTRAINT IF EXISTS fk_project;
ALTER TABLE site_analyses ADD CONSTRAINT fk_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON TABLE projects IS 'Central projects table storing all project metadata and site boundaries';
COMMENT ON COLUMN projects.local_planning_authority IS 'JSONB array of local planning authority names, e.g. ["Westminster", "Camden"]';
COMMENT ON COLUMN projects.polygon_geojson IS 'Site boundary stored as GeoJSON string';
COMMENT ON COLUMN projects.area IS 'Site area - can be auto-calculated from geometry or manually entered';
