-- Verification script for SPA and SAC tables
-- Run this to check the actual column names before deploying the analysis functions

-- Check SPA table structure
SELECT 'special_protection_area columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'special_protection_area'
ORDER BY ordinal_position;

-- Check SAC table structure
SELECT 'special-area-of-conservation columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'special-area-of-conservation'
ORDER BY ordinal_position;

-- Check geometry SRID for SPA
SELECT 'SPA geometry SRID:' as info;
SELECT DISTINCT ST_SRID(geom) as srid FROM public."special_protection_area" LIMIT 1;

-- Check geometry SRID for SAC
SELECT 'SAC geometry SRID:' as info;
SELECT DISTINCT ST_SRID(geom) as srid FROM public."special-area-of-conservation" LIMIT 1;

-- Sample SPA record
SELECT 'Sample SPA record:' as info;
SELECT * FROM public."special_protection_area" LIMIT 1;

-- Sample SAC record
SELECT 'Sample SAC record:' as info;
SELECT * FROM public."special-area-of-conservation" LIMIT 1;
