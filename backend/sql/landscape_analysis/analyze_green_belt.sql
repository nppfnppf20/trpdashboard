-- PostgreSQL function for Green Belt spatial analysis
-- This function analyzes Green Belt areas relative to a drawn polygon

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS analyze_green_belt(TEXT);

-- Function to analyze Green Belt relative to a drawn polygon
CREATE OR REPLACE FUNCTION analyze_green_belt(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_100m BOOLEAN,
  within_1km BOOLEAN,
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

-- Green Belt areas as polygons
-- Note: Adjust table/column names based on your actual Green Belt data schema
gb_polys AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(gb.geom) = 27700 
           THEN gb.geom
           ELSE ST_Transform(gb.geom, 27700)
      END
    ) AS geom,
    gb."fid" AS id,
    COALESCE(gb."name", 'Green Belt Area') AS name
  FROM public."Green_belt" gb  -- Using correct table name with quotes for case sensitivity
  WHERE gb.geom IS NOT NULL
),

-- Calculate distance, closest point (for azimuth), and on-site flag
with_bearing AS (
  SELECT
    p.id,
    p.name,
    p.geom,
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER               AS dist_m,   -- rounded to nearest meter
    ST_Intersects(sr.geom, p.geom)                             AS on_site,  -- polygon intersection
    ST_DWithin(sr.geom, p.geom, 100.0)                         AS within_100m, -- flag for within 100m
    ST_DWithin(sr.geom, p.geom, 1000.0)                        AS within_1km, -- flag for within 1km
    degrees(ST_Azimuth(sr.ref_pt, ST_ClosestPoint(p.geom, sr.geom))) AS az_deg
  FROM gb_polys p
  CROSS JOIN site_ref sr
)

SELECT
  wb.id,
  wb.name,
  wb.dist_m,
  wb.on_site,
  wb.within_100m,
  wb.within_1km,
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
  OR wb.dist_m <= 5000     -- within 5 km for comprehensive analysis
ORDER BY wb.on_site DESC, wb.dist_m ASC;

$$ LANGUAGE sql STABLE;
