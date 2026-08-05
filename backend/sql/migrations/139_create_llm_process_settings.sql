CREATE TABLE IF NOT EXISTS admin_console.llm_process_settings (
  process_key  text PRIMARY KEY,
  provider     text NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
