-- 08_unemployment_timeseries.sql
-- Populates unemployment_timeseries tables from Countries, LAD25, Regions source tables
-- All source column names are clean
-- Note: source uses "Ju20-Jun21" (typo) for the jul20 period — stored exactly as-is in Postgres

TRUNCATE TABLE "Socioeconomics".countries_unemployment_timeseries;
INSERT INTO "Socioeconomics".countries_unemployment_timeseries (
  ctry24cd,
  jul17_jun18, jul17_jun18_ea, jul17_jun18_eap, jul17_18_ue, jul17_18_uep, conf_1,
  jul18_jun19, jul18_jun19_ea, jul18_jun19_eap, jul18_19_ue, jul18_19_uep, conf_2,
  jul19_jun20, jul19_jun20_ea, jul19_jun20_eap, jul19_20_ue, jul19_20_uep, conf_3,
  jul20_jun21, jul20_jun21_ea, jul20_jun21_eap, jul20_21_ue, jul20_21_uep, conf_4,
  jul21_jun22, jul21_jun22_ea, jul21_jun22_eap, jul21_jun22_ue, jul21_jun22_uep, conf_5,
  jul22_jun23, jul22_jun23_ea, jul22_jun23_eap, jul22_jun23_ue, jul22_jun23_uep, conf_6,
  jul23_jun24, jul23_jun24_ea, jul23_jun24_eap, jul23_jun24_ue, jul23_jun24_uep, conf_7,
  jul24_jun25, jul24_jun25_ea, jul24_jun25_eap, jul24_jun25_ue, jul24_jun25_uep, conf_8
)
SELECT
  "CTRY24CD",
  "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-Jun18EAP", "Master sheet2_Jul17-18UE", "Master sheet2_Jul17-18UEP", "Master sheet2_Conf",
  "Master sheet2_Jul18-Jun19", "Master sheet2_Jul18-Jun19EA", "Master sheet2_Jul18-Jun19EAP", "Master sheet2_Jul18-19UE", "Master sheet2_Jul18-19UEP", "Master sheet2_Conf_1",
  "Master sheet2_Jul19-Jun20", "Master sheet2_Jul19-Jun20EA", "Master sheet2_Jul19-Jun20EAP", "Master sheet2_Jul19-20UE", "Master sheet2_Jul19-20UEP", "Master sheet2_Conf_2",
  "Master sheet2_Jul20-Jun21", "Master sheet2_Ju20-Jun21EA", "Master sheet2_Ju20-Jun21EAP", "Master sheet2_Jul20-21UE", "Master sheet2_Jul20-21UEP", "Master sheet2_Conf_3",
  "Master sheet2_Jul21-Jun22", "Master sheet2_Jul21-Jun22EA", "Master sheet2_Jul21-Jun22EAP", "Master sheet2_Jul21-Jun22UE", "Master sheet2_Jul21-Jun22UEP", "Master sheet2_Conf_4",
  "Master sheet2_Jul22-Jun23", "Master sheet2_Jul22-Jun23EA", "Master sheet2_Jul22-Jun23EAP", "Master sheet2_Jul22-Jun23UE", "Master sheet2_Jul22-Jun23UEP", "Master sheet2_Conf_5",
  "Master sheet2_Jul23-Jun24", "Master sheet2_Jul23-Jun24EA", "Master sheet2_Jul23-Jun24EAP", "Master sheet2_Jul23-Jun24UE", "Master sheet2_Jul23-Jun24UEP", "Master sheet2_Conf_6",
  "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25EA", "Master sheet2_Jul24-Jun25EAP", "Master sheet2_Jul24-Jun25UE", "Master sheet2_Jul24-Jun25UEP", "Master sheet2_Conf_7"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_unemployment_timeseries;
INSERT INTO "Socioeconomics".lad25_unemployment_timeseries (
  lad23cd,
  jul17_jun18, jul17_jun18_ea, jul17_jun18_eap, jul17_18_ue, jul17_18_uep, conf_1,
  jul18_jun19, jul18_jun19_ea, jul18_jun19_eap, jul18_19_ue, jul18_19_uep, conf_2,
  jul19_jun20, jul19_jun20_ea, jul19_jun20_eap, jul19_20_ue, jul19_20_uep, conf_3,
  jul20_jun21, jul20_jun21_ea, jul20_jun21_eap, jul20_21_ue, jul20_21_uep, conf_4,
  jul21_jun22, jul21_jun22_ea, jul21_jun22_eap, jul21_jun22_ue, jul21_jun22_uep, conf_5,
  jul22_jun23, jul22_jun23_ea, jul22_jun23_eap, jul22_jun23_ue, jul22_jun23_uep, conf_6,
  jul23_jun24, jul23_jun24_ea, jul23_jun24_eap, jul23_jun24_ue, jul23_jun24_uep, conf_7,
  jul24_jun25, jul24_jun25_ea, jul24_jun25_eap, jul24_jun25_ue, jul24_jun25_uep, conf_8
)
SELECT
  "LAD23CD",
  "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-Jun18EAP", "Master sheet2_Jul17-18UE", "Master sheet2_Jul17-18UEP", "Master sheet2_Conf",
  "Master sheet2_Jul18-Jun19", "Master sheet2_Jul18-Jun19EA", "Master sheet2_Jul18-Jun19EAP", "Master sheet2_Jul18-19UE", "Master sheet2_Jul18-19UEP", "Master sheet2_Conf_1",
  "Master sheet2_Jul19-Jun20", "Master sheet2_Jul19-Jun20EA", "Master sheet2_Jul19-Jun20EAP", "Master sheet2_Jul19-20UE", "Master sheet2_Jul19-20UEP", "Master sheet2_Conf_2",
  "Master sheet2_Jul20-Jun21", "Master sheet2_Ju20-Jun21EA", "Master sheet2_Ju20-Jun21EAP", "Master sheet2_Jul20-21UE", "Master sheet2_Jul20-21UEP", "Master sheet2_Conf_3",
  "Master sheet2_Jul21-Jun22", "Master sheet2_Jul21-Jun22EA", "Master sheet2_Jul21-Jun22EAP", "Master sheet2_Jul21-Jun22UE", "Master sheet2_Jul21-Jun22UEP", "Master sheet2_Conf_4",
  "Master sheet2_Jul22-Jun23", "Master sheet2_Jul22-Jun23EA", "Master sheet2_Jul22-Jun23EAP", "Master sheet2_Jul22-Jun23UE", "Master sheet2_Jul22-Jun23UEP", "Master sheet2_Conf_5",
  "Master sheet2_Jul23-Jun24", "Master sheet2_Jul23-Jun24EA", "Master sheet2_Jul23-Jun24EAP", "Master sheet2_Jul23-Jun24UE", "Master sheet2_Jul23-Jun24UEP", "Master sheet2_Conf_6",
  "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25EA", "Master sheet2_Jul24-Jun25EAP", "Master sheet2_Jul24-Jun25UE", "Master sheet2_Jul24-Jun25UEP", "Master sheet2_Conf_7"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_unemployment_timeseries;
INSERT INTO "Socioeconomics".regions_unemployment_timeseries (
  rgn24cd,
  jul17_jun18, jul17_jun18_ea, jul17_jun18_eap, jul17_18_ue, jul17_18_uep, conf_1,
  jul18_jun19, jul18_jun19_ea, jul18_jun19_eap, jul18_19_ue, jul18_19_uep, conf_2,
  jul19_jun20, jul19_jun20_ea, jul19_jun20_eap, jul19_20_ue, jul19_20_uep, conf_3,
  jul20_jun21, jul20_jun21_ea, jul20_jun21_eap, jul20_21_ue, jul20_21_uep, conf_4,
  jul21_jun22, jul21_jun22_ea, jul21_jun22_eap, jul21_jun22_ue, jul21_jun22_uep, conf_5,
  jul22_jun23, jul22_jun23_ea, jul22_jun23_eap, jul22_jun23_ue, jul22_jun23_uep, conf_6,
  jul23_jun24, jul23_jun24_ea, jul23_jun24_eap, jul23_jun24_ue, jul23_jun24_uep, conf_7,
  jul24_jun25, jul24_jun25_ea, jul24_jun25_eap, jul24_jun25_ue, jul24_jun25_uep, conf_8
)
SELECT
  "RGN24CD",
  "Master sheet2_Jul17-Jun18", "Master sheet2_Jul17-Jun18EA", "Master sheet2_Jul17-Jun18EAP", "Master sheet2_Jul17-18UE", "Master sheet2_Jul17-18UEP", "Master sheet2_Conf",
  "Master sheet2_Jul18-Jun19", "Master sheet2_Jul18-Jun19EA", "Master sheet2_Jul18-Jun19EAP", "Master sheet2_Jul18-19UE", "Master sheet2_Jul18-19UEP", "Master sheet2_Conf_1",
  "Master sheet2_Jul19-Jun20", "Master sheet2_Jul19-Jun20EA", "Master sheet2_Jul19-Jun20EAP", "Master sheet2_Jul19-20UE", "Master sheet2_Jul19-20UEP", "Master sheet2_Conf_2",
  "Master sheet2_Jul20-Jun21", "Master sheet2_Ju20-Jun21EA", "Master sheet2_Ju20-Jun21EAP", "Master sheet2_Jul20-21UE", "Master sheet2_Jul20-21UEP", "Master sheet2_Conf_3",
  "Master sheet2_Jul21-Jun22", "Master sheet2_Jul21-Jun22EA", "Master sheet2_Jul21-Jun22EAP", "Master sheet2_Jul21-Jun22UE", "Master sheet2_Jul21-Jun22UEP", "Master sheet2_Conf_4",
  "Master sheet2_Jul22-Jun23", "Master sheet2_Jul22-Jun23EA", "Master sheet2_Jul22-Jun23EAP", "Master sheet2_Jul22-Jun23UE", "Master sheet2_Jul22-Jun23UEP", "Master sheet2_Conf_5",
  "Master sheet2_Jul23-Jun24", "Master sheet2_Jul23-Jun24EA", "Master sheet2_Jul23-Jun24EAP", "Master sheet2_Jul23-Jun24UE", "Master sheet2_Jul23-Jun24UEP", "Master sheet2_Conf_6",
  "Master sheet2_Jul24-Jun25", "Master sheet2_Jul24-Jun25EA", "Master sheet2_Jul24-Jun25EAP", "Master sheet2_Jul24-Jun25UE", "Master sheet2_Jul24-Jun25UEP", "Master sheet2_Conf_7"
FROM "Socioeconomics"."Regions";
