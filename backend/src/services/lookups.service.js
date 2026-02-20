/**
 * Lookups Service
 * Generic service for fetching dropdown options from lookup tables
 */

import { pool } from '../db.js';

// Define allowed lookup tables with their configurations
const LOOKUP_CONFIGS = {
  'client_organisations': {
    table: 'admin_console.client_organisations',
    idColumn: 'id',
    labelColumn: 'organisation_name',
    orderBy: 'organisation_name'
  },
  'team_members': {
    table: 'admin_console.team_members',
    idColumn: 'id',
    labelColumn: "first_name || ' ' || last_name",
    orderBy: 'first_name, last_name'
  },
  'sectors': {
    table: 'admin_console.sectors',
    idColumn: 'id',
    labelColumn: 'name',
    orderBy: 'id'
  },
  'sub_sectors': {
    table: 'admin_console.sub_sectors',
    idColumn: 'id',
    labelColumn: 'name',
    orderBy: 'id'
  },
  'surveyor_disciplines': {
    table: 'admin_console.surveyor_disciplines',
    idColumn: 'id',
    labelColumn: 'discipline_name',
    orderBy: 'discipline_name'
  },
  'line_item_suggestions': {
    table: 'admin_console.quote_line_items',
    idColumn: 'item',
    labelColumn: 'item',
    orderBy: 'item',
    distinct: true
  }
};

/**
 * Get all options from a lookup table
 * @param {string} lookupType - Key identifying the lookup table
 * @returns {Promise<Array>} Array of { id, label } objects
 */
export async function getLookupOptions(lookupType) {
  const config = LOOKUP_CONFIGS[lookupType];

  if (!config) {
    throw new Error(`Unknown lookup type: ${lookupType}`);
  }

  const distinctClause = config.distinct ? 'DISTINCT' : '';

  const query = `
    SELECT ${distinctClause}
      ${config.idColumn} as id,
      ${config.labelColumn} as label
    FROM ${config.table}
    ORDER BY ${config.orderBy}
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get available lookup types
 * @returns {Array<string>} List of available lookup type keys
 */
export function getAvailableLookupTypes() {
  return Object.keys(LOOKUP_CONFIGS);
}
