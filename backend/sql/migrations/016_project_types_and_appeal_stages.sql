-- Migration: 016_project_types_and_appeal_stages.sql
-- Adds project_type support, appeal-specific stage definitions,
-- refusal reasons table, and SoC/SoCG placeholder templates.

-- =============================================================================
-- 1. Add project_type_filter to project_stage_definitions
--    NULL = applies to all non-appeal project types
--    'appeal' = appeal projects only
-- =============================================================================

ALTER TABLE admin_console.project_stage_definitions
  ADD COLUMN IF NOT EXISTS project_type_filter VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN admin_console.project_stage_definitions.project_type_filter IS
  'NULL = standard stages (all non-appeal types). Set to project type string (e.g. ''appeal'') to scope stages to that type only.';

-- Drop the old global unique constraint on display_order so we can have
-- per-type ordering (e.g. appeal stage order 1 can coexist with standard order 1)
ALTER TABLE admin_console.project_stage_definitions
  DROP CONSTRAINT IF EXISTS project_stage_definitions_display_order_key;

-- Unique display_order within standard stages (no type filter)
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_def_order_standard
  ON admin_console.project_stage_definitions(display_order)
  WHERE project_type_filter IS NULL;

-- Unique display_order within each typed stage set
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_def_order_typed
  ON admin_console.project_stage_definitions(display_order, project_type_filter)
  WHERE project_type_filter IS NOT NULL;

-- =============================================================================
-- 2. Seed appeal stage definitions
-- =============================================================================

INSERT INTO admin_console.project_stage_definitions (name, display_order, project_type_filter) VALUES
  ('Reason for Refusal',        1, 'appeal'),
  ('Decision',                  2, 'appeal'),
  ('Appeal Additional Reports', 3, 'appeal'),
  ('Appeal Submission',         4, 'appeal'),
  ('Appeal Decision',           5, 'appeal')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. Create refusal_reasons table
--    Stores individual refusal reasons for appeal projects.
--    Each reason belongs to a project and lives within the Reason for Refusal stage.
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_console.refusal_reasons (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,   -- full description of the reason
  summary       TEXT,                    -- optional shorter summary
  risk_level    VARCHAR(50),             -- showstopper | extremely_high_risk | high_risk | medium_high_risk | medium_risk | medium_low_risk | low_risk
  is_key_issue  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refusal_reasons_project_id
  ON admin_console.refusal_reasons(project_id);

CREATE TRIGGER update_refusal_reasons_updated_at
  BEFORE UPDATE ON admin_console.refusal_reasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE admin_console.refusal_reasons IS
  'Individual reasons for refusal on appeal projects. Each row has a title, optional summary, risk level, and key issue flag.';
COMMENT ON COLUMN admin_console.refusal_reasons.risk_level IS
  'Allowed values: showstopper, extremely_high_risk, high_risk, medium_high_risk, medium_risk, medium_low_risk, low_risk';

-- =============================================================================
-- 4. SoC and SoCG placeholder templates
--    Appeal-specific planning deliverables. Content will be populated later.
-- =============================================================================

INSERT INTO planning_deliverables.planning_templates
  (template_name, template_type, description, template_content, created_by)
VALUES
(
  'Statement of Case',
  'statement_of_case',
  'Appeal Statement of Case (SoC) - placeholder template',
  '{
    "sections": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Statement of Case - {{project_name}}"
      },
      {
        "id": "appeal_ref",
        "type": "paragraph",
        "content": "Appeal Reference: {{project_id}}"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date: {{current_date}}"
      },
      {
        "id": "intro",
        "type": "heading",
        "level": 2,
        "content": "Introduction"
      },
      {
        "id": "intro_text",
        "type": "paragraph",
        "content": "This Statement of Case is submitted on behalf of {{client}} in relation to the appeal against the decision of {{local_planning_authority}} to refuse planning permission at {{address}}."
      },
      {
        "id": "placeholder_note",
        "type": "paragraph",
        "content": "[Template content to be added. This is a placeholder.]"
      }
    ],
    "placeholders": [
      "project_name",
      "project_id",
      "current_date",
      "client",
      "local_planning_authority",
      "address"
    ],
    "applicable_project_types": ["appeal"]
  }',
  'System'
),
(
  'Statement of Common Ground',
  'statement_of_common_ground',
  'Appeal Statement of Common Ground (SoCG) - placeholder template',
  '{
    "sections": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Statement of Common Ground - {{project_name}}"
      },
      {
        "id": "appeal_ref",
        "type": "paragraph",
        "content": "Appeal Reference: {{project_id}}"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date: {{current_date}}"
      },
      {
        "id": "parties",
        "type": "heading",
        "level": 2,
        "content": "The Parties"
      },
      {
        "id": "parties_text",
        "type": "paragraph",
        "content": "This Statement of Common Ground is agreed between {{client}} (the Appellant) and {{local_planning_authority}} (the Local Planning Authority) in relation to the appeal at {{address}}."
      },
      {
        "id": "agreed_facts",
        "type": "heading",
        "level": 2,
        "content": "Agreed Facts"
      },
      {
        "id": "agreed_facts_text",
        "type": "paragraph",
        "content": "[Agreed facts to be inserted here. This is a placeholder.]"
      },
      {
        "id": "agreed_issues",
        "type": "heading",
        "level": 2,
        "content": "Agreed Issues"
      },
      {
        "id": "agreed_issues_text",
        "type": "paragraph",
        "content": "[Agreed issues to be inserted here. This is a placeholder.]"
      }
    ],
    "placeholders": [
      "project_name",
      "project_id",
      "current_date",
      "client",
      "local_planning_authority",
      "address"
    ],
    "applicable_project_types": ["appeal"]
  }',
  'System'
);
