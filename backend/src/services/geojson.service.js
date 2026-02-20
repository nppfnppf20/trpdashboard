/**
 * GeoJSON Service
 * Provides reusable functions to convert database rows into GeoJSON FeatureCollections
 */

/**
 * Build GeoJSON FeatureCollection for REPD data
 */
export function buildREPDGeoJSON(rows) {
  const features = rows.map(row => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [row.longitude, row.latitude]
    },
    properties: {
      ref_id: row['Ref ID'],
      site_name: row['Site Name'],
      operator: row['Operator (or Applicant)'],
      technology_type: row['Technology Type'],
      capacity: row['Installed Capacity (MWelec)'],
      dev_status: row['Development Status'],
      dev_status_short: row['Development Status (short)'],
      address: row['Address'],
      county: row['County'],
      postcode: row['Post Code'],
      last_updated: row['Record Last Updated (dd/mm/yyyy)'],
      planning_ref: row['Planning Application Reference']
    }
  }));

  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Build GeoJSON FeatureCollection for Renewables/DataCentres (Planit data)
 */
export function buildPlanitGeoJSON(rows) {
  const features = rows.map(row => ({
    type: 'Feature',
    geometry: row.geometry,
    properties: {
      id: row.id,
      uid: row.uid,
      name: row.name,
      description: row.description,
      address: row.address,
      postcode: row.postcode,
      area_name: row.area_name,
      app_type: row.app_type,
      application_type: row.application_type,
      app_state: row.app_state,
      decision: row.decision,
      start_date: row.start_date,
      decided_date: row.decided_date,
      url: row.url,
      latitude: row.latitude,
      longitude: row.longitude,
      dismissed: row.dismissed
    }
  }));

  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Build GeoJSON FeatureCollection for TRP projects
 */
export function buildTRPGeoJSON(rows, includeExtraFields = false) {
  const features = rows.map(row => {
    const properties = {
      id: row.id,
      name: row.name,
      description: row.description
    };

    // Some TRP tables have extra fields
    if (includeExtraFields && row.field_4) {
      properties.field_4 = row.field_4;
      properties.field_5 = row.field_5;
    }

    return {
      type: 'Feature',
      geometry: row.geometry,
      properties
    };
  });

  return {
    type: 'FeatureCollection',
    features: features
  };
}

/**
 * Build GeoJSON FeatureCollection for Projects (with polygon centroids)
 */
export function buildProjectsGeoJSON(rows) {
  const features = rows
    .map(row => {
      try {
        // Parse the polygon GeoJSON string
        const geojson = JSON.parse(row.polygon_geojson);

        // Calculate centroid from polygon coordinates
        let centroid;
        if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
          const coords = geojson.coordinates[0];
          const sum = coords.reduce((acc, coord) => {
            return [acc[0] + coord[0], acc[1] + coord[1]];
          }, [0, 0]);
          centroid = {
            type: 'Point',
            coordinates: [sum[0] / coords.length, sum[1] / coords.length]
          };
        } else if (geojson.type === 'Point') {
          centroid = geojson;
        } else {
          return null; // Skip if geometry type is not supported
        }

        return {
          type: 'Feature',
          geometry: centroid,
          properties: {
            id: row.id,
            unique_id: row.unique_id,
            project_id: row.project_id,
            project_name: row.project_name,
            address: row.address,
            area: row.area,
            client: row.client,
            client_spv_name: row.client_spv_name,
            sector: row.sector,
            sub_sector: row.sub_sector,
            local_planning_authority: row.local_planning_authority,
            project_lead: row.project_lead,
            project_manager: row.project_manager,
            project_director: row.project_director,
            designations_on_site: row.designations_on_site,
            relevant_nearby_designations: row.relevant_nearby_designations,
            created_at: row.created_at,
            updated_at: row.updated_at
          }
        };
      } catch (error) {
        console.warn(`Failed to parse polygon_geojson for project ${row.id}:`, error.message);
        return null;
      }
    })
    .filter(feature => feature !== null);

  return {
    type: 'FeatureCollection',
    features: features
  };
}

