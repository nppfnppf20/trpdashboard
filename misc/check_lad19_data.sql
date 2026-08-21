-- Check LAD19 table structure and data

-- 1. Check if LAD19 table exists and has data
SELECT COUNT(*) as row_count FROM "Socioeconomics"."LAD19";

-- 2. Check the table structure (column names and types)
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'Socioeconomics'
AND table_name = 'LAD19'
ORDER BY ordinal_position;

-- 3. Sample a few rows to see what data is available
SELECT * FROM "Socioeconomics"."LAD19" LIMIT 5;

-- 4. Check for population-related columns specifically
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'Socioeconomics'
AND table_name = 'LAD19'
AND (
    LOWER(column_name) LIKE '%population%' OR
    LOWER(column_name) LIKE '%proj%' OR
    LOWER(column_name) LIKE '%pop%' OR
    LOWER(column_name) LIKE '%total%' OR
    LOWER(column_name) LIKE '%age%' OR
    LOWER(column_name) LIKE '%demo%'
)
ORDER BY column_name;

-- 5. Check for any columns that might contain numeric demographic data
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'Socioeconomics'
AND table_name = 'LAD19'
AND data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision')
ORDER BY column_name;