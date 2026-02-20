-- Migration: Add centroid column to SSSI table for faster spatial queries
-- The full polygon geometries are too complex and cause timeout errors
-- Using centroid for distance calculations is much faster

-- Add centroid column if it doesn't exist
DO $$
BEGIN
  ALTER TABLE public."SSSI" ADD COLUMN centroid geometry(Point, 27700);
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'Column centroid already exists, skipping';
END $$;

-- Populate centroid for all rows (using ST_Centroid on the geometry)
-- First ensure geometry is in 27700, then calculate centroid
UPDATE public."SSSI"
SET centroid = ST_Centroid(
  CASE
    WHEN ST_SRID(geom) = 27700 THEN ST_MakeValid(geom)
    ELSE ST_Transform(ST_MakeValid(geom), 27700)
  END
)
WHERE centroid IS NULL;

-- Create spatial index on centroid for fast lookups
DROP INDEX IF EXISTS idx_sssi_centroid;
CREATE INDEX idx_sssi_centroid ON public."SSSI" USING GIST (centroid);

-- Also ensure there's an index on the main geometry if not already
DROP INDEX IF EXISTS idx_sssi_geom;
CREATE INDEX idx_sssi_geom ON public."SSSI" USING GIST (geom);

-- Analyze the table to update statistics for query planner
ANALYZE public."SSSI";
