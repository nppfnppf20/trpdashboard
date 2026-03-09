-- 10_neet.sql
-- Populates neet tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_neet;
INSERT INTO "Socioeconomics".countries_neet (
  ctry24cd,
  quarter, sex, age, population,
  number_neet, percent_neet,
  percent_conf_interval_neet, percent_annual_change_neet,
  number_net, percent_net
)
SELECT
  "CTRY24CD",
  "Master sheet2_quarter", "Master sheet2_sex", "Master sheet2_age", "Master sheet2_population",
  "Master sheet2_number_NEET", "Master sheet2_percent_NEET",
  "Master sheet2_percent_conf_interval_plus_minus_NEET", "Master sheet2_percent_annual_change_NEET",
  "Master sheet2_number_NET", "Master sheet2_percent_NET"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_neet;
INSERT INTO "Socioeconomics".lad25_neet (
  lad23cd,
  quarter, sex, age, population,
  number_neet, percent_neet,
  percent_conf_interval_neet, percent_annual_change_neet,
  number_net, percent_net
)
SELECT
  "LAD23CD",
  "Master sheet2_quarter", "Master sheet2_sex", "Master sheet2_age", "Master sheet2_population",
  "Master sheet2_number_NEET", "Master sheet2_percent_NEET",
  "Master sheet2_percent_conf_interval_plus_minus_NEET", "Master sheet2_percent_annual_change_NEET",
  "Master sheet2_number_NET", "Master sheet2_percent_NET"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_neet;
INSERT INTO "Socioeconomics".regions_neet (
  rgn24cd,
  quarter, sex, age, population,
  number_neet, percent_neet,
  percent_conf_interval_neet, percent_annual_change_neet,
  number_net, percent_net
)
SELECT
  "RGN24CD",
  "Master sheet2_quarter", "Master sheet2_sex", "Master sheet2_age", "Master sheet2_population",
  "Master sheet2_number_NEET", "Master sheet2_percent_NEET",
  "Master sheet2_percent_conf_interval_plus_minus_NEET", "Master sheet2_percent_annual_change_NEET",
  "Master sheet2_number_NET", "Master sheet2_percent_NET"
FROM "Socioeconomics"."Regions";
