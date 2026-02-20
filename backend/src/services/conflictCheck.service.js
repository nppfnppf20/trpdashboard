/**
 * Conflict Check Service
 * Queries all project map layers to find conflicts within distance buffers
 */

import { pool } from '../db.js';

/**
 * Run conflict check against all project map layers
 * @param {Object} polygon - GeoJSON polygon of the site boundary
 * @returns {Object} Structured conflict results grouped by layer and distance
 */
export const conflictCheckService = {
  async runConflictCheck(polygon, excludeProjectId = null) {
    const startTime = Date.now();
    
    // Run all layer queries in parallel for better performance
    const [
      renewables,
      datacentres,
      repdSolar,
      repdWind,
      repdBattery,
      trpCommercial,
      trpEnergy,
      trpResidential,
      projects
    ] = await Promise.all([
      this.checkRenewables(polygon),
      this.checkDataCentres(polygon),
      this.checkREPDSolar(polygon),
      this.checkREPDWind(polygon),
      this.checkREPDBattery(polygon),
      this.checkTRPCommercial(polygon),
      this.checkTRPEnergy(polygon),
      this.checkTRPResidential(polygon),
      this.checkProjects(polygon, excludeProjectId)
    ]);

    // Combine all results
    const allConflicts = [
      ...renewables.map(r => ({ ...r, layer: 'renewables', layerGroup: 'Web Scrapers', layerName: 'Planit Renewables' })),
      ...datacentres.map(r => ({ ...r, layer: 'datacentres', layerGroup: 'Web Scrapers', layerName: 'Planit Data Centres' })),
      ...repdSolar.map(r => ({ ...r, layer: 'repd_solar', layerGroup: 'REPD Oct 25 Q3', layerName: 'Solar Projects' })),
      ...repdWind.map(r => ({ ...r, layer: 'repd_wind', layerGroup: 'REPD Oct 25 Q3', layerName: 'Wind Onshore Projects' })),
      ...repdBattery.map(r => ({ ...r, layer: 'repd_battery', layerGroup: 'REPD Oct 25 Q3', layerName: 'Battery Projects' })),
      ...trpCommercial.map(r => ({ ...r, layer: 'trp_commercial', layerGroup: 'TRP Projects', layerName: 'Commercial, Economic and Industrial' })),
      ...trpEnergy.map(r => ({ ...r, layer: 'trp_energy', layerGroup: 'TRP Projects', layerName: 'Energy, Digital and Infrastructure' })),
      ...trpResidential.map(r => ({ ...r, layer: 'trp_residential', layerGroup: 'TRP Projects', layerName: 'Residential and Strategic Land' })),
      ...projects.map(r => ({ ...r, layer: 'projects', layerGroup: 'Internal Projects', layerName: 'Projects' }))
    ];

    // Group by distance category
    const groupedByDistance = {
      intersecting: allConflicts.filter(c => c.distance_category === 'intersecting'),
      within_100m: allConflicts.filter(c => c.distance_category === 'within_100m'),
      within_250m: allConflicts.filter(c => c.distance_category === 'within_250m'),
      within_500m: allConflicts.filter(c => c.distance_category === 'within_500m'),
      within_1km: allConflicts.filter(c => c.distance_category === 'within_1km'),
      within_3km: allConflicts.filter(c => c.distance_category === 'within_3km'),
      within_5km: allConflicts.filter(c => c.distance_category === 'within_5km')
    };

    // Calculate summary
    const summary = {
      total: allConflicts.length,
      intersecting: groupedByDistance.intersecting.length,
      within_100m: groupedByDistance.within_100m.length,
      within_250m: groupedByDistance.within_250m.length,
      within_500m: groupedByDistance.within_500m.length,
      within_1km: groupedByDistance.within_1km.length,
      within_3km: groupedByDistance.within_3km.length,
      within_5km: groupedByDistance.within_5km.length
    };

    const queryTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      summary,
      conflicts: groupedByDistance,
      metadata: {
        checkedAt: new Date().toISOString(),
        layersChecked: 9,
        queryTime: `${queryTime}s`
      }
    };
  },

  /**
   * Check Planit Renewables layer
   */
  async checkRenewables(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      distances AS (
        SELECT 
          r.id,
          r.uid,
          r.name,
          r.description,
          r.address,
          r.postcode,
          r.area_name,
          r.app_type,
          r.application_type,
          r.app_state,
          r.decision,
          r.start_date,
          r.decided_date,
          r.url,
          r.latitude,
          r.longitude,
          r.dismissed,
          r.geom,
          ST_Distance(
            ST_Transform(r.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM scraper.planit_renewables r, site_boundary
        WHERE r.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(r.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
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
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check Planit Data Centres layer
   */
  async checkDataCentres(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      distances AS (
        SELECT 
          d.id,
          d.name,
          d.description,
          d.address,
          d.postcode,
          d.area_name,
          d.app_type,
          d.application_type,
          d.app_state,
          d.decision,
          d.start_date,
          d.decided_date,
          d.url,
          d.latitude,
          d.longitude,
          d.dismissed,
          d.geom,
          ST_Distance(
            ST_Transform(d.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM scraper.planit_datacentres d, site_boundary
        WHERE d.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(d.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
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
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check REPD Solar layer
   */
  async checkREPDSolar(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      repd_points AS (
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
          ST_SetSRID(ST_MakePoint(
            CAST("X-coordinate" AS NUMERIC),
            CAST("Y-coordinate" AS NUMERIC)
          ), 27700) as geom
        FROM projects."REPD Filtered"
        WHERE "Technology Type" = 'Solar Photovoltaics'
      ),
      distances AS (
        SELECT 
          r.*,
          ST_Distance(
            r.geom,
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM repd_points r, site_boundary
        WHERE ST_DWithin(
          r.geom,
          ST_Transform(site_boundary.geom, 27700),
          5000
        )
      )
      SELECT 
        "Ref ID" as ref_id,
        "Site Name" as site_name,
        "Operator (or Applicant)" as operator,
        "Technology Type" as technology_type,
        "Installed Capacity (MWelec)" as capacity,
        "Development Status" as dev_status,
        "Development Status (short)" as dev_status_short,
        "Address" as address,
        "County" as county,
        "Post Code" as postcode,
        "Record Last Updated (dd/mm/yyyy)" as last_updated,
        "Planning Application Reference" as planning_ref,
        CASE
          WHEN ST_Intersects(geom, ST_Transform((SELECT geom FROM site_boundary), 27700)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check REPD Wind layer
   */
  async checkREPDWind(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      repd_points AS (
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
          ST_SetSRID(ST_MakePoint(
            CAST("X-coordinate" AS NUMERIC),
            CAST("Y-coordinate" AS NUMERIC)
          ), 27700) as geom
        FROM projects."REPD Filtered"
        WHERE "Technology Type" = 'Wind Onshore'
      ),
      distances AS (
        SELECT 
          r.*,
          ST_Distance(
            r.geom,
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM repd_points r, site_boundary
        WHERE ST_DWithin(
          r.geom,
          ST_Transform(site_boundary.geom, 27700),
          5000
        )
      )
      SELECT 
        "Ref ID" as ref_id,
        "Site Name" as site_name,
        "Operator (or Applicant)" as operator,
        "Technology Type" as technology_type,
        "Installed Capacity (MWelec)" as capacity,
        "Development Status" as dev_status,
        "Development Status (short)" as dev_status_short,
        "Address" as address,
        "County" as county,
        "Post Code" as postcode,
        "Record Last Updated (dd/mm/yyyy)" as last_updated,
        "Planning Application Reference" as planning_ref,
        CASE
          WHEN ST_Intersects(geom, ST_Transform((SELECT geom FROM site_boundary), 27700)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check REPD Battery layer
   */
  async checkREPDBattery(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      repd_points AS (
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
          ST_SetSRID(ST_MakePoint(
            CAST("X-coordinate" AS NUMERIC),
            CAST("Y-coordinate" AS NUMERIC)
          ), 27700) as geom
        FROM projects."REPD Filtered"
        WHERE "Technology Type" = 'Battery'
      ),
      distances AS (
        SELECT 
          r.*,
          ST_Distance(
            r.geom,
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM repd_points r, site_boundary
        WHERE ST_DWithin(
          r.geom,
          ST_Transform(site_boundary.geom, 27700),
          5000
        )
      )
      SELECT 
        "Ref ID" as ref_id,
        "Site Name" as site_name,
        "Operator (or Applicant)" as operator,
        "Technology Type" as technology_type,
        "Installed Capacity (MWelec)" as capacity,
        "Development Status" as dev_status,
        "Development Status (short)" as dev_status_short,
        "Address" as address,
        "County" as county,
        "Post Code" as postcode,
        "Record Last Updated (dd/mm/yyyy)" as last_updated,
        "Planning Application Reference" as planning_ref,
        CASE
          WHEN ST_Intersects(geom, ST_Transform((SELECT geom FROM site_boundary), 27700)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check TRP Commercial layer
   */
  async checkTRPCommercial(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      distances AS (
        SELECT 
          t.id,
          t.name,
          t.description,
          t.geom,
          ST_Distance(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM projects."TRP Projects- Commercial, Economic and Industrial" t, site_boundary
        WHERE t.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
      SELECT 
        id,
        name,
        description,
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check TRP Energy layer
   */
  async checkTRPEnergy(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      distances AS (
        SELECT 
          t.id,
          t.name,
          t.description,
          t.field_4,
          t.field_5,
          t.geom,
          ST_Distance(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM projects."TRP Projects- Energy, digital and infrastructure" t, site_boundary
        WHERE t.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
      SELECT 
        id,
        name,
        description,
        field_4,
        field_5,
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check TRP Residential layer
   */
  async checkTRPResidential(polygon) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      distances AS (
        SELECT 
          t.id,
          t.name,
          t.description,
          t.geom,
          ST_Distance(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM projects."TRP Projects- Residential and Strategic Land" t, site_boundary
        WHERE t.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(t.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
      SELECT 
        id,
        name,
        description,
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const result = await pool.query(query, [polygonString]);
    return result.rows;
  },

  /**
   * Check Internal Projects layer
   */
  async checkProjects(polygon, excludeProjectId = null) {
    const polygonString = typeof polygon === 'string' ? polygon : JSON.stringify(polygon);
    const query = `
      WITH site_boundary AS (
        SELECT ST_GeomFromGeoJSON($1) as geom
      ),
      project_centroids AS (
        SELECT
          p.id,
          p.unique_id,
          p.project_id,
          p.project_name,
          p.address,
          p.area,
          p.client,
          p.sector,
          p.sub_sector,
          CASE
            WHEN (ST_GeomFromGeoJSON(p.polygon_geojson::text))::geometry IS NOT NULL 
            THEN ST_Centroid((ST_GeomFromGeoJSON(p.polygon_geojson::text))::geometry)
            ELSE NULL
          END as geom
        FROM projects p
        WHERE p.polygon_geojson IS NOT NULL
          ${excludeProjectId ? 'AND p.id != $2' : ''}
      ),
      distances AS (
        SELECT 
          pc.*,
          ST_Distance(
            ST_Transform(pc.geom, 27700),
            ST_Transform(site_boundary.geom, 27700)
          ) as distance_meters
        FROM project_centroids pc, site_boundary
        WHERE pc.geom IS NOT NULL
          AND ST_DWithin(
            ST_Transform(pc.geom, 27700),
            ST_Transform(site_boundary.geom, 27700),
            5000
          )
      )
      SELECT 
        id,
        unique_id,
        project_id,
        project_name,
        address,
        area,
        client,
        sector,
        sub_sector,
        CASE
          WHEN ST_Intersects(geom, (SELECT geom FROM site_boundary)) THEN 'intersecting'
          WHEN distance_meters <= 100 THEN 'within_100m'
          WHEN distance_meters <= 250 THEN 'within_250m'
          WHEN distance_meters <= 500 THEN 'within_500m'
          WHEN distance_meters <= 1000 THEN 'within_1km'
          WHEN distance_meters <= 3000 THEN 'within_3km'
          ELSE 'within_5km'
        END as distance_category,
        ROUND(distance_meters::numeric, 0) as distance
      FROM distances
      ORDER BY distance_meters;
    `;

    const params = excludeProjectId ? [polygonString, excludeProjectId] : [polygonString];
    const result = await pool.query(query, params);
    return result.rows;
  }
};

