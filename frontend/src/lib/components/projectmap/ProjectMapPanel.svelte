<script>
  import { onMount } from 'svelte';
  import { getRenewables, getDataCentres, getProjects, getTRPCommercial, getTRPEnergy, getTRPResidential, getREPDSolar, getREPDWind, getREPDBattery } from '$lib/services/projectmap/projectMapApi.js';

  /** @type {HTMLDivElement | null} */
  let mapContainer = null;
  /** @type {import('leaflet').Map | null} */
  let map = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let renewablesLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let dataCentresLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let projectsLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let trpCommercialLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let trpEnergyLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let trpResidentialLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let repdSolarLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let repdWindLayer = null;
  /** @type {import('leaflet').LayerGroup | null} */
  let repdBatteryLayer = null;

  // Layer visibility state (off by default)
  let showRenewables = false;
  let showDataCentres = false;
  let showProjects = false;
  let showTRPCommercial = false;
  let showTRPEnergy = false;
  let showTRPResidential = false;
  let showREPDSolar = false;
  let showREPDWind = false;
  let showREPDBattery = false;

  // Loading states
  let loadingRenewables = false;
  let loadingDataCentres = false;
  let loadingProjects = false;
  let loadingTRPCommercial = false;
  let loadingTRPEnergy = false;
  let loadingTRPResidential = false;
  let loadingREPDSolar = false;
  let loadingREPDWind = false;
  let loadingREPDBattery = false;
  let errorMsg = '';

  // Data
  let renewablesData = null;
  let dataCentresData = null;
  let projectsData = null;
  let trpCommercialData = null;
  let trpEnergyData = null;
  let trpResidentialData = null;
  let repdSolarData = null;
  let repdWindData = null;
  let repdBatteryData = null;

  // Count only un-dismissed items
  $: undismissedRenewablesCount = renewablesData?.features.filter(f => !f.properties.dismissed).length || 0;
  $: undismissedDataCentresCount = dataCentresData?.features.filter(f => !f.properties.dismissed).length || 0;
  $: projectsCount = projectsData?.features.length || 0;
  $: trpCommercialCount = trpCommercialData?.features.length || 0;
  $: trpEnergyCount = trpEnergyData?.features.length || 0;
  $: trpResidentialCount = trpResidentialData?.features.length || 0;

  onMount(async () => {
    // Dynamic import to avoid SSR issues
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    // Initialize the map
    map = L.map(mapContainer).setView([54.5, -2.0], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Initialize layer groups
    renewablesLayer = L.layerGroup();
    dataCentresLayer = L.layerGroup();
    projectsLayer = L.layerGroup();
    trpCommercialLayer = L.layerGroup();
    trpEnergyLayer = L.layerGroup();
    trpResidentialLayer = L.layerGroup();
    repdSolarLayer = L.layerGroup();
    repdWindLayer = L.layerGroup();
    repdBatteryLayer = L.layerGroup();

    // Fetch data
    await fetchLayers(L);

    return () => {
      if (map) {
        map.remove();
      }
    };
  });

  async function fetchLayers(L) {
    // Fetch renewables
    try {
      loadingRenewables = true;
      renewablesData = await getRenewables();
      createRenewablesLayer(L, renewablesData);
      console.log(`✅ Loaded ${renewablesData.features.length} renewables`);
    } catch (error) {
      console.error('Failed to load renewables:', error);
      errorMsg = 'Failed to load renewables data';
    } finally {
      loadingRenewables = false;
    }

    // Fetch data centres
    try {
      loadingDataCentres = true;
      dataCentresData = await getDataCentres();
      createDataCentresLayer(L, dataCentresData);
      console.log(`✅ Loaded ${dataCentresData.features.length} data centres`);
    } catch (error) {
      console.error('Failed to load data centres:', error);
      errorMsg = errorMsg ? errorMsg + ' and data centres' : 'Failed to load data centres data';
    } finally {
      loadingDataCentres = false;
    }

    // Fetch projects
    try {
      loadingProjects = true;
      projectsData = await getProjects();
      createProjectsLayer(L, projectsData);
      console.log(`✅ Loaded ${projectsData.features.length} projects`);
    } catch (error) {
      console.error('Failed to load projects:', error);
      errorMsg = errorMsg ? errorMsg + ', projects' : 'Failed to load projects data';
    } finally {
      loadingProjects = false;
    }

    // Fetch TRP Commercial
    try {
      loadingTRPCommercial = true;
      trpCommercialData = await getTRPCommercial();
      createTRPCommercialLayer(L, trpCommercialData);
      console.log(`✅ Loaded ${trpCommercialData.features.length} TRP Commercial projects`);
    } catch (error) {
      console.error('Failed to load TRP Commercial:', error);
      errorMsg = errorMsg ? errorMsg + ', TRP Commercial' : 'Failed to load TRP Commercial data';
    } finally {
      loadingTRPCommercial = false;
    }

    // Fetch TRP Energy
    try {
      loadingTRPEnergy = true;
      trpEnergyData = await getTRPEnergy();
      createTRPEnergyLayer(L, trpEnergyData);
      console.log(`✅ Loaded ${trpEnergyData.features.length} TRP Energy projects`);
    } catch (error) {
      console.error('Failed to load TRP Energy:', error);
      errorMsg = errorMsg ? errorMsg + ', TRP Energy' : 'Failed to load TRP Energy data';
    } finally {
      loadingTRPEnergy = false;
    }

    // Fetch TRP Residential
    try {
      loadingTRPResidential = true;
      trpResidentialData = await getTRPResidential();
      createTRPResidentialLayer(L, trpResidentialData);
      console.log(`✅ Loaded ${trpResidentialData.features.length} TRP Residential projects`);
    } catch (error) {
      console.error('Failed to load TRP Residential:', error);
      errorMsg = errorMsg ? errorMsg + ', TRP Residential' : 'Failed to load TRP Residential data';
    } finally {
      loadingTRPResidential = false;
    }

    // Fetch REPD Solar
    try {
      loadingREPDSolar = true;
      repdSolarData = await getREPDSolar();
      createREPDSolarLayer(L, repdSolarData);
      console.log(`✅ Loaded ${repdSolarData.features.length} REPD Solar projects`);
    } catch (error) {
      console.error('Failed to load REPD Solar:', error);
      errorMsg = errorMsg ? errorMsg + ', REPD Solar' : 'Failed to load REPD Solar data';
    } finally {
      loadingREPDSolar = false;
    }

    // Fetch REPD Wind
    try {
      loadingREPDWind = true;
      repdWindData = await getREPDWind();
      createREPDWindLayer(L, repdWindData);
      console.log(`✅ Loaded ${repdWindData.features.length} REPD Wind projects`);
    } catch (error) {
      console.error('Failed to load REPD Wind:', error);
      errorMsg = errorMsg ? errorMsg + ', REPD Wind' : 'Failed to load REPD Wind data';
    } finally {
      loadingREPDWind = false;
    }

    // Fetch REPD Battery
    try {
      loadingREPDBattery = true;
      repdBatteryData = await getREPDBattery();
      createREPDBatteryLayer(L, repdBatteryData);
      console.log(`✅ Loaded ${repdBatteryData.features.length} REPD Battery projects`);
    } catch (error) {
      console.error('Failed to load REPD Battery:', error);
      errorMsg = errorMsg ? errorMsg + ', REPD Battery' : 'Failed to load REPD Battery data';
    } finally {
      loadingREPDBattery = false;
    }
  }

  function createRenewablesLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const { latitude, longitude, dismissed } = feature.properties;

      // Skip dismissed items
      if (dismissed) return;

      if (!latitude || !longitude) return;

      // Create circle marker for renewables (green)
      const marker = L.circleMarker([parseFloat(latitude), parseFloat(longitude)], {
        radius: 6,
        fillColor: '#16a34a',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const props = feature.properties;
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #16a34a;">
            Renewables Project
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${props.name || 'N/A'}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${props.app_type || 'N/A'}</p>
            ${props.status_class ? `<p style="margin: 4px 0;"><strong>Status:</strong> ${props.status_class}</p>` : ''}
            ${props.development_type ? `<p style="margin: 4px 0;"><strong>Development:</strong> ${props.development_type}</p>` : ''}
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.postcode ? `<p style="margin: 4px 0;"><strong>Postcode:</strong> ${props.postcode}</p>` : ''}
            ${props.url ? `<p style="margin: 4px 0;"><a href="${props.url}" target="_blank" rel="noopener noreferrer" style="color: #16a34a;">View Details</a></p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      renewablesLayer.addLayer(marker);
    });
  }

  function createDataCentresLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const { latitude, longitude, dismissed } = feature.properties;

      // Skip dismissed items
      if (dismissed) return;

      if (!latitude || !longitude) return;

      // Create circle marker for data centres (blue)
      const marker = L.circleMarker([parseFloat(latitude), parseFloat(longitude)], {
        radius: 6,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const props = feature.properties;
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #3b82f6;">
            Data Centre Project
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${props.name || 'N/A'}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${props.app_type || 'N/A'}</p>
            ${props.decision ? `<p style="margin: 4px 0;"><strong>Decision:</strong> ${props.decision}</p>` : ''}
            ${props.development_type ? `<p style="margin: 4px 0;"><strong>Development:</strong> ${props.development_type}</p>` : ''}
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.postcode ? `<p style="margin: 4px 0;"><strong>Postcode:</strong> ${props.postcode}</p>` : ''}
            ${props.url ? `<p style="margin: 4px 0;"><a href="${props.url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">View Details</a></p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      dataCentresLayer.addLayer(marker);
    });
  }

  function createProjectsLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      // Get coordinates from the centroid geometry
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;

      // Create circle marker for projects (purple)
      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        fillColor: '#a855f7',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });

      // Create popup content
      const props = feature.properties;
      const lpa = props.local_planning_authority
        ? (Array.isArray(props.local_planning_authority)
          ? props.local_planning_authority.join(', ')
          : JSON.stringify(props.local_planning_authority))
        : 'N/A';

      const popupContent = `
        <div style="min-width: 250px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #a855f7;">
            Project: ${props.project_name || 'N/A'}
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Project ID:</strong> ${props.project_id || 'N/A'}</p>
            ${props.client ? `<p style="margin: 4px 0;"><strong>Client:</strong> ${props.client}</p>` : ''}
            ${props.sector ? `<p style="margin: 4px 0;"><strong>Sector:</strong> ${props.sector}</p>` : ''}
            ${props.project_type ? `<p style="margin: 4px 0;"><strong>Type:</strong> ${props.project_type}</p>` : ''}
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.area ? `<p style="margin: 4px 0;"><strong>Area:</strong> ${props.area}</p>` : ''}
            <p style="margin: 4px 0;"><strong>LPA:</strong> ${lpa}</p>
            ${props.project_lead ? `<p style="margin: 4px 0;"><strong>Lead:</strong> ${props.project_lead}</p>` : ''}
            ${props.project_manager ? `<p style="margin: 4px 0;"><strong>Manager:</strong> ${props.project_manager}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      projectsLayer.addLayer(marker);
    });
  }

  function createTRPCommercialLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;

      // Create circle marker for TRP Commercial (orange)
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: '#f97316',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const props = feature.properties;
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #f97316;">
            TRP: Commercial, Economic & Industrial
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${props.name || 'N/A'}</p>
            ${props.description ? `<p style="margin: 4px 0;"><strong>Description:</strong> ${props.description}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      trpCommercialLayer.addLayer(marker);
    });
  }

  function createTRPEnergyLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;

      // Create circle marker for TRP Energy (amber/yellow)
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: '#eab308',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const props = feature.properties;
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #eab308;">
            TRP: Energy, Digital & Infrastructure
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${props.name || 'N/A'}</p>
            ${props.description ? `<p style="margin: 4px 0;"><strong>Description:</strong> ${props.description}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      trpEnergyLayer.addLayer(marker);
    });
  }

  function createTRPResidentialLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;

      // Create circle marker for TRP Residential (teal)
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: '#14b8a6',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const props = feature.properties;
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #14b8a6;">
            TRP: Residential & Strategic Land
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${props.name || 'N/A'}</p>
            ${props.description ? `<p style="margin: 4px 0;"><strong>Description:</strong> ${props.description}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      trpResidentialLayer.addLayer(marker);
    });
  }

  // Helper function to get color based on development status
  function getStatusColor(status) {
    const statusColors = {
      'Operational': '#10b981',           // Green - live projects
      'Under Construction': '#f59e0b',    // Orange - being built
      'Awaiting Construction': '#eab308', // Yellow - approved, waiting to build
      'Application Submitted': '#3b82f6', // Blue - in planning
      'Application Refused': '#ef4444',   // Red - rejected
      'Planning Permission Expired': '#6b7280', // Gray - expired
      'No Application Required': '#8b5cf6', // Purple - special case
      'Abandoned': '#4b5563'              // Dark gray - abandoned
    };
    return statusColors[status] || '#94a3b8'; // Default to light gray
  }

  function createREPDSolarLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;
      const props = feature.properties;
      const statusColor = getStatusColor(props.dev_status_short);

      // Create circle marker for REPD Solar with status-based color and black border
      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: statusColor,
        color: '#000000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const popupContent = `
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${statusColor};">
            REPD Solar: ${props.site_name || 'N/A'}
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Capacity:</strong> ${props.capacity || 'N/A'} MW</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${props.dev_status_short || 'N/A'}</span></p>
            <p style="margin: 4px 0;"><strong>Operator:</strong> ${props.operator || 'N/A'}</p>
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.planning_ref ? `<p style="margin: 4px 0;"><strong>Planning Ref:</strong> ${props.planning_ref}</p>` : ''}
            ${props.last_updated ? `<p style="margin: 4px 0;"><strong>Last Updated:</strong> ${props.last_updated}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      repdSolarLayer.addLayer(marker);
    });
  }

  function createREPDWindLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;
      const props = feature.properties;
      const statusColor = getStatusColor(props.dev_status_short);

      // Create circle marker for REPD Wind with status-based color and black border
      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: statusColor,
        color: '#000000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const popupContent = `
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${statusColor};">
            REPD Wind: ${props.site_name || 'N/A'}
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Capacity:</strong> ${props.capacity || 'N/A'} MW</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${props.dev_status_short || 'N/A'}</span></p>
            <p style="margin: 4px 0;"><strong>Operator:</strong> ${props.operator || 'N/A'}</p>
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.planning_ref ? `<p style="margin: 4px 0;"><strong>Planning Ref:</strong> ${props.planning_ref}</p>` : ''}
            ${props.last_updated ? `<p style="margin: 4px 0;"><strong>Last Updated:</strong> ${props.last_updated}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      repdWindLayer.addLayer(marker);
    });
  }

  function createREPDBatteryLayer(L, geojson) {
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feature => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return;

      const [lng, lat] = coordinates;
      const props = feature.properties;
      const statusColor = getStatusColor(props.dev_status_short);

      // Create circle marker for REPD Battery with status-based color and black border
      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: statusColor,
        color: '#000000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
      });

      // Create popup content
      const popupContent = `
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${statusColor};">
            REPD Battery: ${props.site_name || 'N/A'}
          </h3>
          <div style="font-size: 13px; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>Capacity:</strong> ${props.capacity || 'N/A'} MW</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${props.dev_status_short || 'N/A'}</span></p>
            <p style="margin: 4px 0;"><strong>Operator:</strong> ${props.operator || 'N/A'}</p>
            ${props.address ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${props.address}</p>` : ''}
            ${props.planning_ref ? `<p style="margin: 4px 0;"><strong>Planning Ref:</strong> ${props.planning_ref}</p>` : ''}
            ${props.last_updated ? `<p style="margin: 4px 0;"><strong>Last Updated:</strong> ${props.last_updated}</p>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      repdBatteryLayer.addLayer(marker);
    });
  }

  // Reactive statements to toggle layers when checkboxes change
  $: if (map && renewablesLayer) {
    if (showRenewables) {
      renewablesLayer.addTo(map);
    } else {
      map.removeLayer(renewablesLayer);
    }
  }

  $: if (map && dataCentresLayer) {
    if (showDataCentres) {
      dataCentresLayer.addTo(map);
    } else {
      map.removeLayer(dataCentresLayer);
    }
  }

  $: if (map && projectsLayer) {
    if (showProjects) {
      projectsLayer.addTo(map);
    } else {
      map.removeLayer(projectsLayer);
    }
  }

  $: if (map && trpCommercialLayer) {
    if (showTRPCommercial) {
      trpCommercialLayer.addTo(map);
    } else {
      map.removeLayer(trpCommercialLayer);
    }
  }

  $: if (map && trpEnergyLayer) {
    if (showTRPEnergy) {
      trpEnergyLayer.addTo(map);
    } else {
      map.removeLayer(trpEnergyLayer);
    }
  }

  $: if (map && trpResidentialLayer) {
    if (showTRPResidential) {
      trpResidentialLayer.addTo(map);
    } else {
      map.removeLayer(trpResidentialLayer);
    }
  }

  $: if (map && repdSolarLayer) {
    if (showREPDSolar) {
      repdSolarLayer.addTo(map);
    } else {
      map.removeLayer(repdSolarLayer);
    }
  }

  $: if (map && repdWindLayer) {
    if (showREPDWind) {
      repdWindLayer.addTo(map);
    } else {
      map.removeLayer(repdWindLayer);
    }
  }

  $: if (map && repdBatteryLayer) {
    if (showREPDBattery) {
      repdBatteryLayer.addTo(map);
    } else {
      map.removeLayer(repdBatteryLayer);
    }
  }
</script>

<div class="project-map-panel">
  <div class="map-container" bind:this={mapContainer}></div>

  <!-- Layer Controls -->
  <div class="layer-controls">
    <div class="controls-header">
      <i class="las la-layer-group"></i>
      <span>Layers</span>
    </div>

    <!-- Projects Group -->
    <div class="layer-group">
      <div class="group-header">Projects</div>

      <div class="control-item">
        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={showProjects}
            disabled={loadingProjects}
          />
          <span class="layer-color projects"></span>
          <span class="layer-name">
            Dashboard Projects
            {#if projectsData}
              <span class="layer-count">({projectsCount})</span>
            {/if}
          </span>
        </label>
      </div>

      <!-- MyMaps Import Sub-group -->
      <div class="layer-subgroup">
        <div class="subgroup-header">MyMaps import</div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showTRPCommercial}
              disabled={loadingTRPCommercial}
            />
            <span class="layer-color trp-commercial"></span>
            <span class="layer-name">
              TRP: Commercial
              {#if trpCommercialData}
                <span class="layer-count">({trpCommercialCount})</span>
              {/if}
            </span>
          </label>
        </div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showTRPEnergy}
              disabled={loadingTRPEnergy}
            />
            <span class="layer-color trp-energy"></span>
            <span class="layer-name">
              TRP: Energy
              {#if trpEnergyData}
                <span class="layer-count">({trpEnergyCount})</span>
              {/if}
            </span>
          </label>
        </div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showTRPResidential}
              disabled={loadingTRPResidential}
            />
            <span class="layer-color trp-residential"></span>
            <span class="layer-name">
              TRP: Residential
              {#if trpResidentialData}
                <span class="layer-count">({trpResidentialCount})</span>
              {/if}
            </span>
          </label>
        </div>
      </div>
    </div>

    <!-- External Projects Group -->
    <div class="layer-group">
      <div class="group-header">External Projects</div>

      <!-- Web Scrapers Sub-group -->
      <div class="layer-subgroup">
        <div class="subgroup-header">Web Scrapers</div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showRenewables}
              disabled={loadingRenewables}
            />
            <span class="layer-color renewables"></span>
            <span class="layer-name">
              Planit API Renewables
              {#if renewablesData}
                <span class="layer-count">({undismissedRenewablesCount})</span>
              {/if}
            </span>
          </label>
        </div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showDataCentres}
              disabled={loadingDataCentres}
            />
            <span class="layer-color datacentres"></span>
            <span class="layer-name">
              Planit API Data Centres
              {#if dataCentresData}
                <span class="layer-count">({undismissedDataCentresCount})</span>
              {/if}
            </span>
          </label>
        </div>
      </div>

      <!-- REPD Sub-group -->
      <div class="layer-subgroup">
        <div class="subgroup-header">REPD Oct 25 Q3</div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showREPDSolar}
              disabled={loadingREPDSolar}
            />
            <span class="layer-color repd-solar"></span>
            <span class="layer-name">
              Solar Projects
              {#if repdSolarData}
                <span class="layer-count">({repdSolarData.features.length})</span>
              {/if}
            </span>
          </label>
        </div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showREPDWind}
              disabled={loadingREPDWind}
            />
            <span class="layer-color repd-wind"></span>
            <span class="layer-name">
              Wind Onshore Projects
              {#if repdWindData}
                <span class="layer-count">({repdWindData.features.length})</span>
              {/if}
            </span>
          </label>
        </div>

        <div class="control-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={showREPDBattery}
              disabled={loadingREPDBattery}
            />
            <span class="layer-color repd-battery"></span>
            <span class="layer-name">
              Battery Projects
              {#if repdBatteryData}
                <span class="layer-count">({repdBatteryData.features.length})</span>
              {/if}
            </span>
          </label>
        </div>

        <!-- Status Legend -->
        {#if showREPDSolar || showREPDWind || showREPDBattery}
          <div class="status-legend">
            <div class="legend-title">Development Status</div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #10b981;"></span>
              <span class="legend-label">Operational</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #f59e0b;"></span>
              <span class="legend-label">Under Construction</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #eab308;"></span>
              <span class="legend-label">Awaiting Construction</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #3b82f6;"></span>
              <span class="legend-label">Application Submitted</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #ef4444;"></span>
              <span class="legend-label">Application Refused</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #8b5cf6;"></span>
              <span class="legend-label">No Application Required</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #6b7280;"></span>
              <span class="legend-label">Permission Expired</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background-color: #4b5563;"></span>
              <span class="legend-label">Abandoned</span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if errorMsg}
      <div class="error-message">
        <i class="las la-exclamation-triangle"></i>
        {errorMsg}
      </div>
    {/if}
  </div>
</div>

<style>
  .project-map-panel {
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

  /* Ensure Leaflet styles are properly loaded */
  :global(.leaflet-container) {
    height: 100%;
    width: 100%;
  }

  /* Layer Controls */
  .layer-controls {
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 12px;
    min-width: 200px;
    z-index: 1000;
  }

  .controls-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: #1e293b;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }

  .controls-header i {
    font-size: 16px;
  }

  .layer-group {
    margin-bottom: 16px;
  }

  .layer-group:last-of-type {
    margin-bottom: 0;
  }

  .group-header {
    font-weight: 600;
    font-size: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }

  .layer-subgroup {
    margin-top: 12px;
  }

  .subgroup-header {
    font-weight: 500;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
    font-style: italic;
  }

  .control-item {
    margin-bottom: 8px;
  }

  .control-item:last-child {
    margin-bottom: 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #334155;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .checkbox-label input[type="checkbox"]:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .layer-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #cbd5e1;
  }

  .layer-color.renewables {
    background-color: #16a34a;
  }

  .layer-color.datacentres {
    background-color: #3b82f6;
  }

  .layer-color.projects {
    background-color: #a855f7;
  }

  .layer-color.trp-commercial {
    background-color: #f97316;
  }

  .layer-color.trp-energy {
    background-color: #eab308;
  }

  .layer-color.trp-residential {
    background-color: #14b8a6;
  }

  .layer-color.repd-solar {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #10b981 100%);
  }

  .layer-color.repd-wind {
    background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #10b981 100%);
  }

  .layer-color.repd-battery {
    background: linear-gradient(135deg, #10b981 0%, #eab308 50%, #3b82f6 100%);
  }

  .layer-name {
    flex: 1;
  }

  .layer-count {
    color: #64748b;
    font-size: 12px;
  }

  /* Status Legend */
  .status-legend {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
  }

  .legend-title {
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .legend-color {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid #000000;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: 11px;
    color: #64748b;
    line-height: 1.2;
  }

  .error-message {
    margin-top: 8px;
    padding: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    font-size: 12px;
    color: #991b1b;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .error-message i {
    font-size: 14px;
  }
</style>
