-- Analysis function for Scheduled Monuments
-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS analyze_scheduled_monuments(TEXT);

CREATE OR REPLACE FUNCTION analyze_scheduled_monuments(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  dist_m NUMERIC,
  on_site BOOLEAN,
  direction TEXT,
  geometry GEOMETRY
) AS $$
WITH
-- Convert input GeoJSON polygon to geometry
site AS (
  SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)) AS geom
),

-- Transform to British National Grid (27700) for accurate distance calculations
site_metric AS (
  SELECT ST_Transform(geom, 27700) AS geom
  FROM site
),

-- Reference point for azimuth calculation
site_ref AS (
  SELECT
    sm.geom,
    ST_PointOnSurface(sm.geom) AS ref_pt
  FROM site_metric sm
),

-- Transform scheduled monuments to metric coordinate system
sm_metric AS (
  SELECT
    sm.fid::INTEGER as id,
    COALESCE(sm."Name", 'Unnamed Scheduled Monument')::TEXT as name,
    ST_Transform(sm.geom, 27700) AS geom_metric,
    sm.geom AS geom_wgs84
  FROM public."Scheduled monuments" sm
  WHERE sm.geom IS NOT NULL
),

-- Calculate distance, azimuth, and on-site flag
with_bearing AS (
  SELECT
    p.id,
    p.name,
    p.geom_wgs84 as geom,
    ROUND(ST_Distance(sr.geom, p.geom_metric)::numeric, 0) as dist_m,
    ST_Intersects(sr.geom, p.geom_metric) as on_site,
    degrees(ST_Azimuth(sr.ref_pt, ST_Centroid(p.geom_metric))) as az_deg
  FROM sm_metric p
  CROSS JOIN site_ref sr
  WHERE ST_DWithin(sr.geom, p.geom_metric, 5000)
)

SELECT
  wb.id,
  wb.name,
  wb.dist_m,
  wb.on_site,
  CASE
    WHEN wb.on_site THEN 'N/A'
    WHEN wb.az_deg >= 337.5 OR wb.az_deg < 22.5 THEN 'N'
    WHEN wb.az_deg >= 22.5 AND wb.az_deg < 67.5 THEN 'NE'
    WHEN wb.az_deg >= 67.5 AND wb.az_deg < 112.5 THEN 'E'
    WHEN wb.az_deg >= 112.5 AND wb.az_deg < 157.5 THEN 'SE'
    WHEN wb.az_deg >= 157.5 AND wb.az_deg < 202.5 THEN 'S'
    WHEN wb.az_deg >= 202.5 AND wb.az_deg < 247.5 THEN 'SW'
    WHEN wb.az_deg >= 247.5 AND wb.az_deg < 292.5 THEN 'W'
    WHEN wb.az_deg >= 292.5 AND wb.az_deg < 337.5 THEN 'NW'
    ELSE NULL
  END as direction,
  wb.geom as geometry
FROM with_bearing wb
ORDER BY wb.dist_m;

$$ LANGUAGE sql STABLE;