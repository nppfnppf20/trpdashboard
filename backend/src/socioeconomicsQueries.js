/**
 * SQL queries for socioeconomic data analysis
 *
 * All queries use PostGIS spatial functions to find intersecting features
 * with a provided GeoJSON polygon (in WGS84/SRID 4326), which is transformed
 * to British National Grid (SRID 27700) for comparison.
 */

/**
 * Main socioeconomics analysis function
 * @param {Object} geojsonPolygon - GeoJSON polygon to query against
 * @returns {Object} Query object with text and values
 */
export function buildSocioeconomicsAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_socioeconomics($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

/**
 * Individual analysis functions for specific socioeconomic layers
 */

export function buildCountriesQuery(geojsonPolygon) {
  const text = `
    SELECT s.*,
      ei.apeirt_no, ei.apeirt_p,
      ei.apeirs_no, ei.apeirs_p,
      ei.apeirf_no, ei.apeirf_p,
      ei.apeirts_no, ei.apeirts_p,
      ei.apeirlt_no, ei.apeirlt_p,
      ei.apeird_no, ei.apeird_p,
      ei.apeirt_no_2, ei.apeirt_p_2,
      ei.apeirt_no_3, ei.apeirt_p_3,
      ut.jul17_jun18, ut.jul17_jun18_ea, ut.jul17_jun18_eap, ut.jul17_18_ue, ut.jul17_18_uep, ut.conf_1,
      ut.jul18_jun19, ut.jul18_jun19_ea, ut.jul18_jun19_eap, ut.jul18_19_ue, ut.jul18_19_uep, ut.conf_2,
      ut.jul19_jun20, ut.jul19_jun20_ea, ut.jul19_jun20_eap, ut.jul19_20_ue, ut.jul19_20_uep, ut.conf_3,
      ut.jul20_jun21, ut.jul20_jun21_ea, ut.jul20_jun21_eap, ut.jul20_21_ue, ut.jul20_21_uep, ut.conf_4,
      ut.jul21_jun22, ut.jul21_jun22_ea, ut.jul21_jun22_eap, ut.jul21_jun22_ue, ut.jul21_jun22_uep, ut.conf_5,
      ut.jul22_jun23, ut.jul22_jun23_ea, ut.jul22_jun23_eap, ut.jul22_jun23_ue, ut.jul22_jun23_uep, ut.conf_6,
      ut.jul23_jun24, ut.jul23_jun24_ea, ut.jul23_jun24_eap, ut.jul23_jun24_ue, ut.jul23_jun24_uep, ut.conf_7,
      ut.jul24_jun25, ut.jul24_jun25_ea, ut.jul24_jun25_eap, ut.jul24_jun25_ue, ut.jul24_jun25_uep, ut.conf_8,
      b.a_number, b.a_pct, b.b_number, b.b_pct, b.c_number, b.c_pct,
      b.d_number, b.d_pct, b.e_number, b.e_pct, b.f_number, b.f_pct,
      b.g_number, b.g_pct, b.h_number, b.h_pct, b.i_number, b.i_pct,
      b.j_number, b.j_pct, b.k_number, b.k_pct, b.l_number, b.l_pct,
      b.m_number, b.m_pct, b.n_number, b.n_pct, b.o_number, b.o_pct,
      b.p_number, b.p_pct, b.q_number, b.q_pct, b.r_number, b.r_pct,
      b.s_number, b.s_pct, b.bres_total
    FROM "Socioeconomics"."Countries" s
    LEFT JOIN "Socioeconomics".countries_economic_inactivity ei ON ei.ctry24cd = s."CTRY24CD"
    LEFT JOIN "Socioeconomics".countries_unemployment_timeseries ut ON ut.ctry24cd = s."CTRY24CD"
    LEFT JOIN "Socioeconomics".countries_bres b ON b.ctry24cd = s."CTRY24CD"
    WHERE ST_Intersects(
      s.geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildLAD11Query(geojsonPolygon) {
  const text = `
    SELECT *
    FROM "Socioeconomics"."LAD11"
    WHERE ST_Intersects(
      geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildLAD19Query(geojsonPolygon) {
  const text = `
    SELECT *
    FROM "Socioeconomics"."LAD19"
    WHERE ST_Intersects(
      geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildLAD25Query(geojsonPolygon) {
  const text = `
    SELECT s.*,
      ei.apeirt_no, ei.apeirt_p,
      ei.apeirs_no, ei.apeirs_p,
      ei.apeirf_no, ei.apeirf_p,
      ei.apeirts_no, ei.apeirts_p,
      ei.apeirlt_no, ei.apeirlt_p,
      ei.apeird_no, ei.apeird_p,
      ei.apeirt_no_2, ei.apeirt_p_2,
      ei.apeirt_no_3, ei.apeirt_p_3,
      ut.jul17_jun18, ut.jul17_jun18_ea, ut.jul17_jun18_eap, ut.jul17_18_ue, ut.jul17_18_uep, ut.conf_1,
      ut.jul18_jun19, ut.jul18_jun19_ea, ut.jul18_jun19_eap, ut.jul18_19_ue, ut.jul18_19_uep, ut.conf_2,
      ut.jul19_jun20, ut.jul19_jun20_ea, ut.jul19_jun20_eap, ut.jul19_20_ue, ut.jul19_20_uep, ut.conf_3,
      ut.jul20_jun21, ut.jul20_jun21_ea, ut.jul20_jun21_eap, ut.jul20_21_ue, ut.jul20_21_uep, ut.conf_4,
      ut.jul21_jun22, ut.jul21_jun22_ea, ut.jul21_jun22_eap, ut.jul21_jun22_ue, ut.jul21_jun22_uep, ut.conf_5,
      ut.jul22_jun23, ut.jul22_jun23_ea, ut.jul22_jun23_eap, ut.jul22_jun23_ue, ut.jul22_jun23_uep, ut.conf_6,
      ut.jul23_jun24, ut.jul23_jun24_ea, ut.jul23_jun24_eap, ut.jul23_jun24_ue, ut.jul23_jun24_uep, ut.conf_7,
      ut.jul24_jun25, ut.jul24_jun25_ea, ut.jul24_jun25_eap, ut.jul24_jun25_ue, ut.jul24_jun25_uep, ut.conf_8,
      b.a_number, b.a_pct, b.b_number, b.b_pct, b.c_number, b.c_pct,
      b.d_number, b.d_pct, b.e_number, b.e_pct, b.f_number, b.f_pct,
      b.g_number, b.g_pct, b.h_number, b.h_pct, b.i_number, b.i_pct,
      b.j_number, b.j_pct, b.k_number, b.k_pct, b.l_number, b.l_pct,
      b.m_number, b.m_pct, b.n_number, b.n_pct, b.o_number, b.o_pct,
      b.p_number, b.p_pct, b.q_number, b.q_pct, b.r_number, b.r_pct,
      b.s_number, b.s_pct, b.bres_total
    FROM "Socioeconomics"."LAD25" s
    LEFT JOIN "Socioeconomics".lad25_economic_inactivity ei ON ei.lad23cd = s."LAD23CD"
    LEFT JOIN "Socioeconomics".lad25_unemployment_timeseries ut ON ut.lad23cd = s."LAD23CD"
    LEFT JOIN "Socioeconomics".lad25_bres b ON b.lad23cd = s."LAD23CD"
    WHERE ST_Intersects(
      s.geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildRegionsQuery(geojsonPolygon) {
  const text = `
    SELECT s.*,
      ei.apeirt_no, ei.apeirt_p,
      ei.apeirs_no, ei.apeirs_p,
      ei.apeirf_no, ei.apeirf_p,
      ei.apeirts_no, ei.apeirts_p,
      ei.apeirlt_no, ei.apeirlt_p,
      ei.apeird_no, ei.apeird_p,
      ei.apeirt_no_2, ei.apeirt_p_2,
      ei.apeirt_no_3, ei.apeirt_p_3,
      ut.jul17_jun18, ut.jul17_jun18_ea, ut.jul17_jun18_eap, ut.jul17_18_ue, ut.jul17_18_uep, ut.conf_1,
      ut.jul18_jun19, ut.jul18_jun19_ea, ut.jul18_jun19_eap, ut.jul18_19_ue, ut.jul18_19_uep, ut.conf_2,
      ut.jul19_jun20, ut.jul19_jun20_ea, ut.jul19_jun20_eap, ut.jul19_20_ue, ut.jul19_20_uep, ut.conf_3,
      ut.jul20_jun21, ut.jul20_jun21_ea, ut.jul20_jun21_eap, ut.jul20_21_ue, ut.jul20_21_uep, ut.conf_4,
      ut.jul21_jun22, ut.jul21_jun22_ea, ut.jul21_jun22_eap, ut.jul21_jun22_ue, ut.jul21_jun22_uep, ut.conf_5,
      ut.jul22_jun23, ut.jul22_jun23_ea, ut.jul22_jun23_eap, ut.jul22_jun23_ue, ut.jul22_jun23_uep, ut.conf_6,
      ut.jul23_jun24, ut.jul23_jun24_ea, ut.jul23_jun24_eap, ut.jul23_jun24_ue, ut.jul23_jun24_uep, ut.conf_7,
      ut.jul24_jun25, ut.jul24_jun25_ea, ut.jul24_jun25_eap, ut.jul24_jun25_ue, ut.jul24_jun25_uep, ut.conf_8,
      b.a_number, b.a_pct, b.b_number, b.b_pct, b.c_number, b.c_pct,
      b.d_number, b.d_pct, b.e_number, b.e_pct, b.f_number, b.f_pct,
      b.g_number, b.g_pct, b.h_number, b.h_pct, b.i_number, b.i_pct,
      b.j_number, b.j_pct, b.k_number, b.k_pct, b.l_number, b.l_pct,
      b.m_number, b.m_pct, b.n_number, b.n_pct, b.o_number, b.o_pct,
      b.p_number, b.p_pct, b.q_number, b.q_pct, b.r_number, b.r_pct,
      b.s_number, b.s_pct, b.bres_total
    FROM "Socioeconomics"."Regions" s
    LEFT JOIN "Socioeconomics".regions_economic_inactivity ei ON ei.rgn24cd = s."RGN24CD"
    LEFT JOIN "Socioeconomics".regions_unemployment_timeseries ut ON ut.rgn24cd = s."RGN24CD"
    LEFT JOIN "Socioeconomics".regions_bres b ON b.rgn24cd = s."RGN24CD"
    WHERE ST_Intersects(
      s.geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildSocioecQuery(geojsonPolygon) {
  const text = `
    SELECT *
    FROM "Socioeconomics"."socioec"
    WHERE ST_Intersects(
      geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

/**
 * Get all socioeconomic spatial queries
 * @param {Object} geojsonPolygon - GeoJSON polygon to query against
 * @returns {Array} Array of query definitions with name and parameterized query
 */
export function getSocioeconomicsQueries(geojsonPolygon) {
  return [
    {
      name: 'Countries',
      query: buildCountriesQuery(geojsonPolygon)
    },
    {
      name: 'LAD11',
      query: buildLAD11Query(geojsonPolygon)
    },
    {
      name: 'LAD19',
      query: buildLAD19Query(geojsonPolygon)
    },
    {
      name: 'LAD25',
      query: buildLAD25Query(geojsonPolygon)
    },
    {
      name: 'Regions',
      query: buildRegionsQuery(geojsonPolygon)
    }
  ];
}

/**
 * Get geographic name and code fields for each layer type
 * @param {string} layerName - Name of the geographic layer
 * @param {Object} row - Database row object
 * @returns {Object} Object with geo_name and geo_code fields
 */
export function getGeoIdentifiers(layerName, row) {
  let geoName = '';
  let geoCode = '';

  switch(layerName) {
    case 'Countries':
      geoName = row.CTRY24NM || '';
      geoCode = row.CTRY24CD || '';
      break;
    case 'LAD11':
      geoName = row.lad11nm || '';
      geoCode = row.lad11cd || '';
      break;
    case 'LAD19':
      geoName = row.lad19nm || '';
      geoCode = row.lad19cd || '';
      break;
    case 'LAD25':
      geoName = row.LAD23NM || row.LAD25NM || '';
      geoCode = row.LAD23CD || row.LAD25CD || '';
      break;
    case 'Regions':
      geoName = row.RGN24NM || '';
      geoCode = row.RGN24CD || '';
      break;
    case 'socioec':
      geoName = row.name || row.area_name || '';
      geoCode = row.code || row.area_code || '';
      break;
  }

  return { geo_name: geoName, geo_code: geoCode };
}