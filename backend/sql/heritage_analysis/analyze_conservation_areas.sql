-- PostgreSQL function for conservation areas spatial analysis
-- Analyzes conservation areas relative to a drawn polygon

-- Function to analyze conservation areas relative to a drawn polygon
CREATE OR REPLACE FUNCTION analyze_conservation_areas(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_250m BOOLEAN,
  direction TEXT
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

-- Conservation areas as polygons
ca_polys AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(c.geom) = 27700 
           THEN c.geom
           ELSE ST_Transform(c.geom, 27700)
      END
    ) AS geom,
    c."OBJECTID" AS id,
    c."NAME"     AS name
  FROM public.conservation_area c
),

-- Calculate distance, closest point (for azimuth), and on-site flag
with_bearing AS (
  SELECT
    p.id,
    p.name,
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER               AS dist_m,   -- rounded to nearest meter
    ST_Intersects(sr.geom, p.geom)                             AS on_site,  -- polygon intersection
    ST_DWithin(sr.geom, p.geom, 250.0)                         AS within_250m, -- flag for within 250m
    degrees(ST_Azimuth(sr.ref_pt, ST_ClosestPoint(p.geom, sr.geom))) AS az_deg
  FROM ca_polys p
  CROSS JOIN site_ref sr
)

SELECT
  wb.id,
  wb.name,
  wb.dist_m,
  wb.on_site,
  wb.within_250m,
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
  END AS direction
FROM with_bearing wb
WHERE
  wb.on_site
  OR wb.dist_m <= 1000     -- within 1 km
ORDER BY wb.on_site DESC, wb.dist_m ASC;

$$ LANGUAGE sql STABLE;
