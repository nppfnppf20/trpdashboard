-- 03_method_of_travel.sql
-- Populates method_of_travel tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_method_of_travel;
INSERT INTO "Socioeconomics".countries_method_of_travel (
  ctry24cd,
  employed_week_before_census, employed_week_before_census_pct,
  work_from_home, work_from_home_pct,
  underground_tram, underground_tram_pct,
  train, train_pct,
  bus_minibus_coach, bus_minibus_coach_pct,
  taxi, taxi_pct,
  motorcycle, motorcycle_pct,
  driving_car_van, driving_car_van_pct,
  passenger_car_van, passenger_car_van_pct,
  bicycle, bicycle_pct,
  on_foot, on_foot_pct,
  other_travel, other_travel_pct
)
SELECT
  "CTRY24CD",
  "Master sheet2_16 or over in employment week before census",
  "Master sheet2_16 or over in employment week before census perce",
  "Master sheet2_Work mainly at or from home",
  "Master sheet2_Work mainly at or from home percent",
  "Master sheet2_Underground, metro, light rail, tram",
  "Master sheet2_Underground, metro, light rail, tram percent",
  "Master sheet2_Train",
  "Master sheet2_Train percent",
  "Master sheet2_Bus, minibus or coach",
  "Master sheet2_Bus, minibus or coach percent",
  "Master sheet2_Taxi",
  "Master sheet2_Taxi percent",
  "Master sheet2_Motorcycle, scooter or moped",
  "Master sheet2_Motorcycle, scooter or moped percent",
  "Master sheet2_Driving a car or van",
  "Master sheet2_Driving a car or van percent",
  "Master sheet2_Passenger in a car or van",
  "Master sheet2_Passenger in a car or van percent",
  "Master sheet2_Bicycle",
  "Master sheet2_Bicycle percent",
  "Master sheet2_On foot",
  "Master sheet2_On foot percent",
  "Master sheet2_Other method of travel to work",
  "Master sheet2_Other method of travel to work percent"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_method_of_travel;
INSERT INTO "Socioeconomics".lad25_method_of_travel (
  lad23cd,
  employed_week_before_census, employed_week_before_census_pct,
  work_from_home, work_from_home_pct,
  underground_tram, underground_tram_pct,
  train, train_pct,
  bus_minibus_coach, bus_minibus_coach_pct,
  taxi, taxi_pct,
  motorcycle, motorcycle_pct,
  driving_car_van, driving_car_van_pct,
  passenger_car_van, passenger_car_van_pct,
  bicycle, bicycle_pct,
  on_foot, on_foot_pct,
  other_travel, other_travel_pct
)
SELECT
  "LAD23CD",
  "Master sheet2_16 or over in employment week before census",
  "Master sheet2_16 or over in employment week before census perce",
  "Master sheet2_Work mainly at or from home",
  "Master sheet2_Work mainly at or from home percent",
  "Master sheet2_Underground, metro, light rail, tram",
  "Master sheet2_Underground, metro, light rail, tram percent",
  "Master sheet2_Train",
  "Master sheet2_Train percent",
  "Master sheet2_Bus, minibus or coach",
  "Master sheet2_Bus, minibus or coach percent",
  "Master sheet2_Taxi",
  "Master sheet2_Taxi percent",
  "Master sheet2_Motorcycle, scooter or moped",
  "Master sheet2_Motorcycle, scooter or moped percent",
  "Master sheet2_Driving a car or van",
  "Master sheet2_Driving a car or van percent",
  "Master sheet2_Passenger in a car or van",
  "Master sheet2_Passenger in a car or van percent",
  "Master sheet2_Bicycle",
  "Master sheet2_Bicycle percent",
  "Master sheet2_On foot",
  "Master sheet2_On foot percent",
  "Master sheet2_Other method of travel to work",
  "Master sheet2_Other method of travel to work percent"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_method_of_travel;
INSERT INTO "Socioeconomics".regions_method_of_travel (
  rgn24cd,
  employed_week_before_census, employed_week_before_census_pct,
  work_from_home, work_from_home_pct,
  underground_tram, underground_tram_pct,
  train, train_pct,
  bus_minibus_coach, bus_minibus_coach_pct,
  taxi, taxi_pct,
  motorcycle, motorcycle_pct,
  driving_car_van, driving_car_van_pct,
  passenger_car_van, passenger_car_van_pct,
  bicycle, bicycle_pct,
  on_foot, on_foot_pct,
  other_travel, other_travel_pct
)
SELECT
  "RGN24CD",
  "Master sheet2_16 or over in employment week before census",
  "Master sheet2_16 or over in employment week before census perce",
  "Master sheet2_Work mainly at or from home",
  "Master sheet2_Work mainly at or from home percent",
  "Master sheet2_Underground, metro, light rail, tram",
  "Master sheet2_Underground, metro, light rail, tram percent",
  "Master sheet2_Train",
  "Master sheet2_Train percent",
  "Master sheet2_Bus, minibus or coach",
  "Master sheet2_Bus, minibus or coach percent",
  "Master sheet2_Taxi",
  "Master sheet2_Taxi percent",
  "Master sheet2_Motorcycle, scooter or moped",
  "Master sheet2_Motorcycle, scooter or moped percent",
  "Master sheet2_Driving a car or van",
  "Master sheet2_Driving a car or van percent",
  "Master sheet2_Passenger in a car or van",
  "Master sheet2_Passenger in a car or van percent",
  "Master sheet2_Bicycle",
  "Master sheet2_Bicycle percent",
  "Master sheet2_On foot",
  "Master sheet2_On foot percent",
  "Master sheet2_Other method of travel to work",
  "Master sheet2_Other method of travel to work percent"
FROM "Socioeconomics"."Regions";
