-- Airfields Domain Aggregator Function
-- Combines all airfields-related analysis functions

CREATE OR REPLACE FUNCTION analyze_site_airfields(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  uk_airports_result JSON;
  combined_result JSON;
BEGIN
  -- UK Airports analysis
  SELECT json_agg(row_to_json(t)) INTO uk_airports_result
  FROM (SELECT * FROM analyze_uk_airports(polygon_geojson)) t;

  -- Combine results (add more layers here as needed)
  SELECT json_build_object(
    'uk_airports', COALESCE(uk_airports_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;
