<script>
  import { onMount } from 'svelte';
  import { RISK_LEVELS } from '$lib/utils/riskLevels.js';
  import {
    getBuildingRiskLevel,
    getConservationAreaRiskLevel,
    getScheduledMonumentRiskLevel,
    getGreenBeltRiskLevel,
    getAONBRiskLevel,
    getNationalParksRiskLevel,
    getRegisteredParksGardensRiskLevel,
    getWorldHeritageSiteRiskLevel,
    getSSSIRiskLevel,
    getNationalNatureReservesRiskLevel,
    getRenewablesRiskLevel,
    getAncientWoodlandRiskLevel,
    getUkAirportsRiskLevel,
    getSPARiskLevel,
    getSACRiskLevel,
    getDrinkingWaterRiskLevel
  } from '$lib/utils/mapRiskAssessment.js';
  import {
    createConservationAreasLayer,
    createListedBuildingsLayer,
    createScheduledMonumentsLayer,
    createGreenBeltLayer,
    createAONBLayer,
    createNationalParksLayer,
    createRegisteredParksGardensLayer,
    createWorldHeritageSitesLayer,
    createSSSILayer,
    createNationalNatureReservesLayer,
    createRenewablesLayer,
    createAncientWoodlandLayer,
    createUkAirportsLayer,
    createSPALayer,
    createSACLayer,
    createDWSafeguardSurfaceLayer,
    createDWProtectedSurfaceLayer,
    createDWSafeguardGroundwaterLayer
  } from '$lib/utils/layerFactory.js';
  import {
    processScheduledMonuments,
    processRenewablesData,
    filterBuildingsByGrade,
    setLayerData
  } from '$lib/utils/dataProcessor.js';
  import MapControls from './MapControls.svelte';

  /** @type {HTMLDivElement | null} */
  let mapContainer = null;
  /** @type {import('leaflet').Map | null} */
  let map = null;
  /** @type {any} */
  let drawnItems = null;
  /** @type {any} */
  let L = null;

  /** @type {(geojson: any) => void} */
  export let onPolygonDrawn = (geojson) => {};
  /** @type {boolean} */
  export let drawingEnabled = true; // Enable/disable drawing controls
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

  /**
   * Load a polygon geometry onto the map and zoom to it
   * @param {any} geometry - GeoJSON geometry object
   */
  export function loadPolygonOnMap(geometry) {
    if (!map || !drawnItems || !L) {
      console.warn('Map not initialized yet');
      return;
    }

    try {
      // Clear existing drawn layers
      drawnItems.clearLayers();

      // Create layer from GeoJSON geometry with no fill
      const layer = L.geoJSON(geometry, {
        style: { color: '#ff0000', fillOpacity: 0 }
      });

      // Add each feature to drawnItems
      layer.eachLayer((l) => {
        drawnItems.addLayer(l);
      });

      // Zoom to fit the polygon bounds
      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });

      // Restrict ALC WMS layer to ~20km radius around site
      if (alcWmsLayer) {
        const center = bounds.getCenter();
        const alcBounds = center.toBounds(40000); // 20km in each direction
        alcWmsLayer.options.bounds = alcBounds;
        if (map.hasLayer(alcWmsLayer)) {
          alcWmsLayer.redraw();
        }
      }

      console.log('✅ Polygon loaded and zoomed on map');
    } catch (error) {
      console.error('❌ Error loading polygon on map:', error);
    }
  }

  $: console.log('🔍 Map received landscapeData:', landscapeData);
  $: console.log('🔍 Map received renewablesData:', renewablesData);
  $: console.log('📋 All Map props:', { heritageData: !!heritageData, landscapeData: !!landscapeData, renewablesData: !!renewablesData });

  // Force browser refresh

  // Map layers
  /** @type {import('leaflet').GeoJSON | null} */
  let conservationAreasLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let listedBuildingsGradeILayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let listedBuildingsGradeIIStarLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let listedBuildingsGradeIILayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let scheduledMonumentsLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let greenBeltLayer = null;
  let aonbLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let nationalParksLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let registeredParksGardensLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let worldHeritageSitesLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let sssiLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let nnrLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let spaLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let sacLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let renewablesLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let ancientWoodlandLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let ukAirportsLayer = null;
  /** @type {any} */
  let floodZonesWmsLayer = null;
  /** @type {any} */
  let surfaceWaterWmsLayer = null;
  /** @type {any} */
  let surfaceWaterCCWmsLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let dwSafeguardSurfaceLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let dwProtectedSurfaceLayer = null;
  /** @type {import('leaflet').GeoJSON | null} */
  let dwSafeguardGroundwaterLayer = null;
  /** @type {any} */
  let alcWmsLayer = null;

  // Controls component reference
  let mapControls = null;

  // Draw control reference (for dynamic enable/disable)
  let drawControl = null;

  // Risk level filter state
  /** @type {Record<string, boolean>} */
  let riskFilters = {
    [RISK_LEVELS.SHOWSTOPPER]: true,
    [RISK_LEVELS.EXTREMELY_HIGH_RISK]: true,
    [RISK_LEVELS.HIGH_RISK]: true,
    [RISK_LEVELS.MEDIUM_HIGH_RISK]: true,
    [RISK_LEVELS.MEDIUM_RISK]: true,
    [RISK_LEVELS.MEDIUM_LOW_RISK]: true,
    [RISK_LEVELS.LOW_RISK]: true
  };

  /**
   * Update layer visibility based on current risk filter settings
   */
  function updateLayerVisibility() {
    if (!conservationAreasLayer || !listedBuildingsGradeILayer || !listedBuildingsGradeIIStarLayer ||
        !listedBuildingsGradeIILayer || !scheduledMonumentsLayer || !registeredParksGardensLayer ||
        !worldHeritageSitesLayer || !sssiLayer || !ancientWoodlandLayer || !ukAirportsLayer) return;

    console.log('🔄 Updating layer visibility...');

    // Refresh layers with current filter settings
    if (heritageData?.conservation_areas) {
      setLayerData(conservationAreasLayer, heritageData.conservation_areas, (r) => ({
        name: r.name,
        riskLevel: getConservationAreaRiskLevel(r)
      }), true, riskFilters);
    }

    if (heritageData?.listed_buildings) {
      // Filter buildings by grade and apply to appropriate layers
      const gradeIBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'I');
      const gradeIIStarBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'II*');
      const gradeIIBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'II');

      setLayerData(listedBuildingsGradeILayer, gradeIBuildings, (r) => ({
        name: r.name,
        grade: r.grade,
        riskLevel: getBuildingRiskLevel(r)
      }), true, riskFilters);

      setLayerData(listedBuildingsGradeIIStarLayer, gradeIIStarBuildings, (r) => ({
        name: r.name,
        grade: r.grade,
        riskLevel: getBuildingRiskLevel(r)
      }), true, riskFilters);

      setLayerData(listedBuildingsGradeIILayer, gradeIIBuildings, (r) => ({
        name: r.name,
        grade: r.grade,
        riskLevel: getBuildingRiskLevel(r)
      }), true, riskFilters);
    }

    if (heritageData?.scheduled_monuments) {
      const monumentsWithGeometry = processScheduledMonuments(heritageData.scheduled_monuments);
      setLayerData(scheduledMonumentsLayer, monumentsWithGeometry, (r) => ({
        name: r.name,
        riskLevel: getScheduledMonumentRiskLevel(r)
      }), true, riskFilters);
    }

    if (heritageData?.registered_parks_gardens) {
      setLayerData(registeredParksGardensLayer, heritageData.registered_parks_gardens, (r) => ({
        name: r.name || 'Registered Park/Garden',
        grade: r.grade,
        riskLevel: getRegisteredParksGardensRiskLevel(r)
      }), true, riskFilters);
    }

    if (heritageData?.world_heritage_sites) {
      setLayerData(worldHeritageSitesLayer, heritageData.world_heritage_sites, (r) => ({
        name: r.name || 'World Heritage Site',
        riskLevel: getWorldHeritageSiteRiskLevel(r)
      }), true, riskFilters);
    }

    if (ecologyData?.sssi) {
      setLayerData(sssiLayer, ecologyData.sssi, (r) => ({
        name: r.name || 'SSSI',
        ref_code: r.ref_code,
        riskLevel: getSSSIRiskLevel(r)
      }), true, riskFilters);
    }

    if (ecologyData?.national_nature_reserves) {
      setLayerData(nnrLayer, ecologyData.national_nature_reserves, (r) => ({
        name: r.name || 'National Nature Reserve',
        ref_code: r.ref_code,
        riskLevel: getNationalNatureReservesRiskLevel(r)
      }), true, riskFilters);
    }

    if (ecologyData?.spa) {
      setLayerData(spaLayer, ecologyData.spa, (r) => ({
        name: r.name || 'Special Protection Area',
        code: r.code,
        riskLevel: getSPARiskLevel(r)
      }), true, riskFilters);
    }

    if (ecologyData?.sac) {
      setLayerData(sacLayer, ecologyData.sac, (r) => ({
        name: r.name || 'Special Area of Conservation',
        code: r.code,
        riskLevel: getSACRiskLevel(r)
      }), true, riskFilters);
    }

    if (landscapeData?.green_belt) {
      setLayerData(greenBeltLayer, landscapeData.green_belt, (r) => ({
        name: r.name || 'Green Belt',
        riskLevel: getGreenBeltRiskLevel(r)
      }), true, riskFilters);
    }

    if (landscapeData?.aonb) {
      setLayerData(aonbLayer, landscapeData.aonb, (r) => ({
        name: r.name || 'AONB',
        riskLevel: getAONBRiskLevel(r)
      }), true, riskFilters);
    }

    if (landscapeData?.national_parks) {
      setLayerData(nationalParksLayer, landscapeData.national_parks, (r) => ({
        name: r.name || 'National Park',
        riskLevel: getNationalParksRiskLevel(r)
      }), true, riskFilters);
    }

    // Update renewables layer when risk filters change
    if (renewablesData?.renewables) {
      const renewablesWithGeometry = processRenewablesData(renewablesData.renewables);
      setLayerData(renewablesLayer, renewablesWithGeometry, (r) => ({
        site_name: r.site_name,
        technology_type: r.technology_type,
        installed_capacity_mw: r.installed_capacity_mw,
        development_status_short: r.development_status_short,
        planning_authority: r.planning_authority,
        planning_application_reference: r.planning_application_reference,
        riskLevel: getRenewablesRiskLevel(r)
      }), true, riskFilters);
    }

    // Update ancient woodland layer when risk filters change
    if (treesData?.ancient_woodland) {
      setLayerData(ancientWoodlandLayer, treesData.ancient_woodland, (r) => ({
        name: r.name || 'Ancient Woodland',
        theme: r.theme,
        riskLevel: getAncientWoodlandRiskLevel(r)
      }), true, riskFilters);
    }

    // Update UK airports layer when risk filters change
    if (airfieldsData?.uk_airports) {
      setLayerData(ukAirportsLayer, airfieldsData.uk_airports, (r) => ({
        name: r.name || 'UK Airport',
        aeroway_type: r.aeroway_type,
        riskLevel: getUkAirportsRiskLevel(r)
      }), true, riskFilters);
    }

    // Update drinking water layers when risk filters change
    if (ecologyData?.drinking_water) {
      const safeguardSurface = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'safeguard_surface');
      const protectedSurface = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'protected_surface');
      const safeguardGroundwater = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'safeguard_groundwater');

      if (safeguardSurface.length > 0) {
        setLayerData(dwSafeguardSurfaceLayer, safeguardSurface, (r) => ({
          name: r.name || 'Safeguard Zone (Surface Water)',
          source_layer: r.source_layer,
          percentage_coverage: r.percentage_coverage,
          riskLevel: getDrinkingWaterRiskLevel(safeguardSurface)
        }), true, riskFilters);
      }
      if (protectedSurface.length > 0) {
        setLayerData(dwProtectedSurfaceLayer, protectedSurface, (r) => ({
          name: r.name || 'Protected Area (Surface Water)',
          source_layer: r.source_layer,
          percentage_coverage: r.percentage_coverage,
          riskLevel: getDrinkingWaterRiskLevel(protectedSurface)
        }), true, riskFilters);
      }
      if (safeguardGroundwater.length > 0) {
        setLayerData(dwSafeguardGroundwaterLayer, safeguardGroundwater, (r) => ({
          name: r.name || 'Safeguard Zone (Groundwater)',
          source_layer: r.source_layer,
          percentage_coverage: r.percentage_coverage,
          riskLevel: getDrinkingWaterRiskLevel(safeguardGroundwater)
        }), true, riskFilters);
      }
    }
  }

  onMount(async () => {
    // Lazy-import Leaflet only on client
    L = (await import('leaflet')).default;
    // Bring in leaflet-draw for side effects (no typings)
    await import('leaflet-draw');
    // Bring in leaflet-ruler for side effects
    await import('leaflet-ruler');

    // Initialize map
    map = L.map(mapContainer).setView([51.505, -0.09], 13);

    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Patch ruler control before addTo so onAdd registers the patched versions
    const rulerControl = L.control.ruler({ position: 'topright' });

    // Patch _toggleMeasure: clear old measurement layers when re-enabling
    const _origToggleMeasure = rulerControl._toggleMeasure.bind(rulerControl);
    rulerControl._toggleMeasure = function() {
      if (!this._choice && this._map) {
        this._map.removeLayer(this._allLayers);
        this._allLayers = L.layerGroup();
      }
      _origToggleMeasure();
    };

    // Patch _closePath: clean up without calling _toggleMeasure so the result
    // stays visible; clicking the ruler button again clears it
    rulerControl._closePath = function() {
      this._map.removeLayer(this._tempLine);
      this._map.removeLayer(this._tempPoint);
      if (this._clickCount <= 1) this._map.removeLayer(this._pointLayer);
      this._choice = false;
      this._container.classList.remove('leaflet-ruler-clicked');
      this._map.doubleClickZoom.enable();
      L.DomEvent.off(this._map._container, 'keydown', this._escape, this);
      L.DomEvent.off(this._map._container, 'dblclick', this._closePath, this);
      this._map._container.style.cursor = this._defaultCursor;
      this._map.off('click', this._clicked, this);
      this._map.off('mousemove', this._moving, this);
      L.DomEvent.on(this._container, 'click', this._toggleMeasure, this);
    };

    // Patch _clicked: auto-close after second point
    const _origClicked = rulerControl._clicked.bind(rulerControl);
    rulerControl._clicked = function(e) {
      _origClicked(e);
      if (this._clickCount === 2) {
        setTimeout(() => this._closePath(), 10);
      }
    };


    // Create all layers using factory functions
    conservationAreasLayer = createConservationAreasLayer(L);
    listedBuildingsGradeILayer = createListedBuildingsLayer(L, 'I');
    listedBuildingsGradeIIStarLayer = createListedBuildingsLayer(L, 'II*');
    listedBuildingsGradeIILayer = createListedBuildingsLayer(L, 'II');
    scheduledMonumentsLayer = createScheduledMonumentsLayer(L);
    greenBeltLayer = createGreenBeltLayer(L);
    aonbLayer = createAONBLayer(L);
    nationalParksLayer = createNationalParksLayer(L);
    registeredParksGardensLayer = createRegisteredParksGardensLayer(L);
    worldHeritageSitesLayer = createWorldHeritageSitesLayer(L);
    sssiLayer = createSSSILayer(L);
    nnrLayer = createNationalNatureReservesLayer(L);
    spaLayer = createSPALayer(L);
    sacLayer = createSACLayer(L);
    renewablesLayer = createRenewablesLayer(L);
    ancientWoodlandLayer = createAncientWoodlandLayer(L);
    ukAirportsLayer = createUkAirportsLayer(L);
    dwSafeguardSurfaceLayer = createDWSafeguardSurfaceLayer(L);
    dwProtectedSurfaceLayer = createDWProtectedSurfaceLayer(L);
    dwSafeguardGroundwaterLayer = createDWSafeguardGroundwaterLayer(L);

    // EA Flood Zones WMS layer
    floodZonesWmsLayer = L.tileLayer.wms('https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones/wms', {
      layers: 'Flood_Zones_2_3_Rivers_and_Sea',
      format: 'image/png',
      transparent: true,
      opacity: 0.8,
      attribution: '&copy; Environment Agency'
    });

    // EA Surface Water Flooding WMS layer
    surfaceWaterWmsLayer = L.tileLayer.wms('https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms', {
      layers: 'rofsw',
      format: 'image/png',
      transparent: true,
      opacity: 0.8,
      attribution: '&copy; Environment Agency'
    });

    // EA Surface Water Flooding (Climate Change) WMS layer
    surfaceWaterCCWmsLayer = L.tileLayer.wms('https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water-climate-change/wms', {
      layers: 'rofsw_cc01',
      format: 'image/png',
      transparent: true,
      opacity: 0.8,
      attribution: '&copy; Environment Agency'
    });

    // Provisional ALC WMS layer
    alcWmsLayer = L.tileLayer.wms('https://environment.data.gov.uk/spatialdata/agricultural-land-classification-provisional-england/wms', {
      layers: 'Agricultural_Land_Classification_Provisional_England',
      format: 'image/png',
      transparent: true,
      opacity: 0.7,
      attribution: '&copy; Natural England'
    });

    // Create controls using the MapControls component
    if (mapControls) {
      mapControls.createLayerControl(L, base);
      rulerControl.addTo(map);
      // Ensure ruler starts inactive after DOM insertion
      rulerControl._choice = false;
      rulerControl._container?.classList.remove('leaflet-ruler-clicked');
      map._container.style.cursor = rulerControl._defaultCursor || '';
      map.off('click', rulerControl._clicked, rulerControl);
      map.off('mousemove', rulerControl._moving, rulerControl);
      mapControls.createRiskFilterControl(L);
      // Draw control will be created reactively based on drawingEnabled
    }

    // Ensure tiles render fully if container size changed during mount
    setTimeout(() => {
      map?.invalidateSize();
    }, 0);
  });

  // Reactive draw control - enable/disable based on drawingEnabled prop
  $: if (map && mapControls && drawnItems && L) {
    if (drawingEnabled && !drawControl) {
      // Enable drawing - create the draw control
      drawControl = mapControls.createDrawControl(L, drawnItems, onPolygonDrawn);
      console.log('✅ Drawing controls enabled');
    } else if (!drawingEnabled && drawControl) {
      // Disable drawing - remove the draw control
      mapControls.removeDrawControl(drawControl);
      drawControl = null;
      console.log('🚫 Drawing controls disabled');
    }
  }

  // Reactive data updates for heritage data
  $: if (heritageData?.conservation_areas) {
    console.log('🏛️ First conservation area structure:', heritageData.conservation_areas[0]);
    setLayerData(conservationAreasLayer, heritageData.conservation_areas, (r) => ({
      name: r.name,
      riskLevel: getConservationAreaRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (heritageData?.listed_buildings) {
    // Filter buildings by grade and apply to appropriate layers
    const gradeIBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'I');
    const gradeIIStarBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'II*');
    const gradeIIBuildings = filterBuildingsByGrade(heritageData.listed_buildings, 'II');

    setLayerData(listedBuildingsGradeILayer, gradeIBuildings, (r) => ({
      name: r.name,
      grade: r.grade,
      riskLevel: getBuildingRiskLevel(r)
    }), true, riskFilters);

    setLayerData(listedBuildingsGradeIIStarLayer, gradeIIStarBuildings, (r) => ({
      name: r.name,
      grade: r.grade,
      riskLevel: getBuildingRiskLevel(r)
    }), true, riskFilters);

    setLayerData(listedBuildingsGradeIILayer, gradeIIBuildings, (r) => ({
      name: r.name,
      grade: r.grade,
      riskLevel: getBuildingRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (heritageData?.scheduled_monuments) {
    console.log('🏛️ Scheduled monuments data received:', heritageData.scheduled_monuments);
    console.log('🏛️ Scheduled monuments count:', heritageData.scheduled_monuments.length);
    console.log('🔍 First scheduled monument structure:', heritageData.scheduled_monuments[0]);

    const monumentsWithGeometry = processScheduledMonuments(heritageData.scheduled_monuments);

    console.log('🔧 Converted scheduled monuments with geometry:', monumentsWithGeometry[0]);
    setLayerData(scheduledMonumentsLayer, monumentsWithGeometry, (r) => ({
      name: r.name,
      riskLevel: getScheduledMonumentRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (heritageData?.registered_parks_gardens) {
    console.log('🟠 Registered Parks/Gardens data received:', heritageData.registered_parks_gardens);
    console.log('🟠 Registered Parks/Gardens count:', heritageData.registered_parks_gardens.length);
    console.log('🔍 First Registered Park/Garden structure:', heritageData.registered_parks_gardens[0]);
    setLayerData(registeredParksGardensLayer, heritageData.registered_parks_gardens, (r) => ({
      name: r.name || 'Registered Park/Garden',
      grade: r.grade,
      riskLevel: getRegisteredParksGardensRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (heritageData?.world_heritage_sites) {
    console.log('🟣 World Heritage Sites data received:', heritageData.world_heritage_sites);
    console.log('🟣 World Heritage Sites count:', heritageData.world_heritage_sites.length);
    console.log('🔍 First World Heritage Site structure:', heritageData.world_heritage_sites[0]);
    setLayerData(worldHeritageSitesLayer, heritageData.world_heritage_sites, (r) => ({
      name: r.name || 'World Heritage Site',
      riskLevel: getWorldHeritageSiteRiskLevel(r)
    }), true, riskFilters);
  }

  // Reactive data updates for ecology data
  $: if (ecologyData?.sssi) {
    console.log('🟢 SSSI data received:', ecologyData.sssi);
    console.log('🟢 SSSI count:', ecologyData.sssi.length);
    console.log('🔍 First SSSI structure:', ecologyData.sssi[0]);
    setLayerData(sssiLayer, ecologyData.sssi, (r) => ({
      name: r.name || 'SSSI',
      ref_code: r.ref_code,
      riskLevel: getSSSIRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (ecologyData?.national_nature_reserves) {
    console.log('🟢 NNR data received:', ecologyData.national_nature_reserves);
    console.log('🟢 NNR count:', ecologyData.national_nature_reserves.length);
    setLayerData(nnrLayer, ecologyData.national_nature_reserves, (r) => ({
      name: r.name || 'National Nature Reserve',
      ref_code: r.ref_code,
      riskLevel: getNationalNatureReservesRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (ecologyData?.spa) {
    console.log('🟣 SPA data received:', ecologyData.spa);
    console.log('🟣 SPA count:', ecologyData.spa.length);
    if (ecologyData.spa.length > 0) {
      console.log('🔍 First SPA structure:', ecologyData.spa[0]);
    }
    setLayerData(spaLayer, ecologyData.spa, (r) => ({
      name: r.name || 'Special Protection Area',
      code: r.code,
      riskLevel: getSPARiskLevel(r)
    }), true, riskFilters);
  }

  $: if (ecologyData?.sac) {
    console.log('💗 SAC data received:', ecologyData.sac);
    console.log('💗 SAC count:', ecologyData.sac.length);
    if (ecologyData.sac.length > 0) {
      console.log('🔍 First SAC structure:', ecologyData.sac[0]);
    }
    setLayerData(sacLayer, ecologyData.sac, (r) => ({
      name: r.name || 'Special Area of Conservation',
      code: r.code,
      riskLevel: getSACRiskLevel(r)
    }), true, riskFilters);
  }

  $: if (ecologyData?.drinking_water) {
    console.log('💧 Drinking Water data received:', ecologyData.drinking_water);
    console.log('💧 Drinking Water count:', ecologyData.drinking_water.length);

    const safeguardSurface = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'safeguard_surface');
    const protectedSurface = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'protected_surface');
    const safeguardGroundwater = ecologyData.drinking_water.filter((/** @type {any} */ d) => d.source_layer === 'safeguard_groundwater');

    if (safeguardSurface.length > 0) {
      setLayerData(dwSafeguardSurfaceLayer, safeguardSurface, (r) => ({
        name: r.name || 'Safeguard Zone (Surface Water)',
        source_layer: r.source_layer,
        percentage_coverage: r.percentage_coverage,
        riskLevel: getDrinkingWaterRiskLevel(safeguardSurface)
      }), true, riskFilters);
    }

    if (protectedSurface.length > 0) {
      setLayerData(dwProtectedSurfaceLayer, protectedSurface, (r) => ({
        name: r.name || 'Protected Area (Surface Water)',
        source_layer: r.source_layer,
        percentage_coverage: r.percentage_coverage,
        riskLevel: getDrinkingWaterRiskLevel(protectedSurface)
      }), true, riskFilters);
    }

    if (safeguardGroundwater.length > 0) {
      setLayerData(dwSafeguardGroundwaterLayer, safeguardGroundwater, (r) => ({
        name: r.name || 'Safeguard Zone (Groundwater)',
        source_layer: r.source_layer,
        percentage_coverage: r.percentage_coverage,
        riskLevel: getDrinkingWaterRiskLevel(safeguardGroundwater)
      }), true, riskFilters);
    }
  }

  // Reactive data updates for landscape data
  $: if (landscapeData?.green_belt) {
    console.log('🟢 Green Belt data received:', landscapeData.green_belt);
    console.log('🟢 Green Belt count:', landscapeData.green_belt.length);
    console.log('🔍 First Green Belt feature structure:', landscapeData.green_belt[0]);
    setLayerData(greenBeltLayer, landscapeData.green_belt, (r) => ({
      name: r.name || 'Green Belt',
      riskLevel: getGreenBeltRiskLevel(r)
    }), false, riskFilters); // false = don't apply risk filter which requires geometry
  }

  $: if (landscapeData?.aonb) {
    console.log('🔵 AONB data received:', landscapeData.aonb);
    console.log('🔵 AONB count:', landscapeData.aonb.length);
    console.log('🔍 First AONB feature structure:', landscapeData.aonb[0]);
    setLayerData(aonbLayer, landscapeData.aonb, (r) => ({
      name: r.name || 'AONB',
      riskLevel: getAONBRiskLevel(r)
    }), true, riskFilters); // true = apply risk filter using geometry
  }

  $: if (landscapeData?.national_parks) {
    console.log('🟣 National Parks data received:', landscapeData.national_parks);
    console.log('🟣 National Parks count:', landscapeData.national_parks.length);
    console.log('🔍 First National Park feature structure:', landscapeData.national_parks[0]);
    setLayerData(nationalParksLayer, landscapeData.national_parks, (r) => ({
      name: r.name || 'National Park',
      riskLevel: getNationalParksRiskLevel(r)
    }), true, riskFilters); // true = apply risk filter using geometry
  }

  // Reactive data updates for renewables data
  $: if (renewablesData) {
    console.log('⚡ Full renewables data:', renewablesData);
    console.log('⚡ renewablesData keys:', Object.keys(renewablesData));

    // Check if it has renewables property
    if (renewablesData.renewables) {
      console.log('⚡ Renewables data found:', renewablesData.renewables);
      console.log('⚡ Renewables count:', renewablesData.renewables.length);
      console.log('🔍 First renewables item structure:', renewablesData.renewables[0]);
    } else {
      console.log('❌ No renewables property found in renewablesData');
    }

    const renewablesWithGeometry = processRenewablesData(renewablesData.renewables);

    console.log('🔧 Converted renewables with geometry:', renewablesWithGeometry.length > 0 ? renewablesWithGeometry[0] : 'No renewables data');

    // Debug: Check risk levels before filtering
    if (renewablesWithGeometry.length > 0) {
      console.log('🎯 Checking renewables risk levels:');
      renewablesWithGeometry.forEach((r, i) => {
        const riskLevel = getRenewablesRiskLevel(r);
        console.log(`  [${i}] ${r.site_name}: status="${r.development_status_short}", on_site=${r.on_site}, riskLevel="${riskLevel}"`);
      });
      console.log('🎯 Current risk filters:', riskFilters);
    }

    setLayerData(renewablesLayer, renewablesWithGeometry, (r) => ({
      site_name: r.site_name,
      technology_type: r.technology_type,
      installed_capacity_mw: r.installed_capacity_mw,
      development_status_short: r.development_status_short,
      planning_authority: r.planning_authority,
      planning_application_reference: r.planning_application_reference,
      riskLevel: getRenewablesRiskLevel(r)
    }), true, riskFilters);
  }

  // Reactive data updates for trees data
  $: if (treesData?.ancient_woodland) {
    console.log('🌳 Ancient Woodland data received:', treesData.ancient_woodland);
    console.log('🌳 Ancient Woodland count:', treesData.ancient_woodland.length);
    if (treesData.ancient_woodland.length > 0) {
      console.log('🔍 First Ancient Woodland structure:', treesData.ancient_woodland[0]);
    }
    setLayerData(ancientWoodlandLayer, treesData.ancient_woodland, (r) => ({
      name: r.name || 'Ancient Woodland',
      theme: r.theme,
      riskLevel: getAncientWoodlandRiskLevel(r)
    }), true, riskFilters);
  }

  // Reactive data updates for airfields data
  $: if (airfieldsData?.uk_airports) {
    console.log('✈️ UK Airports data received:', airfieldsData.uk_airports);
    console.log('✈️ UK Airports count:', airfieldsData.uk_airports.length);
    if (airfieldsData.uk_airports.length > 0) {
      console.log('🔍 First UK Airport structure:', airfieldsData.uk_airports[0]);
    }
    setLayerData(ukAirportsLayer, airfieldsData.uk_airports, (r) => ({
      name: r.name || 'UK Airport',
      aeroway_type: r.aeroway_type,
      riskLevel: getUkAirportsRiskLevel(r)
    }), true, riskFilters);
  }
</script>

<div bind:this={mapContainer} class="map-container"></div>

<MapControls
  bind:this={mapControls}
  {map}
  {riskFilters}
  onRiskFilterChange={updateLayerVisibility}
  {conservationAreasLayer}
  {listedBuildingsGradeILayer}
  {listedBuildingsGradeIIStarLayer}
  {listedBuildingsGradeIILayer}
  {scheduledMonumentsLayer}
  {registeredParksGardensLayer}
  {worldHeritageSitesLayer}
  {sssiLayer}
  {nnrLayer}
  {spaLayer}
  {sacLayer}
  {dwSafeguardSurfaceLayer}
  {dwProtectedSurfaceLayer}
  {dwSafeguardGroundwaterLayer}
  {greenBeltLayer}
  {aonbLayer}
  {nationalParksLayer}
  {renewablesLayer}
  {ancientWoodlandLayer}
  {ukAirportsLayer}
  {floodZonesWmsLayer}
  {surfaceWaterWmsLayer}
  {surfaceWaterCCWmsLayer}
  {alcWmsLayer}
/>

<style>
  .map-container {
    height: 100%;
    width: 100%;
    min-height: 400px;
    position: relative;
  }
</style>