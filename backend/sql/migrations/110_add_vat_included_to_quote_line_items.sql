-- Per-line-item VAT flag for quotes. When true, the line contributes cost + 20%
-- to the quote total; costs themselves remain stored excl. VAT.
-- Existing rows are backfilled to false because their quote totals were saved
-- without VAT; the default is then flipped to true to match the UI (new line
-- items are VAT-included unless unticked).

ALTER TABLE admin_console.quote_line_items
  ADD COLUMN IF NOT EXISTS vat_included BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE admin_console.quote_line_items
  ALTER COLUMN vat_included SET DEFAULT true;
