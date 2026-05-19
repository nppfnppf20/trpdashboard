-- Guiding briefs: admin-defined document standards that guide generation
-- and provide post-generation review checklists.
-- A null development_type row applies to all development types;
-- a non-null row is a development-type-specific variant.

CREATE TABLE IF NOT EXISTS admin_console.guiding_briefs (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  document_type    VARCHAR(100) NOT NULL,
  development_type VARCHAR(100) DEFAULT NULL,
  guidance_content TEXT         DEFAULT NULL,
  review_checklist TEXT         DEFAULT NULL,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One brief per document_type + development_type combination
CREATE UNIQUE INDEX IF NOT EXISTS guiding_briefs_doctype_devtype_uidx
  ON admin_console.guiding_briefs (document_type, COALESCE(development_type, ''));

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION admin_console.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guiding_briefs_updated_at
  BEFORE UPDATE ON admin_console.guiding_briefs
  FOR EACH ROW EXECUTE FUNCTION admin_console.set_updated_at();
