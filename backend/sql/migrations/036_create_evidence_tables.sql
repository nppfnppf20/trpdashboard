-- Migration 036: Evidence tables for evidence-backed appeal drafting
-- Adds document_text_spans, argument_points, and argument_point_evidence
-- to support source-verified evidence in draft generation.

-- Stores every chunk extracted from an analysed document.
-- Chunk text is the actual extracted document text — not LLM-generated.
-- is_high_value flags conclusion/summary sections detected by heading keywords.
CREATE TABLE IF NOT EXISTS planning_applications.document_text_spans (
  id                SERIAL PRIMARY KEY,
  document_log_id   INTEGER NOT NULL REFERENCES planning_applications.document_log(id) ON DELETE CASCADE,
  project_id        INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index       INTEGER NOT NULL,
  char_start        INTEGER NOT NULL,
  char_end          INTEGER NOT NULL,
  text              TEXT NOT NULL,
  is_high_value     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_spans_document ON planning_applications.document_text_spans(document_log_id);
CREATE INDEX IF NOT EXISTS idx_pa_spans_project  ON planning_applications.document_text_spans(project_id);

-- Structured argument points — one record per accepted point from a document.
-- Stores the display headline and a richer detailed_summary separately so
-- the UI can show short labels while the draft LLM gets full evidential depth.
-- document_log_id is nullable to allow manually written points with no source doc.
CREATE TABLE IF NOT EXISTS planning_applications.argument_points (
  id                SERIAL PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  track_id          INTEGER NOT NULL REFERENCES admin_console.project_issue_tracks(id) ON DELETE CASCADE,
  document_log_id   INTEGER REFERENCES planning_applications.document_log(id) ON DELETE SET NULL,
  field             TEXT NOT NULL CHECK (field IN ('argument_for', 'argument_against')),
  headline          TEXT NOT NULL,
  detailed_summary  TEXT,
  accepted          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_argpoints_project ON planning_applications.argument_points(project_id, track_id);

CREATE TRIGGER set_argument_points_updated_at
  BEFORE UPDATE ON planning_applications.argument_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Links argument points to the source text spans that back them.
-- quote_snapshot preserves the exact span text at time of linking so evidence
-- remains stable even if the span record is later altered.
CREATE TABLE IF NOT EXISTS planning_applications.argument_point_evidence (
  id                   SERIAL PRIMARY KEY,
  argument_point_id    INTEGER NOT NULL REFERENCES planning_applications.argument_points(id) ON DELETE CASCADE,
  span_id              INTEGER REFERENCES planning_applications.document_text_spans(id) ON DELETE SET NULL,
  quote_snapshot       TEXT,
  relevance_note       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_evidence_point ON planning_applications.argument_point_evidence(argument_point_id);
