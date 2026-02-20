<script>
  import { onMount } from 'svelte';

  /** @type {HTMLDivElement | null} */
  let mapContainer = null;
  /** @type {import('leaflet').Map | null} */
  let map = null;

  /** @type {(geojson: any) => void} */
  export let onPolygonDrawn = (geojson) => {};
  /** @type {Record<string, any> | null} */
  export let heritageData = null;

  /** @type {import('leaflet').GeoJSON | null} */
  let conservationAreasLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let listedBuildingsLayer = null;
  /** @type {any} */
  let layerControl = null;
  /** @type {any} */
  let legend = null;
  /** @type {any} */
  let riskFilterControl = null;

  // Risk level filter state
  /** @type {Record<string, boolean>} */
  let riskFilters = {
    'showstopper': true,
    'extremely_high_risk': true,
    'high_risk': true,
    'medium_high_risk': true,
    'medium_risk': true,
    'medium_low_risk': true,
    'low_risk': true
  };

  /**
   * Determine risk level for a listed building based on its properties
   * @param {any} building
   */
  function getBuildingRiskLevel(building) {
    const { on_site, grade, dist_m } = building;

    // Grade I
    if (grade === 'I') {
      if (on_site) return 'showstopper';
      if (dist_m <= 100) return 'extremely_high_risk';
      if (dist_m <= 500) return 'high_risk';
      if (dist_m <= 1000) return 'medium_high_risk';
      if (dist_m <= 5000) return 'medium_risk';
      return 'low_risk';
    }

    // Grade II*
    if (grade === 'II*') {
      if (on_site) return 'extremely_high_risk';
      if (dist_m <= 100) return 'extremely_high_risk';
      if (dist_m <= 500) return 'high_risk';
      if (dist_m <= 5000) return 'medium_risk';
      return 'low_risk';
    }

    // Grade II
    if (grade === 'II') {
      if (on_site) return 'extremely_high_risk';
      if (dist_m <= 100) return 'high_risk';
      if (dist_m <= 250) return 'medium_risk';
      if (dist_m <= 5000) return 'medium_low_risk';
      return 'low_risk';
    }

    return 'low_risk';
  }

  /**
   * Determine risk level for a conservation area based on its properties
   * @param {any} area
   */
  function getConservationAreaRiskLevel(area) {
    if (area.on_site) return 'high_risk';
    if (area.within_250m) return 'medium_risk';
    return 'low_risk';
  }

  /**
   * Check if a feature should be visible based on current risk filters
   * @param {string} riskLevel
   */
  function isRiskLevelVisible(riskLevel) {
    return riskFilters[riskLevel] === true;
  }


  /**
   * Update layer visibility based on current risk filter settings
   */
  function updateLayerVisibility() {
    if (!conservationAreasLayer || !listedBuildingsLayer) return;

    // Refresh layers with current filter settings
    if (heritageData?.conservation_areas) {
      setLayerData(conservationAreasLayer, heritageData.conservation_areas, (r) => ({ 
        name: r.name,
        riskLevel: getConservationAreaRiskLevel(r)
      }), true);
    }

    if (heritageData?.listed_buildings) {
      setLayerData(listedBuildingsLayer, heritageData.listed_buildings, (r) => ({ 
        name: r.name, 
        grade: r.grade,
        riskLevel: getBuildingRiskLevel(r)
      }), true);
    }
  }

  /** @param {string} href */
  onMount(async () => {
    // Lazy-import Leaflet only on client
    const L = (await import('leaflet')).default;
    // Bring in leaflet-draw for side effects (no typings)
    await import('leaflet-draw');

    map = L.map(mapContainer).setView([51.505, -0.09], 13);

    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Overlay: Conservation Areas
    conservationAreasLayer = L.geoJSON(null, {
      style: { color: '#0ea5e9', weight: 2, fillOpacity: 0.15 },
      onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
        const n = f?.properties?.name || 'Conservation area';
        layer.bindPopup(n);
      }
    });

    // Overlay: Listed Buildings (points)
    listedBuildingsLayer = L.geoJSON(null, {
      pointToLayer: (/** @type {any} */ feat, /** @type {any} */ latlng) => {
        const grade = feat?.properties?.grade || '';
        const color = grade === 'I' ? '#dc2626' : grade.includes('II*') ? '#ea580c' : '#8b5cf6';
        return L.circleMarker(latlng, { radius: 6, color, fillColor: color, fillOpacity: 0.8, weight: 2 });
      },
      onEachFeature: (/** @type {any} */ f, /** @type {any} */ layer) => {
        const name = f?.properties?.name || 'Listed building';
        const grade = f?.properties?.grade || '';
        layer.bindPopup(`${name}<br><strong>Grade ${grade}</strong>`);
      }
    });

    // Layer control
    layerControl = L.control.layers(
      { 'OSM': base },
      { 
        'Conservation areas': conservationAreasLayer,
        'Listed buildings': listedBuildingsLayer
      },
      { collapsed: false }
    ).addTo(map);

    // Custom legend
    legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-content">
          <h4>Heritage Assets</h4>
          <div class="legend-section">
            <div class="legend-title">Listed Buildings</div>
            <div class="legend-item">
              <span class="legend-symbol" style="background: #dc2626;"></span>
              Grade I
            </div>
            <div class="legend-item">
              <span class="legend-symbol" style="background: #ea580c;"></span>
              Grade II*
            </div>
            <div class="legend-item">
              <span class="legend-symbol" style="background: #8b5cf6;"></span>
              Grade II
            </div>
          </div>
          <div class="legend-section">
            <div class="legend-title">Conservation Areas</div>
            <div class="legend-item">
              <span class="legend-symbol" style="background: rgba(14, 165, 233, 0.15); border: 2px solid #0ea5e9;"></span>
              Conservation Area
            </div>
          </div>
          <div class="legend-section">
            <div class="legend-title">Risk Levels</div>
            <div class="legend-note">Features are filtered by risk level. Use the Risk Filter control above to toggle visibility.</div>
            <div class="legend-item">
              <span class="legend-dot" style="color: #dc2626;">●</span>
              Showstopper
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="color: #ea580c;">●</span>
              High Risk
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="color: #d97706;">●</span>
              Medium-High
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="color: #f59e0b;">●</span>
              Medium Risk
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="color: #059669;">●</span>
              Low Risk
            </div>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    // Create risk filter control
    riskFilterControl = L.control({ position: 'topleft' });
    riskFilterControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'risk-filter-control');
      div.innerHTML = `
        <div class="risk-filter-content">
          <h4>Risk Level Filter</h4>
          <div class="risk-filter-options">
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-showstopper" checked>
              <span class="risk-label showstopper">Showstopper</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-extremely_high_risk" checked>
              <span class="risk-label extremely-high">Extremely High</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-high_risk" checked>
              <span class="risk-label high">High Risk</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-medium_high_risk" checked>
              <span class="risk-label medium-high">Medium-High</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-medium_risk" checked>
              <span class="risk-label medium">Medium Risk</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-medium_low_risk" checked>
              <span class="risk-label medium-low">Medium-Low</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-low_risk" checked>
              <span class="risk-label low">Low Risk</span>
            </label>
          </div>
        </div>
      `;
      
      // Add event listeners for checkboxes
      Object.keys(riskFilters).forEach(riskLevel => {
        const checkbox = div.querySelector(`#risk-${riskLevel}`);
        if (checkbox) {
          checkbox.addEventListener('change', () => {
            riskFilters[riskLevel] = checkbox.checked;
            updateLayerVisibility();
          });
        }
      });
      
      // Prevent map interaction when clicking on control
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      
      return div;
    };
    riskFilterControl.addTo(map);

    // leaflet-draw types aren't available, cast to any to access Draw
    const Lany = /** @type {any} */ (L);
    const drawControl = new Lany.Control.Draw({
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems
      }
    });

    map.addControl(drawControl);

    map.on(Lany.Draw.Event.CREATED, function (/** @type {any} */ e) {
      const layer = e.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      const geojson = layer.toGeoJSON().geometry;
      onPolygonDrawn(geojson);
    });

    // Ensure tiles render fully if container size changed during mount
    setTimeout(() => {
      map?.invalidateSize();
    }, 0);
  });

  /**
   * @param {import('leaflet').GeoJSON | null} layer
   * @param {any[]} rows
   * @param {(r: any) => Record<string, any>} propsMapper
   * @param {boolean} applyRiskFilter
   */
  function setLayerData(layer, rows, propsMapper = (r) => r, applyRiskFilter = false) {
    if (!layer) return;
    layer.clearLayers();
    if (!Array.isArray(rows) || rows.length === 0) return;
    
    let filteredRows = rows.filter((r) => r?.geometry);
    
    // Apply risk level filtering if requested
    if (applyRiskFilter) {
      filteredRows = filteredRows.filter((r) => {
        const props = propsMapper(r);
        return props.riskLevel ? isRiskLevelVisible(props.riskLevel) : true;
      });
    }
    
    const features = filteredRows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: propsMapper(r)
    }));
    
    if (features.length > 0) layer.addData({ type: 'FeatureCollection', features });
  }

  $: if (heritageData?.conservation_areas) {
    setLayerData(conservationAreasLayer, heritageData.conservation_areas, (r) => ({ 
      name: r.name,
      riskLevel: getConservationAreaRiskLevel(r)
    }), true);
  }

  $: if (heritageData?.listed_buildings) {
    setLayerData(listedBuildingsLayer, heritageData.listed_buildings, (r) => ({ 
      name: r.name, 
      grade: r.grade,
      riskLevel: getBuildingRiskLevel(r)
    }), true);
  }
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    height: 100%;
    width: 100%;
    min-height: 400px;
  }

  :global(.map-legend) {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    min-width: 180px;
  }

  :global(.map-legend .legend-content h4) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
  }

  :global(.map-legend .legend-section) {
    margin-bottom: 12px;
  }

  :global(.map-legend .legend-section:last-child) {
    margin-bottom: 0;
  }

  :global(.map-legend .legend-title) {
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.map-legend .legend-item) {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
    color: #6b7280;
  }

  :global(.map-legend .legend-item:last-child) {
    margin-bottom: 0;
  }

  :global(.map-legend .legend-symbol) {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 8px;
    flex-shrink: 0;
  }

  :global(.map-legend .legend-symbol[style*="border"]) {
    border-radius: 3px;
    width: 16px;
    height: 12px;
  }

  :global(.map-legend .legend-note) {
    font-size: 10px;
    color: #9ca3af;
    margin-bottom: 6px;
    font-style: italic;
    line-height: 1.3;
  }

  :global(.map-legend .legend-dot) {
    margin-right: 8px;
    font-size: 14px;
    line-height: 1;
  }

  /* Risk Filter Control Styles */
  :global(.risk-filter-control) {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    min-width: 160px;
    margin-bottom: 10px;
  }

  :global(.risk-filter-control .risk-filter-content h4) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
  }

  :global(.risk-filter-control .risk-filter-options) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.risk-filter-control .risk-filter-item) {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: 11px;
    color: #6b7280;
  }

  :global(.risk-filter-control .risk-filter-item input[type="checkbox"]) {
    margin-right: 6px;
    margin-top: 0;
    cursor: pointer;
  }

  :global(.risk-filter-control .risk-label) {
    font-weight: 500;
  }

  :global(.risk-filter-control .risk-label.showstopper) {
    color: #dc2626;
  }

  :global(.risk-filter-control .risk-label.extremely-high) {
    color: #b91c1c;
  }

  :global(.risk-filter-control .risk-label.high) {
    color: #ea580c;
  }

  :global(.risk-filter-control .risk-label.medium-high) {
    color: #d97706;
  }

  :global(.risk-filter-control .risk-label.medium) {
    color: #f59e0b;
  }

  :global(.risk-filter-control .risk-label.medium-low) {
    color: #84cc16;
  }

  :global(.risk-filter-control .risk-label.low) {
    color: #059669;
  }

</style>


