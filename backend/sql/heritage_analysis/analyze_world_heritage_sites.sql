-- PostgreSQL function for World Heritage Sites spatial analysis
-- Analyzes World Heritage Sites relative to a drawn polygon
-- Returns features that are on-site or within up to 5km, with distance buckets

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS analyze_world_heritage_sites(TEXT);

CREATE OR REPLACE FUNCTION analyze_world_heritage_sites(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  list_entry INTEGER,
  inscr_date TIMESTAMP,
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

-- World Heritage Sites polygons
whs_polys AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(whs.geom) = 27700 THEN whs.geom ELSE ST_Transform(whs.geom, 27700) END
    ) AS geom,
    whs.id AS id,
    whs."Name" AS name,
    whs."ListEntry" AS list_entry,
    whs."InscrDate" AS inscr_date
  FROM public.world_heritage_site whs
  WHERE whs.geom IS NOT NULL
),

with_measures AS (
  SELECT
    p.id,
    p.name,
    p.list_entry,
    p.inscr_date,
    p.geom,
    sr.geom AS site_geom,
    sr.ref_pt,
    -- Calculate distance in meters
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER AS dist_m,
    -- Check if intersecting (on-site)
    ST_Intersects(sr.geom, p.geom) AS on_site
  FROM whs_polys p
  CROSS JOIN site_ref sr
),

with_buffers AS (
  SELECT
    wm.id,
    wm.name,
    wm.list_entry,
    wm.inscr_date,
    wm.geom,
    wm.dist_m,
    wm.on_site,
    -- Distance buckets
    ST_DWithin(wm.site_geom, wm.geom, 50.0) AS within_50m,
    ST_DWithin(wm.site_geom, wm.geom, 100.0) AS within_100m,
    ST_DWithin(wm.site_geom, wm.geom, 250.0) AS within_250m,
    ST_DWithin(wm.site_geom, wm.geom, 500.0) AS within_500m,
    ST_DWithin(wm.site_geom, wm.geom, 1000.0) AS within_1km,
    ST_DWithin(wm.site_geom, wm.geom, 3000.0) AS within_3km,
    ST_DWithin(wm.site_geom, wm.geom, 5000.0) AS within_5km,
    -- Calculate direction (azimuth from site to WHS)
    DEGREES(ST_Azimuth(wm.ref_pt, ST_ClosestPoint(wm.geom, wm.site_geom))) AS az_deg
  FROM with_measures wm
)

SELECT
  wb.id,
  wb.name,
  wb.list_entry,
  wb.inscr_date,
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
  -- Convert geometry to GeoJSON for frontend display
  ST_AsGeoJSON(ST_Transform(wb.geom, 4326))::JSON AS geometry
FROM with_buffers wb
WHERE wb.within_5km = TRUE -- Only return features within 5km
ORDER BY wb.dist_m;

$$ LANGUAGE sql STABLE;

