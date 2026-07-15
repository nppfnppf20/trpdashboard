-- Extra per-line-item fields for quotes, all nullable so existing rows are
-- untouched: a free-text stage label (shown before the item), and two flags
-- ticked like the VAT box - whether the line is optional, and whether it is
-- still to be confirmed (TBC).

ALTER TABLE admin_console.quote_line_items
  ADD COLUMN IF NOT EXISTS stage TEXT;

ALTER TABLE admin_console.quote_line_items
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN;

ALTER TABLE admin_console.quote_line_items
  ADD COLUMN IF NOT EXISTS is_tbc BOOLEAN;
