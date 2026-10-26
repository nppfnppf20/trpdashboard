-- Surveyor briefings: allow a briefing to be recorded (surveyors selected) before any email is drafted.
-- Safe to re-run.
--
-- status 'sent'    = email drafted and sent/saved as sent (all existing rows)
-- status 'planned' = surveyors selected, no email yet (email_content NULL, sent_date NULL)

ALTER TABLE admin_console.sent_quote_requests
  ALTER COLUMN email_content DROP NOT NULL;

ALTER TABLE admin_console.sent_quote_requests
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sent_quote_requests_status_check'
  ) THEN
    ALTER TABLE admin_console.sent_quote_requests
      ADD CONSTRAINT sent_quote_requests_status_check CHECK (status IN ('planned', 'sent'));
  END IF;
END $$;

COMMENT ON COLUMN admin_console.sent_quote_requests.status IS 'planned = surveyors selected, no email yet; sent = email drafted and sent/saved as sent';
