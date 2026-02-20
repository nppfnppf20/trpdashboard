-- PostgreSQL function for SSSI (Sites of Special Scientific Interest) spatial analysis
-- Analyzes SSSI relative to a drawn polygon
-- Returns features that are on-site or within up to 5km, with distance buckets
-- OPTIMIZED: Uses ONLY centroid - no polygon operations for speed

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS analyze_sssi(TEXT);

CREATE OR REPLACE FUNCTION analyze_sssi(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  ref_code TEXT,
  measure DOUBLE PRECISION,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_50m BOOLEAN,
  within_100m BOOLEAN,
  within_250m BOOLEAN,
  within_500m BOOLEAN,
  within_1km BOOLEAN,
  within_3km BOOLEAN,
  within_5km BOOLEAN,
  direction TEXT,
  geometry JSON
) AS $$
WITH
-- Convert input GeoJSON polygon to geometry
site AS (
  SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)) AS geom
),

-- Transform to British National Grid (27700) for accurate distance calculations
site_metric AS (
  SELECT ST_Transform(geom, 27700) AS geom FROM site
),

-- Reference point for azimuth calculation
site_ref AS (
  SELECT sm.geom, ST_PointOnSurface(sm.geom) AS ref_pt FROM site_metric sm
),

-- Find SSSI centroids within 5km
with_measures AS (
  SELECT
    s."OBJECTID" AS id,
    s."NAME" AS name,
    s."REF_CODE" AS ref_code,
    s."MEASURE" AS measure,
    s.centroid AS centroid_geom,
    sr.geom AS site_geom,
    sr.ref_pt,
    -- Distance from site to centroid
    ROUND(ST_Distance(sr.geom, s.centroid))::INTEGER AS dist_m,
    -- On-site = site polygon contains the centroid point
    ST_Contains(sr.geom, s.centroid) AS on_site
  FROM public."SSSI" s
  CROSS JOIN site_ref sr
  WHERE s.centroid IS NOT NULL
    AND ST_DWithin(sr.geom, s.centroid, 5000.0)
),

with_buckets AS (
  SELECT
    wm.id,
    wm.name,
    wm.ref_code,
    wm.measure,
    wm.centroid_geom,
    wm.dist_m,
    wm.on_site,
    -- Distance buckets
    (wm.on_site OR wm.dist_m <= 50) AS within_50m,
    (wm.on_site OR wm.dist_m <= 100) AS within_100m,
    (wm.on_site OR wm.dist_m <= 250) AS within_250m,
    (wm.on_site OR wm.dist_m <= 500) AS within_500m,
    (wm.on_site OR wm.dist_m <= 1000) AS within_1km,
    (wm.on_site OR wm.dist_m <= 3000) AS within_3km,
    TRUE AS within_5km,
    -- Azimuth from site to centroid
    DEGREES(ST_Azimuth(wm.ref_pt, wm.centroid_geom)) AS az_deg
  FROM with_measures wm
)

SELECT
  wb.id,
  wb.name,
  wb.ref_code,
  wb.measure,
  wb.dist_m,
  wb.on_site,
  wb.within_50m,
  wb.within_100m,
  wb.within_250m,
  wb.within_500m,
  wb.within_1km,
  wb.within_3km,
  wb.within_5km,
  -- Convert azimuth to cardinal direction
  CASE
    WHEN wb.on_site THEN 'N/A'
    WHEN wb.az_deg IS NULL THEN 'N/A'
    WHEN wb.az_deg >= 337.5 OR wb.az_deg < 22.5 THEN 'N'
    WHEN wb.az_deg >= 22.5 AND wb.az_deg < 67.5 THEN 'NE'
    WHEN wb.az_deg >= 67.5 AND wb.az_deg < 112.5 THEN 'E'
    WHEN wb.az_deg >= 112.5 AND wb.az_deg < 157.5 THEN 'SE'
    WHEN wb.az_deg >= 157.5 AND wb.az_deg < 202.5 THEN 'S'
    WHEN wb.az_deg >= 202.5 AND wb.az_deg < 247.5 THEN 'SW'
    WHEN wb.az_deg >= 247.5 AND wb.az_deg < 292.5 THEN 'W'
    WHEN wb.az_deg >= 292.5 AND wb.az_deg < 337.5 THEN 'NW'
    ELSE 'N/A'
  END AS direction,
  -- Return centroid as a point geometry for display
  ST_AsGeoJSON(ST_Transform(wb.centroid_geom, 4326))::JSON AS geometry
FROM with_buckets wb
ORDER BY wb.dist_m;

$$ LANGUAGE sql STABLE;
