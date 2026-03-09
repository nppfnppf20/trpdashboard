-- 12_bres.sql
-- Populates bres tables from Countries, LAD25, Regions source tables
-- All source column names are clean

TRUNCATE TABLE "Socioeconomics".countries_bres;
INSERT INTO "Socioeconomics".countries_bres (
  ctry24cd,
  a_number, a_pct, b_number, b_pct, c_number, c_pct,
  d_number, d_pct, e_number, e_pct, f_number, f_pct,
  g_number, g_pct, h_number, h_pct, i_number, i_pct,
  j_number, j_pct, k_number, k_pct, l_number, l_pct,
  m_number, m_pct, n_number, n_pct, o_number, o_pct,
  p_number, p_pct, q_number, q_pct, r_number, r_pct,
  s_number, s_pct, bres_total
)
SELECT
  "CTRY24CD",
  "Master sheet2_A number", "Master sheet2_A percent",
  "Master sheet2_B number", "Master sheet2_B percent",
  "Master sheet2_C number", "Master sheet2_C percent",
  "Master sheet2_D number", "Master sheet2_D percent",
  "Master sheet2_E number", "Master sheet2_E percent",
  "Master sheet2_F number", "Master sheet2_F percent",
  "Master sheet2_G number", "Master sheet2_G percent",
  "Master sheet2_H number", "Master sheet2_H percent",
  "Master sheet2_I number", "Master sheet2_I percent",
  "Master sheet2_J number", "Master sheet2_J percent",
  "Master sheet2_K number", "Master sheet2_K percent",
  "Master sheet2_L number", "Master sheet2_L percent",
  "Master sheet2_M number", "Master sheet2_M percent",
  "Master sheet2_N number", "Master sheet2_N percent",
  "Master sheet2_O number", "Master sheet2_O percent",
  "Master sheet2_P number", "Master sheet2_P percent",
  "Master sheet2_Q number", "Master sheet2_Q percent",
  "Master sheet2_R number", "Master sheet2_R percent",
  "Master sheet2_S number", "Master sheet2_S percent",
  "Master sheet2_BRES Total"
FROM "Socioeconomics"."Countries";

TRUNCATE TABLE "Socioeconomics".lad25_bres;
INSERT INTO "Socioeconomics".lad25_bres (
  lad23cd,
  a_number, a_pct, b_number, b_pct, c_number, c_pct,
  d_number, d_pct, e_number, e_pct, f_number, f_pct,
  g_number, g_pct, h_number, h_pct, i_number, i_pct,
  j_number, j_pct, k_number, k_pct, l_number, l_pct,
  m_number, m_pct, n_number, n_pct, o_number, o_pct,
  p_number, p_pct, q_number, q_pct, r_number, r_pct,
  s_number, s_pct, bres_total
)
SELECT
  "LAD23CD",
  "Master sheet2_A number", "Master sheet2_A percent",
  "Master sheet2_B number", "Master sheet2_B percent",
  "Master sheet2_C number", "Master sheet2_C percent",
  "Master sheet2_D number", "Master sheet2_D percent",
  "Master sheet2_E number", "Master sheet2_E percent",
  "Master sheet2_F number", "Master sheet2_F percent",
  "Master sheet2_G number", "Master sheet2_G percent",
  "Master sheet2_H number", "Master sheet2_H percent",
  "Master sheet2_I number", "Master sheet2_I percent",
  "Master sheet2_J number", "Master sheet2_J percent",
  "Master sheet2_K number", "Master sheet2_K percent",
  "Master sheet2_L number", "Master sheet2_L percent",
  "Master sheet2_M number", "Master sheet2_M percent",
  "Master sheet2_N number", "Master sheet2_N percent",
  "Master sheet2_O number", "Master sheet2_O percent",
  "Master sheet2_P number", "Master sheet2_P percent",
  "Master sheet2_Q number", "Master sheet2_Q percent",
  "Master sheet2_R number", "Master sheet2_R percent",
  "Master sheet2_S number", "Master sheet2_S percent",
  "Master sheet2_BRES Total"
FROM "Socioeconomics"."LAD25";

TRUNCATE TABLE "Socioeconomics".regions_bres;
INSERT INTO "Socioeconomics".regions_bres (
  rgn24cd,
  a_number, a_pct, b_number, b_pct, c_number, c_pct,
  d_number, d_pct, e_number, e_pct, f_number, f_pct,
  g_number, g_pct, h_number, h_pct, i_number, i_pct,
  j_number, j_pct, k_number, k_pct, l_number, l_pct,
  m_number, m_pct, n_number, n_pct, o_number, o_pct,
  p_number, p_pct, q_number, q_pct, r_number, r_pct,
  s_number, s_pct, bres_total
)
SELECT
  "RGN24CD",
  "Master sheet2_A number", "Master sheet2_A percent",
  "Master sheet2_B number", "Master sheet2_B percent",
  "Master sheet2_C number", "Master sheet2_C percent",
  "Master sheet2_D number", "Master sheet2_D percent",
  "Master sheet2_E number", "Master sheet2_E percent",
  "Master sheet2_F number", "Master sheet2_F percent",
  "Master sheet2_G number", "Master sheet2_G percent",
  "Master sheet2_H number", "Master sheet2_H percent",
  "Master sheet2_I number", "Master sheet2_I percent",
  "Master sheet2_J number", "Master sheet2_J percent",
  "Master sheet2_K number", "Master sheet2_K percent",
  "Master sheet2_L number", "Master sheet2_L percent",
  "Master sheet2_M number", "Master sheet2_M percent",
  "Master sheet2_N number", "Master sheet2_N percent",
  "Master sheet2_O number", "Master sheet2_O percent",
  "Master sheet2_P number", "Master sheet2_P percent",
  "Master sheet2_Q number", "Master sheet2_Q percent",
  "Master sheet2_R number", "Master sheet2_R percent",
  "Master sheet2_S number", "Master sheet2_S percent",
  "Master sheet2_BRES Total"
FROM "Socioeconomics"."Regions";
