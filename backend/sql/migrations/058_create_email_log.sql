CREATE TABLE IF NOT EXISTS admin_console.email_log (
  id                SERIAL PRIMARY KEY,
  type              TEXT NOT NULL,           -- 'surveyor_briefing' | 'scraper_digest'
  recipient_email   TEXT NOT NULL,
  subject           TEXT NOT NULL,
  resend_message_id TEXT,
  status            TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message     TEXT,
  project_id        INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_type      ON admin_console.email_log(type);
CREATE INDEX IF NOT EXISTS idx_email_log_project   ON admin_console.email_log(project_id);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON admin_console.email_log(recipient_email);
