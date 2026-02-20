-- PostgreSQL function for listed buildings spatial analysis
-- Analyzes listed buildings relative to a drawn polygon

-- Function to analyze listed buildings relative to a drawn polygon
DROP FUNCTION IF EXISTS analyze_listed_buildings(TEXT);
CREATE OR REPLACE FUNCTION analyze_listed_buildings(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  grade TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
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

-- Listed buildings using existing geometry - extract points from multipoint
lb_points AS (
  SELECT
    ST_GeometryN(lb.geom, 1) AS geom,  -- Extract first point from multipoint
    lb."OBJECTID" AS id,
    lb."Name"     AS name,
    lb."Grade"    AS grade
  FROM public.listed_building lb
  WHERE lb.geom IS NOT NULL
),

-- Calculate distance, azimuth, and on-site flag
with_bearing AS (
  SELECT
    p.id,
    p.name,
    p.grade,
    p.geom,
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER AS dist_m,  -- rounded to nearest meter
    ST_Covers(sr.geom, p.geom)                   AS on_site,
    degrees(ST_Azimuth(sr.ref_pt, p.geom))       AS az_deg
  FROM lb_points p
  CROSS JOIN site_ref sr
)

SELECT
  wb.id,
  wb.name,
  wb.grade,
  wb.dist_m,
  wb.on_site,
  CASE
    WHEN wb.on_site THEN 'N/A'
    WHEN wb.az_deg >= 337.5 OR wb.az_deg < 22.5  THEN 'N'
    WHEN wb.az_deg >= 22.5  AND wb.az_deg < 67.5  THEN 'NE'
    WHEN wb.az_deg >= 67.5  AND wb.az_deg < 112.5 THEN 'E'
    WHEN wb.az_deg >= 112.5 AND wb.az_deg < 157.5 THEN 'SE'
    WHEN wb.az_deg >= 157.5 AND wb.az_deg < 202.5 THEN 'S'
    WHEN wb.az_deg >= 202.5 AND wb.az_deg < 247.5 THEN 'SW'
    WHEN wb.az_deg >= 247.5 AND wb.az_deg < 292.5 THEN 'W'
    WHEN wb.az_deg >= 292.5 AND wb.az_deg < 337.5 THEN 'NW'
    ELSE NULL
  END AS direction,
  ST_AsGeoJSON(ST_Transform(wb.geom, 4326))::JSON AS geometry
FROM with_bearing wb
WHERE
  wb.on_site
  OR wb.dist_m <= 5000
ORDER BY wb.on_site DESC, wb.dist_m ASC;

$$ LANGUAGE sql STABLE;
