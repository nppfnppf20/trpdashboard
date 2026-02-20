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
    SELECT *
    FROM "Socioeconomics"."Countries"
    WHERE ST_Intersects(
      geom,
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
    SELECT *
    FROM "Socioeconomics"."LAD25"
    WHERE ST_Intersects(
      geom,
      ST_Transform(ST_GeomFromGeoJSON($1), 27700)
    )
  `;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildRegionsQuery(geojsonPolygon) {
  const text = `
    SELECT *
    FROM "Socioeconomics"."Regions"
    WHERE ST_Intersects(
      geom,
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