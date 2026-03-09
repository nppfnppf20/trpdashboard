-- 06_occupation.sql
-- Populates occupation tables from Countries, LAD25, Regions source tables
-- All source column names are clean
-- Note: several source column names are truncated to 63 chars by PostgreSQL on import

TRUNCATE TABLE "Socioeconomics".countries_occupation;
INSERT INTO "Socioeconomics".countries_occupation (
  ctry24cd,
  occupation_total, occupation_total_pct,
  managers_directors, managers_directors_pct,
  professional, professional_pct,
  associate_professional, associate_professional_pct,
  administrative_secretarial, administrative_secretarial_pct,
  skilled_trades, skilled_trades_pct,
  caring_leisure, caring_leisure_pct,
  sales_customer_service, sales_customer_service_pct,
  process_plant_machine, process_plant_machine_pct,
  elementary, elementary_pct
)
SELECT
  "CTRY24CD",
  "Master sheet2_Occupation All usual residents",
  "Master sheet2_Occupation All usual residents percent",
  "Master sheet2_1. Managers, directors and senior officials",
  "Master sheet2_1. percent Managers, directors and senior officia",
  "Master sheet2_2. Professional occupations",
  "Master sheet2_2. percent Professional occupations",
  "Master sheet2_3. Associate professional and technical occupatio",
  "Master sheet2_3. percent Associate professional and technical o",
  "Master sheet2_4. Administrative and secretarial occupations",
  "Master sheet2_4. percent Administrative and secretarial occupat",
  "Master sheet2_5. Skilled trades occupations",
  "Master sheet2_Skilled percent",
  "Master sheet2_6. Caring, leisure and other service occupations",
  "Master sheet2_6. percent Caring, leisure and other service occu",
  "Master sheet2_7. Sales and customer service occupations",
  "Master sheet2_7. percent Sales and customer service occupations",
  "Master sheet2_8. Process, plant and machine operatives",
  "Master sheet2_8. percent Process, plant and machine operatives",
  "Master sheet2_9. Elementary occupations",
  "Master sheet2_9. Elementary occupations percent"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_occupation;
INSERT INTO "Socioeconomics".lad25_occupation (
  lad23cd,
  occupation_total, occupation_total_pct,
  managers_directors, managers_directors_pct,
  professional, professional_pct,
  associate_professional, associate_professional_pct,
  administrative_secretarial, administrative_secretarial_pct,
  skilled_trades, skilled_trades_pct,
  caring_leisure, caring_leisure_pct,
  sales_customer_service, sales_customer_service_pct,
  process_plant_machine, process_plant_machine_pct,
  elementary, elementary_pct
)
SELECT
  "LAD23CD",
  "Master sheet2_Occupation All usual residents",
  "Master sheet2_Occupation All usual residents percent",
  "Master sheet2_1. Managers, directors and senior officials",
  "Master sheet2_1. percent Managers, directors and senior officia",
  "Master sheet2_2. Professional occupations",
  "Master sheet2_2. percent Professional occupations",
  "Master sheet2_3. Associate professional and technical occupatio",
  "Master sheet2_3. percent Associate professional and technical o",
  "Master sheet2_4. Administrative and secretarial occupations",
  "Master sheet2_4. percent Administrative and secretarial occupat",
  "Master sheet2_5. Skilled trades occupations",
  "Master sheet2_Skilled percent",
  "Master sheet2_6. Caring, leisure and other service occupations",
  "Master sheet2_6. percent Caring, leisure and other service occu",
  "Master sheet2_7. Sales and customer service occupations",
  "Master sheet2_7. percent Sales and customer service occupations",
  "Master sheet2_8. Process, plant and machine operatives",
  "Master sheet2_8. percent Process, plant and machine operatives",
  "Master sheet2_9. Elementary occupations",
  "Master sheet2_9. Elementary occupations percent"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_occupation;
INSERT INTO "Socioeconomics".regions_occupation (
  rgn24cd,
  occupation_total, occupation_total_pct,
  managers_directors, managers_directors_pct,
  professional, professional_pct,
  associate_professional, associate_professional_pct,
  administrative_secretarial, administrative_secretarial_pct,
  skilled_trades, skilled_trades_pct,
  caring_leisure, caring_leisure_pct,
  sales_customer_service, sales_customer_service_pct,
  process_plant_machine, process_plant_machine_pct,
  elementary, elementary_pct
)
SELECT
  "RGN24CD",
  "Master sheet2_Occupation All usual residents",
  "Master sheet2_Occupation All usual residents percent",
  "Master sheet2_1. Managers, directors and senior officials",
  "Master sheet2_1. percent Managers, directors and senior officia",
  "Master sheet2_2. Professional occupations",
  "Master sheet2_2. percent Professional occupations",
  "Master sheet2_3. Associate professional and technical occupatio",
  "Master sheet2_3. percent Associate professional and technical o",
  "Master sheet2_4. Administrative and secretarial occupations",
  "Master sheet2_4. percent Administrative and secretarial occupat",
  "Master sheet2_5. Skilled trades occupations",
  "Master sheet2_Skilled percent",
  "Master sheet2_6. Caring, leisure and other service occupations",
  "Master sheet2_6. percent Caring, leisure and other service occu",
  "Master sheet2_7. Sales and customer service occupations",
  "Master sheet2_7. percent Sales and customer service occupations",
  "Master sheet2_8. Process, plant and machine operatives",
  "Master sheet2_8. percent Process, plant and machine operatives",
  "Master sheet2_9. Elementary occupations",
  "Master sheet2_9. Elementary occupations percent"
FROM "Socioeconomics"."Regions";
