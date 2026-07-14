-- Migration: Fix sent_quote_requests FK to cascade on project delete
-- Purpose: sent_quote_requests.project_id referenced projects(unique_id) with no
--          ON DELETE rule (NO ACTION), which blocked deleting any project that had
--          sent quote requests. Recipients already cascade from sent_quote_requests.
-- Date: 2026-07-14

ALTER TABLE admin_console.sent_quote_requests
  DROP CONSTRAINT sent_quote_requests_project_id_fkey;

ALTER TABLE admin_console.sent_quote_requests
  ADD CONSTRAINT sent_quote_requests_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(unique_id)
  ON DELETE CASCADE;
