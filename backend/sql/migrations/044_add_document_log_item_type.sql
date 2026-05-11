ALTER TABLE planning_applications.document_log
  ADD COLUMN item_type   TEXT NOT NULL DEFAULT 'document' CHECK (item_type IN ('document', 'drawing', 'other')),
  ADD COLUMN prepared_by TEXT;
