-- PostgreSQL function for Drinking Water Protected Areas spatial analysis
-- Analyzes 3 drinking water layers as a combined designation:
--   - drinking_water_safeguard_zones_surface_water
--   - drinking_water_protected_areas_surface_water
--   - drinkingwater_safeguard_zones_groundwater
-- Returns percentage coverage for risk assessment

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS analyze_drinking_water(TEXT);

CREATE OR REPLACE FUNCTION analyze_drinking_water(polygon_geojson TEXT)
RETURNS TABLE (
  source_layer TEXT,
  name TEXT,
  area_hectares NUMERIC,
  percentage_coverage NUMERIC,
  on_site BOOLEAN,
  geometry JSON
) AS $$
WITH
-- Convert input GeoJSON polygon to geometry and transform to British National Grid
site AS (
  SELECT ST_Transform(
    ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)),
    27700
  ) AS geom
),

-- Calculate total site area for percentage calculations
site_area AS (
  SELECT
    geom,
    ST_Area(geom) AS total_area_sqm,
    ST_Area(geom) / 10000.0 AS total_area_hectares
  FROM site
),

-- Drinking Water Safeguard Zones (Surface Water)
dw_safeguard_surface AS (
  SELECT
    'safeguard_surface' AS source_layer,
    dw.sgz_name AS name,
    ST_MakeValid(
      CASE WHEN ST_SRID(dw.geom) = 27700 THEN dw.geom ELSE ST_Transform(dw.geom, 27700) END
    ) AS geom
  FROM public.drinking_water_safeguard_zones_surface_water dw
  WHERE dw.geom IS NOT NULL
),

-- Drinking Water Protected Areas (Surface Water)
dw_protected_surface AS (
  SELECT
    'protected_surface' AS source_layer,
    dw.sgz_name AS name,
    ST_MakeValid(
      CASE WHEN ST_SRID(dw.geom) = 27700 THEN dw.geom ELSE ST_Transform(dw.geom, 27700) END
    ) AS geom
  FROM public.drinking_water_protected_areas_surface_water dw
  WHERE dw.geom IS NOT NULL
),

-- Drinking Water Safeguard Zones (Groundwater)
dw_safeguard_groundwater AS (
  SELECT
    'safeguard_groundwater' AS source_layer,
    dw."SGZ_NAME" AS name,
    ST_MakeValid(
      CASE WHEN ST_SRID(dw.geom) = 27700 THEN dw.geom ELSE ST_Transform(dw.geom, 27700) END
    ) AS geom
  FROM public.drinkingwater_safeguard_zones_groundwater dw
  WHERE dw.geom IS NOT NULL
),

-- Combine all drinking water layers
all_drinking_water AS (
  SELECT * FROM dw_safeguard_surface
  UNION ALL
  SELECT * FROM dw_protected_surface
  UNION ALL
  SELECT * FROM dw_safeguard_groundwater
),

-- Find intersecting areas and calculate coverage
intersecting_areas AS (
  SELECT
    dw.source_layer,
    dw.name,
    dw.geom AS original_geom,
    ST_Intersection(sa.geom, dw.geom) AS intersection_geom,
    sa.total_area_sqm,
    sa.total_area_hectares
  FROM all_drinking_water dw
  CROSS JOIN site_area sa
  WHERE ST_Intersects(sa.geom, dw.geom)
),

-- Calculate area and percentage for each intersecting feature
coverage AS (
  SELECT
    ia.source_layer,
    ia.name,
    ia.original_geom,
    ST_Area(ia.intersection_geom) / 10000.0 AS area_hectares,
    (ST_Area(ia.intersection_geom) / ia.total_area_sqm * 100.0) AS percentage_coverage
  FROM intersecting_areas ia
)

SELECT
  c.source_layer,
  c.name,
  ROUND(c.area_hectares::NUMERIC, 4) AS area_hectares,
  ROUND(c.percentage_coverage::NUMERIC, 2) AS percentage_coverage,
  TRUE AS on_site,
  ST_AsGeoJSON(ST_Transform(c.original_geom, 4326))::JSON AS geometry
FROM coverage c
WHERE c.percentage_coverage > 0
ORDER BY c.percentage_coverage DESC;

$$ LANGUAGE sql STABLE;
