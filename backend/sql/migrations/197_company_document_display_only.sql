-- Company Policy Library: "display only" documents. Safe to re-run.
--
-- A display-only document is stored and shown exactly as uploaded (an image, or a PDF where only the
-- original should be seen). It is never read, chunked, embedded or searched, so it has no chunks, and the
-- viewer shows only the Original. Images are always display-only; PDFs can be switched either way.
-- Such a document is 'ready' straight away (there is nothing to index).

ALTER TABLE company_documents.documents
  ADD COLUMN IF NOT EXISTS display_only BOOLEAN NOT NULL DEFAULT false;
