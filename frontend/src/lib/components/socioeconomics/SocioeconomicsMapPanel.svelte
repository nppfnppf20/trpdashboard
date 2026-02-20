<script>
  import { onMount } from 'svelte';

  /** @type {(geometry: any) => void} */
  export let onPolygonDrawn;
  /** @type {boolean} */
  export let loading = false;
  /** @type {boolean} */
  export let drawingEnabled = true;

  // Loading message rotation
  let loadingMessageIndex = 0;
  let loadingInterval = null;

  const loadingMessages = [
    'Analysing socioeconomics data...',
    'Analysing education data...',
    'Analysing census data...',
    'Analysing travel data...',
    'Analysing employment data...',
    'Analysing housing data...',
    'Analysing demographic data...'
  ];

  $: currentLoadingMessage = loadingMessages[loadingMessageIndex];

  // Handle loading state changes
  $: if (loading) {
    startLoadingRotation();
  } else {
    stopLoadingRotation();
  }

  function startLoadingRotation() {
    if (loadingInterval) return; // Already running

    loadingMessageIndex = 0;
    loadingInterval = setInterval(() => {
      loadingMessageIndex = (loadingMessageIndex + 1) % loadingMessages.length;
    }, 3000); // Change every 3 seconds
  }

  function stopLoadingRotation() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }
    loadingMessageIndex = 0; // Reset to first message
  }

  /** @type {HTMLDivElement | null} */
  let mapContainer = null;
  /** @type {import('leaflet').Map | null} */
  let map = null;
  /** @type {import('leaflet').FeatureGroup | null} */
  let drawnItems = null;
  /** @type {any} */
  let L = null;
  /** @type {any} */
  let drawControl = null;

  /**
   * Load a polygon geometry onto the map and zoom to it
   * @param {any} geometry - GeoJSON geometry object
   * @returns {boolean} - Returns true if successful, false if map not ready
   */
  export function loadPolygonOnMap(geometry) {
    if (!map || !drawnItems || !L) {
      console.warn('⚠️ Map not initialized yet, cannot load polygon');
      return false;
    }

    try {
      // Clear existing drawn layers
      drawnItems.clearLayers();

      // Create layer from GeoJSON geometry
      const layer = L.geoJSON(geometry);

      // Add each feature to drawnItems
      layer.eachLayer((l) => {
        drawnItems.addLayer(l);
      });

      // Zoom to fit the polygon bounds
      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });

      console.log('✅ Polygon loaded and zoomed on map');
      return true;
    } catch (error) {
      console.error('❌ Error loading polygon on map:', error);
      return false;
    }
  }

  onMount(async () => {
    // Dynamic import to avoid SSR issues
    L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    await import('leaflet-draw');
    await import('leaflet-draw/dist/leaflet.draw.css');

    // Initialize the map
    map = L.map(mapContainer).setView([54.5, -2.0], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize drawn items group
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Cast L to any to access Draw functionality (leaflet-draw types aren't available)
    const Lany = /** @type {any} */ (L);

    // Handle polygon creation
    map.on(Lany.Draw.Event.CREATED, function (e) {
      const layer = e.layer;

      // Clear existing polygons
      drawnItems.clearLayers();

      // Add new polygon
      drawnItems.addLayer(layer);

      // Get the GeoJSON
      const geoJSON = layer.toGeoJSON();
      console.log('🎯 Socioeconomics polygon drawn:', geoJSON);
      console.log('🎯 Geometry being passed to callback:', geoJSON.geometry);
      console.log('🎯 onPolygonDrawn function:', onPolygonDrawn);

      // Call the callback
      try {
        onPolygonDrawn(geoJSON.geometry);
        console.log('✅ onPolygonDrawn callback executed successfully');
      } catch (error) {
        console.error('❌ Error calling onPolygonDrawn callback:', error);
      }
    });

    // Handle polygon deletion
    map.on(Lany.Draw.Event.DELETED, function () {
      console.log('🗑️ Polygon deleted');
      // Could call a callback here if needed
    });

    return () => {
      if (map) {
        map.remove();
      }
      stopLoadingRotation(); // Clean up interval on unmount
    };
  });

  // Reactive draw control - enable/disable based on drawingEnabled prop
  $: if (map && drawnItems && L) {
    const Lany = /** @type {any} */ (L);

    if (drawingEnabled && !drawControl) {
      // Enable drawing - create the draw control
      drawControl = new Lany.Control.Draw({
        edit: {
          featureGroup: drawnItems,
          remove: true
        },
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: '#e1e100',
              message: '<strong>Error:</strong> shape edges cannot cross!'
            },
            shapeOptions: {
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
              weight: 2
            }
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false
        }
      });
      map.addControl(drawControl);
      console.log('✅ Drawing controls enabled');
    } else if (!drawingEnabled && drawControl) {
      // Disable drawing - remove the draw control
      map.removeControl(drawControl);
      drawControl = null;
      console.log('🚫 Drawing controls disabled');
    }
  }
</script>

<div class="socioeconomics-map-panel">
  <div class="map-container" bind:this={mapContainer}></div>

  {#if loading}
    <div class="map-loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>{currentLoadingMessage}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .socioeconomics-map-panel {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .map-container {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  .map-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #16a34a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-spinner p {
    margin: 0;
    color: #374151;
    font-weight: 500;
    font-size: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Ensure Leaflet styles are properly loaded */
  :global(.leaflet-container) {
    height: 100%;
    width: 100%;
  }

  :global(.leaflet-draw-toolbar) {
    margin-top: 10px;
  }
</style>