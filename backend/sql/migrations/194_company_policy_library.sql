-- Company Policy Library (RAG): internal policy documents uploaded in the app, chunked and embedded
-- for search and chat. New tables only; nothing existing is altered. Safe to re-run.
-- Plan: docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md
--
--   company_documents.documents  one row per uploaded file/version. The original lives in the private
--                             'company-policies' storage bucket; the chunks below are a rebuildable index.
--   company_documents.chunks     structure-based chunks of a document (section path, page, text) with an
--                             embedding (OpenAI text-embedding-3-small, 1536 dims) and a full-text column.
--
-- Access: the backend is the only reader/writer (it connects with the service/postgres role, which bypasses
-- RLS). RLS is enabled with no policies and every grant to anon/authenticated is revoked, so the tables are
-- unreachable through the Supabase client API. Same stance as migrations 151-157.
--
-- Versioning: uploading a new version inserts a new document row pointing at the old one (supersedes_id) and
-- flips the old row's is_current to false. Search only reads chunks of current documents, so chunks need no
-- flag of their own. 'uploaded' means stored but not yet indexed (ingestion arrives in the next phase).

CREATE EXTENSION IF NOT EXISTS vector;

-- Own schema, so it is not exposed through the Supabase API (only schemas listed under API settings are).
CREATE SCHEMA IF NOT EXISTS company_documents;

CREATE TABLE IF NOT EXISTS company_documents.documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  version TEXT NOT NULL DEFAULT '1',
  effective_date DATE,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  status_detail TEXT,
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'admin')),
  is_current BOOLEAN NOT NULL DEFAULT true,
  supersedes_id INTEGER REFERENCES company_documents.documents(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_documents_current
  ON company_documents.documents (is_current, category);

CREATE TABLE IF NOT EXISTS company_documents.chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES company_documents.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_path TEXT NOT NULL DEFAULT '',
  section_ref TEXT,
  page_start INTEGER,
  page_end INTEGER,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  embedding_model TEXT,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(section_path, '') || ' ' || content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_cp_chunks_embedding
  ON company_documents.chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_cp_chunks_tsv
  ON company_documents.chunks USING gin (tsv);

-- Backend-only access
ALTER TABLE company_documents.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents.chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA company_documents FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA company_documents FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA company_documents FROM anon, authenticated;

-- Private bucket for the original files. No storage.objects policies are added, so only the
-- service-role key (the backend) can read or write it.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-policies', 'company-policies', false)
ON CONFLICT (id) DO NOTHING;
