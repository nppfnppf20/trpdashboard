-- Policy context template text by development type.
-- One row per dev type; columns populated separately when text is ready.

CREATE TABLE IF NOT EXISTS planning_applications.policy_context_templates (
  development_type      VARCHAR(100) PRIMARY KEY,
  nppf_text             TEXT,
  nppg_text             TEXT,
  other_national_text   TEXT,
  other_guidance_text   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a row per development type matching the frontend dropdown values.
-- Text columns left NULL — populated when content is ready.
INSERT INTO planning_applications.policy_context_templates (development_type)
VALUES
  ('Residential'),
  ('Co-Living'),
  ('Commercial'),
  ('Solar'),
  ('Wind'),
  ('Mixed Use'),
  ('Industrial'),
  ('Change of Use'),
  ('Agricultural'),
  ('Other')
ON CONFLICT (development_type) DO NOTHING;
