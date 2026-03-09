-- 13_population_projections.sql
-- Populates population_projections tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_population_projections;
INSERT INTO "Socioeconomics".countries_population_projections (
  ctry24cd,
  yr2018_all_ages, yr2018_aged_0_15, yr2018_aged_16_64, yr2018_aged_65_plus,
  yr2043_all_ages, yr2043_aged_0_15, yr2043_aged_16_64, yr2043_aged_65_plus
)
SELECT
  "CTRY24CD",
  "Master sheet2_2018 All Ages", "Master sheet2_2018 Aged 0 to 15", "Master sheet2_2018 Aged 16 to 64", "Master sheet2_2018 Aged 65+",
  "Master sheet2_2043 All Ages", "Master sheet2_2043 Aged 0 to 15", "Master sheet2_2043 Aged 16 to 64", "Master sheet2_2043 Aged 65+"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_population_projections;
INSERT INTO "Socioeconomics".lad25_population_projections (
  lad23cd,
  yr2018_all_ages, yr2018_aged_0_15, yr2018_aged_16_64, yr2018_aged_65_plus,
  yr2043_all_ages, yr2043_aged_0_15, yr2043_aged_16_64, yr2043_aged_65_plus
)
SELECT
  "LAD23CD",
  "Master sheet2_2018 All Ages", "Master sheet2_2018 Aged 0 to 15", "Master sheet2_2018 Aged 16 to 64", "Master sheet2_2018 Aged 65+",
  "Master sheet2_2043 All Ages", "Master sheet2_2043 Aged 0 to 15", "Master sheet2_2043 Aged 16 to 64", "Master sheet2_2043 Aged 65+"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_population_projections;
INSERT INTO "Socioeconomics".regions_population_projections (
  rgn24cd,
  yr2018_all_ages, yr2018_aged_0_15, yr2018_aged_16_64, yr2018_aged_65_plus,
  yr2043_all_ages, yr2043_aged_0_15, yr2043_aged_16_64, yr2043_aged_65_plus
)
SELECT
  "RGN24CD",
  "Master sheet2_2018 All Ages", "Master sheet2_2018 Aged 0 to 15", "Master sheet2_2018 Aged 16 to 64", "Master sheet2_2018 Aged 65+",
  "Master sheet2_2043 All Ages", "Master sheet2_2043 Aged 0 to 15", "Master sheet2_2043 Aged 16 to 64", "Master sheet2_2043 Aged 65+"
FROM "Socioeconomics"."Regions";
