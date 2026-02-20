-- PostgreSQL function for GCN Class Survey License Returns spatial analysis
-- Analyzes GCN Class Survey License Returns relative to a drawn polygon
-- Returns features that are on-site or within up to 250m, with distance buckets

CREATE OR REPLACE FUNCTION analyze_gcn(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_50m BOOLEAN,
  within_100m BOOLEAN,
  within_250m BOOLEAN,
  within_500m BOOLEAN,
  within_1km BOOLEAN,
  within_3km BOOLEAN,
  within_5km BOOLEAN,
  direction TEXT
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

-- GCN Class Survey License Returns (adjust table/columns as appropriate)
gcn AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(g.geom) = 27700 THEN g.geom ELSE ST_Transform(g.geom, 27700) END
    ) AS geom,
    g."OBJECTID" AS id
  FROM public."GCN_Class_Survey_License_Returns_England" g
  WHERE g.geom IS NOT NULL
),

with_measures AS (
  SELECT
    g.id,
    ROUND(ST_Distance(sr.geom, g.geom))::INTEGER               AS dist_m,
    ST_Intersects(sr.geom, g.geom)                             AS on_site,
    ST_DWithin(sr.geom, g.geom, 50.0)                          AS within_50m,
    ST_DWithin(sr.geom, g.geom, 100.0)                         AS within_100m,
    ST_DWithin(sr.geom, g.geom, 250.0)                         AS within_250m,
    ST_DWithin(sr.geom, g.geom, 500.0)                         AS within_500m,
    ST_DWithin(sr.geom, g.geom, 1000.0)                        AS within_1km,
    ST_DWithin(sr.geom, g.geom, 3000.0)                        AS within_3km,
    ST_DWithin(sr.geom, g.geom, 5000.0)                        AS within_5km,
    degrees(ST_Azimuth(sr.ref_pt, ST_ClosestPoint(g.geom, sr.geom))) AS az_deg
  FROM gcn g
  CROSS JOIN site_ref sr
)

SELECT
  m.id,
  m.dist_m,
  m.on_site,
  m.within_50m,
  m.within_100m,
  m.within_250m,
  m.within_500m,
  m.within_1km,
  m.within_3km,
  m.within_5km,
  CASE
    WHEN m.on_site THEN 'N/A'
    WHEN m.az_deg >= 337.5 OR m.az_deg < 22.5  THEN 'N'
    WHEN m.az_deg >= 22.5  AND m.az_deg < 67.5  THEN 'NE'
    WHEN m.az_deg >= 67.5  AND m.az_deg < 112.5 THEN 'E'
    WHEN m.az_deg >= 112.5 AND m.az_deg < 157.5 THEN 'SE'
    WHEN m.az_deg >= 157.5 AND m.az_deg < 202.5 THEN 'S'
    WHEN m.az_deg >= 202.5 AND m.az_deg < 247.5 THEN 'SW'
    WHEN m.az_deg >= 247.5 AND m.az_deg < 292.5 THEN 'W'
    WHEN m.az_deg >= 292.5 AND m.az_deg < 337.5 THEN 'NW'
    ELSE NULL
  END AS direction
FROM with_measures m
WHERE
  m.on_site OR m.within_250m
ORDER BY m.on_site DESC, m.dist_m ASC;

$$ LANGUAGE sql STABLE;