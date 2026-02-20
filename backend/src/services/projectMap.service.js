/**
 * Project Map Service
 * Handles queries for project map data layers
 */

import { pool } from '../db.js';
import { buildPlanitGeoJSON, buildTRPGeoJSON, buildProjectsGeoJSON } from './geojson.service.js';

export const projectMapService = {
  /**
   * Get renewables data from Planit
   */
  async getRenewables() {
    const query = `
      SELECT
        id,
        uid,
        name,
        description,
        address,
        postcode,
        area_name,
        app_type,
        application_type,
        app_state,
        decision,
        start_date,
        decided_date,
        url,
        latitude,
        longitude,
        dismissed,
        ST_AsGeoJSON(geom)::json as geometry
      FROM scraper.planit_renewables
      WHERE geom IS NOT NULL
      ORDER BY start_date DESC NULLS LAST, id DESC
    `;

    const result = await pool.query(query);
    return buildPlanitGeoJSON(result.rows);
  },

  /**
   * Get data centres from Planit
   */
  async getDataCentres() {
    const query = `
      SELECT
        id,
        name,
        description,
        address,
        postcode,
        area_name,
        app_type,
        application_type,
        app_state,
        decision,
        start_date,
        decided_date,
        url,
        latitude,
        longitude,
        dismissed,
        ST_AsGeoJSON(geom)::json as geometry
      FROM scraper.planit_datacentres
      WHERE geom IS NOT NULL
      ORDER BY start_date DESC NULLS LAST, id DESC
    `;

    const result = await pool.query(query);
    return buildPlanitGeoJSON(result.rows);
  },

  /**
   * Get projects with polygon centroids
   */
  async getProjects() {
    const query = `
      SELECT
        id,
        unique_id,
        project_id,
        project_name,
        address,
        polygon_geojson,
        area,
        client,
        client_spv_name,
        sector,
        sub_sector,
        local_planning_authority,
        project_lead,
        project_manager,
        project_director,
        designations_on_site,
        relevant_nearby_designations,
        created_at,
        updated_at
      FROM projects
      WHERE polygon_geojson IS NOT NULL
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    return buildProjectsGeoJSON(result.rows);
  },

  /**
   * Get TRP Commercial projects
   */
  async getTRPCommercial() {
    const query = `
      SELECT
        id,
        name,
        description,
        ST_AsGeoJSON(geom)::json as geometry
      FROM projects."TRP Projects- Commercial, Economic and Industrial"
      WHERE geom IS NOT NULL
      ORDER BY id
    `;

    const result = await pool.query(query);
    return buildTRPGeoJSON(result.rows);
  },

  /**
   * Get TRP Energy projects
   */
  async getTRPEnergy() {
    const query = `
      SELECT
        id,
        name,
        description,
        field_4,
        field_5,
        ST_AsGeoJSON(geom)::json as geometry
      FROM projects."TRP Projects- Energy, digital and infrastructure"
      WHERE geom IS NOT NULL
      ORDER BY id
    `;

    const result = await pool.query(query);
    return buildTRPGeoJSON(result.rows, true); // Include extra fields
  },

  /**
   * Get TRP Residential projects
   */
  async getTRPResidential() {
    const query = `
      SELECT
        id,
        name,
        description,
        ST_AsGeoJSON(geom)::json as geometry
      FROM projects."TRP Projects- Residential and Strategic Land"
      WHERE geom IS NOT NULL
      ORDER BY id
    `;

    const result = await pool.query(query);
    return buildTRPGeoJSON(result.rows);
  },

  /**
   * Toggle dismissed status for a renewable
   */
  async updateRenewableDismissed(id, dismissed) {
    const query = `
      UPDATE scraper.planit_renewables
      SET dismissed = $1
      WHERE id = $2
      RETURNING id, dismissed
    `;

    const result = await pool.query(query, [dismissed, id]);
    
    if (result.rows.length === 0) {
      const error = new Error('Renewable not found');
      error.status = 404;
      throw error;
    }

    return result.rows[0];
  },

  /**
   * Toggle dismissed status for a data centre
   */
  async updateDataCentreDismissed(id, dismissed) {
    const query = `
      UPDATE scraper.planit_datacentres
      SET dismissed = $1
      WHERE id = $2
      RETURNING id, dismissed
    `;

    const result = await pool.query(query, [dismissed, id]);

    if (result.rows.length === 0) {
      const error = new Error('Data centre not found');
      error.status = 404;
      throw error;
    }

    return result.rows[0];
  },

  /**
   * Get contracts finder data
   */
  async getContractsFinder() {
    const query = `
      SELECT
        id,
        title,
        description,
        organisation,
        published_date,
        closing_date,
        status,
        notice_type,
        region,
        postcode,
        suitable_for_sme,
        url,
        dismissed
      FROM scraper.contracts_finder
      ORDER BY published_date DESC NULLS LAST, id DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Toggle dismissed status for a contract
   */
  async updateContractsFinderDismissed(id, dismissed) {
    const query = `
      UPDATE scraper.contracts_finder
      SET dismissed = $1
      WHERE id = $2
      RETURNING id, dismissed
    `;

    const result = await pool.query(query, [dismissed, id]);

    if (result.rows.length === 0) {
      const error = new Error('Contract not found');
      error.status = 404;
      throw error;
    }

    return result.rows[0];
  }
};

