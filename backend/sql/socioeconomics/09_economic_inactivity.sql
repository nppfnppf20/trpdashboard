-- 09_economic_inactivity.sql
-- Populates economic_inactivity tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_economic_inactivity;
INSERT INTO "Socioeconomics".countries_economic_inactivity (
  ctry24cd,
  apeirt_no, apeirt_p,
  apeirs_no, apeirs_p,
  apeirf_no, apeirf_p,
  apeirts_no, apeirts_p,
  apeirlt_no, apeirlt_p,
  apeird_no, apeird_p,
  apeirt_no_2, apeirt_p_2,
  apeirt_no_3, apeirt_p_3
)
SELECT
  "CTRY24CD",
  "Master sheet2_APEIRTno", "Master sheet2_APEIRTp",
  "Master sheet2_APEIRSno", "Master sheet2_APEIRSp",
  "Master sheet2_APEIRFno", "Master sheet2_APEIRFp",
  "Master sheet2_APEIRTSno", "Master sheet2_APEIRTSp",
  "Master sheet2_APEIRLTno", "Master sheet2_APEIRLTp",
  "Master sheet2_APEIRDno", "Master sheet2_APEIRDp",
  "Master sheet2_APEIRTno_1", "Master sheet2_APEIRTp_1",
  "Master sheet2_APEIRTno_2", "Master sheet2_APEIRTp_2"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_economic_inactivity;
INSERT INTO "Socioeconomics".lad25_economic_inactivity (
  lad23cd,
  apeirt_no, apeirt_p,
  apeirs_no, apeirs_p,
  apeirf_no, apeirf_p,
  apeirts_no, apeirts_p,
  apeirlt_no, apeirlt_p,
  apeird_no, apeird_p,
  apeirt_no_2, apeirt_p_2,
  apeirt_no_3, apeirt_p_3
)
SELECT
  "LAD23CD",
  "Master sheet2_APEIRTno", "Master sheet2_APEIRTp",
  "Master sheet2_APEIRSno", "Master sheet2_APEIRSp",
  "Master sheet2_APEIRFno", "Master sheet2_APEIRFp",
  "Master sheet2_APEIRTSno", "Master sheet2_APEIRTSp",
  "Master sheet2_APEIRLTno", "Master sheet2_APEIRLTp",
  "Master sheet2_APEIRDno", "Master sheet2_APEIRDp",
  "Master sheet2_APEIRTno_1", "Master sheet2_APEIRTp_1",
  "Master sheet2_APEIRTno_2", "Master sheet2_APEIRTp_2"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_economic_inactivity;
INSERT INTO "Socioeconomics".regions_economic_inactivity (
  rgn24cd,
  apeirt_no, apeirt_p,
  apeirs_no, apeirs_p,
  apeirf_no, apeirf_p,
  apeirts_no, apeirts_p,
  apeirlt_no, apeirlt_p,
  apeird_no, apeird_p,
  apeirt_no_2, apeirt_p_2,
  apeirt_no_3, apeirt_p_3
)
SELECT
  "RGN24CD",
  "Master sheet2_APEIRTno", "Master sheet2_APEIRTp",
  "Master sheet2_APEIRSno", "Master sheet2_APEIRSp",
  "Master sheet2_APEIRFno", "Master sheet2_APEIRFp",
  "Master sheet2_APEIRTSno", "Master sheet2_APEIRTSp",
  "Master sheet2_APEIRLTno", "Master sheet2_APEIRLTp",
  "Master sheet2_APEIRDno", "Master sheet2_APEIRDp",
  "Master sheet2_APEIRTno_1", "Master sheet2_APEIRTp_1",
  "Master sheet2_APEIRTno_2", "Master sheet2_APEIRTp_2"
FROM "Socioeconomics"."Regions";
