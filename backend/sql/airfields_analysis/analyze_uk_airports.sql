-- UK Airports Analysis Function
-- Analyzes proximity to UK airports, airstrips, helipads, and heliports

CREATE OR REPLACE FUNCTION analyze_uk_airports(polygon_geojson TEXT)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  aeroway_type TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_500m BOOLEAN,
  within_5km BOOLEAN,
  within_10km BOOLEAN,
  direction TEXT,
  geometry JSON
) AS $$
WITH
-- Convert GeoJSON to geometry (4326)
site AS (
  SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)) AS geom
),
-- Transform to British National Grid (27700)
site_metric AS (
  SELECT ST_Transform(geom, 27700) AS geom FROM site
),
-- Reference point for direction
site_ref AS (
  SELECT sm.geom, ST_PointOnSurface(sm.geom) AS ref_pt FROM site_metric sm
),
-- Airport data - filter for actual airports/airfields
layer_features AS (
  SELECT
    ST_MakeValid(f.geom) AS geom,
    f.fid AS id,
    COALESCE(f.name, 'Unnamed ' || f.aeroway) AS name,
    f.aeroway AS aeroway_type
  FROM public.ukairports f
  WHERE f.geom IS NOT NULL
    AND f.aeroway IN ('aerodrome', 'airstrip', 'helipad', 'heliport')
),
-- Calculate distances and buffers
with_measures AS (
  SELECT
    p.id,
    p.name,
    p.aeroway_type,
    p.geom,
    sr.geom AS site_geom,
    sr.ref_pt,
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER AS dist_m,
    ST_Intersects(sr.geom, ST_Buffer(p.geom, 1)) AS on_site,
    ST_DWithin(sr.geom, p.geom, 500.0) AS within_500m,
    ST_DWithin(sr.geom, p.geom, 5000.0) AS within_5km,
    ST_DWithin(sr.geom, p.geom, 10000.0) AS within_10km,
    DEGREES(ST_Azimuth(sr.ref_pt, p.geom)) AS az_deg
  FROM layer_features p
  CROSS JOIN site_ref sr
)
SELECT
  id, name, aeroway_type, dist_m,
  on_site, within_500m, within_5km, within_10km,
  -- Convert azimuth to cardinal direction
  CASE
    WHEN on_site THEN 'N/A'
    WHEN az_deg >= 337.5 OR az_deg < 22.5 THEN 'N'
    WHEN az_deg >= 22.5 AND az_deg < 67.5 THEN 'NE'
    WHEN az_deg >= 67.5 AND az_deg < 112.5 THEN 'E'
    WHEN az_deg >= 112.5 AND az_deg < 157.5 THEN 'SE'
    WHEN az_deg >= 157.5 AND az_deg < 202.5 THEN 'S'
    WHEN az_deg >= 202.5 AND az_deg < 247.5 THEN 'SW'
    WHEN az_deg >= 247.5 AND az_deg < 292.5 THEN 'W'
    WHEN az_deg >= 292.5 AND az_deg < 337.5 THEN 'NW'
    ELSE 'N/A'
  END AS direction,
  ST_AsGeoJSON(ST_Transform(p.geom, 4326))::JSON AS geometry
FROM with_measures p
WHERE within_10km = TRUE
ORDER BY dist_m;
$$ LANGUAGE sql STABLE;
