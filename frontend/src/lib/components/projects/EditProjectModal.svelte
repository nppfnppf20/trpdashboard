<script>
  import { onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { authFetch } from '$lib/api/client.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SearchableDropdown from '$lib/components/shared/SearchableDropdown.svelte';

  export let isOpen = false;
  export let onClose = () => {};
  export let onProjectUpdated = () => {};
  export let projectId = null;

  // Tab state
  let activeTab = 'site_boundary';

  // Lookup options
  let clientOptions = [];
  let clientOptionsLoading = false;
  let teamMemberOptions = [];
  let teamMemberOptionsLoading = false;
  let sectorOptions = [];
  let sectorOptionsLoading = false;
  let subSectorOptions = [];
  let subSectorOptionsLoading = false;

  const statusOptions = ['Prospective', 'Instructed', 'Submitted', 'Post-Submission', 'Closed'];

  // Form data
  let formData = {
    project_id: '',
    project_name: '',
    local_planning_authority: [],
    project_lead: '',
    project_manager: '',
    project_director: '',
    address: '',
    polygon_geojson: null,
    area: '',
    client: '',
    client_spv_name: '',
    sector: '',
    sub_sector: '',
    designations_on_site: '',
    relevant_nearby_designations: '',
    status: '',
    case_officer_name: '',
    case_officer_email: '',
    case_officer_phone_number: '',
    lpa_reference: '',
    submission_date: '',
    validation_date: '',
    lpa_consultation_end_date: '',
    committee_date: '',
    target_determination_date: '',
    determined_date: '',
    expiry_of_1st_stat_period_date: '',
    eot_date: '',
    six_months_appeal_window_date: '',
    comments: ''
  };

  // LPA input handling
  let lpaInput = '';

  // Map state
  let mapContainer;
  let map;
  let L;
  let drawnItems;
  let drawControl;

  // State
  let errors = {};
  let saving = false;
  let loading = true;
  let mapInitialized = false;

  // Load project data when modal opens
  $: if (browser && isOpen && projectId && loading) {
    loadProject();
  }

  // Initialize map when on site boundary tab
  $: if (browser && isOpen && !loading && activeTab === 'site_boundary' && !mapInitialized && mapContainer) {
    initializeMap();
  }

  // Cleanup map when switching away from site boundary tab
  $: if (activeTab !== 'site_boundary' && map) {
    cleanupMap();
  }

  $: if (!isOpen && map) {
    cleanupMap();
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

  async function loadClientOptions() {
    clientOptionsLoading = true;
    try { clientOptions = await getLookupOptions('client_organisations'); }
    catch (e) { console.error('Failed to load client options:', e); }
    finally { clientOptionsLoading = false; }
  }

  async function loadTeamMemberOptions() {
    teamMemberOptionsLoading = true;
    try { teamMemberOptions = await getLookupOptions('team_members'); }
    catch (e) { console.error('Failed to load team member options:', e); }
    finally { teamMemberOptionsLoading = false; }
  }

  async function loadSectorOptions() {
    sectorOptionsLoading = true;
    try { sectorOptions = await getLookupOptions('sectors'); }
    catch (e) { console.error('Failed to load sector options:', e); }
    finally { sectorOptionsLoading = false; }
  }

  async function loadSubSectorOptions() {
    subSectorOptionsLoading = true;
    try { subSectorOptions = await getLookupOptions('sub_sectors'); }
    catch (e) { console.error('Failed to load sub-sector options:', e); }
    finally { subSectorOptionsLoading = false; }
  }

  onDestroy(() => { cleanupMap(); });

  function cleanupMap() {
    if (map) {
      map.remove();
      map = null;
      mapInitialized = false;
    }
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    return dateString.slice(0, 10);
  }

  async function loadProject() {
    loading = true;
    try {
      const response = await authFetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');
      const project = await response.json();

      formData = {
        project_id: project.project_id || '',
        project_name: project.project_name || '',
        local_planning_authority: project.local_planning_authority || [],
        project_lead: project.project_lead || '',
        project_manager: project.project_manager || '',
        project_director: project.project_director || '',
        address: project.address || '',
        polygon_geojson: project.polygon_geojson || null,
        area: project.area || '',
        client: project.client || '',
        client_spv_name: project.client_spv_name || '',
        sector: project.sector || '',
        sub_sector: project.sub_sector || '',
        designations_on_site: project.designations_on_site || '',
        relevant_nearby_designations: project.relevant_nearby_designations || '',
        status: project.status || '',
        case_officer_name: project.case_officer_name || '',
        case_officer_email: project.case_officer_email || '',
        case_officer_phone_number: project.case_officer_phone_number || '',
        lpa_reference: project.lpa_reference || '',
        submission_date: formatDateForInput(project.submission_date),
        validation_date: formatDateForInput(project.validation_date),
        lpa_consultation_end_date: formatDateForInput(project.lpa_consultation_end_date),
        committee_date: formatDateForInput(project.committee_date),
        target_determination_date: formatDateForInput(project.target_determination_date),
        determined_date: formatDateForInput(project.determined_date),
        expiry_of_1st_stat_period_date: formatDateForInput(project.expiry_of_1st_stat_period_date),
        eot_date: formatDateForInput(project.eot_date),
        six_months_appeal_window_date: formatDateForInput(project.six_months_appeal_window_date),
        comments: project.comments || ''
      };
    } catch (error) {
      console.error('Error loading project:', error);
      errors.submit = 'Failed to load project data';
    } finally {
      loading = false;
    }
  }

  async function initializeMap() {
    if (!browser || !mapContainer || mapInitialized) return;

    try {
      const leafletModule = await import('leaflet');
      L = leafletModule.default || leafletModule;

      await import('leaflet-draw');
      await tick();

      map = L.map(mapContainer).setView([54.5, -2.5], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      if (formData.polygon_geojson) {
        try {
          const geojson = JSON.parse(formData.polygon_geojson);
          const layer = L.geoJSON(geojson).getLayers()[0];
          drawnItems.addLayer(layer);
          map.fitBounds(drawnItems.getBounds());
        } catch (err) {
          console.error('Error loading existing polygon:', err);
        }
      }

      drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            shapeOptions: { color: '#9333ea', weight: 3, opacity: 0.8, fillOpacity: 0.2 },
            metric: true
          },
          polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
        },
        edit: { featureGroup: drawnItems, remove: true }
      });
      map.addControl(drawControl);

      map.on(L.Draw.Event.CREATED, function (e) {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        formData.polygon_geojson = JSON.stringify(e.layer.toGeoJSON().geometry);
        const area = L.GeometryUtil && e.layer.getLatLngs
          ? L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]) : null;
        if (area) formData.area = `${(area / 10000).toFixed(2)} ha`;
      });

      map.on(L.Draw.Event.EDITED, function (e) {
        e.layers.eachLayer(layer => {
          formData.polygon_geojson = JSON.stringify(layer.toGeoJSON().geometry);
        });
      });

      map.on(L.Draw.Event.DELETED, function () {
        formData.polygon_geojson = null;
        formData.area = '';
      });

      setTimeout(() => { if (map) map.invalidateSize(); }, 100);

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
    if (e.key === 'Enter') { e.preventDefault(); addLPA(); }
  }

  function validateForm() {
    errors = {};
    if (!formData.project_id.trim()) errors.project_id = 'Project ID is required';
    if (!formData.project_name.trim()) errors.project_name = 'Project Name is required';
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;

    saving = true;
    try {
      const response = await authFetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onProjectUpdated(data.project);
        handleClose();
      } else {
        errors.submit = data.error || 'Failed to update project';
      }
    } catch (error) {
      console.error('Error updating project:', error);
      errors.submit = 'Network error. Please try again.';
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    formData = {
      project_id: '', project_name: '', local_planning_authority: [],
      project_lead: '', project_manager: '', project_director: '',
      address: '', polygon_geojson: null, area: '', client: '',
      client_spv_name: '', sector: '', sub_sector: '',
      designations_on_site: '', relevant_nearby_designations: '', status: '',
      case_officer_name: '', case_officer_email: '', case_officer_phone_number: '',
      lpa_reference: '', submission_date: '', validation_date: '',
      lpa_consultation_end_date: '', committee_date: '', target_determination_date: '',
      determined_date: '', expiry_of_1st_stat_period_date: '', eot_date: '',
      six_months_appeal_window_date: '', comments: ''
    };
    errors = {};
    lpaInput = '';
    loading = true;
    activeTab = 'site_boundary';
    if (map && drawnItems) drawnItems.clearLayers();
    cleanupMap();
    onClose();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) handleClose();
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-container">
      <div class="modal-header">
        <h2>Edit Project</h2>
        <button class="close-btn" on:click={handleClose}>&times;</button>
      </div>

      {#if loading}
        <div class="loading-wrapper">
          <div class="spinner"></div>
          <p>Loading project...</p>
        </div>
      {:else}
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab-button {activeTab === 'site_boundary' ? 'active' : ''}"
            on:click={() => activeTab = 'site_boundary'}
          >
            Site Boundary
          </button>
          <button
            class="tab-button {activeTab === 'details' ? 'active' : ''}"
            on:click={() => activeTab = 'details'}
          >
            Project Details
          </button>
        </div>

        <div class="modal-body">
          {#if activeTab === 'site_boundary'}
            <!-- Site Boundary Tab -->
            <div class="site-boundary-section">
              <p class="map-hint">Use the polygon tool to draw or modify the site boundary.</p>
              <div class="map-container" bind:this={mapContainer}></div>
              {#if errors.geometry}
                <span class="error-text">{errors.geometry}</span>
              {/if}
            </div>
          {:else}
            <!-- Project Details Tab -->
            <div class="form-section">
              <div class="form-scroll">

                <!-- Project Overview -->
                <h3 class="form-section-header">Project Overview</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="project_id">Project ID <span class="required">*</span></label>
                    <input id="project_id" type="text" bind:value={formData.project_id}
                      placeholder="e.g. 1240" class:error={errors.project_id} />
                    {#if errors.project_id}<span class="error-text">{errors.project_id}</span>{/if}
                  </div>

                  <div class="form-group">
                    <label for="project_name">Project Name <span class="required">*</span></label>
                    <input id="project_name" type="text" bind:value={formData.project_name}
                      placeholder="e.g. Tollington Solar" class:error={errors.project_name} />
                    {#if errors.project_name}<span class="error-text">{errors.project_name}</span>{/if}
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
                    <label for="sector">Sector</label>
                    <SearchableDropdown id="sector" options={sectorOptions} bind:value={formData.sector}
                      valueField="label" placeholder="Select sector..." loading={sectorOptionsLoading} />
                  </div>

                  <div class="form-group">
                    <label for="sub_sector">Sub-sector</label>
                    <SearchableDropdown id="sub_sector" options={subSectorOptions} bind:value={formData.sub_sector}
                      valueField="label" placeholder="Select sub-sector..." loading={subSectorOptionsLoading} />
                  </div>

                  <div class="form-group">
                    <label for="area">Area</label>
                    <input id="area" type="text" bind:value={formData.area}
                      placeholder="Auto-calculated or enter manually" />
                  </div>

                  <div class="form-group form-group--full">
                    <label for="address">Address</label>
                    <textarea id="address" bind:value={formData.address} rows="2"></textarea>
                  </div>
                </div>

                <!-- Team -->
                <h3 class="form-section-header">Team</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="client">Client</label>
                    <SearchableDropdown id="client" options={clientOptions} bind:value={formData.client}
                      valueField="label" placeholder="Select a client..." loading={clientOptionsLoading} />
                  </div>

                  <div class="form-group">
                    <label for="client_spv_name">Client SPV Name</label>
                    <input id="client_spv_name" type="text" bind:value={formData.client_spv_name} />
                  </div>

                  <div class="form-group">
                    <label for="project_lead">Project Lead</label>
                    <SearchableDropdown id="project_lead" options={teamMemberOptions} bind:value={formData.project_lead}
                      valueField="label" placeholder="Select project lead..." loading={teamMemberOptionsLoading} />
                  </div>

                  <div class="form-group">
                    <label for="project_manager">Project Manager</label>
                    <SearchableDropdown id="project_manager" options={teamMemberOptions} bind:value={formData.project_manager}
                      valueField="label" placeholder="Select project manager..." loading={teamMemberOptionsLoading} />
                  </div>

                  <div class="form-group">
                    <label for="project_director">Project Director</label>
                    <SearchableDropdown id="project_director" options={teamMemberOptions} bind:value={formData.project_director}
                      valueField="label" placeholder="Select project director..." loading={teamMemberOptionsLoading} />
                  </div>
                </div>

                <!-- Planning -->
                <h3 class="form-section-header">Planning</h3>
                <div class="form-grid">
                  <!-- LPA spans full width due to tag UI -->
                  <div class="form-group form-group--full">
                    <label for="lpa">Local Planning Authority</label>
                    <div class="lpa-input-group">
                      <input id="lpa" type="text" bind:value={lpaInput}
                        on:keydown={handleLPAKeydown} placeholder="Type LPA name and press Add" />
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

                  <div class="form-group">
                    <label for="lpa_reference">LPA Reference</label>
                    <input id="lpa_reference" type="text" bind:value={formData.lpa_reference} />
                  </div>

                  <div class="form-group form-group--full">
                    <label for="designations_on_site">Designations on Site</label>
                    <textarea id="designations_on_site" bind:value={formData.designations_on_site} rows="2"></textarea>
                  </div>

                  <div class="form-group form-group--full">
                    <label for="relevant_nearby_designations">Relevant Nearby Designations</label>
                    <textarea id="relevant_nearby_designations" bind:value={formData.relevant_nearby_designations} rows="2"></textarea>
                  </div>
                </div>

                <!-- Case Officer -->
                <h3 class="form-section-header">Case Officer</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="case_officer_name">Name</label>
                    <input id="case_officer_name" type="text" bind:value={formData.case_officer_name} />
                  </div>

                  <div class="form-group">
                    <label for="case_officer_email">Email</label>
                    <input id="case_officer_email" type="email" bind:value={formData.case_officer_email} />
                  </div>

                  <div class="form-group">
                    <label for="case_officer_phone_number">Phone</label>
                    <input id="case_officer_phone_number" type="tel" bind:value={formData.case_officer_phone_number} />
                  </div>
                </div>

                <!-- Key Dates -->
                <h3 class="form-section-header">Key Dates</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="submission_date">Submission Date</label>
                    <input id="submission_date" type="date" bind:value={formData.submission_date} />
                  </div>

                  <div class="form-group">
                    <label for="validation_date">Validation Date</label>
                    <input id="validation_date" type="date" bind:value={formData.validation_date} />
                  </div>

                  <div class="form-group">
                    <label for="lpa_consultation_end_date">LPA Consultation End</label>
                    <input id="lpa_consultation_end_date" type="date" bind:value={formData.lpa_consultation_end_date} />
                  </div>

                  <div class="form-group">
                    <label for="committee_date">Committee Date</label>
                    <input id="committee_date" type="date" bind:value={formData.committee_date} />
                  </div>

                  <div class="form-group">
                    <label for="target_determination_date">Target Determination Date</label>
                    <input id="target_determination_date" type="date" bind:value={formData.target_determination_date} />
                  </div>

                  <div class="form-group">
                    <label for="determined_date">Determined Date</label>
                    <input id="determined_date" type="date" bind:value={formData.determined_date} />
                  </div>

                  <div class="form-group">
                    <label for="expiry_of_1st_stat_period_date">1st Stat Period Expiry</label>
                    <input id="expiry_of_1st_stat_period_date" type="date" bind:value={formData.expiry_of_1st_stat_period_date} />
                  </div>

                  <div class="form-group">
                    <label for="eot_date">EOT Date</label>
                    <input id="eot_date" type="date" bind:value={formData.eot_date} />
                  </div>

                  <div class="form-group">
                    <label for="six_months_appeal_window_date">6-Month Appeal Window</label>
                    <input id="six_months_appeal_window_date" type="date" bind:value={formData.six_months_appeal_window_date} />
                  </div>
                </div>

                <!-- Additional -->
                <h3 class="form-section-header">Additional</h3>
                <div class="form-grid">
                  <div class="form-group form-group--full">
                    <label for="comments">Comments</label>
                    <textarea id="comments" bind:value={formData.comments} rows="3"></textarea>
                  </div>
                </div>

              </div>
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          {#if errors.submit}
            <span class="error-text submit-error">{errors.submit}</span>
          {/if}
          <button class="btn-cancel" on:click={handleClose} disabled={saving}>Cancel</button>
          <button class="btn-save" on:click={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Update Project'}
          </button>
        </div>
      {/if}
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
    height: 90vh;
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
    flex-shrink: 0;
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

  .close-btn:hover { color: #1e293b; }

  .loading-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #64748b;
    flex: 1;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #9333ea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    padding: 0 2rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .tab-button {
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: -1px;
  }

  .tab-button:hover { color: #1e293b; background: #f8fafc; }
  .tab-button.active { color: #9333ea; border-bottom-color: #9333ea; }

  /* Modal Body */
  .modal-body {
    display: flex;
    flex-direction: column;
    padding: 2rem;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  /* Site Boundary Tab */
  .site-boundary-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    gap: 0.75rem;
  }

  .map-hint {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
    flex-shrink: 0;
  }

  .map-container {
    flex: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    min-height: 0;
  }

  /* Project Details Tab */
  .form-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }

  .form-scroll {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .form-section-header {
    font-size: 0.75rem;
    font-weight: 700;
    color: #9333ea;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 1.5rem 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .form-section-header:first-child { margin-top: 0; }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .form-group { display: flex; flex-direction: column; }
  .form-group--full { grid-column: 1 / -1; }

  .form-group label {
    display: block;
    margin-bottom: 0.375rem;
    font-weight: 500;
    color: #1e293b;
    font-size: 0.875rem;
  }

  .required { color: #ef4444; }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.2s;
    background: white;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.08);
  }

  .form-group input.error { border-color: #ef4444; }

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

  .lpa-input-group input { flex: 1; }

  .add-btn {
    padding: 0.625rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .add-btn:hover { background: #7e22ce; }

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

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .submit-error { margin-right: auto; }

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

  .btn-save:hover:not(:disabled) { background: #7e22ce; }

  .btn-cancel:disabled,
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
