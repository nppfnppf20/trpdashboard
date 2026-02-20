<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { saveSite } from '$lib/services/api.js';
  import { authFetch } from '$lib/api/client.js';

  export let isOpen = false;
  export let onClose = () => {};
  export let onProjectCreated = () => {};

  // Pre-filled polygon from HLPV analysis
  export let polygonGeojson = null;

  // HLPV analysis results to save after project creation
  export let heritageResult = null;
  export let landscapeResult = null;
  export let agLandResult = null;
  export let renewablesResult = null;
  export let ecologyResult = null;

  // Form data matching database schema
  let formData = {
    project_id: '',
    project_name: '',
    local_planning_authority: [],
    project_lead: '',
    project_manager: '',
    project_director: '',
    address: '',
    polygon_geojson: polygonGeojson,
    area: '',
    client: '',
    client_spv_name: '',
    sector: '',
    project_type: '',
    designations_on_site: '',
    relevant_nearby_designations: ''
  };

  // LPA input handling
  let lpaInput = '';

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

  // Update formData when polygonGeojson prop changes
  $: if (polygonGeojson) {
    formData.polygon_geojson = polygonGeojson;
  }

  $: if (browser && isOpen && !mapInitialized && mapContainer) {
    initializeMap();
  }

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
      mapInitialized = false;
    }
  });

  async function initializeMap() {
    if (!browser || !mapContainer || mapInitialized) return;

    try {
      // Dynamically import Leaflet and Leaflet Draw
      const leafletModule = await import('leaflet');
      L = leafletModule.default || leafletModule;

      // Import Leaflet Draw
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

      // Load pre-filled polygon if available (display-only, no editing)
      if (polygonGeojson) {
        try {
          const geometry = typeof polygonGeojson === 'string'
            ? JSON.parse(polygonGeojson)
            : polygonGeojson;

          const layer = L.geoJSON(geometry, {
            style: {
              color: '#9333ea',
              weight: 3,
              opacity: 0.8,
              fillOpacity: 0.2
            }
          });
          const geoJsonLayer = layer.getLayers()[0];
          drawnItems.addLayer(geoJsonLayer);

          // Zoom to polygon bounds
          map.fitBounds(drawnItems.getBounds());

          // Calculate area
          const areaInSqMeters = L.GeometryUtil && geoJsonLayer.getLatLngs
            ? L.GeometryUtil.geodesicArea(geoJsonLayer.getLatLngs()[0])
            : null;

          if (areaInSqMeters) {
            const areaInHectares = (areaInSqMeters / 10000).toFixed(2);
            formData.area = `${areaInHectares} ha`;
          }
        } catch (error) {
          console.error('Error loading pre-filled polygon:', error);
        }
      }

      // Note: NO drawing/editing controls since HLPV analysis was done on this specific boundary

      // Force map to resize after initialization
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 100);

      mapInitialized = true;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  function addLPA() {
    if (lpaInput.trim()) {
      formData.local_planning_authority = [...formData.local_planning_authority, lpaInput.trim()];
      lpaInput = '';
    }
  }

  function removeLPA(index) {
    formData.local_planning_authority = formData.local_planning_authority.filter((_, i) => i !== index);
  }

  function handleLPAKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLPA();
    }
  }

  function validateForm() {
    errors = {};

    if (!formData.project_id.trim()) {
      errors.project_id = 'Project ID is required';
    }

    if (!formData.project_name.trim()) {
      errors.project_name = 'Project Name is required';
    }

    if (!formData.polygon_geojson) {
      errors.geometry = 'Site boundary is required';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) {
      return;
    }

    saving = true;

    try {
      // Step 1: Create the project
      console.log('🎯 Step 1: Creating project...');
      const createResponse = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const createData = await createResponse.json();

      if (!createResponse.ok || !createData.success) {
        errors.submit = createData.error || 'Failed to create project';
        saving = false;
        return;
      }

      console.log('✅ Project created:', createData.project);
      const newProjectId = createData.project.id;

      // Step 2: Save the HLPV analysis to the new project
      console.log('🎯 Step 2: Saving HLPV analysis to project...');
      const siteData = {
        siteName: formData.project_name,
        polygonGeojson: formData.polygon_geojson,
        projectId: newProjectId,
        heritageRisk: heritageResult?.overallRisk || 'no_risk',
        heritageRuleCount: heritageResult?.rules?.length || 0,
        landscapeRisk: landscapeResult?.overallRisk || 'no_risk',
        landscapeRuleCount: landscapeResult?.rules?.length || 0,
        renewablesRisk: renewablesResult?.overallRisk || 'no_risk',
        renewablesRuleCount: renewablesResult?.rules?.length || 0,
        ecologyRisk: ecologyResult?.overallRisk || 'no_risk',
        ecologyRuleCount: ecologyResult?.rules?.length || 0,
        agLandRisk: agLandResult?.overallRisk || 'no_risk',
        agLandRuleCount: agLandResult?.rules?.length || 0
      };

      const saveResult = await saveSite(siteData);
      console.log('✅ HLPV analysis saved:', saveResult);

      // Step 3: Notify parent and close
      onProjectCreated(createData.project);
      handleClose();
    } catch (error) {
      console.error('❌ Error creating project with analysis:', error);
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
      local_planning_authority: [],
      project_lead: '',
      project_manager: '',
      project_director: '',
      address: '',
      polygon_geojson: polygonGeojson, // Keep the original polygon
      area: '',
      client: '',
      client_spv_name: '',
      sector: '',
      project_type: '',
      designations_on_site: '',
      relevant_nearby_designations: ''
    };
    errors = {};
    lpaInput = '';

    if (map) {
      drawnItems.clearLayers();
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
        <h2>Create New Project with Analysis</h2>
        <button class="close-btn" on:click={handleClose}>&times;</button>
      </div>

      <div class="modal-body">
        <!-- Left: Form -->
        <div class="form-section">
          <div class="form-scroll">
            <div class="info-banner">
              <i class="las la-info-circle"></i>
              <p>The site boundary from your HLPV analysis is locked to ensure the analysis results remain accurate. If you need a different boundary, please run a new HLPV analysis.</p>
            </div>

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

            <!-- Local Planning Authority (Multiple) -->
            <div class="form-group">
              <label for="lpa">Local Planning Authority</label>
              <div class="lpa-input-group">
                <input
                  id="lpa"
                  type="text"
                  bind:value={lpaInput}
                  on:keydown={handleLPAKeydown}
                  placeholder="Type LPA name and press Add"
                />
                <button type="button" class="add-btn" on:click={addLPA}>Add</button>
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
              <input id="client" type="text" bind:value={formData.client} placeholder="" />
            </div>

            <div class="form-group">
              <label for="client_spv_name">Client SPV Name</label>
              <input id="client_spv_name" type="text" bind:value={formData.client_spv_name} placeholder="" />
            </div>

            <!-- Project Team -->
            <div class="form-group">
              <label for="project_lead">Project Lead</label>
              <input id="project_lead" type="text" bind:value={formData.project_lead} placeholder="" />
            </div>

            <div class="form-group">
              <label for="project_manager">Project Manager</label>
              <input id="project_manager" type="text" bind:value={formData.project_manager} placeholder="" />
            </div>

            <div class="form-group">
              <label for="project_director">Project Director</label>
              <input id="project_director" type="text" bind:value={formData.project_director} placeholder="" />
            </div>

            <!-- Project Details -->
            <div class="form-group">
              <label for="sector">Sector</label>
              <input id="sector" type="text" bind:value={formData.sector} placeholder="" />
            </div>

            <div class="form-group">
              <label for="project_type">Project Type</label>
              <input id="project_type" type="text" bind:value={formData.project_type} placeholder="" />
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
            <h3>Site Boundary</h3>
            <p class="map-hint">The polygon from your HLPV analysis is locked and displayed below.</p>
          </div>
          <div class="map-container" bind:this={mapContainer}></div>
          {#if errors.geometry}
            <span class="error-text">{errors.geometry}</span>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        {#if errors.submit}
          <span class="error-text submit-error">{errors.submit}</span>
        {/if}
        <button class="btn-cancel" on:click={handleClose} disabled={saving}>Cancel</button>
        <button class="btn-save" on:click={handleSave} disabled={saving}>
          {saving ? 'Creating Project & Saving Analysis...' : 'Create Project & Save Analysis'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
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
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #1e293b;
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

  .info-banner {
    display: flex;
    gap: 0.75rem;
    padding: 0.875rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .info-banner i {
    font-size: 1.25rem;
    color: #3b82f6;
    flex-shrink: 0;
  }

  .info-banner p {
    margin: 0;
    color: #1e40af;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #1e293b;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #9333ea;
  }

  .form-group input.error {
    border-color: #ef4444;
  }

  .error-text {
    display: block;
    color: #ef4444;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .lpa-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .lpa-input-group input {
    flex: 1;
  }

  .add-btn {
    padding: 0.625rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: #7e22ce;
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
    background: #f3e8ff;
    color: #7e22ce;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .lpa-tag button {
    background: none;
    border: none;
    color: #7e22ce;
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
    color: #1e293b;
  }

  .map-hint {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
  }

  .map-container {
    flex: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    min-height: 400px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
  }

  .submit-error {
    margin-right: auto;
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
    border: 1px solid #cbd5e1;
    color: #64748b;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .btn-save {
    background: #9333ea;
    border: none;
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    background: #7e22ce;
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
