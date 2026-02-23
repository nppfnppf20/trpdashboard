<script>
  import { RISK_LEVELS } from '$lib/utils/riskLevels.js';

  export let map = null;
  export let riskFilters = {};
  export let onRiskFilterChange = () => {};
  export let conservationAreasLayer = null;
  export let listedBuildingsGradeILayer = null;
  export let listedBuildingsGradeIIStarLayer = null;
  export let listedBuildingsGradeIILayer = null;
  export let scheduledMonumentsLayer = null;
  export let registeredParksGardensLayer = null;
  export let worldHeritageSitesLayer = null;
  export let sssiLayer = null;
  export let nnrLayer = null;
  export let spaLayer = null;
  export let sacLayer = null;
  export let dwSafeguardSurfaceLayer = null;
  export let dwProtectedSurfaceLayer = null;
  export let dwSafeguardGroundwaterLayer = null;
  export let greenBeltLayer = null;
  export let aonbLayer = null;
  export let nationalParksLayer = null;
  export let renewablesLayer = null;
  export let ancientWoodlandLayer = null;
  export let ukAirportsLayer = null;
  export let floodZonesWmsLayer = null;
  export let surfaceWaterWmsLayer = null;
  export let surfaceWaterCCWmsLayer = null;
  export let alcWmsLayer = null;

  let layerControl = null;
  let riskFilterControl = null;

  /**
   * Create and add custom grouped layer control to map
   * @param {import('leaflet')} L - Leaflet instance
   * @param {any} base - Base layer
   */
  export function createLayerControl(L, base) {
    if (!map) return;

    // Create custom control
    layerControl = L.control({ position: 'topright' });
    layerControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'grouped-layer-control');

      // Define discipline groups
      const disciplineGroups = {
        heritage: {
          title: 'Heritage',
          layers: [
            { layer: conservationAreasLayer, name: 'Conservation Areas', style: 'rgba(14, 165, 233, 0.15); border: 2px solid #0ea5e9; border-radius: 3px;', shape: 'rect' },
            { layer: listedBuildingsGradeILayer, name: 'Grade I Listed', style: '#dc2626', shape: 'circle' },
            { layer: listedBuildingsGradeIIStarLayer, name: 'Grade II* Listed', style: '#ea580c', shape: 'circle' },
            { layer: listedBuildingsGradeIILayer, name: 'Grade II Listed', style: '#8b5cf6', shape: 'circle' },
            { layer: scheduledMonumentsLayer, name: 'Scheduled Monuments', style: '#ffed4e; border: 2px solid #000000', shape: 'circle' },
            { layer: registeredParksGardensLayer, name: 'Registered Parks/Gardens', style: 'rgba(249, 115, 22, 0.2); border: 3px solid #f97316; border-radius: 3px;', shape: 'rect' },
            { layer: worldHeritageSitesLayer, name: 'World Heritage Sites', style: 'rgba(124, 58, 237, 0.25); border: 4px solid #7c3aed; border-radius: 3px;', shape: 'rect' }
          ]
        },
        landscape: {
          title: 'Landscape',
          layers: [
            { layer: greenBeltLayer, name: 'Green Belt', style: 'rgba(34, 197, 94, 0.2); border: 3px solid #22c55e; border-radius: 3px;', shape: 'rect' },
            { layer: aonbLayer, name: 'AONB', style: 'rgba(59, 130, 246, 0.2); border: 3px solid #3b82f6; border-radius: 3px;', shape: 'rect' },
            { layer: nationalParksLayer, name: 'National Parks', style: 'rgba(168, 85, 247, 0.2); border: 3px solid #a855f7; border-radius: 3px;', shape: 'rect' }
          ]
        },
        energy: {
          title: 'Renewables Development',
          layers: [
            { layer: renewablesLayer, name: 'Renewables', style: '#ec4899', shape: 'circle' }
          ]
        },
        ecology: {
          title: 'Ecology',
          layers: [
            { layer: sssiLayer, name: 'SSSI', style: 'rgba(16, 185, 129, 0.2); border: 3px solid #10b981; border-radius: 3px;', shape: 'rect' },
            { layer: nnrLayer, name: 'National Nature Reserves', style: 'rgba(5, 150, 105, 0.25); border: 4px solid #059669; border-radius: 3px;', shape: 'rect' },
            { layer: spaLayer, name: 'Special Protection Areas', style: 'rgba(139, 92, 246, 0.2); border: 3px solid #8b5cf6; border-radius: 3px;', shape: 'rect' },
            { layer: sacLayer, name: 'Special Areas of Conservation', style: 'rgba(236, 72, 153, 0.2); border: 3px solid #ec4899; border-radius: 3px;', shape: 'rect' }
          ]
        },
        trees: {
          title: 'Ancient Woodland',
          layers: [
            { layer: ancientWoodlandLayer, name: 'Ancient Woodland', style: 'rgba(5, 150, 105, 0.3); border: 3px solid #065f46; border-radius: 3px;', shape: 'rect' }
          ]
        },
        agLand: {
          title: 'Ag Land',
          layers: [
            { layer: alcWmsLayer, name: 'Agricultural Land Classification', style: '#B2FE99', shape: 'rect', legendLayout: 'vertical', multiStyle: [
              { style: '#37E2FE', shape: 'square', label: 'Grade 1' },
              { style: '#C2FBFE', shape: 'square', label: 'Grade 2' },
              { style: '#B2FE99', shape: 'square', label: 'Grade 3' },
              { style: '#FEF8A4', shape: 'square', label: 'Grade 4' },
              { style: '#B28864', shape: 'square', label: 'Grade 5' },
              { style: '#FEC455', shape: 'square', label: 'Non Agricultural' },
              { style: '#FF6347', shape: 'square', label: 'Urban' }
            ] }
          ]
        },
        flood: {
          title: 'Flood',
          layers: [
            { layer: floodZonesWmsLayer, name: 'Flood Zones 2 & 3', style: 'rgba(59, 130, 246, 0.3); border: 2px solid #3b82f6; border-radius: 3px;', shape: 'rect' },
            { layer: surfaceWaterWmsLayer, name: 'Surface Water Flooding', style: 'rgba(14, 165, 233, 0.3); border: 2px solid #0ea5e9; border-radius: 3px;', shape: 'rect' },
            { layer: surfaceWaterCCWmsLayer, name: 'Surface Water Flooding (CC)', style: 'rgba(139, 92, 246, 0.3); border: 2px solid #8b5cf6; border-radius: 3px;', shape: 'rect' }
          ]
        },
        other: {
          title: 'Other',
          layers: [
            { layer: dwSafeguardSurfaceLayer, name: 'DW Safeguard Zones (Surface)', style: 'rgba(56, 189, 248, 0.25); border: 3px solid #0284c7; border-radius: 3px;', shape: 'rect' },
            { layer: dwProtectedSurfaceLayer, name: 'DW Protected Areas (Surface)', style: 'rgba(167, 139, 250, 0.25); border: 3px solid #7c3aed; border-radius: 3px;', shape: 'rect' },
            { layer: dwSafeguardGroundwaterLayer, name: 'DW Safeguard Zones (Groundwater)', style: 'rgba(94, 234, 212, 0.25); border: 3px solid #0d9488; border-radius: 3px;', shape: 'rect' }
          ]
        }
        // Airfields - Hidden until dataset is complete
        // airfields: {
        //   title: 'Airfields',
        //   layers: [
        //     { layer: ukAirportsLayer, name: 'UK Airports', style: '#3b82f6', shape: 'circle' }
        //   ]
        // }
      };

      let html = '<div class="layer-control-content"><h4>Map Layers</h4>';

      // Add base layer section
      html += '<div class="base-layers-section"><h5>Base Map</h5>';
      html += '<label class="layer-item"><input type="radio" name="base-layer" checked> OSM</label>';
      html += '</div>';

      // Add discipline groups
      Object.entries(disciplineGroups).forEach(([groupKey, group]) => {
        html += `
          <div class="discipline-group" data-group="${groupKey}">
            <div class="discipline-header">
              <button class="group-toggle" data-group="${groupKey}">
                <span class="toggle-icon">▶</span>
                <input type="checkbox" class="group-checkbox" data-group="${groupKey}">
                <span class="group-title">${group.title}</span>
              </button>
            </div>
            <div class="discipline-layers" data-group="${groupKey}" style="display: none;">
        `;

        group.layers.forEach((layerInfo, index) => {
          if (layerInfo.layer) {
            const layerId = `${groupKey}-${index}`;

            // Handle multiStyle with multiple square types
            if (layerInfo.multiStyle && layerInfo.multiStyle.length > 0) {
              if (layerInfo.legendLayout === 'vertical') {
                // Vertical legend: checkbox + name on first line, then each entry on its own line
                let legendEntriesHtml = '';
                layerInfo.multiStyle.forEach((styleInfo) => {
                  const swatchStyle = styleInfo.shape === 'circle'
                    ? `width: 12px; height: 12px; background: ${styleInfo.style}; border-radius: 50%;`
                    : `width: 12px; height: 12px; background: ${styleInfo.style}; border-radius: 2px;`;
                  legendEntriesHtml += `
                    <div class="legend-entry">
                      <span class="layer-icon" style="${swatchStyle}"></span>
                      <span class="legend-label">${styleInfo.label}</span>
                    </div>`;
                });

                html += `
                  <label class="layer-item">
                    <input type="checkbox" id="${layerId}">
                    <span class="layer-name">${layerInfo.name}</span>
                  </label>
                  <div class="legend-entries">${legendEntriesHtml}</div>
                `;
              } else {
                // Inline: all swatches in a row (existing behaviour)
                let multiIconsHtml = '';
                layerInfo.multiStyle.forEach((styleInfo, styleIndex) => {
                  const multiShapeStyle = styleInfo.shape === 'circle'
                    ? `width: 12px; height: 12px; background: ${styleInfo.style}; border-radius: 50%;`
                    : `width: 12px; height: 12px; background: ${styleInfo.style}; border-radius: 2px; margin-right: 4px;`;
                  multiIconsHtml += `<span class="layer-icon" style="${multiShapeStyle}"></span>`;
                });

                html += `
                  <label class="layer-item">
                    <input type="checkbox" id="${layerId}">
                    <div class="multi-layer-icons">${multiIconsHtml}</div>
                    <span class="layer-name">${layerInfo.name}</span>
                  </label>
                `;
              }
            } else {
              // Standard single icon display
              const shapeStyle = layerInfo.shape === 'circle'
                ? `width: 12px; height: 12px; background: ${layerInfo.style}; border-radius: 50%;`
                : `width: 16px; height: 12px; background: ${layerInfo.style};`;

              html += `
                <label class="layer-item">
                  <input type="checkbox" id="${layerId}">
                  <span class="layer-icon" style="${shapeStyle}"></span>
                  <span class="layer-name">${layerInfo.name}</span>
                </label>
              `;
            }
          }
        });

        html += '</div></div>';
      });

      html += '</div>';
      div.innerHTML = html;

      // Add event listeners
      setupLayerControlEvents(div, disciplineGroups, L);

      // Prevent map interaction when clicking on control
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      return div;
    };

    layerControl.addTo(map);
  }

  /**
   * Setup event listeners for the custom layer control
   */
  function setupLayerControlEvents(div, disciplineGroups, L) {
    // Group toggle functionality
    div.querySelectorAll('.group-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const groupKey = button.dataset.group;
        const layersDiv = div.querySelector(`.discipline-layers[data-group="${groupKey}"]`);
        const icon = button.querySelector('.toggle-icon');

        if (layersDiv.style.display === 'none') {
          layersDiv.style.display = 'block';
          icon.textContent = '▼';
        } else {
          layersDiv.style.display = 'none';
          icon.textContent = '▶';
        }
      });
    });

    // Group checkbox functionality
    div.querySelectorAll('.group-checkbox').forEach(groupCheckbox => {
      groupCheckbox.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent toggle button from firing
        const groupKey = groupCheckbox.dataset.group;
        const group = disciplineGroups[groupKey];
        const checkboxes = div.querySelectorAll(`.discipline-layers[data-group="${groupKey}"] input[type="checkbox"]`);
        const newState = groupCheckbox.checked;

        checkboxes.forEach((checkbox, index) => {
          checkbox.checked = newState;
          const layerInfo = group.layers[index];
          if (layerInfo.layer && map.hasLayer(layerInfo.layer) !== newState) {
            if (newState) {
              map.addLayer(layerInfo.layer);
            } else {
              map.removeLayer(layerInfo.layer);
            }
          }
        });
      });
    });

    // Individual layer toggle functionality
    Object.entries(disciplineGroups).forEach(([groupKey, group]) => {
      group.layers.forEach((layerInfo, index) => {
        if (layerInfo.layer) {
          const layerId = `${groupKey}-${index}`;
          const checkbox = div.querySelector(`#${layerId}`);
          if (checkbox) {
            // Initialize layer state (layers start unchecked/hidden)
            // Don't add layers to map on initialization

            checkbox.addEventListener('change', () => {
              if (checkbox.checked) {
                map.addLayer(layerInfo.layer);
              } else {
                map.removeLayer(layerInfo.layer);
              }

              // Update group checkbox state
              updateGroupCheckboxState(div, groupKey, group);
            });
          }
        }
      });
    });
  }

  /**
   * Update the state of the group checkbox based on individual checkboxes
   */
  function updateGroupCheckboxState(div, groupKey, group) {
    const checkboxes = div.querySelectorAll(`.discipline-layers[data-group="${groupKey}"] input[type="checkbox"]`);
    const groupCheckbox = div.querySelector(`.group-checkbox[data-group="${groupKey}"]`);

    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;

    if (checkedCount === 0) {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = false;
    } else if (checkedCount === totalCount) {
      groupCheckbox.checked = true;
      groupCheckbox.indeterminate = false;
    } else {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = true;
    }
  }

  /**
   * Create and add risk filter control to map
   * @param {import('leaflet')} L - Leaflet instance
   */
  export function createRiskFilterControl(L) {
    if (!map) return;

    riskFilterControl = L.control({ position: 'bottomright' });
    riskFilterControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'risk-filter-control');
      div.innerHTML = `
        <div class="risk-filter-content">
          <div class="risk-filter-options" style="display: none;">
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.SHOWSTOPPER}" checked>
              <span class="risk-label showstopper">Showstopper</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.EXTREMELY_HIGH_RISK}" checked>
              <span class="risk-label extremely-high">Extremely High</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.HIGH_RISK}" checked>
              <span class="risk-label high">High Risk</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.MEDIUM_HIGH_RISK}" checked>
              <span class="risk-label medium-high">Medium-High</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.MEDIUM_RISK}" checked>
              <span class="risk-label medium">Medium Risk</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.MEDIUM_LOW_RISK}" checked>
              <span class="risk-label medium-low">Medium-Low</span>
            </label>
            <label class="risk-filter-item">
              <input type="checkbox" id="risk-${RISK_LEVELS.LOW_RISK}" checked>
              <span class="risk-label low">Low Risk</span>
            </label>
          </div>
          <div class="risk-filter-header">
            <button class="risk-filter-toggle">
              <span class="toggle-icon">▲</span>
              <span class="filter-title">Risk Level Filter</span>
            </button>
          </div>
        </div>
      `;

      // Add toggle functionality
      const toggleButton = div.querySelector('.risk-filter-toggle');
      const optionsDiv = div.querySelector('.risk-filter-options');
      const toggleIcon = div.querySelector('.toggle-icon');

      toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (optionsDiv.style.display === 'none') {
          optionsDiv.style.display = 'block';
          toggleIcon.textContent = '▼';
        } else {
          optionsDiv.style.display = 'none';
          toggleIcon.textContent = '▲';
        }
      });

      // Add event listeners for checkboxes and sync initial state
      Object.keys(riskFilters).forEach(riskLevel => {
        const checkbox = div.querySelector(`#risk-${riskLevel}`);
        if (checkbox) {
          // Sync checkbox state with riskFilters initial values
          checkbox.checked = riskFilters[riskLevel];

          checkbox.addEventListener('change', () => {
            riskFilters[riskLevel] = checkbox.checked;
            onRiskFilterChange();
          });
        }
      });

      // Prevent map interaction when clicking on control
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      return div;
    };
    riskFilterControl.addTo(map);
  }

  /**
   * Create and add draw control to map
   * @param {import('leaflet')} L - Leaflet instance
   * @param {any} drawnItems - Feature group for drawn items
   * @param {(geojson: any) => void} onPolygonDrawn - Callback for when polygon is drawn
   * @returns {any} The created draw control
   */
  export function createDrawControl(L, drawnItems, onPolygonDrawn) {
    if (!map) return null;

    // leaflet-draw types aren't available, cast to any to access Draw
    const Lany = /** @type {any} */ (L);
    const drawControl = new Lany.Control.Draw({
      draw: {
        polygon: {
          shapeOptions: {
            color: '#ff0000',
            fillOpacity: 0
          }
        },
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
      layer.setStyle({ fillOpacity: 0 });
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      const geojson = layer.toGeoJSON().geometry;
      onPolygonDrawn(geojson);
    });

    return drawControl;
  }

  /**
   * Remove draw control from map
   * @param {any} drawControl - The draw control to remove
   */
  export function removeDrawControl(drawControl) {
    if (!map || !drawControl) return;
    map.removeControl(drawControl);
  }

</script>

<style>
  /* Risk Filter Control Styles */
  :global(.risk-filter-control) {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    min-width: 200px;
    max-width: 250px;
    margin-bottom: 10px;
  }

  :global(.risk-filter-control .risk-filter-header) {
    margin-top: 4px;
  }

  :global(.risk-filter-control .risk-filter-toggle) {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    width: 100%;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
    margin-top: 4px;
  }

  :global(.risk-filter-control .risk-filter-toggle:hover) {
    color: #1f2937;
  }

  :global(.risk-filter-control .risk-filter-toggle .toggle-icon) {
    font-size: 10px;
    width: 12px;
    text-align: center;
  }

  :global(.risk-filter-control .filter-title) {
    font-size: 14px;
    font-weight: 600;
  }

  :global(.risk-filter-control .risk-filter-options) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 4px;
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

  /* Grouped Layer Control Styles */
  :global(.grouped-layer-control) {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 12px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    min-width: 200px;
    max-width: 250px;
  }

  :global(.grouped-layer-control .layer-control-content h4) {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 6px;
  }

  :global(.grouped-layer-control .base-layers-section) {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  :global(.grouped-layer-control .base-layers-section h5) {
    margin: 0 0 6px 0;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }

  :global(.grouped-layer-control .discipline-group) {
    margin-bottom: 8px;
  }

  :global(.grouped-layer-control .discipline-header) {
    margin-bottom: 4px;
  }

  :global(.grouped-layer-control .group-toggle) {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    width: 100%;
  }

  :global(.grouped-layer-control .group-toggle:hover) {
    color: #1f2937;
  }

  :global(.grouped-layer-control .toggle-icon) {
    font-size: 10px;
    width: 12px;
    text-align: center;
  }

  :global(.grouped-layer-control .group-checkbox) {
    margin: 0;
    cursor: pointer;
  }

  :global(.grouped-layer-control .discipline-layers) {
    margin-left: 12px;
    border-left: 2px solid #f3f4f6;
    padding-left: 8px;
  }

  :global(.grouped-layer-control .layer-item) {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 2px 0;
    font-size: 11px;
    color: #6b7280;
    gap: 8px;
  }

  :global(.grouped-layer-control .layer-item:hover) {
    color: #374151;
  }

  :global(.grouped-layer-control .layer-item input[type="checkbox"],
         .grouped-layer-control .layer-item input[type="radio"]) {
    margin: 0;
    cursor: pointer;
  }

  :global(.grouped-layer-control .layer-icon) {
    display: inline-block;
    flex-shrink: 0;
  }

  :global(.grouped-layer-control .layer-name) {
    font-weight: 500;
  }

  :global(.grouped-layer-control .multi-layer-icons) {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  :global(.grouped-layer-control .multi-layer-icons .layer-icon:last-child) {
    margin-right: 0 !important;
  }

  :global(.grouped-layer-control .legend-entries) {
    margin-left: 28px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  :global(.grouped-layer-control .legend-entry) {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #6b7280;
  }

  :global(.grouped-layer-control .legend-label) {
    font-weight: 400;
  }

</style>
