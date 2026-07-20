-- Tender intelligence pipeline (v1: Find a Tender collector).
-- One row per published notice (release); the same ocid recurs across the
-- planning -> tender -> award lifecycle and all stages are kept.

CREATE SCHEMA IF NOT EXISTS scraper;

CREATE TABLE IF NOT EXISTS scraper.tender_authorities (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  canonical_code TEXT UNIQUE,        -- ONS GSS code (E06/E07/E08/E09/W06/S12/E10/E47); null for manual adds
  region         TEXT,
  authority_type TEXT CHECK (authority_type IN
                   ('unitary','district','metropolitan','london_borough','county','combined','other')),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_authorities_name
  ON scraper.tender_authorities (LOWER(name));

CREATE TABLE IF NOT EXISTS scraper.tender_authority_aliases (
  id           SERIAL PRIMARY KEY,
  alias        TEXT NOT NULL UNIQUE,  -- stored normalised (lower-case, stripped)
  authority_id INTEGER NOT NULL REFERENCES scraper.tender_authorities(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL DEFAULT 'manual' CHECK (created_by IN ('auto','manual')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_aliases_authority
  ON scraper.tender_authority_aliases (authority_id);

CREATE TABLE IF NOT EXISTS scraper.tender_notices (
  id                   SERIAL PRIMARY KEY,
  source               TEXT NOT NULL CHECK (source IN ('find_a_tender','contracts_finder')),
  source_notice_id     TEXT NOT NULL,
  ocid                 TEXT,
  stage                TEXT CHECK (stage IN ('planning','tender','award')),
  publication_date     TIMESTAMPTZ,
  title                TEXT,
  description          TEXT,
  buyer_name           TEXT,
  authority_id         INTEGER REFERENCES scraper.tender_authorities(id) ON DELETE SET NULL,
  value_amount         NUMERIC,
  value_currency       TEXT,
  deadline             TIMESTAMPTZ,
  contract_start       DATE,
  contract_end         DATE,
  procurement_method   TEXT,
  is_framework         BOOLEAN,
  cpv_code             TEXT,
  cpv_description      TEXT,
  additional_cpv_codes JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id, description}]
  contact_name         TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  notice_url           TEXT,
  submission_url       TEXT,
  raw_json             JSONB NOT NULL,
  relevance_status     TEXT NOT NULL DEFAULT 'candidate'
                       CHECK (relevance_status IN ('candidate','relevant','irrelevant','dismissed')),
  classified_by        TEXT CHECK (classified_by IN ('llm','human')),
  llm_reason           TEXT,
  dismissed            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_notice_id)
);

CREATE INDEX IF NOT EXISTS idx_tender_notices_ocid      ON scraper.tender_notices (ocid);
CREATE INDEX IF NOT EXISTS idx_tender_notices_pubdate   ON scraper.tender_notices (publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_tender_notices_authority ON scraper.tender_notices (authority_id);
CREATE INDEX IF NOT EXISTS idx_tender_notices_status    ON scraper.tender_notices (relevance_status);
CREATE INDEX IF NOT EXISTS idx_tender_notices_stage     ON scraper.tender_notices (stage);
CREATE INDEX IF NOT EXISTS idx_tender_notices_buyer     ON scraper.tender_notices (LOWER(buyer_name));

CREATE TABLE IF NOT EXISTS scraper.tender_sync_runs (
  id              SERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  window_from     TIMESTAMPTZ,
  window_to       TIMESTAMPTZ,
  pages_fetched   INTEGER NOT NULL DEFAULT 0,
  notices_seen    INTEGER NOT NULL DEFAULT 0,
  notices_stored  INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_tender_sync_runs_source
  ON scraper.tender_sync_runs (source, started_at DESC);

-- Filter config: CPV prefixes, include/exclude keywords, and the LLM prompt (single row)
CREATE TABLE IF NOT EXISTS scraper.tender_filter_rules (
  id         SERIAL PRIMARY KEY,
  rule_type  TEXT NOT NULL CHECK (rule_type IN ('cpv_prefix','keyword','exclusion_keyword','llm_prompt')),
  value      TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_type, value)
);
