-- verify_subject_tables.sql
-- Compares subject tables against source tables using EXCEPT (both directions).
-- Every check should return mismatches = 0 if data is correct.
-- Run each statement individually in Supabase SQL editor.

-- ============================================================
-- 1. ROW COUNT CHECKS — all 39 subject tables
-- Expected: countries_* = 4, regions_* = 9, lad25_* = 361
-- ============================================================
SELECT
  table_name,
  (xpath('/row/c/text()', query_to_xml(
    format('SELECT COUNT(*) AS c FROM "Socioeconomics".%I', table_name),
    false, true, ''
  )))[1]::text::int AS row_count,
  CASE
    WHEN table_name LIKE 'countries_%' THEN 4
    WHEN table_name LIKE 'regions_%'   THEN 9
    WHEN table_name LIKE 'lad25_%'     THEN 361
  END AS expected,
  CASE
    WHEN (xpath('/row/c/text()', query_to_xml(
      format('SELECT COUNT(*) AS c FROM "Socioeconomics".%I', table_name),
      false, true, ''
    )))[1]::text::int =
    CASE
      WHEN table_name LIKE 'countries_%' THEN 4
      WHEN table_name LIKE 'regions_%'   THEN 9
      WHEN table_name LIKE 'lad25_%'     THEN 361
    END
    THEN 'OK' ELSE 'MISMATCH'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'Socioeconomics'
  AND table_name NOT IN ('Countries','LAD25','LAD11','LAD19','Regions','socioec')
ORDER BY table_name;


-- ============================================================
-- 2. DATA CHECKS — EXCEPT both directions (0 = match)
-- ============================================================

-- --- census_2011 ---
SELECT 'countries_census_2011' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".countries_census_2011
    EXCEPT
    SELECT "CTRY24CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".countries_census_2011
  ) d) AS mismatches;

SELECT 'lad25_census_2011' AS check,
  (SELECT COUNT(*) FROM (
    SELECT lad23cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".lad25_census_2011
    EXCEPT
    SELECT "LAD23CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."LAD25"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "LAD23CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."LAD25"
    EXCEPT
    SELECT lad23cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".lad25_census_2011
  ) d) AS mismatches;

SELECT 'regions_census_2011' AS check,
  (SELECT COUNT(*) FROM (
    SELECT rgn24cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".regions_census_2011
    EXCEPT
    SELECT "RGN24CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."Regions"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "RGN24CD", "Master sheet2_Total 2011 census", "Master sheet2_Age 16-64 2011", "Master sheet2_Working age percent 2011"
    FROM "Socioeconomics"."Regions"
    EXCEPT
    SELECT rgn24cd, total_2011, age_16_64_2011, working_age_percent_2011
    FROM "Socioeconomics".regions_census_2011
  ) d) AS mismatches;


-- --- census_2021 ---
SELECT 'countries_census_2021' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021
    FROM "Socioeconomics".countries_census_2021
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_abc_Total_All_usual_residents_2021_census",
      "Master sheet2_Census 2021 pop",
      "Master sheet2_percent working age 2021 census"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD",
      "Master sheet2_abc_Total_All_usual_residents_2021_census",
      "Master sheet2_Census 2021 pop",
      "Master sheet2_percent working age 2021 census"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021
    FROM "Socioeconomics".countries_census_2021
  ) d) AS mismatches;

SELECT 'lad25_census_2021' AS check,
  (SELECT COUNT(*) FROM (
    SELECT lad23cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021
    FROM "Socioeconomics".lad25_census_2021
    EXCEPT
    SELECT "LAD23CD",
      "Master sheet2_abc_Total_All_usual_residents_2021_census",
      "Master sheet2_Census 2021 pop",
      "Master sheet2_percent working age 2021 census"
    FROM "Socioeconomics"."LAD25"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "LAD23CD",
      "Master sheet2_abc_Total_All_usual_residents_2021_census",
      "Master sheet2_Census 2021 pop",
      "Master sheet2_percent working age 2021 census"
    FROM "Socioeconomics"."LAD25"
    EXCEPT
    SELECT lad23cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021
    FROM "Socioeconomics".lad25_census_2021
  ) d) AS mismatches;


-- --- method_of_travel ---
SELECT 'countries_method_of_travel' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, employed_week_before_census, employed_week_before_census_pct,
      work_from_home, work_from_home_pct, underground_tram, underground_tram_pct,
      train, train_pct, bus_minibus_coach, bus_minibus_coach_pct,
      taxi, taxi_pct, motorcycle, motorcycle_pct,
      driving_car_van, driving_car_van_pct, passenger_car_van, passenger_car_van_pct,
      bicycle, bicycle_pct, on_foot, on_foot_pct, other_travel, other_travel_pct
    FROM "Socioeconomics".countries_method_of_travel
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_16 or over in employment week before census",
      "Master sheet2_16 or over in employment week before census perce",
      "Master sheet2_Work mainly at or from home", "Master sheet2_Work mainly at or from home percent",
      "Master sheet2_Underground, metro, light rail, tram", "Master sheet2_Underground, metro, light rail, tram percent",
      "Master sheet2_Train", "Master sheet2_Train percent",
      "Master sheet2_Bus, minibus or coach", "Master sheet2_Bus, minibus or coach percent",
      "Master sheet2_Taxi", "Master sheet2_Taxi percent",
      "Master sheet2_Motorcycle, scooter or moped", "Master sheet2_Motorcycle, scooter or moped percent",
      "Master sheet2_Driving a car or van", "Master sheet2_Driving a car or van percent",
      "Master sheet2_Passenger in a car or van", "Master sheet2_Passenger in a car or van percent",
      "Master sheet2_Bicycle", "Master sheet2_Bicycle percent",
      "Master sheet2_On foot", "Master sheet2_On foot percent",
      "Master sheet2_Other method of travel to work", "Master sheet2_Other method of travel to work percent"
    FROM "Socioeconomics"."Countries"
  ) d) AS mismatches;


-- --- car_availability ---
SELECT 'countries_car_availability' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct
    FROM "Socioeconomics".countries_car_availability
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_No cars or vans in household percent",
      "Master sheet2_1 car or van in household percent",
      "Master sheet2_2 cars or vans in household percent",
      "Master sheet2_3 or more cars or vans in household percent"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD",
      "Master sheet2_No cars or vans in household percent",
      "Master sheet2_1 car or van in household percent",
      "Master sheet2_2 cars or vans in household percent",
      "Master sheet2_3 or more cars or vans in household percent"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct
    FROM "Socioeconomics".countries_car_availability
  ) d) AS mismatches;

SELECT 'lad25_car_availability' AS check,
  (SELECT COUNT(*) FROM (
    SELECT lad23cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct
    FROM "Socioeconomics".lad25_car_availability
    EXCEPT
    SELECT "LAD23CD",
      "Master sheet2_No cars or vans in household percent",
      "Master sheet2_1 car or van in household percent",
      "Master sheet2_2 cars or vans in household percent",
      "Master sheet2_3 or more cars or vans in household percent"
    FROM "Socioeconomics"."LAD25"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "LAD23CD",
      "Master sheet2_No cars or vans in household percent",
      "Master sheet2_1 car or van in household percent",
      "Master sheet2_2 cars or vans in household percent",
      "Master sheet2_3 or more cars or vans in household percent"
    FROM "Socioeconomics"."LAD25"
    EXCEPT
    SELECT lad23cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct
    FROM "Socioeconomics".lad25_car_availability
  ) d) AS mismatches;


-- --- general_health ---
SELECT 'countries_general_health' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, health_total_residents, health_total_residents_pct,
      very_good_health, very_good_health_pct, good_health, good_health_pct,
      fair_health, fair_health_pct, bad_health, bad_health_pct,
      very_bad_health, very_bad_health_pct
    FROM "Socioeconomics".countries_general_health
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_Health total residents", "Master sheet2_Health total residents percent",
      "Master sheet2_Very good health", "Master sheet2_Very good health percent",
      "Master sheet2_Good health", "Master sheet2_Good health percent",
      "Master sheet2_Fair health", "Master sheet2_Fair health percent",
      "Master sheet2_Bad health", "Master sheet2_Bad health percent",
      "Master sheet2_Very bad health", "Master sheet2_Very bad health percent"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD",
      "Master sheet2_Health total residents", "Master sheet2_Health total residents percent",
      "Master sheet2_Very good health", "Master sheet2_Very good health percent",
      "Master sheet2_Good health", "Master sheet2_Good health percent",
      "Master sheet2_Fair health", "Master sheet2_Fair health percent",
      "Master sheet2_Bad health", "Master sheet2_Bad health percent",
      "Master sheet2_Very bad health", "Master sheet2_Very bad health percent"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, health_total_residents, health_total_residents_pct,
      very_good_health, very_good_health_pct, good_health, good_health_pct,
      fair_health, fair_health_pct, bad_health, bad_health_pct,
      very_bad_health, very_bad_health_pct
    FROM "Socioeconomics".countries_general_health
  ) d) AS mismatches;


-- --- occupation ---
SELECT 'countries_occupation' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, occupation_total, occupation_total_pct,
      managers_directors, managers_directors_pct, professional, professional_pct,
      associate_professional, associate_professional_pct,
      administrative_secretarial, administrative_secretarial_pct,
      skilled_trades, skilled_trades_pct, caring_leisure, caring_leisure_pct,
      sales_customer_service, sales_customer_service_pct,
      process_plant_machine, process_plant_machine_pct, elementary, elementary_pct
    FROM "Socioeconomics".countries_occupation
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_Occupation All usual residents", "Master sheet2_Occupation All usual residents percent",
      "Master sheet2_1. Managers, directors and senior officials", "Master sheet2_1. percent Managers, directors and senior officia",
      "Master sheet2_2. Professional occupations", "Master sheet2_2. percent Professional occupations",
      "Master sheet2_3. Associate professional and technical occupatio", "Master sheet2_3. percent Associate professional and technical o",
      "Master sheet2_4. Administrative and secretarial occupations", "Master sheet2_4. percent Administrative and secretarial occupat",
      "Master sheet2_5. Skilled trades occupations", "Master sheet2_Skilled percent",
      "Master sheet2_6. Caring, leisure and other service occupations", "Master sheet2_6. percent Caring, leisure and other service occu",
      "Master sheet2_7. Sales and customer service occupations", "Master sheet2_7. percent Sales and customer service occupations",
      "Master sheet2_8. Process, plant and machine operatives", "Master sheet2_8. percent Process, plant and machine operatives",
      "Master sheet2_9. Elementary occupations", "Master sheet2_9. Elementary occupations percent"
    FROM "Socioeconomics"."Countries"
  ) d) AS mismatches;


-- --- qualifications ---
SELECT 'countries_qualifications' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, total_residents_16_over,
      all_residents_qual, all_residents_qual_pct,
      no_qualifications, no_qualifications_pct,
      level_1_entry, level_1_entry_pct, level_2, level_2_pct,
      apprenticeship, apprenticeship_pct, level_3, level_3_pct,
      level_4_above, level_4_above_pct, other_qualifications, other_qualifications_pct
    FROM "Socioeconomics".countries_qualifications
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_Total_All_usual_residents_aged_16_and_over",
      "Master sheet2_All usual residents qualification", "Master sheet2_All usual residents qualification percent",
      "Master sheet2_No qualifications", "Master sheet2_No qualifications percent",
      "Master sheet2_Level 1 and entry level qualifications", "Master sheet2_Level 1 and entry level qualifications percent",
      "Master sheet2_Level 2 qualifications", "Master sheet2_Level 2 qualifications percent",
      "Master sheet2_Apprenticeship", "Master sheet2_Apprenticeship percent",
      "Master sheet2_Level 3 qualifications", "Master sheet2_Level 3 qualifications percent",
      "Master sheet2_Level 4 qualifications or above", "Master sheet2_Level 4 qualifications or above percent",
      "Master sheet2_Other qualifications", "Master sheet2_Other qualifications percent"
    FROM "Socioeconomics"."Countries"
  ) d) AS mismatches;


-- --- renewables ---
SELECT 'countries_renewables' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, local_authority_code, estimated_households,
      photovoltaics, onshore_wind, hydro, anaerobic_digestion,
      offshore_wind, wave_tidal, sewage_gas, landfill_gas,
      municipal_solid_waste, animal_biomass, plant_biomass, cofiring, total, ev_charging
    FROM "Socioeconomics".countries_renewables
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_Local_Authority_Code", "Master sheet2_Estimated_number_of_households",
      "Master sheet2_Photovoltaics", "Master sheet2_Onshore Wind", "Master sheet2_Hydro",
      "Master sheet2_Anaerobic Digestion", "Master sheet2_Offshore Wind", "Master sheet2_Wave/Tidal",
      "Master sheet2_Sewage Gas", "Master sheet2_Landfill Gas", "Master sheet2_Municipal Solid Waste",
      "Master sheet2_Animal Biomass", "Master sheet2_Plant Biomass", "Master sheet2_Cofiring",
      "Master sheet2_Total", "Master sheet2_Elec Vehicle Charging"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD",
      "Master sheet2_Local_Authority_Code", "Master sheet2_Estimated_number_of_households",
      "Master sheet2_Photovoltaics", "Master sheet2_Onshore Wind", "Master sheet2_Hydro",
      "Master sheet2_Anaerobic Digestion", "Master sheet2_Offshore Wind", "Master sheet2_Wave/Tidal",
      "Master sheet2_Sewage Gas", "Master sheet2_Landfill Gas", "Master sheet2_Municipal Solid Waste",
      "Master sheet2_Animal Biomass", "Master sheet2_Plant Biomass", "Master sheet2_Cofiring",
      "Master sheet2_Total", "Master sheet2_Elec Vehicle Charging"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, local_authority_code, estimated_households,
      photovoltaics, onshore_wind, hydro, anaerobic_digestion,
      offshore_wind, wave_tidal, sewage_gas, landfill_gas,
      municipal_solid_waste, animal_biomass, plant_biomass, cofiring, total, ev_charging
    FROM "Socioeconomics".countries_renewables
  ) d) AS mismatches;


-- --- unemployment_timeseries (spot check first + last period) ---
SELECT 'countries_unemployment_timeseries' AS check,
  (SELECT COUNT(*) FROM (
    SELECT ctry24cd, jul17_jun18, jul17_jun18_ea, jul17_18_ue, jul24_jun25, jul24_jun25_uep
    FROM "Socioeconomics".countries_unemployment_timeseries
    EXCEPT
    SELECT "CTRY24CD",
      "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-18UE",
      "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25UEP"
    FROM "Socioeconomics"."Countries"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "CTRY24CD",
      "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-18UE",
      "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25UEP"
    FROM "Socioeconomics"."Countries"
    EXCEPT
    SELECT ctry24cd, jul17_jun18, jul17_jun18_ea, jul17_18_ue, jul24_jun25, jul24_jun25_uep
    FROM "Socioeconomics".countries_unemployment_timeseries
  ) d) AS mismatches;

SELECT 'lad25_unemployment_timeseries' AS check,
  (SELECT COUNT(*) FROM (
    SELECT lad23cd, jul17_jun18, jul17_jun18_ea, jul17_18_ue, jul24_jun25, jul24_jun25_uep
    FROM "Socioeconomics".lad25_unemployment_timeseries
    EXCEPT
    SELECT "LAD23CD",
      "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-18UE",
      "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25UEP"
    FROM "Socioeconomics"."LAD25"
  ) d) +
  (SELECT COUNT(*) FROM (
    SELECT "LAD23CD",
      "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-18UE",
      "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25UEP"
    FROM "Socioeconomics"."LAD25"
    EXCEPT
    SELECT lad23cd, jul17_jun18, jul17_jun18_ea, jul17_18_ue, jul24_jun25, jul24_jun25_uep
    FROM "Socioeconomics".lad25_unemployment_timeseries
  ) d) AS mismatches;
