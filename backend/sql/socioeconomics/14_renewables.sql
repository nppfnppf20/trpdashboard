-- 14_renewables.sql
-- Populates renewables tables from Countries, LAD25, Regions source tables
-- Run rename-socio-columns.js first to fix the blocked source column names.

TRUNCATE TABLE "Socioeconomics".countries_renewables;
INSERT INTO "Socioeconomics".countries_renewables (
  ctry24cd,
  local_authority_code, estimated_households,
  photovoltaics, onshore_wind, hydro, anaerobic_digestion,
  offshore_wind, wave_tidal, sewage_gas, landfill_gas,
  municipal_solid_waste, animal_biomass, plant_biomass,
  cofiring, total, ev_charging
)
SELECT
  "CTRY24CD",
  "Master sheet2_Local_Authority_Code",
  "Master sheet2_Estimated_number_of_households",
  "Master sheet2_Photovoltaics",
  "Master sheet2_Onshore Wind",
  "Master sheet2_Hydro",
  "Master sheet2_Anaerobic Digestion",
  "Master sheet2_Offshore Wind",
  "Master sheet2_Wave/Tidal",
  "Master sheet2_Sewage Gas",
  "Master sheet2_Landfill Gas",
  "Master sheet2_Municipal Solid Waste",
  "Master sheet2_Animal Biomass",
  "Master sheet2_Plant Biomass",
  "Master sheet2_Cofiring",
  "Master sheet2_Total",
  "Master sheet2_Elec Vehicle Charging"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_renewables;
INSERT INTO "Socioeconomics".lad25_renewables (
  lad23cd,
  local_authority_code, estimated_households,
  photovoltaics, onshore_wind, hydro, anaerobic_digestion,
  offshore_wind, wave_tidal, sewage_gas, landfill_gas,
  municipal_solid_waste, animal_biomass, plant_biomass,
  cofiring, total, ev_charging
)
SELECT
  "LAD23CD",
  "Master sheet2_Local_Authority_Code",
  "Master sheet2_Estimated_number_of_households",
  "Master sheet2_Photovoltaics",
  "Master sheet2_Onshore Wind",
  "Master sheet2_Hydro",
  "Master sheet2_Anaerobic Digestion",
  "Master sheet2_Offshore Wind",
  "Master sheet2_Wave/Tidal",
  "Master sheet2_Sewage Gas",
  "Master sheet2_Landfill Gas",
  "Master sheet2_Municipal Solid Waste",
  "Master sheet2_Animal Biomass",
  "Master sheet2_Plant Biomass",
  "Master sheet2_Cofiring",
  "Master sheet2_Total",
  "Master sheet2_Elec Vehicle Charging"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_renewables;
INSERT INTO "Socioeconomics".regions_renewables (
  rgn24cd,
  local_authority_code, estimated_households,
  photovoltaics, onshore_wind, hydro, anaerobic_digestion,
  offshore_wind, wave_tidal, sewage_gas, landfill_gas,
  municipal_solid_waste, animal_biomass, plant_biomass,
  cofiring, total, ev_charging
)
SELECT
  "RGN24CD",
  "Master sheet2_Local_Authority_Code",
  "Master sheet2_Estimated_number_of_households",
  "Master sheet2_Photovoltaics",
  "Master sheet2_Onshore Wind",
  "Master sheet2_Hydro",
  "Master sheet2_Anaerobic Digestion",
  "Master sheet2_Offshore Wind",
  "Master sheet2_Wave/Tidal",
  "Master sheet2_Sewage Gas",
  "Master sheet2_Landfill Gas",
  "Master sheet2_Municipal Solid Waste",
  "Master sheet2_Animal Biomass",
  "Master sheet2_Plant Biomass",
  "Master sheet2_Cofiring",
  "Master sheet2_Total",
  "Master sheet2_Elec Vehicle Charging"
FROM "Socioeconomics"."Regions";
