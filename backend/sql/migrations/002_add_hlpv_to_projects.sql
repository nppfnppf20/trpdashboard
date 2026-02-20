-- Add HLPV risk summary columns to projects table
-- This allows storing quick risk summaries directly on projects for easy access

ALTER TABLE projects ADD COLUMN IF NOT EXISTS heritage_risk VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS landscape_risk VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ecology_risk VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ag_land_risk VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS renewables_risk VARCHAR(50);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS heritage_rule_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS landscape_rule_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ecology_rule_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ag_land_rule_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS renewables_rule_count INTEGER DEFAULT 0;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS hlpv_last_analyzed TIMESTAMP;

-- Add index for querying by risk levels
CREATE INDEX IF NOT EXISTS idx_projects_hlpv_analyzed ON projects(hlpv_last_analyzed);
