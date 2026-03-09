-- 01_census_2011.sql
-- Populates census_2011 tables from Countries, LAD25, Regions source tables
-- All source column names are clean (no special characters)

TRUNCATE TABLE "Socioeconomics".countries_census_2011;
INSERT INTO "Socioeconomics".countries_census_2011 (ctry24cd, total_2011, age_16_64_2011, working_age_percent_2011)
SELECT
  "CTRY24CD",
  "Master sheet2_Total 2011 census",
  "Master sheet2_Age 16-64 2011",
  "Master sheet2_Working age percent 2011"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_census_2011;
INSERT INTO "Socioeconomics".lad25_census_2011 (lad23cd, total_2011, age_16_64_2011, working_age_percent_2011)
SELECT
  "LAD23CD",
  "Master sheet2_Total 2011 census",
  "Master sheet2_Age 16-64 2011",
  "Master sheet2_Working age percent 2011"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_census_2011;
INSERT INTO "Socioeconomics".regions_census_2011 (rgn24cd, total_2011, age_16_64_2011, working_age_percent_2011)
SELECT
  "RGN24CD",
  "Master sheet2_Total 2011 census",
  "Master sheet2_Age 16-64 2011",
  "Master sheet2_Working age percent 2011"
FROM "Socioeconomics"."Regions";
