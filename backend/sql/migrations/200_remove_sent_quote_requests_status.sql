-- Undo the 'planned' status added in 199: briefings are now either saved as sent or not saved at all.
-- email_content stays nullable (a briefing can be saved as sent without a stored email). Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'admin_console' AND table_name = 'sent_quote_requests' AND column_name = 'status'
  ) THEN
    DELETE FROM admin_console.sent_quote_requests WHERE status = 'planned';
  END IF;
END $$;

ALTER TABLE admin_console.sent_quote_requests
  DROP CONSTRAINT IF EXISTS sent_quote_requests_status_check;

ALTER TABLE admin_console.sent_quote_requests
  DROP COLUMN IF EXISTS status;
