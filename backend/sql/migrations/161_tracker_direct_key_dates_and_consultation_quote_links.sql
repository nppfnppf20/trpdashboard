-- Direct key dates for tracker rows (Conditions / Issues / Consultation),
-- plus quote-linking for Consultation Tracker to bring it to parity with
-- Conditions and Issues. Programme no longer requires a linked quote for a
-- row to carry dates — a condition/issue/consultation response can now have
-- its own key dates directly, alongside whatever a linked quote contributes.

CREATE TABLE IF NOT EXISTS planning_applications.condition_key_dates (
  id           SERIAL PRIMARY KEY,
  condition_id INTEGER NOT NULL REFERENCES planning_applications.conditions(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  date         DATE NOT NULL,
  colour       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_condition_key_dates_condition ON planning_applications.condition_key_dates(condition_id);

CREATE TABLE IF NOT EXISTS planning_applications.progress_issue_key_dates (
  id         SERIAL PRIMARY KEY,
  issue_id   INTEGER NOT NULL REFERENCES planning_applications.progress_issues(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  date       DATE NOT NULL,
  colour     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_progress_issue_key_dates_issue ON planning_applications.progress_issue_key_dates(issue_id);

CREATE TABLE IF NOT EXISTS planning_applications.consultation_response_key_dates (
  id          SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES planning_applications.consultation_responses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  colour      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consultation_response_key_dates_response ON planning_applications.consultation_response_key_dates(response_id);

-- Consultation Tracker quote linking, mirroring 113_condition_quote_links.sql
-- and 143_issue_quote_linking.sql.
CREATE TABLE IF NOT EXISTS planning_applications.consultation_response_quote_links (
  response_id INTEGER NOT NULL REFERENCES planning_applications.consultation_responses(id) ON DELETE CASCADE,
  quote_id    UUID NOT NULL REFERENCES admin_console.quotes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (response_id, quote_id)
);
CREATE INDEX IF NOT EXISTS idx_consultation_response_quote_links_quote ON planning_applications.consultation_response_quote_links(quote_id);

-- Same "tag this advancement as relevant to a linked quote" column Conditions
-- and Issues already have (condition_advancements.quote_id / progress_actions.quote_id).
ALTER TABLE planning_applications.consultation_response_advancements
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES admin_console.quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_consultation_response_advancements_quote ON planning_applications.consultation_response_advancements(quote_id);

COMMENT ON TABLE planning_applications.condition_key_dates IS 'Key dates owned directly by a condition, independent of any linked quote.';
COMMENT ON TABLE planning_applications.progress_issue_key_dates IS 'Key dates owned directly by an issue, independent of any linked quote.';
COMMENT ON TABLE planning_applications.consultation_response_key_dates IS 'Key dates owned directly by a consultation response, independent of any linked quote.';
COMMENT ON TABLE planning_applications.consultation_response_quote_links IS 'Links a Surveyor Management quote to a Consultation Tracker response — same many-to-many shape as condition_quote_links / progress_issue_quote_links.';
