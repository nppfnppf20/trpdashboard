<script>
  import { onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import ConflictDetailPopup from './ConflictDetailPopup.svelte';
  import { authFetch } from '$lib/api/client.js';
  import { getQuotes, getQuoteKeyDates, getProgrammeEvents } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';

  export let isOpen = false;
  export let onClose = () => {};
  export let onEdit = () => {};
  export let projectId = null;

  // Project data
  let projectData = null;
  let loading = true;
  let error = null;

  // Tab state
  let activeTab = 'site_boundary';

  // Map state
  let mapContainer;
  let map;
  let L;
  let polygonLayer;
  let mapInitialized = false;

  // Conflict check state
  let conflictCheckRunning = false;
  let conflictResults = null;
  let conflictError = null;
  let expandedCategories = {};
  let loadingSavedCheck = false;
  let savedCheckInfo = null;
  let selectedConflict = null;

  // Surveyor management state
  let stats = null;
  let keyDates = [];
  let programmeEvents = [];
  let statsLoading = false;
  let statsError = null;

  // Load project data when modal opens
  $: if (browser && isOpen && projectId && !projectData) {
    loadProject();
  }

  // Load saved conflict check when switching to conflict tab
  $: if (browser && isOpen && activeTab === 'conflict' && projectData && !conflictResults && !loadingSavedCheck) {
    loadSavedConflictCheck();
  }

  // Load surveyor management stats when switching to that tab
  $: if (browser && isOpen && activeTab === 'surveyor' && projectData && !stats && !statsLoading && !statsError) {
    loadSurveyorStats();
  }

  // Initialize map when container is available and on site boundary tab
  $: if (browser && isOpen && projectData && activeTab === 'site_boundary' && !mapInitialized && mapContainer) {
    initializeMapWithPolygon();
  }

  // Cleanup map when switching away from site boundary tab
  $: if (activeTab !== 'site_boundary' && map) {
    cleanupMap();
  }

  $: if (!isOpen && map) {
    cleanupMap();
  }

  onDestroy(() => {
    cleanupMap();
  });

  function cleanupMap() {
    if (map) {
      map.remove();
      map = null;
      mapInitialized = false;
      polygonLayer = null;
    }
  }

  async function loadProject() {
    loading = true;
    error = null;

    try {
      // Fetch project data (now includes HLPV risk summary)
      const response = await authFetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');
      projectData = await response.json();
      console.log('✅ Project loaded with HLPV data:', projectData);
    } catch (err) {
      console.error('Error loading project:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function initializeMapWithPolygon() {
    try {
      await initializeMap();

      // Display polygon if it exists
      if (projectData && projectData.polygon_geojson) {
        displayPolygon(projectData.polygon_geojson);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
    }
  }

  async function initializeMap() {
    if (!browser || !mapContainer || mapInitialized) return;

    try {
      // Dynamically import Leaflet
      const leafletModule = await import('leaflet');
      L = leafletModule.default || leafletModule;

      await tick(); // Wait for DOM to be ready

      // Initialize map centered on UK
      map = L.map(mapContainer).setView([54.5, -2.5], 6);

      // Add OSM tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Force resize after a short delay
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 100);

      mapInitialized = true;
    } catch (err) {
      console.error('Error initializing map:', err);
      error = 'Failed to initialize map';
    }
  }

  function displayPolygon(geojsonString) {
    if (!map || !L) return;

    try {
      const geojson = JSON.parse(geojsonString);

      // Remove existing polygon if any
      if (polygonLayer) {
        map.removeLayer(polygonLayer);
      }

      // Create polygon layer
      polygonLayer = L.geoJSON(geojson, {
        style: {
          color: '#9333ea',
          weight: 3,
          opacity: 0.8,
          fillOpacity: 0.2
        }
      }).addTo(map);

      // Zoom to polygon bounds
      map.fitBounds(polygonLayer.getBounds());
    } catch (err) {
      console.error('Error displaying polygon:', err);
    }
  }

  function formatLPA(lpaArray) {
    if (!lpaArray || !Array.isArray(lpaArray) || lpaArray.length === 0) return '-';
    return lpaArray.join(', ');
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function loadSavedConflictCheck() {
    if (!projectData?.id) return;

    loadingSavedCheck = true;
    
    try {
      const response = await authFetch(`/api/conflict-check/project/${projectData.id}/latest`);
      
      if (response.ok) {
        const savedCheck = await response.json();
        conflictResults = savedCheck.results;
        savedCheckInfo = {
          id: savedCheck.id,
          checkedAt: savedCheck.checked_at,
          totalConflicts: savedCheck.total_conflicts
        };
        
        // Auto-expand all categories that have results
        expandedCategories = {
          intersecting: true,
          within_100m: true,
          within_250m: true,
          within_500m: true,
          within_1km: true,
          within_3km: true,
          within_5km: true
        };
        
        console.log('✅ Loaded saved conflict check:', savedCheckInfo);
      } else if (response.status === 404) {
        // No saved conflict check found - this is fine
        console.log('ℹ️ No saved conflict check found for this project');
      } else {
        throw new Error('Failed to load saved conflict check');
      }
    } catch (err) {
      console.error('Error loading saved conflict check:', err);
      // Don't show error to user, just log it
    } finally {
      loadingSavedCheck = false;
    }
  }

  async function runConflictCheck() {
    if (!projectData.polygon_geojson) {
      alert('No site boundary defined for this project');
      return;
    }

    conflictCheckRunning = true;
    conflictError = null;
    conflictResults = null;
    savedCheckInfo = null;

    try {
      const polygon = JSON.parse(projectData.polygon_geojson);
      
      const response = await authFetch('/api/conflict-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          polygon,
          excludeProjectId: projectData.id,
          projectId: projectData.id,
          saveResults: true
        })
      });

      if (!response.ok) throw new Error('Failed to run conflict check');
      
      conflictResults = await response.json();
      
      if (conflictResults.savedCheckId) {
        savedCheckInfo = {
          id: conflictResults.savedCheckId,
          checkedAt: conflictResults.metadata.checkedAt,
          totalConflicts: conflictResults.summary.total
        };
        console.log('✅ Conflict check saved with ID:', conflictResults.savedCheckId);
      }
      
      console.log('✅ Conflict check complete:', conflictResults);
      
      // Auto-expand all categories that have results
      expandedCategories = {
        intersecting: true,
        within_100m: true,
        within_250m: true,
        within_500m: true,
        within_1km: true,
        within_3km: true,
        within_5km: true
      };
    } catch (err) {
      console.error('Error running conflict check:', err);
      conflictError = err.message;
    } finally {
      conflictCheckRunning = false;
    }
  }

  function toggleCategory(category) {
    expandedCategories[category] = !expandedCategories[category];
  }

  function showConflictDetails(conflict) {
    selectedConflict = conflict;
  }

  function closeConflictDetails() {
    selectedConflict = null;
  }

  async function handleDeleteConflict(conflict, event) {
    // Stop event propagation to prevent opening the detail popup
    event.stopPropagation();
    
    if (!conflict.conflictId) {
      alert('Cannot delete: conflict ID not found');
      return;
    }

    if (!confirm('Are you sure you want to permanently delete this conflict?')) {
      return;
    }

    try {
      const response = await authFetch(`/api/conflict-check/conflict/${conflict.conflictId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete conflict');

      console.log('✅ Conflict deleted');
      
      // Reload the conflict check to get updated results
      await loadSavedConflictCheck();
    } catch (error) {
      console.error('Error deleting conflict:', error);
      alert('Failed to delete conflict');
    }
  }

  let copySuccess = false;

  function buildConflictText(conflict) {
    const parts = [`${conflict.layerGroup} - ${conflict.layerName} (${conflict.distance}m)`];
    if (conflict.layer === 'renewables' || conflict.layer === 'datacentres') {
      if (conflict.name) parts.push(`  Name: ${conflict.name}`);
      if (conflict.address) parts.push(`  Address: ${conflict.address}`);
      if (conflict.app_state) parts.push(`  Status: ${conflict.app_state}`);
      if (conflict.decision) parts.push(`  Decision: ${conflict.decision}`);
    } else if (conflict.layer?.startsWith('repd_')) {
      if (conflict.site_name) parts.push(`  Site: ${conflict.site_name}`);
      if (conflict.capacity) parts.push(`  Capacity: ${conflict.capacity} MW`);
      if (conflict.dev_status_short) parts.push(`  Status: ${conflict.dev_status_short}`);
      if (conflict.operator) parts.push(`  Operator: ${conflict.operator}`);
    } else if (conflict.layer?.startsWith('trp_')) {
      if (conflict.name) parts.push(`  Name: ${conflict.name}`);
      if (conflict.description) parts.push(`  Description: ${conflict.description}`);
    } else if (conflict.layer === 'projects') {
      if (conflict.project_name) parts.push(`  Project: ${conflict.project_name}`);
      if (conflict.client) parts.push(`  Client: ${conflict.client}`);
      if (conflict.sector) parts.push(`  Sector: ${conflict.sector}`);
    }
    return parts.join('\n');
  }

  async function copyConflictResults() {
    if (!conflictResults) return;

    const lines = [];
    lines.push(`INITIAL CONFLICT CHECK - ${projectData?.project_name || 'Project'}`);
    if (savedCheckInfo?.checkedAt) {
      lines.push(`Checked: ${new Date(savedCheckInfo.checkedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    }
    lines.push(`Total Conflicts: ${conflictResults.summary.total}`);
    lines.push('');

    const categories = [
      { key: 'intersecting', label: 'Intersecting' },
      { key: 'within_100m', label: 'Within 100m' },
      { key: 'within_250m', label: 'Within 250m' },
      { key: 'within_500m', label: 'Within 500m' },
      { key: 'within_1km', label: 'Within 1km' },
      { key: 'within_3km', label: 'Within 3km' },
      { key: 'within_5km', label: 'Within 5km' }
    ];

    for (const cat of categories) {
      const conflicts = conflictResults.conflicts?.[cat.key] || [];
      if (conflicts.length > 0) {
        lines.push(`--- ${cat.label} (${conflicts.length}) ---`);
        for (const c of conflicts) {
          lines.push(buildConflictText(c));
          lines.push('');
        }
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      copySuccess = true;
      setTimeout(() => { copySuccess = false; }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function loadSurveyorStats() {
    statsLoading = true;
    statsError = null;
    try {
      const [quotes, sentRequests, kd, pe] = await Promise.all([
        getQuotes({ projectId: projectData.unique_id }),
        getSentRequestsForProject(projectData.unique_id),
        getQuoteKeyDates(projectData.unique_id),
        getProgrammeEvents(projectData.unique_id)
      ]);

      keyDates = kd;
      programmeEvents = pe;

      const instructed = quotes.filter(q =>
        q.instruction_status === 'instructed' || q.instruction_status === 'partially_instructed'
      );
      const instructedSpend = instructed.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
      const worksCompleted = instructed.filter(q => q.work_status === 'completed');
      const worksOutstanding = instructed.filter(q => q.work_status !== 'completed');

      stats = {
        quotesSent: sentRequests.length,
        quotesReceived: quotes.length,
        quotesInstructed: instructed.length,
        instructedSpend,
        worksCompleted: worksCompleted.length,
        worksOutstanding: worksOutstanding.length
      };
    } catch (err) {
      console.error('Error loading surveyor stats:', err);
      statsError = err.message;
    } finally {
      statsLoading = false;
    }
  }

  function handleClose() {
    projectData = null;
    loading = true;
    error = null;
    activeTab = 'site_boundary';
    conflictResults = null;
    conflictError = null;
    expandedCategories = {};
    savedCheckInfo = null;
    loadingSavedCheck = false;
    stats = null;
    keyDates = [];
    programmeEvents = [];
    statsLoading = false;
    statsError = null;
    cleanupMap();
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
        <h2>View Project</h2>
        <div class="header-actions">
          <button class="btn-edit-header" on:click={onEdit} title="Edit project">
            <i class="las la-edit"></i>
          </button>
          <button class="close-btn" on:click={handleClose}>&times;</button>
        </div>
      </div>

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
        <button
          class="tab-button {activeTab === 'hlpv' ? 'active' : ''}"
          on:click={() => activeTab = 'hlpv'}
        >
          HLPV Analysis
        </button>
        <button
          class="tab-button {activeTab === 'conflict' ? 'active' : ''}"
          on:click={() => activeTab = 'conflict'}
        >
          Initial Conflict Check
        </button>
        <button
          class="tab-button {activeTab === 'surveyor' ? 'active' : ''}"
          on:click={() => activeTab = 'surveyor'}
        >
          Surveyor Management
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading project...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <i class="las la-exclamation-circle"></i>
            <p>Error: {error}</p>
            <button on:click={loadProject}>Retry</button>
          </div>
        {:else if projectData}
          {#if activeTab === 'site_boundary'}
            <!-- Site Boundary Tab -->
            <div class="site-boundary-section">
              {#if !projectData.polygon_geojson}
                <div class="empty-state">
                  <i class="las la-map-marked-alt"></i>
                  <p>No site boundary defined for this project.</p>
                </div>
              {/if}
              <div class="map-container" bind:this={mapContainer}></div>
            </div>
          {:else if activeTab === 'details'}
            <!-- Project Details Tab -->
            <div class="details-section">
              <div class="details-scroll">

                <!-- Project Overview -->
                <h3 class="detail-section-header">Project Overview</h3>
                <div class="detail-grid">
                  <div class="detail-group">
                    <label>Project ID</label>
                    <div class="detail-value">{projectData.project_id || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Project Name</label>
                    <div class="detail-value">{projectData.project_name || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Status</label>
                    <div class="detail-value">{projectData.status || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Sector</label>
                    <div class="detail-value">{projectData.sector || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Sub-sector</label>
                    <div class="detail-value">{projectData.sub_sector || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Address</label>
                    <div class="detail-value">{projectData.address || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Area</label>
                    <div class="detail-value">{projectData.area || '-'}</div>
                  </div>
                </div>

                <!-- Team -->
                <h3 class="detail-section-header">Team</h3>
                <div class="detail-grid">
                  <div class="detail-group">
                    <label>Client</label>
                    <div class="detail-value">{projectData.client || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Client SPV Name</label>
                    <div class="detail-value">{projectData.client_spv_name || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Project Lead</label>
                    <div class="detail-value">{projectData.project_lead || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Project Manager</label>
                    <div class="detail-value">{projectData.project_manager || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Project Director</label>
                    <div class="detail-value">{projectData.project_director || '-'}</div>
                  </div>
                </div>

                <!-- Planning -->
                <h3 class="detail-section-header">Planning</h3>
                <div class="detail-grid">
                  <div class="detail-group">
                    <label>Local Planning Authority</label>
                    <div class="detail-value">{formatLPA(projectData.local_planning_authority)}</div>
                  </div>
                  <div class="detail-group">
                    <label>LPA Reference</label>
                    <div class="detail-value">{projectData.lpa_reference || '-'}</div>
                  </div>
                  <div class="detail-group detail-group--full">
                    <label>Designations on Site</label>
                    <div class="detail-value">{projectData.designations_on_site || '-'}</div>
                  </div>
                  <div class="detail-group detail-group--full">
                    <label>Relevant Nearby Designations</label>
                    <div class="detail-value">{projectData.relevant_nearby_designations || '-'}</div>
                  </div>
                </div>

                <!-- Case Officer -->
                <h3 class="detail-section-header">Case Officer</h3>
                <div class="detail-grid">
                  <div class="detail-group">
                    <label>Name</label>
                    <div class="detail-value">{projectData.case_officer_name || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Email</label>
                    <div class="detail-value">{projectData.case_officer_email || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Phone</label>
                    <div class="detail-value">{projectData.case_officer_phone_number || '-'}</div>
                  </div>
                </div>

                <!-- Key Dates -->
                <h3 class="detail-section-header">Key Dates</h3>
                <div class="detail-grid">
                  <div class="detail-group">
                    <label>Submission Date</label>
                    <div class="detail-value">{formatDate(projectData.submission_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>Validation Date</label>
                    <div class="detail-value">{formatDate(projectData.validation_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>LPA Consultation End</label>
                    <div class="detail-value">{formatDate(projectData.lpa_consultation_end_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>Committee Date</label>
                    <div class="detail-value">{formatDate(projectData.committee_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>Target Determination Date</label>
                    <div class="detail-value">{formatDate(projectData.target_determination_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>Determined Date</label>
                    <div class="detail-value">{formatDate(projectData.determined_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>1st Stat Period Expiry</label>
                    <div class="detail-value">{formatDate(projectData.expiry_of_1st_stat_period_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>EOT Date</label>
                    <div class="detail-value">{formatDate(projectData.eot_date)}</div>
                  </div>
                  <div class="detail-group">
                    <label>6-Month Appeal Window</label>
                    <div class="detail-value">{formatDate(projectData.six_months_appeal_window_date)}</div>
                  </div>
                </div>

                <!-- Additional -->
                <h3 class="detail-section-header">Additional</h3>
                <div class="detail-grid">
                  <div class="detail-group detail-group--full">
                    <label>Comments</label>
                    <div class="detail-value">{projectData.comments || '-'}</div>
                  </div>
                  <div class="detail-group">
                    <label>Created</label>
                    <div class="detail-value">{formatDate(projectData.created_at)}</div>
                  </div>
                  <div class="detail-group">
                    <label>Last Updated</label>
                    <div class="detail-value">{formatDate(projectData.updated_at)}</div>
                  </div>
                </div>

              </div>
            </div>
          {:else if activeTab === 'hlpv'}
            <!-- HLPV Analysis Tab -->
            <div class="hlpv-analysis-section">
              {#if !projectData.hlpv_last_analyzed}
                <div class="error-state">
                  <i class="las la-info-circle"></i>
                  <p>No HLPV analysis has been run for this project yet.</p>
                </div>
              {:else}
                <div class="hlpv-content">
                  <h3>Risk by Discipline</h3>
                  <div class="risk-grid">
                    <div class="risk-card">
                      <div class="risk-label">Heritage</div>
                      <div class="risk-value risk-{projectData.heritage_risk?.toLowerCase().replace(/_/g, '-') || 'no-risk'}">
                        {projectData.heritage_risk?.replace(/_/g, ' ') || 'No Risk'}
                      </div>
                      <div class="risk-count">{projectData.heritage_rule_count || 0} rules triggered</div>
                    </div>

                    <div class="risk-card">
                      <div class="risk-label">Landscape</div>
                      <div class="risk-value risk-{projectData.landscape_risk?.toLowerCase().replace(/_/g, '-') || 'no-risk'}">
                        {projectData.landscape_risk?.replace(/_/g, ' ') || 'No Risk'}
                      </div>
                      <div class="risk-count">{projectData.landscape_rule_count || 0} rules triggered</div>
                    </div>

                    <div class="risk-card">
                      <div class="risk-label">Ecology</div>
                      <div class="risk-value risk-{projectData.ecology_risk?.toLowerCase().replace(/_/g, '-') || 'no-risk'}">
                        {projectData.ecology_risk?.replace(/_/g, ' ') || 'No Risk'}
                      </div>
                      <div class="risk-count">{projectData.ecology_rule_count || 0} rules triggered</div>
                    </div>

                    <div class="risk-card">
                      <div class="risk-label">Agricultural Land</div>
                      <div class="risk-value risk-{projectData.ag_land_risk?.toLowerCase().replace(/_/g, '-') || 'no-risk'}">
                        {projectData.ag_land_risk?.replace(/_/g, ' ') || 'No Risk'}
                      </div>
                      <div class="risk-count">{projectData.ag_land_rule_count || 0} rules triggered</div>
                    </div>

                    <div class="risk-card">
                      <div class="risk-label">Renewables</div>
                      <div class="risk-value risk-{projectData.renewables_risk?.toLowerCase().replace(/_/g, '-') || 'no-risk'}">
                        {projectData.renewables_risk?.replace(/_/g, ' ') || 'No Risk'}
                      </div>
                      <div class="risk-count">{projectData.renewables_rule_count || 0} rules triggered</div>
                    </div>
                  </div>

                  <div class="hlpv-meta">
                    <p><strong>Last Analyzed:</strong> {new Date(projectData.hlpv_last_analyzed).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              {/if}
            </div>
          {:else if activeTab === 'conflict'}
            <!-- Conflict Check Tab -->
            <div class="conflict-check-section">
              {#if !projectData.polygon_geojson}
                <div class="error-state">
                  <i class="las la-info-circle"></i>
                  <p>No site boundary defined for this project.</p>
                  <p class="hint">A site boundary is required to run a conflict check.</p>
                </div>
              {:else}
                <div class="conflict-check-header">
                  <div>
                    <h3>Initial Conflict Check</h3>
                    <p class="conflict-description">Check for nearby projects and developments within 5km of this site.</p>
                    {#if savedCheckInfo && conflictResults}
                      <p class="last-checked">
                        <i class="las la-clock"></i>
                        Last checked: {new Date(savedCheckInfo.checkedAt).toLocaleDateString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    {/if}
                  </div>
                  <div class="conflict-header-buttons">
                    {#if conflictResults}
                      <button
                        class="btn-copy-results"
                        on:click={copyConflictResults}
                      >
                        <i class="las {copySuccess ? 'la-check' : 'la-copy'}"></i>
                        {copySuccess ? 'Copied' : 'Copy All'}
                      </button>
                    {/if}
                    <button
                      class="btn-run-check"
                      on:click={runConflictCheck}
                      disabled={conflictCheckRunning}
                    >
                      {#if conflictCheckRunning}
                        <span class="spinner-small"></span>
                        Running Check...
                      {:else}
                        <i class="las la-search"></i>
                        {savedCheckInfo ? 'Re-run Check' : 'Run Conflict Check'}
                      {/if}
                    </button>
                  </div>
                </div>

                {#if conflictCheckRunning}
                  <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Checking all layers...</p>
                    <p class="hint">This may take a few seconds</p>
                  </div>
                {:else if conflictError}
                  <div class="error-state">
                    <i class="las la-exclamation-circle"></i>
                    <p>Error: {conflictError}</p>
                    <button on:click={runConflictCheck}>Retry</button>
                  </div>
                {:else if conflictResults}
                  <div class="conflict-results">
                    <!-- Summary -->
                    <div class="conflict-summary">
                      <div class="summary-card">
                        <div class="summary-number">{conflictResults.summary.total}</div>
                        <div class="summary-label">Potential Conflicts Identified</div>
                      </div>
                    </div>

                    {#if conflictResults.summary.total === 0}
                      <div class="no-conflicts">
                        <i class="las la-check-circle"></i>
                        <p>No conflicts found within 5km of this site.</p>
                      </div>
                    {:else}
                      <!-- Distance Categories -->
                      <div class="distance-categories">
                        <!-- Intersecting -->
                        {#if conflictResults.summary.intersecting > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-intersecting"
                              on:click={() => toggleCategory('intersecting')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.intersecting ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Intersecting</span>
                                <span class="category-count">{conflictResults.summary.intersecting}</span>
                              </div>
                            </button>
                            {#if expandedCategories.intersecting}
                              <div class="category-content">
                                {#each conflictResults.conflicts.intersecting as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                          {#if conflict.decision}<p><strong>Decision:</strong> {conflict.decision}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                          {#if conflict.operator}<p><strong>Operator:</strong> {conflict.operator}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.description}<p><strong>Description:</strong> {conflict.description}</p>{/if}
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                          {#if conflict.sector}<p><strong>Sector:</strong> {conflict.sector}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 100m -->
                        {#if conflictResults.summary.within_100m > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-100m"
                              on:click={() => toggleCategory('within_100m')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_100m ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 100m</span>
                                <span class="category-count">{conflictResults.summary.within_100m}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_100m}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_100m as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 250m -->
                        {#if conflictResults.summary.within_250m > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-250m"
                              on:click={() => toggleCategory('within_250m')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_250m ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 250m</span>
                                <span class="category-count">{conflictResults.summary.within_250m}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_250m}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_250m as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_') || conflict.layer === 'projects'}
                                          <p><strong>Name:</strong> {conflict.name || conflict.project_name || 'N/A'}</p>
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 500m -->
                        {#if conflictResults.summary.within_500m > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-500m"
                              on:click={() => toggleCategory('within_500m')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_500m ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 500m</span>
                                <span class="category-count">{conflictResults.summary.within_500m}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_500m}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_500m as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 1km -->
                        {#if conflictResults.summary.within_1km > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-1km"
                              on:click={() => toggleCategory('within_1km')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_1km ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 1km</span>
                                <span class="category-count">{conflictResults.summary.within_1km}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_1km}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_1km as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 3km -->
                        {#if conflictResults.summary.within_3km > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-3km"
                              on:click={() => toggleCategory('within_3km')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_3km ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 3km</span>
                                <span class="category-count">{conflictResults.summary.within_3km}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_3km}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_3km as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}

                        <!-- Within 5km -->
                        {#if conflictResults.summary.within_5km > 0}
                          <div class="category-section">
                            <button 
                              class="category-header category-5km"
                              on:click={() => toggleCategory('within_5km')}
                            >
                              <div class="category-info">
                                <i class="las {expandedCategories.within_5km ? 'la-chevron-down' : 'la-chevron-right'}"></i>
                                <span class="category-title">Within 5km</span>
                                <span class="category-count">{conflictResults.summary.within_5km}</span>
                              </div>
                            </button>
                            {#if expandedCategories.within_5km}
                              <div class="category-content">
                                {#each conflictResults.conflicts.within_5km as conflict}
                                  <div class="conflict-item-wrapper">
                                    <button class="conflict-item" on:click={() => showConflictDetails(conflict)}>
                                      <div class="conflict-header-item">
                                        <span class="conflict-layer">{conflict.layerGroup} - {conflict.layerName}</span>
                                        <span class="conflict-distance">{conflict.distance}m</span>
                                      </div>
                                      <div class="conflict-details">
                                        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                          {#if conflict.address}<p><strong>Address:</strong> {conflict.address}</p>{/if}
                                          {#if conflict.app_state}<p><strong>Status:</strong> {conflict.app_state}</p>{/if}
                                        {:else if conflict.layer.startsWith('repd_')}
                                          <p><strong>Site:</strong> {conflict.site_name || 'N/A'}</p>
                                          {#if conflict.capacity}<p><strong>Capacity:</strong> {conflict.capacity} MW</p>{/if}
                                          {#if conflict.dev_status_short}<p><strong>Status:</strong> {conflict.dev_status_short}</p>{/if}
                                        {:else if conflict.layer.startsWith('trp_')}
                                          <p><strong>Name:</strong> {conflict.name || 'N/A'}</p>
                                        {:else if conflict.layer === 'projects'}
                                          <p><strong>Project:</strong> {conflict.project_name || 'N/A'}</p>
                                          {#if conflict.client}<p><strong>Client:</strong> {conflict.client}</p>{/if}
                                        {/if}
                                      </div>
                                    </button>
                                    <button 
                                      class="conflict-delete-btn" 
                                      on:click={(e) => handleDeleteConflict(conflict, e)}
                                      title="Delete conflict"
                                    >
                                      <i class="las la-times"></i>
                                    </button>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="empty-state">
                    <i class="las la-search"></i>
                    <p>Click "Run Conflict Check" to search for nearby projects and developments.</p>
                  </div>
                {/if}
              {/if}
            </div>
          {:else if activeTab === 'surveyor'}
            <!-- Surveyor Management Tab -->
            <div class="surveyor-section">
              <div class="surveyor-section-header">
                <a href="/surveyor-management" class="btn-goto-surveyor">
                  <i class="las la-external-link-alt"></i> Open Surveyor Management
                </a>
              </div>
              {#if statsLoading}
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading surveyor data...</p>
                </div>
              {:else if statsError}
                <div class="error-state">
                  <i class="las la-exclamation-circle"></i>
                  <p>Error loading data: {statsError}</p>
                  <button on:click={loadSurveyorStats}>Retry</button>
                </div>
              {:else if stats}

                <!-- Quote Stats -->
                <h3 class="surveyor-section-title">Quotes</h3>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-number">{stats.quotesSent}</div>
                    <div class="stat-label">Requests Sent</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{stats.quotesReceived}</div>
                    <div class="stat-label">Quotes Received</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{stats.quotesInstructed}</div>
                    <div class="stat-label">Instructed</div>
                  </div>
                  <div class="stat-card stat-card--highlight">
                    <div class="stat-number">£{stats.instructedSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="stat-label">Instructed Spend</div>
                  </div>
                </div>

                <!-- Works Status -->
                <h3 class="surveyor-section-title">Works Status</h3>
                <div class="stats-grid stats-grid--3">
                  <div class="stat-card stat-card--warning">
                    <div class="stat-number">{stats.worksOutstanding}</div>
                    <div class="stat-label">Works Outstanding</div>
                  </div>
                  <div class="stat-card stat-card--success">
                    <div class="stat-number">{stats.worksCompleted}</div>
                    <div class="stat-label">Works Completed</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{keyDates.length}</div>
                    <div class="stat-label">Key Dates</div>
                  </div>
                </div>

                <!-- Upcoming Programme Events -->
                {#if programmeEvents.length > 0}
                  <h3 class="surveyor-section-title">Upcoming Programme Events</h3>
                  <div class="event-list">
                    {#each programmeEvents
                      .filter(e => new Date(e.date) >= new Date())
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .slice(0, 3) as event}
                      <div class="event-item">
                        <span class="event-dot" style="background: {event.colour || '#9333ea'}"></span>
                        <span class="event-date">{formatDate(event.date)}</span>
                        <span class="event-title">{event.title}</span>
                      </div>
                    {:else}
                      <p class="no-data">No upcoming programme events.</p>
                    {/each}
                  </div>
                {/if}

                <!-- Key Dates -->
                {#if keyDates.length > 0}
                  <h3 class="surveyor-section-title">Key Dates</h3>
                  <div class="event-list">
                    {#each keyDates.sort((a, b) => new Date(a.date) - new Date(b.date)) as kd}
                      <div class="event-item">
                        <span class="event-dot" style="background: {kd.colour || '#3b82f6'}"></span>
                        <span class="event-date">{formatDate(kd.date)}</span>
                        <span class="event-title">{kd.title}</span>
                        {#if kd.discipline}
                          <span class="event-discipline">{kd.discipline}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}

              {:else}
                <div class="empty-state">
                  <i class="las la-hard-hat"></i>
                  <p>No surveyor management data found for this project.</p>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-close" on:click={handleClose}>Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Conflict Detail Popup -->
<ConflictDetailPopup 
  conflict={selectedConflict} 
  onClose={closeConflictDetails}
/>

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
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-edit-header {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    font-size: 1.5rem;
    line-height: 1;
  }

  .btn-edit-header:hover {
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
    display: flex;
    flex-direction: column;
    padding: 2rem;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
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

  .error-state i {
    font-size: 3rem;
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .error-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .error-state button:hover {
    background: #7e22ce;
  }

  .site-boundary-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .site-boundary-section .map-container {
    flex: 1;
    min-height: 0;
  }

  .details-section {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
  }

  .details-scroll {
    flex: 1;
    overflow-y: auto;
    padding-right: 1rem;
  }

  .detail-section-header {
    font-size: 0.75rem;
    font-weight: 700;
    color: #9333ea;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 1.5rem 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .detail-section-header:first-child {
    margin-top: 0;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .detail-group--full {
    grid-column: 1 / -1;
  }

  .detail-group {
    margin-bottom: 1.5rem;
  }

  .detail-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .detail-value {
    font-size: 1rem;
    color: #1e293b;
    padding: 0.625rem 0.875rem;
    background: #f8fafc;
    border-radius: 0.375rem;
    border: 1px solid #e2e8f0;
  }

  .map-container {
    flex: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    min-height: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    gap: 1rem;
  }

  .btn-close {
    padding: 0.625rem 1.5rem;
    background: #64748b;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-close:hover {
    background: #475569;
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    gap: 0;
    padding: 0 2rem;
    border-bottom: 1px solid #e2e8f0;
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
  }

  .tab-button:hover {
    color: #1e293b;
    background: #f8fafc;
  }

  .tab-button.active {
    color: #9333ea;
    border-bottom-color: #9333ea;
  }

  /* HLPV Analysis Section */
  .hlpv-analysis-section {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .hlpv-content {
    max-width: 900px;
    margin: 0 auto;
  }

  .hlpv-content h3 {
    margin: 0 0 1.5rem 0;
    color: #1e293b;
    font-size: 1.25rem;
  }

  .risk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .risk-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1.25rem;
    text-align: center;
  }

  .risk-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .risk-value {
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.375rem;
    text-transform: uppercase;
  }

  .risk-value.risk-no-risk {
    background: #d1fae5;
    color: #065f46;
  }

  .risk-value.risk-low-risk {
    background: #dbeafe;
    color: #1e40af;
  }

  .risk-value.risk-medium-low-risk {
    background: #fef3c7;
    color: #92400e;
  }

  .risk-value.risk-medium-risk {
    background: #fed7aa;
    color: #9a3412;
  }

  .risk-value.risk-medium-high-risk {
    background: #fecaca;
    color: #991b1b;
  }

  .risk-value.risk-high-risk {
    background: #fca5a5;
    color: #7f1d1d;
  }

  .risk-value.risk-extremely-high-risk,
  .risk-value.risk-showstopper {
    background: #dc2626;
    color: white;
  }

  .risk-count {
    font-size: 0.75rem;
    color: #64748b;
  }

  .hlpv-meta {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 2rem;
  }

  .hlpv-meta p {
    margin: 0.5rem 0;
    color: #475569;
    font-size: 0.875rem;
  }

  .hlpv-meta p:first-child {
    margin-top: 0;
  }

  .hlpv-meta p:last-child {
    margin-bottom: 0;
  }

  /* Conflict Check Styles */
  .conflict-check-section {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    overflow-y: auto;
  }

  .conflict-check-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  .conflict-check-header h3 {
    margin: 0 0 0.5rem 0;
    color: #1e293b;
    font-size: 1.5rem;
  }

  .conflict-description {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  .last-checked {
    color: #64748b;
    font-size: 0.8125rem;
    margin: 0.5rem 0 0 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .last-checked i {
    font-size: 1rem;
  }

  .conflict-header-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .btn-copy-results {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-copy-results:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
  }

  .btn-run-check {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-run-check:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .btn-run-check:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-run-check i {
    font-size: 1.125rem;
  }

  .spinner-small {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .conflict-summary {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 2rem;
    align-items: center;
  }

  .summary-card {
    text-align: center;
    padding: 1rem 2rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .summary-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #3b82f6;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .summary-label {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  .summary-meta {
    flex: 1;
  }

  .summary-meta p {
    margin: 0.5rem 0;
    color: #475569;
    font-size: 0.875rem;
  }

  .summary-meta p:first-child {
    margin-top: 0;
  }

  .summary-meta p:last-child {
    margin-bottom: 0;
  }

  .no-conflicts {
    text-align: center;
    padding: 3rem;
    background: #f0fdf4;
    border: 2px dashed #86efac;
    border-radius: 0.75rem;
  }

  .no-conflicts i {
    font-size: 3rem;
    color: #22c55e;
    margin-bottom: 1rem;
  }

  .no-conflicts p {
    color: #166534;
    font-size: 1rem;
    margin: 0;
  }

  .distance-categories {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .category-section {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
    background: white;
  }

  .category-header {
    width: 100%;
    background: #f8fafc;
    border: none;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .category-header:hover {
    background: #f1f5f9;
  }

  .category-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .category-info i {
    font-size: 1rem;
    color: #64748b;
    transition: transform 0.2s;
  }

  .category-icon {
    font-size: 1.25rem;
  }

  .category-title {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.9375rem;
  }

  .category-count {
    background: #3b82f6;
    color: white;
    padding: 0.25rem 0.625rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .category-content {
    padding: 0.5rem;
    background: white;
    border-top: 1px solid #e2e8f0;
  }

  .conflict-item-wrapper {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .conflict-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.875rem;
    flex: 1;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .conflict-item:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateX(2px);
  }

  .conflict-delete-btn {
    background: transparent;
    color: #dc2626;
    border: none;
    border-radius: 0.25rem;
    padding: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
  }

  .conflict-delete-btn:hover {
    background: #fee2e2;
    color: #b91c1c;
  }

  .conflict-delete-btn i {
    font-size: 0.875rem;
  }

  .conflict-item:last-child {
    margin-bottom: 0;
  }


  .conflict-header-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .conflict-layer {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.875rem;
  }

  .conflict-distance {
    background: #3b82f6;
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .conflict-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .conflict-details p {
    margin: 0;
    color: #475569;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .conflict-details strong {
    color: #1e293b;
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #94a3b8;
  }

  .empty-state i {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 1rem;
    margin: 0;
  }

  .hint {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-top: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Surveyor Management Tab ── */
  .surveyor-section-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .btn-goto-surveyor {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #9333ea;
    background: #f5f3ff;
    border: 1px solid #d8b4fe;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-goto-surveyor:hover {
    background: #ede9fe;
    border-color: #a855f7;
  }

  .surveyor-section {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.25rem 1rem;
  }

  .surveyor-section-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #9333ea;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 1.5rem 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .surveyor-section-title:first-child {
    margin-top: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .stats-grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .stat-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1.25rem 1rem;
    text-align: center;
  }

  .stat-card--highlight {
    background: #f3e8ff;
    border-color: #d8b4fe;
  }

  .stat-card--warning {
    background: #fff7ed;
    border-color: #fed7aa;
  }

  .stat-card--success {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .stat-number {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .stat-card--highlight .stat-number { color: #7e22ce; }
  .stat-card--warning .stat-number   { color: #c2410c; }
  .stat-card--success .stat-number   { color: #15803d; }

  .stat-label {
    font-size: 0.8125rem;
    color: #64748b;
    font-weight: 500;
  }

  .event-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .event-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .event-date {
    color: #64748b;
    white-space: nowrap;
    font-size: 0.8125rem;
    min-width: 6rem;
  }

  .event-title {
    color: #1e293b;
    font-weight: 500;
    flex: 1;
  }

  .event-discipline {
    font-size: 0.75rem;
    color: #7e22ce;
    background: #f3e8ff;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .no-data {
    color: #94a3b8;
    font-size: 0.875rem;
    margin: 0;
  }
</style>
