-- Migration: Create Quote Request Tables
-- Purpose: Create tables for surveyor quote request email system
-- Date: 2026-01-13

-- Quote request email templates
CREATE TABLE IF NOT EXISTS admin_console.quote_request_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL,
  discipline VARCHAR(100),  -- NULL = applies to all disciplines
  description TEXT,
  subject_line VARCHAR(500),
  template_content TEXT NOT NULL,  -- HTML content with placeholders
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sent quote requests tracking
CREATE TABLE IF NOT EXISTS admin_console.sent_quote_requests (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(unique_id),
  template_id INTEGER REFERENCES admin_console.quote_request_templates(id),
  sent_date TIMESTAMP DEFAULT NOW(),
  email_content TEXT NOT NULL,  -- Final HTML sent (post-merge)
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction table: which surveyors received this request
CREATE TABLE IF NOT EXISTS admin_console.quote_request_recipients (
  id SERIAL PRIMARY KEY,
  sent_request_id INTEGER NOT NULL REFERENCES admin_console.sent_quote_requests(id) ON DELETE CASCADE,
  surveyor_organisation_id UUID NOT NULL REFERENCES admin_console.surveyor_organisations(id),
  contact_id UUID REFERENCES admin_console.contacts(id),  -- NULL if general org contact
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add auto-update trigger to templates table
CREATE TRIGGER update_quote_request_templates_updated_at
  BEFORE UPDATE ON admin_console.quote_request_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sent_quote_requests_updated_at
  BEFORE UPDATE ON admin_console.sent_quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sent_requests_project ON admin_console.sent_quote_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_sent_requests_date ON admin_console.sent_quote_requests(sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_recipients_request ON admin_console.quote_request_recipients(sent_request_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON admin_console.quote_request_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_discipline ON admin_console.quote_request_templates(discipline);

-- Comments for documentation
COMMENT ON TABLE admin_console.quote_request_templates IS 'Email templates for quote requests to surveyors with placeholder support';
COMMENT ON TABLE admin_console.sent_quote_requests IS 'Tracking of quote request emails sent to surveyors';
COMMENT ON TABLE admin_console.quote_request_recipients IS 'Junction table linking sent requests to surveyor organisations and contacts';

COMMENT ON COLUMN admin_console.quote_request_templates.template_content IS 'HTML content with placeholders: [PROJECT_NAME], [PROJECT_CODE], [ADDRESS], [AREA], [DISCIPLINE], [SURVEYOR_NAME], [CONTACT_NAME], [CLIENT_NAME], [PROJECT_TYPE], [SECTOR]';
COMMENT ON COLUMN admin_console.sent_quote_requests.email_content IS 'Final merged HTML content that was sent (post placeholder replacement)';
