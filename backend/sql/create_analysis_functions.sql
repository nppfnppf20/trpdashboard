-- PostgreSQL aggregator functions for spatial analysis
-- This file contains only the main aggregator functions that combine results 
-- from individual analysis functions in heritage_analysis/ and landscape_analysis/

-- Combined heritage analysis function that calls individual heritage functions
CREATE OR REPLACE FUNCTION analyze_site_heritage(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  listed_buildings_result JSON;
  conservation_areas_result JSON;
  scheduled_monuments_result JSON;
  registered_parks_gardens_result JSON;
  world_heritage_sites_result JSON;
  combined_result JSON;
BEGIN
  -- Get listed buildings analysis
  SELECT json_agg(row_to_json(t)) INTO listed_buildings_result
  FROM (
    SELECT * FROM analyze_listed_buildings(polygon_geojson)
  ) t;

  -- Get conservation areas analysis
  SELECT json_agg(row_to_json(t)) INTO conservation_areas_result
  FROM (
    SELECT * FROM analyze_conservation_areas(polygon_geojson)
  ) t;

  -- Get scheduled monuments analysis
  SELECT json_agg(row_to_json(t)) INTO scheduled_monuments_result
  FROM (
    SELECT * FROM analyze_scheduled_monuments(polygon_geojson)
  ) t;

  -- Get registered parks and gardens analysis
  SELECT json_agg(row_to_json(t)) INTO registered_parks_gardens_result
  FROM (
    SELECT * FROM analyze_registered_parks_gardens(polygon_geojson)
  ) t;

  -- Get world heritage sites analysis
  SELECT json_agg(row_to_json(t)) INTO world_heritage_sites_result
  FROM (
    SELECT * FROM analyze_world_heritage_sites(polygon_geojson)
  ) t;

  -- Combine results
  SELECT json_build_object(
    'listed_buildings', COALESCE(listed_buildings_result, '[]'::json),
    'conservation_areas', COALESCE(conservation_areas_result, '[]'::json),
    'scheduled_monuments', COALESCE(scheduled_monuments_result, '[]'::json),
    'registered_parks_gardens', COALESCE(registered_parks_gardens_result, '[]'::json),
    'world_heritage_sites', COALESCE(world_heritage_sites_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Combined landscape analysis function that calls individual landscape functions
CREATE OR REPLACE FUNCTION analyze_site_landscape(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  green_belt_result JSON;
  aonb_result JSON;
  national_parks_result JSON;
  combined_result JSON;
BEGIN
  -- Get Green Belt analysis
  SELECT json_agg(row_to_json(t)) INTO green_belt_result
  FROM (
    SELECT * FROM analyze_green_belt(polygon_geojson)
  ) t;

  -- Get AONB analysis
  SELECT json_agg(row_to_json(t)) INTO aonb_result
  FROM (
    SELECT * FROM analyze_aonb(polygon_geojson)
  ) t;

  -- Get National Parks analysis
  SELECT json_agg(row_to_json(t)) INTO national_parks_result
  FROM (
    SELECT * FROM analyze_national_parks(polygon_geojson)
  ) t;

  -- Combine results
  SELECT json_build_object(
    'green_belt', COALESCE(green_belt_result, '[]'::json),
    'aonb', COALESCE(aonb_result, '[]'::json),
    'national_parks', COALESCE(national_parks_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Agricultural land analysis function (separate category)
CREATE OR REPLACE FUNCTION analyze_site_ag_land(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  ag_land_result JSON;
  combined_result JSON;
BEGIN
  -- Get agricultural land analysis
  SELECT json_agg(row_to_json(t)) INTO ag_land_result
  FROM (
    SELECT * FROM analyze_ag_land(polygon_geojson)
  ) t;

  -- Build result object
  SELECT json_build_object(
    'ag_land', COALESCE(ag_land_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Renewables analysis function (separate category)
CREATE OR REPLACE FUNCTION analyze_site_renewables(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  renewables_result JSON;
  combined_result JSON;
BEGIN
  -- Get renewables analysis
  SELECT json_agg(row_to_json(t)) INTO renewables_result
  FROM (
    SELECT * FROM analyze_renewables(polygon_geojson)
  ) t;

  -- Build result object
  SELECT json_build_object(
    'renewables', COALESCE(renewables_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ecology analysis function (new domain)
CREATE OR REPLACE FUNCTION analyze_site_ecology(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  os_priority_ponds_result JSON;
  ramsar_result JSON;
  spa_result JSON;
  sac_result JSON;
  gcn_result JSON;
  sssi_result JSON;
  nnr_result JSON;
  drinking_water_result JSON;
  combined_result JSON;
BEGIN
  -- Get OS Priority Ponds analysis
  SELECT json_agg(row_to_json(t)) INTO os_priority_ponds_result
  FROM (
    SELECT * FROM analyze_os_priority_ponds(polygon_geojson)
  ) t;

  -- Get Ramsar sites analysis
  SELECT json_agg(row_to_json(t)) INTO ramsar_result
  FROM (
    SELECT * FROM analyze_ramsar(polygon_geojson)
  ) t;

  -- Get Special Protection Areas (SPA) analysis
  SELECT json_agg(row_to_json(t)) INTO spa_result
  FROM (
    SELECT * FROM analyze_spa(polygon_geojson)
  ) t;

  -- Get Special Areas of Conservation (SAC) analysis
  SELECT json_agg(row_to_json(t)) INTO sac_result
  FROM (
    SELECT * FROM analyze_sac(polygon_geojson)
  ) t;

  -- Get GCN analysis
  SELECT json_agg(row_to_json(t)) INTO gcn_result
  FROM (
    SELECT * FROM analyze_gcn(polygon_geojson)
  ) t;

  -- Get SSSI analysis
  SELECT json_agg(row_to_json(t)) INTO sssi_result
  FROM (
    SELECT * FROM analyze_sssi(polygon_geojson)
  ) t;

  -- Get National Nature Reserves analysis
  SELECT json_agg(row_to_json(t)) INTO nnr_result
  FROM (
    SELECT * FROM analyze_national_nature_reserves(polygon_geojson)
  ) t;

  -- Get Drinking Water Protected Areas analysis
  SELECT json_agg(row_to_json(t)) INTO drinking_water_result
  FROM (
    SELECT * FROM analyze_drinking_water(polygon_geojson)
  ) t;

  -- Build result object
  SELECT json_build_object(
    'os_priority_ponds', COALESCE(os_priority_ponds_result, '[]'::json),
    'ramsar', COALESCE(ramsar_result, '[]'::json),
    'spa', COALESCE(spa_result, '[]'::json),
    'sac', COALESCE(sac_result, '[]'::json),
    'gcn', COALESCE(gcn_result, '[]'::json),
    'sssi', COALESCE(sssi_result, '[]'::json),
    'national_nature_reserves', COALESCE(nnr_result, '[]'::json),
    'drinking_water', COALESCE(drinking_water_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trees analysis function (new domain)
CREATE OR REPLACE FUNCTION analyze_site_trees(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  ancient_woodland_result JSON;
  combined_result JSON;
BEGIN
  -- Get Ancient Woodland analysis
  SELECT json_agg(row_to_json(t)) INTO ancient_woodland_result
  FROM (
    SELECT * FROM analyze_ancient_woodland(polygon_geojson)
  ) t;

  -- Build result object
  SELECT json_build_object(
    'ancient_woodland', COALESCE(ancient_woodland_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;