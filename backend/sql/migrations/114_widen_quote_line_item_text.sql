-- Quote line item text columns were varchar(255), which verbatim descriptions
-- extracted from quote PDFs can exceed (error 22001: value too long for type
-- character varying(255)). Widen to TEXT: metadata-only change, existing data
-- untouched.

ALTER TABLE admin_console.quote_line_items
  ALTER COLUMN item TYPE TEXT;

ALTER TABLE admin_console.quote_line_items
  ALTER COLUMN description TYPE TEXT;

-- Extraction notes (exclusions, assumptions, VAT caveats) land in quote_notes,
-- which can also exceed 255. No-op if already TEXT.
ALTER TABLE admin_console.quotes
  ALTER COLUMN quote_notes TYPE TEXT;
