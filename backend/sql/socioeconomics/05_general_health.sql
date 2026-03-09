-- 05_general_health.sql
-- Populates general_health tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_general_health;
INSERT INTO "Socioeconomics".countries_general_health (
  ctry24cd,
  health_total_residents, health_total_residents_pct,
  very_good_health, very_good_health_pct,
  good_health, good_health_pct,
  fair_health, fair_health_pct,
  bad_health, bad_health_pct,
  very_bad_health, very_bad_health_pct
)
SELECT
  "CTRY24CD",
  "Master sheet2_Health total residents",
  "Master sheet2_Health total residents percent",
  "Master sheet2_Very good health",
  "Master sheet2_Very good health percent",
  "Master sheet2_Good health",
  "Master sheet2_Good health percent",
  "Master sheet2_Fair health",
  "Master sheet2_Fair health percent",
  "Master sheet2_Bad health",
  "Master sheet2_Bad health percent",
  "Master sheet2_Very bad health",
  "Master sheet2_Very bad health percent"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_general_health;
INSERT INTO "Socioeconomics".lad25_general_health (
  lad23cd,
  health_total_residents, health_total_residents_pct,
  very_good_health, very_good_health_pct,
  good_health, good_health_pct,
  fair_health, fair_health_pct,
  bad_health, bad_health_pct,
  very_bad_health, very_bad_health_pct
)
SELECT
  "LAD23CD",
  "Master sheet2_Health total residents",
  "Master sheet2_Health total residents percent",
  "Master sheet2_Very good health",
  "Master sheet2_Very good health percent",
  "Master sheet2_Good health",
  "Master sheet2_Good health percent",
  "Master sheet2_Fair health",
  "Master sheet2_Fair health percent",
  "Master sheet2_Bad health",
  "Master sheet2_Bad health percent",
  "Master sheet2_Very bad health",
  "Master sheet2_Very bad health percent"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_general_health;
INSERT INTO "Socioeconomics".regions_general_health (
  rgn24cd,
  health_total_residents, health_total_residents_pct,
  very_good_health, very_good_health_pct,
  good_health, good_health_pct,
  fair_health, fair_health_pct,
  bad_health, bad_health_pct,
  very_bad_health, very_bad_health_pct
)
SELECT
  "RGN24CD",
  "Master sheet2_Health total residents",
  "Master sheet2_Health total residents percent",
  "Master sheet2_Very good health",
  "Master sheet2_Very good health percent",
  "Master sheet2_Good health",
  "Master sheet2_Good health percent",
  "Master sheet2_Fair health",
  "Master sheet2_Fair health percent",
  "Master sheet2_Bad health",
  "Master sheet2_Bad health percent",
  "Master sheet2_Very bad health",
  "Master sheet2_Very bad health percent"
FROM "Socioeconomics"."Regions";
