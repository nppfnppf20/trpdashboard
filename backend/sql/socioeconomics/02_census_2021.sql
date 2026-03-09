-- 02_census_2021.sql
-- Populates census_2021 tables from Countries, LAD25, Regions source tables
-- Run rename-socio-columns.js first to fix the blocked source column name.

TRUNCATE TABLE "Socioeconomics".countries_census_2021;
INSERT INTO "Socioeconomics".countries_census_2021 (ctry24cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021)
SELECT
  "CTRY24CD",
  "Master sheet2_abc_Total_All_usual_residents_2021_census",
  "Master sheet2_Census 2021 pop",
  "Master sheet2_percent working age 2021 census"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_census_2021;
INSERT INTO "Socioeconomics".lad25_census_2021 (lad23cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021)
SELECT
  "LAD23CD",
  "Master sheet2_abc_Total_All_usual_residents_2021_census",
  "Master sheet2_Census 2021 pop",
  "Master sheet2_percent working age 2021 census"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_census_2021;
INSERT INTO "Socioeconomics".regions_census_2021 (rgn24cd, total_usual_residents_2021, census_2021_pop, percent_working_age_2021)
SELECT
  "RGN24CD",
  "Master sheet2_abc_Total_All_usual_residents_2021_census",
  "Master sheet2_Census 2021 pop",
  "Master sheet2_percent working age 2021 census"
FROM "Socioeconomics"."Regions";
