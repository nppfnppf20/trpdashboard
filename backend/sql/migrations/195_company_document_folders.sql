-- Company Policy Library: folders. Adds a folder tree and a folder on each document. Safe to re-run.
-- Plan: docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md
--
--   company_documents.folders      a tree of folders (parent_id), max 4 levels deep. The depth limit and
--                                  "no cycles" rules are enforced by the backend; sibling names are unique here.
--   company_documents.documents    gains folder_id (NULL = not in a folder).
--
-- Deleting a folder that still has sub-folders or documents is refused: the foreign keys are
-- ON DELETE RESTRICT, and the backend checks first so it can give a friendly message.
--
-- The free-text documents.category column stays (nothing is lost), but the app now files documents by
-- folder instead. Existing categories become top-level folders so current documents keep their grouping.

CREATE TABLE IF NOT EXISTS company_documents.folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  parent_id INTEGER REFERENCES company_documents.folders(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

-- Two folders with the same name can't sit side by side (case-insensitive); NULL parent = top level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cd_folders_sibling_name
  ON company_documents.folders (COALESCE(parent_id, 0), lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_cd_folders_parent ON company_documents.folders (parent_id);

ALTER TABLE company_documents.documents
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES company_documents.folders(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_cd_documents_folder ON company_documents.documents (folder_id);

-- Backend-only access, as for the other tables in this schema
ALTER TABLE company_documents.folders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA company_documents FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA company_documents FROM anon, authenticated;

-- One top-level folder per existing category, then file each document that has no folder yet.
INSERT INTO company_documents.folders (name)
SELECT DISTINCT btrim(d.category)
  FROM company_documents.documents d
 WHERE d.folder_id IS NULL
   AND btrim(d.category) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM company_documents.folders f
      WHERE f.parent_id IS NULL AND lower(btrim(f.name)) = lower(btrim(d.category))
   );

UPDATE company_documents.documents d
   SET folder_id = f.id
  FROM company_documents.folders f
 WHERE d.folder_id IS NULL
   AND f.parent_id IS NULL
   AND lower(btrim(f.name)) = lower(btrim(d.category));
