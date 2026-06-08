CREATE TABLE IF NOT EXISTS admin_console.document_style_templates (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  guiding_brief_id integer REFERENCES admin_console.guiding_briefs(id) ON DELETE SET NULL,
  style_text      text,
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
