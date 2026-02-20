<script>
  import Map from './Map.svelte';

  /** @type {(geometry: any) => void} */
  export let onPolygonDrawn;

  /** @type {boolean} */
  export let loading = false;

  /** @type {boolean} */
  export let drawingEnabled = true;

  /** @type {Record<string, any> | null} */
  export let heritageData = null;
  /** @type {Record<string, any> | null} */
  export let landscapeData = null;
  /** @type {Record<string, any> | null} */
  export let renewablesData = null;
  /** @type {Record<string, any> | null} */
  export let ecologyData = null;
  /** @type {Record<string, any> | null} */
  export let treesData = null;
  /** @type {Record<string, any> | null} */
  export let airfieldsData = null;

  /** @type {Map | null} */
  let mapComponent = null;

  /**
   * Load a polygon geometry onto the map
   * @param {any} geometry - GeoJSON geometry object
   */
  export function loadPolygonOnMap(geometry) {
    if (mapComponent) {
      mapComponent.loadPolygonOnMap(geometry);
    }
  }

  // Loading message rotation
  let loadingMessageIndex = 0;
  let loadingInterval = null;

  const loadingMessages = [
    'Analysing site constraints...',
    'Analysing heritage data...',
    'Analysing landscape data...',
    'Analysing ecology data...',
    'Analysing agricultural land...',
    'Analysing renewables data...',
    'Processing spatial analysis...'
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
</script>

<div class="map-panel">
  <div class="map-panel-content">
    <Map bind:this={mapComponent} {onPolygonDrawn} {drawingEnabled} {heritageData} {landscapeData} {renewablesData} {ecologyData} {treesData} {airfieldsData} />

    {#if loading}
      <div class="map-loading-overlay">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>{currentLoadingMessage}</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
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
    border-top: 3px solid #3b82f6;
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
</style>
