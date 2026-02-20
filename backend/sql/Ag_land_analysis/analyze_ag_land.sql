-- PostgreSQL function for agricultural land classification analysis
-- Analyzes ALC grades within a drawn polygon and calculates percentage coverage

CREATE OR REPLACE FUNCTION analyze_ag_land(polygon_geojson TEXT)
RETURNS TABLE (
  grade TEXT,
  area_hectares NUMERIC,
  percentage_coverage NUMERIC,
  on_site BOOLEAN
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
    ST_Area(geom) / 10000.0 AS total_area_hectares  -- Convert to hectares
  FROM site
),

-- Find ALC polygons that intersect with the site
intersecting_alc AS (
  SELECT
    alc."agricultural-land-classification-grade" AS grade,
    ST_Intersection(sa.geom, alc.geom) AS intersection_geom,
    sa.total_area_sqm,
    sa.total_area_hectares
  FROM provisional_alc alc
  CROSS JOIN site_area sa
  WHERE ST_Intersects(sa.geom, alc.geom)
    AND alc."agricultural-land-classification-grade" IS NOT NULL
    AND alc."agricultural-land-classification-grade" != ''
),

-- Calculate area and percentage for each ALC grade
grade_coverage AS (
  SELECT
    grade,
    ST_Area(ST_Union(intersection_geom)) AS grade_area_sqm,
    ST_Area(ST_Union(intersection_geom)) / 10000.0 AS grade_area_hectares,
    total_area_sqm,
    total_area_hectares,
    -- Calculate percentage coverage
    (ST_Area(ST_Union(intersection_geom)) / total_area_sqm * 100.0) AS percentage_coverage
  FROM intersecting_alc
  GROUP BY grade, total_area_sqm, total_area_hectares
)

SELECT
  gc.grade,
  ROUND(gc.grade_area_hectares::NUMERIC, 4) AS area_hectares,
  ROUND(gc.percentage_coverage::NUMERIC, 2) AS percentage_coverage,
  TRUE AS on_site  -- All results are on-site by definition
FROM grade_coverage gc
ORDER BY 
  CASE gc.grade 
    WHEN '1' THEN 1
    WHEN '2' THEN 2  
    WHEN '3' THEN 3
    WHEN '4' THEN 4
    WHEN '5' THEN 5
    ELSE 6
  END;

$$ LANGUAGE sql STABLE;
