// Heritage analysis using PostgreSQL functions
// These functions analyze listed buildings and conservation areas relative to a drawn polygon

// Main analysis function that returns detailed heritage analysis
export function buildHeritageAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_heritage($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Individual analysis functions for specific heritage types
export function buildListedBuildingsQuery(geojsonPolygon) {
  const text = `SELECT * FROM analyze_listed_buildings($1);`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildConservationAreasQuery(geojsonPolygon) {
  const text = `SELECT * FROM analyze_conservation_areas($1);`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

export function buildScheduledMonumentsQuery(geojsonPolygon) {
  const text = `SELECT * FROM analyze_scheduled_monuments($1);`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Landscape analysis using PostgreSQL functions
export function buildLandscapeAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_landscape($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Agricultural land analysis using PostgreSQL functions
export function buildAgLandAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_ag_land($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Renewables analysis using PostgreSQL functions
export function buildRenewablesAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_renewables($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Ecology analysis using PostgreSQL functions
export function buildEcologyAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_ecology($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Trees analysis using PostgreSQL functions
export function buildTreesAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_trees($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Airfields analysis using PostgreSQL functions
export function buildAirfieldsAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_airfields($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}

// Legacy function for backward compatibility (if needed)
export function buildAnalysisQuery(geojsonPolygon) {
  // For now, redirect to the new heritage analysis
  return buildHeritageAnalysisQuery(geojsonPolygon);
}


