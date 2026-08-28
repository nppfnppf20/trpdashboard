<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { authFetch } from '$lib/api/client.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SearchableDropdown from '$lib/components/shared/SearchableDropdown.svelte';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import NudgeBoundaryModal from '$lib/components/projects/NudgeBoundaryModal.svelte';

  export let isOpen = false;
  export let onClose = () => {};
  export let onProjectCreated = () => {};

  // Lookup options
  let clientOptions = [];
  let clientOptionsLoading = false;
  let teamMemberOptions = [];
  let teamMemberOptionsLoading = false;
  let sectorOptions = [];
  let sectorOptionsLoading = false;
  let subSectorOptions = [];
  let subSectorOptionsLoading = false;
  let developmentTypeOptions = [];
  let developmentTypeOptionsLoading = false;
  let lpaOptions = [];
  let lpaOptionsLoading = false;
  let showLpaDropdown = false;

  // Form data matching database schema
  let formData = {
    project_id: '',
    project_name: '',
    project_type: '',
    local_planning_authority: [], // Array of LPAs
    project_lead: '',
    project_manager: '',
    project_director: '',
    address: '',
    polygon_geojson: null,
    area: '',
    client: '',
    client_spv_name: '',
    sectors: [],
    sub_sectors: [],
    development_types: [],
    designations_on_site: '',
    relevant_nearby_designations: '',
    status: ''
  };

  // Status options for dropdown
  const statusOptions = ['Prospective', 'Instructed', 'Submitted', 'Post-Submission', 'Closed'];
  const projectTypeOptions = ['Full Application', 'DoC', 'NMA', 'S73', 'Appeal', 'Other'];


  // LPA input handling
  let lpaInput = '';

  $: filteredLpaOptions = lpaInput.trim().length > 1
    ? lpaOptions
        .filter(opt =>
          opt.label.toLowerCase().includes(lpaInput.toLowerCase()) &&
          !formData.local_planning_authority.includes(opt.label)
        )
        .slice(0, 8)
    : [];

  // Map state
  let mapContainer;
  let map;
  let L;
  let drawnItems;
  let drawControl;

  // Validation
  let errors = {};
  let saving = false;
  let mapInitialized = false;
  let mapInitError = false;
  let showNudgeBoundary = false;

  $: if (browser && isOpen && !mapInitialized && !mapInitError && mapContainer) {
    initializeMap();
  }

  // Fetch lookup options when modal opens
  $: if (browser && isOpen && clientOptions.length === 0 && !clientOptionsLoading) {
    loadClientOptions();
  }

  $: if (browser && isOpen && teamMemberOptions.length === 0 && !teamMemberOptionsLoading) {
    loadTeamMemberOptions();
  }

  $: if (browser && isOpen && sectorOptions.length === 0 && !sectorOptionsLoading) {
    loadSectorOptions();
  }

  $: if (browser && isOpen && subSectorOptions.length === 0 && !subSectorOptionsLoading) {
    loadSubSectorOptions();
  }

  $: if (browser && isOpen && developmentTypeOptions.length === 0 && !developmentTypeOptionsLoading) {
    loadDevelopmentTypeOptions();
  }

  $: if (browser && isOpen && lpaOptions.length === 0 && !lpaOptionsLoading) {
    loadLpaOptions();
  }

  async function loadClientOptions() {
    clientOptionsLoading = true;
    try {
      clientOptions = await getLookupOptions('client_organisations');
    } catch (error) {
      console.error('Failed to load client options:', error);
    } finally {
      clientOptionsLoading = false;
    }
  }

  async function loadTeamMemberOptions() {
    teamMemberOptionsLoading = true;
    try {
      teamMemberOptions = await getLookupOptions('team_members');
    } catch (error) {
      console.error('Failed to load team member options:', error);
    } finally {
      teamMemberOptionsLoading = false;
    }
  }

  async function loadSectorOptions() {
    sectorOptionsLoading = true;
    try {
      sectorOptions = await getLookupOptions('sectors');
    } catch (error) {
      console.error('Failed to load sector options:', error);
    } finally {
      sectorOptionsLoading = false;
    }
  }

  async function loadLpaOptions() {
    lpaOptionsLoading = true;
    try {
      lpaOptions = await getLookupOptions('local_planning_authorities');
    } catch (error) {
      console.error('Failed to load LPA options:', error);
    } finally {
      lpaOptionsLoading = false;
    }
  }

  async function loadSubSectorOptions() {
    subSectorOptionsLoading = true;
    try {
      subSectorOptions = await getLookupOptions('sub_sectors');
    } catch (error) {
      console.error('Failed to load sub-sector options:', error);
    } finally {
      subSectorOptionsLoading = false;
    }
  }

  async function loadDevelopmentTypeOptions() {
    developmentTypeOptionsLoading = true;
    try {
      developmentTypeOptions = await getLookupOptions('development_types');
    } catch (error) {
      console.error('Failed to load development type options:', error);
    } finally {
      developmentTypeOptionsLoading = false;
    }
  }

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
      mapInitialized = false;
      mapInitError = false;
    }
  });

  async function initializeMap() {
    if (!browser || !mapContainer || mapInitialized) return;

    try {
      // Dynamically import Leaflet and Leaflet Draw
      const leafletModule = await import('leaflet');
      L = leafletModule.default || leafletModule;
      // Required for leaflet-draw UMD plugin to find Leaflet
      window.L = L;

      await import('leaflet-draw');

      await tick(); // Wait for DOM to be ready

      // Initialize map centered on UK
      map = L.map(mapContainer).setView([54.5, -2.5], 6);

      // Add OSM tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Create feature group for drawn items
      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      // Add drawing control
      drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false, // Disabled to avoid strict mode bug
            shapeOptions: {
              color: '#9333ea',
              weight: 3,
              opacity: 0.8,
              fillOpacity: 0.2
            },
            metric: true
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItems,
          remove: true
        }
      });
      map.addControl(drawControl);

      // Debug: Log drawing events
      map.on(L.Draw.Event.DRAWSTART, function () {
        console.log('Drawing started');
      });

      map.on(L.Draw.Event.DRAWSTOP, function () {
        console.log('Drawing stopped');
      });

      map.on(L.Draw.Event.DRAWVERTEX, function (e) {
        console.log('Vertex added:', e);
      });

      // Handle polygon created
      map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        
        // Extract GeoJSON
        const geojson = layer.toGeoJSON().geometry;
        
        // VALIDATION: Check polygon complexity
        const numPoints = geojson.coordinates[0].length;
        if (numPoints > 1000) {
          alert('Polygon too complex. Please draw a simpler shape (max 1000 points).\n\nThis prevents performance issues during analysis.');
          // Don't add the polygon to the map
          return;
        }
        
        drawnItems.clearLayers(); // Only one polygon at a time
        drawnItems.addLayer(layer);
        
        formData.polygon_geojson = JSON.stringify(geojson);

        // Calculate area (approximate)
        const areaInSqMeters = L.GeometryUtil && layer.getLatLngs
          ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
          : null;

        if (areaInSqMeters) {
          const areaInHectares = (areaInSqMeters / 10000).toFixed(2);
          formData.area = `${areaInHectares} ha`;
        }

        // Clear geometry error if it exists
        if (errors.geometry) {
          delete errors.geometry;
          errors = { ...errors };
        }
      });

      // Handle polygon edited
      map.on(L.Draw.Event.EDITED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
          const geojson = layer.toGeoJSON().geometry;
          formData.polygon_geojson = JSON.stringify(geojson);
        });
      });

      // Handle polygon deleted
      map.on(L.Draw.Event.DELETED, function () {
        formData.polygon_geojson = null;
        formData.area = '';
      });

      // Force map to resize after initialization
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 100);

      mapInitialized = true;
    } catch (error) {
      console.error('Error initializing map:', error);
      mapInitError = true;
    }
  }

  function selectLpa(lpaLabel) {
    if (!formData.local_planning_authority.includes(lpaLabel)) {
      formData.local_planning_authority = [...formData.local_planning_authority, lpaLabel];
    }
    lpaInput = '';
    showLpaDropdown = false;
  }

  function removeLPA(index) {
    formData.local_planning_authority = formData.local_planning_authority.filter((_, i) => i !== index);
  }

  function handleLPAKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredLpaOptions.length > 0) {
        selectLpa(filteredLpaOptions[0].label);
      }
    } else if (e.key === 'Escape') {
      showLpaDropdown = false;
    }
  }

  function handleLpaInput() {
    showLpaDropdown = lpaInput.trim().length > 1;
  }


  function validateForm() {
    errors = {};

    if (!formData.project_id.trim()) {
      errors.project_id = 'Project ID is required';
    }

    if (!formData.project_name.trim()) {
      errors.project_name = 'Project Name is required';
    }

    if (!formData.project_type) {
      errors.project_type = 'Project Type is required';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) {
      return;
    }

    if (!formData.polygon_geojson) {
      showNudgeBoundary = true;
      return;
    }

    await doSave();
  }

  async function doSave() {
    saving = true;

    try {
      const response = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onProjectCreated(data.project);
        handleClose();
      } else {
        errors.submit = data.error || 'Failed to create project';
      }
    } catch (error) {
      console.error('Error saving project:', error);
      errors.submit = 'Network error. Please try again.';
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    // Reset form
    formData = {
      project_id: '',
      project_name: '',
      project_type: '',
      local_planning_authority: [],
      project_lead: '',
      project_manager: '',
      project_director: '',
      address: '',
      polygon_geojson: null,
      area: '',
      client: '',
      client_spv_name: '',
      sectors: [],
      sub_sectors: [],
      development_types: [],
      designations_on_site: '',
      relevant_nearby_designations: '',
      status: ''
    };
    errors = {};
    lpaInput = '';

    // Destroy map so it reinitializes fresh next time
    if (map) {
      map.remove();
      map = null;
      mapInitialized = false;
      drawnItems = null;
      drawControl = null;
    }

    onClose();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-container">
      <div class="modal-header">
        <h2>Create New Project</h2>
        <button class="close-btn" on:click={handleClose}>&times;</button>
      </div>

      <div class="modal-body">
        <!-- Left: Form -->
        <div class="form-section">
          <div class="form-scroll">
            <!-- Required Fields -->
            <div class="form-group">
              <label for="project_id">
                Project ID <span class="required">*</span>
              </label>
              <input
                id="project_id"
                type="text"
                bind:value={formData.project_id}
                placeholder="e.g. 1240"
                class:error={errors.project_id}
              />
              {#if errors.project_id}
                <span class="error-text">{errors.project_id}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="project_name">
                Project Name <span class="required">*</span>
              </label>
              <input
                id="project_name"
                type="text"
                bind:value={formData.project_name}
                placeholder="e.g. Tollington Solar"
                class:error={errors.project_name}
              />
              {#if errors.project_name}
                <span class="error-text">{errors.project_name}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="project_type">
                Project Type <span class="required">*</span>
              </label>
              <select id="project_type" bind:value={formData.project_type} class:error={errors.project_type}>
                <option value="">Select project type...</option>
                {#each projectTypeOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
              {#if errors.project_type}
                <span class="error-text">{errors.project_type}</span>
              {/if}
            </div>

            <!-- Local Planning Authority (Multiple) -->
            <div class="form-group">
              <label for="lpa">Local Planning Authority</label>
              <div class="lpa-autocomplete">
                <input
                  id="lpa"
                  type="text"
                  bind:value={lpaInput}
                  on:input={handleLpaInput}
                  on:keydown={handleLPAKeydown}
                  on:focus={() => { if (lpaInput.trim().length > 1) showLpaDropdown = true; }}
                  on:blur={() => setTimeout(() => { showLpaDropdown = false; }, 150)}
                  placeholder={lpaOptionsLoading ? 'Loading...' : formData.local_planning_authority.length > 0 ? 'Search to add another LPA...' : 'Search for an LPA...'}
                  autocomplete="off"
                />
                {#if showLpaDropdown && filteredLpaOptions.length > 0}
                  <div class="lpa-dropdown">
                    {#each filteredLpaOptions as option}
                      <button type="button" class="lpa-option" on:mousedown={() => selectLpa(option.label)}>
                        {option.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              {#if formData.local_planning_authority.length > 0}
                <div class="lpa-tags">
                  {#each formData.local_planning_authority as lpa, index}
                    <span class="lpa-tag">
                      {lpa}
                      <button type="button" on:click={() => removeLPA(index)}>&times;</button>
                    </span>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Client Info -->
            <div class="form-group">
              <label for="client">Client</label>
              <SearchableDropdown
                id="client"
                options={clientOptions}
                bind:value={formData.client}
                valueField="label"
                placeholder="Select a client..."
                loading={clientOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label for="client_spv_name">Client SPV Name</label>
              <input id="client_spv_name" type="text" bind:value={formData.client_spv_name} placeholder="" />
            </div>

            <!-- Project Team -->
            <div class="form-group">
              <label for="project_lead">Project Lead</label>
              <SearchableDropdown
                id="project_lead"
                options={teamMemberOptions}
                bind:value={formData.project_lead}
                valueField="label"
                placeholder="Select project lead..."
                loading={teamMemberOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label for="project_manager">Project Manager</label>
              <SearchableDropdown
                id="project_manager"
                options={teamMemberOptions}
                bind:value={formData.project_manager}
                valueField="label"
                placeholder="Select project manager..."
                loading={teamMemberOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label for="project_director">Project Director</label>
              <SearchableDropdown
                id="project_director"
                options={teamMemberOptions}
                bind:value={formData.project_director}
                valueField="label"
                placeholder="Select project director..."
                loading={teamMemberOptionsLoading}
              />
            </div>

            <!-- Project Details -->
            <div class="form-group">
              <label>Sector</label>
              <MultiSelectDropdown
                options={sectorOptions}
                bind:selected={formData.sectors}
                placeholder="Select sector(s)..."
                loading={sectorOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label>Sub-sector</label>
              <MultiSelectDropdown
                options={subSectorOptions}
                bind:selected={formData.sub_sectors}
                placeholder="Select sub-sector(s)..."
                loading={subSectorOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label>Development Type</label>
              <MultiSelectDropdown
                options={developmentTypeOptions}
                bind:selected={formData.development_types}
                placeholder="Select development type(s)..."
                loading={developmentTypeOptionsLoading}
              />
            </div>

            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" bind:value={formData.status}>
                <option value="">Select status...</option>
                {#each statusOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="address">Address</label>
              <textarea id="address" bind:value={formData.address} placeholder="" rows="2"></textarea>
            </div>

            <div class="form-group">
              <label for="area">Area</label>
              <input id="area" type="text" bind:value={formData.area} placeholder="Auto-calculated or enter manually" />
            </div>
          </div>
        </div>

        <!-- Right: Map -->
        <div class="map-section">
          <div class="map-header">
            <h3>Draw Site Boundary</h3>
            <p class="map-hint">Use the polygon tool to draw the site boundary on the map</p>
          </div>
          <div class="map-container" bind:this={mapContainer}></div>
          {#if errors.geometry}
            <span class="error-text">{errors.geometry}</span>
          {/if}
        </div>
      </div>

      {#if errors.submit}
        <div class="submit-error-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{errors.submit}</span>
        </div>
      {/if}

      <div class="modal-footer">
        <button class="btn-cancel" on:click={handleClose} disabled={saving}>Cancel</button>
        <button class="btn-save" on:click={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Create Project'}
        </button>
      </div>
    </div>
  </div>

  <NudgeBoundaryModal
    isOpen={showNudgeBoundary}
    onDrawBoundary={() => { showNudgeBoundary = false; }}
    onContinueWithout={() => { showNudgeBoundary = false; doSave(); }}
  />
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 1400px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--color-slate-800);
  }

  .modal-body {
    display: grid;
    grid-template-columns: 500px 1fr;
    gap: 2rem;
    padding: 2rem;
    overflow: hidden;
    flex: 1;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .form-scroll {
    overflow-y: auto;
    padding-right: 1rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-slate-800);
    font-size: 0.875rem;
  }

  .required {
    color: var(--color-red-500);
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-purple-600);
  }

  .form-group input.error {
    border-color: var(--color-red-500);
  }

  .error-text {
    display: block;
    color: var(--color-red-500);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .lpa-autocomplete {
    position: relative;
  }

  .lpa-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 50;
    max-height: 220px;
    overflow-y: auto;
    margin-top: 2px;
  }

  .lpa-option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.875rem;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-slate-100);
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    cursor: pointer;
  }

  .lpa-option:last-child {
    border-bottom: none;
  }

  .lpa-option:hover {
    background: var(--color-violet-100);
    color: var(--color-purple-700);
  }

  .lpa-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .lpa-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--color-violet-100);
    color: var(--color-purple-700);
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .lpa-tag button {
    background: none;
    border: none;
    color: var(--color-purple-700);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .map-section {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .map-header {
    margin-bottom: 1rem;
  }

  .map-header h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .map-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  .map-container {
    flex: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--color-slate-300);
    min-height: 400px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .submit-error-banner {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0 2rem;
    padding: 0.875rem 1.125rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 0.5rem;
    color: var(--color-red-800);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .submit-error-banner svg {
    flex-shrink: 0;
  }

  .btn-cancel,
  .btn-save {
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: white;
    border: 1px solid var(--color-slate-300);
    color: var(--color-slate-500);
  }

  .btn-cancel:hover:not(:disabled) {
    background: var(--color-slate-50);
    border-color: var(--color-slate-400);
  }

  .btn-save {
    background: var(--color-purple-600);
    border: none;
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--color-purple-700);
  }

  .btn-cancel:disabled,
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 1024px) {
    .modal-body {
      grid-template-columns: 1fr;
    }

    .map-container {
      min-height: 300px;
    }
  }
</style>
