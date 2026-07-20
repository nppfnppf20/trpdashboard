/**
 * Buyer-name -> canonical authority matching.
 * Deterministic only: normalised exact match against authority names and aliases.
 * Unmatched buyers stay NULL and surface via GET /api/tenders/unmatched-buyers.
 */

import { pool } from '../../db.js';

const LEADING_PATTERNS = [
  /^the\s+/,
  /^london borough of\s+/,
  /^royal borough of\s+/,
  /^city and county of\s+/,
  /^city of\s+/,
  /^council of the city of\s+/,
];

// 'combined authority' is deliberately NOT stripped: it distinguishes e.g.
// Lancashire Combined Authority from Lancashire County Council.
const TRAILING_PATTERNS = [
  // modifiers can stack: "County Borough Council", "Metropolitan District Council"
  /\s+(?:(?:metropolitan|county|city|borough|district|town|community|unitary)\s+)*council$/,
  /\s+(mbc|bc|cc|dc|ua)$/,
];

export function normaliseBuyerName(raw) {
  if (!raw) return '';
  let name = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const pattern of LEADING_PATTERNS) name = name.replace(pattern, '');
  for (const pattern of TRAILING_PATTERNS) name = name.replace(pattern, '');
  return name.trim();
}

/** One map for a whole sync run: normalised name/alias -> authority id. */
export async function buildMatchMap() {
  const [authorities, aliases] = await Promise.all([
    pool.query('SELECT id, name FROM scraper.tender_authorities WHERE active = TRUE'),
    pool.query('SELECT alias, authority_id FROM scraper.tender_authority_aliases'),
  ]);

  const map = new Map();
  for (const row of authorities.rows) {
    const key = normaliseBuyerName(row.name);
    if (key) map.set(key, row.id);
  }
  // Aliases override derived names (they are explicit mappings)
  for (const row of aliases.rows) {
    map.set(row.alias, row.authority_id);
  }
  return map;
}

/**
 * Returns an authority id or null. On a fresh name-derived hit, records the buyer
 * string as an auto alias so the mapping is explicit (and reviewable) next time.
 */
export async function matchAuthority(buyerName, matchMap) {
  const key = normaliseBuyerName(buyerName);
  if (!key) return null;

  const authorityId = matchMap.get(key);
  if (!authorityId) return null;

  await pool.query(
    `INSERT INTO scraper.tender_authority_aliases (alias, authority_id, created_by)
     VALUES ($1, $2, 'auto')
     ON CONFLICT (alias) DO NOTHING`,
    [key, authorityId]
  );
  return authorityId;
}

/** Manual match from the UI: stores an alias and backfills existing notices. */
export async function addManualAlias(buyerName, authorityId) {
  const key = normaliseBuyerName(buyerName);
  if (!key) throw new Error('Buyer name normalises to an empty string');

  await pool.query(
    `INSERT INTO scraper.tender_authority_aliases (alias, authority_id, created_by)
     VALUES ($1, $2, 'manual')
     ON CONFLICT (alias) DO UPDATE SET authority_id = $2, created_by = 'manual'`,
    [key, authorityId]
  );

  const result = await pool.query(
    `UPDATE scraper.tender_notices
     SET authority_id = $2, updated_at = NOW()
     WHERE authority_id IS NULL AND LOWER(buyer_name) = LOWER($1)`,
    [buyerName, authorityId]
  );
  return result.rowCount;
}
