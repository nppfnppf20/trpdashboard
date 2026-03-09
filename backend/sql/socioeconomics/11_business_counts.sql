-- 11_business_counts.sql
-- Populates business_counts tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_business_counts;
INSERT INTO "Socioeconomics".countries_business_counts (ctry24cd, area, total, micro_0_9, small_10_49, medium_50_249, large_250_plus)
SELECT
  "CTRY24CD",
  "Master sheet2_Area",
  "Master sheet2_Total_1",
  "Master sheet2_Micro (0 to 9)",
  "Master sheet2_Small (10 to 49)",
  "Master sheet2_Medium-sized (50 to 249)",
  "Master sheet2_Large (250+)"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_business_counts;
INSERT INTO "Socioeconomics".lad25_business_counts (lad23cd, area, total, micro_0_9, small_10_49, medium_50_249, large_250_plus)
SELECT
  "LAD23CD",
  "Master sheet2_Area",
  "Master sheet2_Total_1",
  "Master sheet2_Micro (0 to 9)",
  "Master sheet2_Small (10 to 49)",
  "Master sheet2_Medium-sized (50 to 249)",
  "Master sheet2_Large (250+)"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_business_counts;
INSERT INTO "Socioeconomics".regions_business_counts (rgn24cd, area, total, micro_0_9, small_10_49, medium_50_249, large_250_plus)
SELECT
  "RGN24CD",
  "Master sheet2_Area",
  "Master sheet2_Total_1",
  "Master sheet2_Micro (0 to 9)",
  "Master sheet2_Small (10 to 49)",
  "Master sheet2_Medium-sized (50 to 249)",
  "Master sheet2_Large (250+)"
FROM "Socioeconomics"."Regions";
