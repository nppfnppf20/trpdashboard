// Layer factory functions for creating Leaflet layers with standardized styling
// Each function creates a properly configured layer for different data types

/**
 * Create conservation areas layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createConservationAreasLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#0ea5e9', weight: 2, fillOpacity: 0.15 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const n = f?.properties?.name || 'Conservation area';
      layer.bindPopup(n);
    }
  });
}

/**
 * Create listed buildings layer for a specific grade
 * @param {import('leaflet')} L - Leaflet instance
 * @param {'I' | 'II*' | 'II'} grade - Building grade
 * @returns {import('leaflet').GeoJSON}
 */
export function createListedBuildingsLayer(L, grade) {
  const styles = {
    'I': { color: '#dc2626', fillColor: '#dc2626' },
    'II*': { color: '#ea580c', fillColor: '#ea580c' },
    'II': { color: '#8b5cf6', fillColor: '#8b5cf6' }
  };

  const style = styles[grade];

  return L.geoJSON(null, {
    pointToLayer: (/** @type {any} */ feat, /** @type {any} */ latlng) => {
      return L.circleMarker(latlng, {
        radius: 6,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: 0.8,
        weight: 2
      });
    },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Listed building';
      layer.bindPopup(`${name}<br><strong>Grade ${grade}</strong>`);
    }
  });
}

/**
 * Create scheduled monuments layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createScheduledMonumentsLayer(L) {
  return L.geoJSON(null, {
    pointToLayer: (/** @type {any} */ feat, /** @type {any} */ latlng) => {
      const radius = 6; // Circle radius (same size as listed buildings)
      return L.circleMarker(latlng, {
        radius: radius,
        color: '#000000',        // Black border
        fillColor: '#ffed4e',    // Bright yellow fill
        fillOpacity: 0.8,
        weight: 3
      });
    },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Scheduled Monument';
      layer.bindPopup(`${name}<br><strong>Scheduled Monument</strong>`);
    }
  });
}

/**
 * Create green belt layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createGreenBeltLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#22c55e', weight: 3, fillOpacity: 0.2 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Green Belt';
      layer.bindPopup(`${name}<br><strong>Green Belt Area</strong>`);
    }
  });
}

/**
 * Create AONB layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createAONBLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#3b82f6', weight: 3, fillOpacity: 0.2 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'AONB';
      layer.bindPopup(`${name}<br><strong>Area of Outstanding Natural Beauty</strong>`);
    }
  });
}

/**
 * Create National Parks layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createNationalParksLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#a855f7', weight: 3, fillOpacity: 0.2 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'National Park';
      layer.bindPopup(`${name}<br><strong>National Park</strong>`);
    }
  });
}

/**
 * Create Registered Parks and Gardens layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createRegisteredParksGardensLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#f97316', weight: 3, fillOpacity: 0.2 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Registered Park/Garden';
      const grade = f?.properties?.grade || '';
      layer.bindPopup(`${name}<br><strong>Grade ${grade} Registered Park/Garden</strong>`);
    }
  });
}

/**
 * Create World Heritage Sites layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createWorldHeritageSitesLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#7c3aed', weight: 4, fillOpacity: 0.25 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'World Heritage Site';
      layer.bindPopup(`${name}<br><strong>UNESCO World Heritage Site</strong>`);
    }
  });
}

/**
 * Create renewables layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createRenewablesLayer(L) {
  const markerColor = '#ec4899'; // Pink for all points
  const radius = 5;

  return L.geoJSON(null, {
    pointToLayer: (/** @type {any} */ feat, /** @type {any} */ latlng) => {
      return L.circleMarker(latlng, {
        radius,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.8,
        weight: 2
      });
    },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const props = f.properties;
      const name = props.site_name || 'Renewable Development';
      const tech = props.technology_type || 'Unknown';
      const status = props.development_status_short || 'Unknown';
      const planningAuth = props.planning_authority || 'Unknown';
      const planningRef = props.planning_application_reference || '-';
      const appealRef = props.appeal_reference || '-';

      let popup = `
        <strong>${name}</strong><br>
        Technology: ${tech}<br>
        Status: ${status}<br>
        Planning Authority: ${planningAuth}<br>
        Planning Ref: ${planningRef}`;
      if (appealRef && appealRef !== '-') {
        popup += `<br>Appeal Ref: ${appealRef}`;
      }

      layer.bindPopup(popup);
    }
  });
}

/**
 * Create SSSI layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createSSSILayer(L) {
  return L.geoJSON(null, {
    style: { color: '#10b981', weight: 3, fillOpacity: 0.2 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'SSSI';
      const refCode = f?.properties?.ref_code || '';
      layer.bindPopup(`${name}<br><strong>Site of Special Scientific Interest</strong>${refCode ? '<br>Ref: ' + refCode : ''}`);
    }
  });
}

/**
 * Create National Nature Reserves layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createNationalNatureReservesLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#059669', weight: 4, fillOpacity: 0.25 },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'National Nature Reserve';
      const refCode = f?.properties?.ref_code || '';
      layer.bindPopup(`${name}<br><strong>National Nature Reserve</strong>${refCode ? '<br>Ref: ' + refCode : ''}`);
    }
  });
}

/**
 * Create Ancient Woodland layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createAncientWoodlandLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#065f46', weight: 3, fillOpacity: 0.3, fillColor: '#059669' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Ancient Woodland';
      const theme = f?.properties?.theme || '';
      layer.bindPopup(`${name}<br><strong>Ancient Woodland</strong>${theme ? '<br>Type: ' + theme : ''}`);
    }
  });
}

/**
 * Create UK Airports layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createUkAirportsLayer(L) {
  return L.geoJSON(null, {
    pointToLayer: (/** @type {any} */ feat, /** @type {any} */ latlng) => {
      return L.circleMarker(latlng, {
        radius: 8,
        color: '#1e3a8a',        // Dark blue border
        fillColor: '#3b82f6',    // Blue fill
        fillOpacity: 0.8,
        weight: 2
      });
    },
    style: { color: '#1e3a8a', weight: 2, fillOpacity: 0.3, fillColor: '#3b82f6' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'UK Airport';
      const aerowayType = f?.properties?.aeroway_type || '';
      const typeLabel = aerowayType ? aerowayType.charAt(0).toUpperCase() + aerowayType.slice(1) : 'Airport';
      layer.bindPopup(`${name}<br><strong>${typeLabel}</strong>`);
    }
  });
}

/**
 * Create Special Protection Areas (SPA) layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createSPALayer(L) {
  return L.geoJSON(null, {
    style: { color: '#8b5cf6', weight: 3, fillOpacity: 0.2, fillColor: '#a78bfa' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Special Protection Area';
      const code = f?.properties?.code || '';
      layer.bindPopup(`${name}<br><strong>Special Protection Area (SPA)</strong>${code ? '<br>Code: ' + code : ''}`);
    }
  });
}

/**
 * Create Special Areas of Conservation (SAC) layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createSACLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#ec4899', weight: 3, fillOpacity: 0.2, fillColor: '#f472b6' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Special Area of Conservation';
      const code = f?.properties?.code || '';
      layer.bindPopup(`${name}<br><strong>Special Area of Conservation (SAC)</strong>${code ? '<br>Code: ' + code : ''}`);
    }
  });
}

/**
 * Create Drinking Water Safeguard Zones (Surface Water) layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createDWSafeguardSurfaceLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#0284c7', weight: 3, fillOpacity: 0.25, fillColor: '#38bdf8' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Safeguard Zone';
      const coverage = f?.properties?.percentage_coverage;
      layer.bindPopup(`${name}<br><strong>Safeguard Zone (Surface Water)</strong>${coverage ? '<br>Coverage: ' + coverage.toFixed(1) + '%' : ''}`);
    }
  });
}

/**
 * Create Drinking Water Protected Areas (Surface Water) layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createDWProtectedSurfaceLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#7c3aed', weight: 3, fillOpacity: 0.25, fillColor: '#a78bfa' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Protected Area';
      const coverage = f?.properties?.percentage_coverage;
      layer.bindPopup(`${name}<br><strong>Protected Area (Surface Water)</strong>${coverage ? '<br>Coverage: ' + coverage.toFixed(1) + '%' : ''}`);
    }
  });
}

/**
 * Create Drinking Water Safeguard Zones (Groundwater) layer
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON}
 */
export function createDWSafeguardGroundwaterLayer(L) {
  return L.geoJSON(null, {
    style: { color: '#0d9488', weight: 3, fillOpacity: 0.25, fillColor: '#5eead4' },
    onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
      const name = f?.properties?.name || 'Safeguard Zone';
      const coverage = f?.properties?.percentage_coverage;
      layer.bindPopup(`${name}<br><strong>Safeguard Zone (Groundwater)</strong>${coverage ? '<br>Coverage: ' + coverage.toFixed(1) + '%' : ''}`);
    }
  });
}