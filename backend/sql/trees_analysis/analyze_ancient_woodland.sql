-- PostgreSQL function for Ancient Woodland spatial analysis
-- Analyzes Ancient Woodland relative to a drawn polygon
-- Returns features that are on-site or within up to 500m, with distance buckets

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS analyze_ancient_woodland(TEXT);

CREATE OR REPLACE FUNCTION analyze_ancient_woodland(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  theme TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_50m BOOLEAN,
  within_500m BOOLEAN,
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

-- Ancient Woodland polygons
ancient_woodland_polys AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(aw.geom) = 27700 THEN aw.geom ELSE ST_Transform(aw.geom, 27700) END
    ) AS geom,
    aw."OBJECTID" AS id,
    aw."NAME" AS name,
    aw."THEME" AS theme
  FROM public."Ancient woodland" aw
  WHERE aw.geom IS NOT NULL
),

with_measures AS (
  SELECT
    p.id,
    p.name,
    p.theme,
    p.geom,
    sr.geom AS site_geom,
    sr.ref_pt,
    -- Calculate distance in meters
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER AS dist_m,
    -- Check if intersecting (on-site)
    ST_Intersects(sr.geom, p.geom) AS on_site
  FROM ancient_woodland_polys p
  CROSS JOIN site_ref sr
),

with_buffers AS (
  SELECT
    wm.id,
    wm.name,
    wm.theme,
    wm.geom,
    wm.dist_m,
    wm.on_site,
    -- Distance buckets
    ST_DWithin(wm.site_geom, wm.geom, 50.0) AS within_50m,
    ST_DWithin(wm.site_geom, wm.geom, 500.0) AS within_500m,
    -- Calculate direction (azimuth from site to Ancient Woodland)
    DEGREES(ST_Azimuth(wm.ref_pt, ST_ClosestPoint(wm.geom, wm.site_geom))) AS az_deg
  FROM with_measures wm
)

SELECT
  wb.id,
  wb.name,
  wb.theme,
  wb.dist_m,
  wb.on_site,
  wb.within_50m,
  wb.within_500m,
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
  -- Convert geometry to GeoJSON for frontend display
  ST_AsGeoJSON(ST_Transform(wb.geom, 4326))::JSON AS geometry
FROM with_buffers wb
WHERE wb.within_500m = TRUE -- Only return features within 500m
ORDER BY wb.dist_m;

$$ LANGUAGE sql STABLE;
