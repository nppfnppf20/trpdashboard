-- Add file_text column to appeal_documents for storing parsed document content
-- used by the document incorporation flow (no longer storing ai_review at upload time)

ALTER TABLE public.appeal_documents
  ADD COLUMN IF NOT EXISTS file_text TEXT;
