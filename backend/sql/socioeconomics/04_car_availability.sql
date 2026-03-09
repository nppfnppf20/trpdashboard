-- 04_car_availability.sql
-- Populates car_availability tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_car_availability;
INSERT INTO "Socioeconomics".countries_car_availability (ctry24cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct)
SELECT
  "CTRY24CD",
  "Master sheet2_No cars or vans in household percent",
  "Master sheet2_1 car or van in household percent",
  "Master sheet2_2 cars or vans in household percent",
  "Master sheet2_3 or more cars or vans in household percent"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_car_availability;
INSERT INTO "Socioeconomics".lad25_car_availability (lad23cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct)
SELECT
  "LAD23CD",
  "Master sheet2_No cars or vans in household percent",
  "Master sheet2_1 car or van in household percent",
  "Master sheet2_2 cars or vans in household percent",
  "Master sheet2_3 or more cars or vans in household percent"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_car_availability;
INSERT INTO "Socioeconomics".regions_car_availability (rgn24cd, no_cars_pct, one_car_pct, two_cars_pct, three_plus_cars_pct)
SELECT
  "RGN24CD",
  "Master sheet2_No cars or vans in household percent",
  "Master sheet2_1 car or van in household percent",
  "Master sheet2_2 cars or vans in household percent",
  "Master sheet2_3 or more cars or vans in household percent"
FROM "Socioeconomics"."Regions";
