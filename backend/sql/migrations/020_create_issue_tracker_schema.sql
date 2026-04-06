-- Migration: 020_create_issue_tracker_schema.sql
-- Creates the issue_tracker schema for document ingestion + LLM topic tracking.
-- All tables are scoped to issue_tracker to keep this separate from the RAG pipeline
-- and the admin_console workflow tables. FKs cross into public.projects as needed.

CREATE SCHEMA IF NOT EXISTS issue_tracker;

-- =============================================================================
-- Table 1: topics
-- User-defined themes to track across documents (ISS-01, ISS-02 etc.)
-- These are distinct from admin_console.project_issue_tracks which are
-- discipline-based risk tracks on the stage board.
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.topics (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code           VARCHAR(20) NOT NULL,           -- auto-generated e.g. ISS-01
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  keywords       TEXT[],
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, code)
);

-- =============================================================================
-- Table 2: documents
-- Uploaded files attached to a project. Can optionally be tied to an existing
-- project_stage_instance so documents appear in context of the stage board.
-- stage_label is a free-text fallback for non-stage uploads.
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.documents (
  id                       SERIAL PRIMARY KEY,
  project_id               INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_instance_id        INTEGER REFERENCES admin_console.project_stage_instances(id) ON DELETE SET NULL,
  stage_label              VARCHAR(255),          -- free-text label if no stage_instance_id
  filename                 VARCHAR(500) NOT NULL,
  raw_text                 TEXT,
  status                   VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | processing | awaiting_review | confirmed | complete | error
  parse_warning            TEXT,                  -- set if pdf-parse failed and we fell back to UTF-8
  uploaded_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table 3: document_summaries
-- 200-word summary + unmatched content + suggested new topics for a document.
-- Only written once the document is confirmed (not during draft/review phase).
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.document_summaries (
  id                  SERIAL PRIMARY KEY,
  document_id         INTEGER NOT NULL UNIQUE REFERENCES issue_tracker.documents(id) ON DELETE CASCADE,
  summary             TEXT,
  unmatched_content   TEXT,
  suggested_topics    JSONB DEFAULT '[]',
  -- [{ title, description, reason }]
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table 4: topic_summaries
-- LLM analysis result for one topic against one document.
-- is_draft=true rows are written during backfill-on-accept only,
-- normal confirmed results are always is_draft=false.
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.topic_summaries (
  id             SERIAL PRIMARY KEY,
  document_id    INTEGER NOT NULL REFERENCES issue_tracker.documents(id) ON DELETE CASCADE,
  topic_id       INTEGER NOT NULL REFERENCES issue_tracker.topics(id) ON DELETE CASCADE,
  summary        TEXT,
  sentiment      VARCHAR(20),   -- positive | neutral | negative | not_mentioned
  source_quote   TEXT,
  confidence     VARCHAR(10),   -- high | medium | low
  mentioned      BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, topic_id)
);

-- =============================================================================
-- Table 5: draft_topic_summaries
-- Holds LLM output for a preset-stage document while it is awaiting user review.
-- Deleted once the user confirms (rows move to topic_summaries).
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.draft_topic_summaries (
  id             SERIAL PRIMARY KEY,
  document_id    INTEGER NOT NULL REFERENCES issue_tracker.documents(id) ON DELETE CASCADE,
  topic_id       INTEGER NOT NULL REFERENCES issue_tracker.topics(id) ON DELETE CASCADE,
  summary        TEXT,
  sentiment      VARCHAR(20),
  source_quote   TEXT,
  confidence     VARCHAR(10),
  mentioned      BOOLEAN NOT NULL DEFAULT FALSE,
  user_edited    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, topic_id)
);

-- =============================================================================
-- Table 6: draft_document_summaries
-- Mirrors document_summaries but for the review phase only.
-- Deleted once confirmed; the confirmed version goes to document_summaries.
-- =============================================================================
CREATE TABLE IF NOT EXISTS issue_tracker.draft_document_summaries (
  id                  SERIAL PRIMARY KEY,
  document_id         INTEGER NOT NULL UNIQUE REFERENCES issue_tracker.documents(id) ON DELETE CASCADE,
  summary             TEXT,
  unmatched_content   TEXT,
  suggested_topics    JSONB DEFAULT '[]',
  user_edited         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Columns added to existing stage definitions to support per-stage LLM config.
-- When a document is uploaded against a stage that has these set, the custom
-- prompts are used instead of the defaults in llm.service.js.
-- =============================================================================
ALTER TABLE admin_console.project_stage_definitions
  ADD COLUMN IF NOT EXISTS llm_system_prompt        TEXT,
  ADD COLUMN IF NOT EXISTS llm_user_prompt_template TEXT,
  ADD COLUMN IF NOT EXISTS user_guidance            TEXT;

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_it_topics_project      ON issue_tracker.topics(project_id);
CREATE INDEX IF NOT EXISTS idx_it_documents_project   ON issue_tracker.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_it_documents_status    ON issue_tracker.documents(status);
CREATE INDEX IF NOT EXISTS idx_it_documents_stage     ON issue_tracker.documents(stage_instance_id);
CREATE INDEX IF NOT EXISTS idx_it_topic_sums_doc      ON issue_tracker.topic_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_it_topic_sums_topic    ON issue_tracker.topic_summaries(topic_id);
CREATE INDEX IF NOT EXISTS idx_it_draft_topic_doc     ON issue_tracker.draft_topic_summaries(document_id);

-- =============================================================================
-- updated_at triggers (reuse the existing function already in the DB)
-- =============================================================================
CREATE TRIGGER update_it_topics_updated_at
  BEFORE UPDATE ON issue_tracker.topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_it_documents_updated_at
  BEFORE UPDATE ON issue_tracker.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_it_document_summaries_updated_at
  BEFORE UPDATE ON issue_tracker.document_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_it_topic_summaries_updated_at
  BEFORE UPDATE ON issue_tracker.topic_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON SCHEMA issue_tracker IS 'Document ingestion and LLM topic tracking — separate from the RAG pipeline and admin_console workflow tables';

COMMENT ON TABLE issue_tracker.topics IS 'User-defined themes (ISS-01 etc.) to track across uploaded documents; distinct from admin_console discipline tracks';
COMMENT ON TABLE issue_tracker.documents IS 'Files uploaded for LLM analysis; optionally linked to a project stage instance';
COMMENT ON TABLE issue_tracker.document_summaries IS '200-word document summary + unmatched content + suggested new topics; written on confirm';
COMMENT ON TABLE issue_tracker.topic_summaries IS 'Confirmed LLM analysis for one topic against one document';
COMMENT ON TABLE issue_tracker.draft_topic_summaries IS 'Pre-confirm LLM output for preset-stage documents; deleted after user confirms';
COMMENT ON TABLE issue_tracker.draft_document_summaries IS 'Pre-confirm document summary for preset-stage documents; deleted after user confirms';

COMMENT ON COLUMN issue_tracker.documents.stage_instance_id IS 'Links to an existing project stage (Kick-off, EIA etc.) — drives custom LLM prompts and the review flow';
COMMENT ON COLUMN issue_tracker.documents.parse_warning IS 'Non-null if pdf-parse failed and content was read as raw UTF-8 instead';
COMMENT ON COLUMN issue_tracker.topic_summaries.sentiment IS 'positive | neutral | negative | not_mentioned';
COMMENT ON COLUMN issue_tracker.topic_summaries.confidence IS 'high | medium | low — taken from highest-confidence chunk during aggregation';
COMMENT ON COLUMN admin_console.project_stage_definitions.llm_system_prompt IS 'Overrides default LLM system prompt when a document is uploaded against this stage';
COMMENT ON COLUMN admin_console.project_stage_definitions.llm_user_prompt_template IS 'Overrides default user prompt; use {{CHUNK_TEXT}} and {{TOPICS_JSON}} placeholders';
COMMENT ON COLUMN admin_console.project_stage_definitions.user_guidance IS 'Shown to the user above the review form when confirming a document at this stage';
