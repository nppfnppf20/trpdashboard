/**
 * REPD Service
 * Handles REPD (Renewable Energy Planning Database) data queries
 */

import { pool } from '../db.js';
import { buildREPDGeoJSON } from './geojson.service.js';

export const repdService = {
  /**
   * Get REPD projects filtered by technology type
   * @param {string} technologyType - Technology type to filter (e.g., 'Solar Photovoltaics', 'Wind Onshore', 'Battery')
   * @returns {Object} GeoJSON FeatureCollection
   */
  async getREPDByTechnology(technologyType) {
    const query = `
      SELECT
        "Ref ID",
        "Site Name",
        "Operator (or Applicant)",
        "Technology Type",
        "Installed Capacity (MWelec)",
        "Development Status",
        "Development Status (short)",
        "Address",
        "County",
        "Post Code",
        "Record Last Updated (dd/mm/yyyy)",
        "Planning Application Reference",
        ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(CAST("X-coordinate" AS NUMERIC), CAST("Y-coordinate" AS NUMERIC)), 27700), 4326)) as longitude,
        ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(CAST("X-coordinate" AS NUMERIC), CAST("Y-coordinate" AS NUMERIC)), 27700), 4326)) as latitude
      FROM projects."REPD Filtered"
      WHERE "Technology Type" = $1
      ORDER BY "Ref ID"
    `;

    const result = await pool.query(query, [technologyType]);
    return buildREPDGeoJSON(result.rows);
  }
};

