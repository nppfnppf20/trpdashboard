<script>
  import SocioeconomicsMapPanel from './SocioeconomicsMapPanel.svelte';
  import SocioeconomicsSpreadsheet from './SocioeconomicsSpreadsheet.svelte';
  import ProjectSelector from '$lib/components/shared/ProjectSelector.svelte';
  import AddProjectModal from '$lib/components/projects/AddProjectModal.svelte';
  import { analyzeSocioeconomics } from '$lib/services/socioeconomicsApi.js';

  /** @type {any | null} */
  let currentPolygonGeometry = null;
  /** @type {any | null} */
  let socioeconomicsResult = null;
  /** @type {boolean} */
  let loading = false;
  /** @type {string} */
  let errorMsg = '';

  // Project selector state
  /** @type {string} */
  let selectionModeBinding = 'project';
  /** @type {string} */
  let selectedProjectIdBinding = '';
  /** @type {any | null} */
  let selectedProject = null;
  /** @type {any | null} */
  let projectSelectorComponent = null;
  /** @type {any | null} */
  let mapPanelComponent = null;
  /** @type {boolean} */
  let showCreateProjectModal = false;
  /** @type {boolean} */
  let drawingEnabled = false;

  // Enable drawing only when a valid selection is made
  $: drawingEnabled = selectionModeBinding === 'oneoff' || (selectionModeBinding === 'project' && selectedProject !== null);

  // Check if analysis has been run
  $: hasResults = !!socioeconomicsResult;

  /**
   * Handle project selection from ProjectSelector
   * @param {CustomEvent} event
   */
  async function handleProjectSelected(event) {
    const { project } = event.detail;

    if (!project) {
      selectedProject = null;
      selectionModeBinding = 'project';
      return;
    }

    selectedProject = project;
    selectionModeBinding = 'project';
    console.log('🎯 Socioeconomics: Project selected:', project);

    // If project has a polygon, load it on map and run analysis
    if (project.polygon_geojson) {
      try {
        const geometry = JSON.parse(project.polygon_geojson);
        console.log('📍 Loading project polygon on map...');

        // Wait for map to be ready and load polygon
        let attempts = 0;
        const maxAttempts = 20;
        let polygonLoaded = false;

        while (attempts < maxAttempts && !polygonLoaded) {
          if (mapPanelComponent && typeof mapPanelComponent.loadPolygonOnMap === 'function') {
            polygonLoaded = mapPanelComponent.loadPolygonOnMap(geometry);
            if (!polygonLoaded) {
              console.log(`⏳ Waiting for map to initialize (attempt ${attempts + 1}/${maxAttempts})...`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          attempts++;
        }

        if (!polygonLoaded) {
          console.warn('⚠️ Could not load polygon on map after multiple attempts');
        }

        // Run analysis with the loaded geometry
        console.log('🚀 Running socioeconomics analysis for selected project...');
        await handlePolygonDrawn(geometry);
      } catch (error) {
        console.error('❌ Error loading project polygon:', error);
        errorMsg = 'Failed to load project polygon';
      }
    } else {
      console.log('ℹ️ Project has no polygon defined');
      errorMsg = 'This project is missing a site boundary. Please add one in the projects table to proceed with analysis.';
    }
  }

  /**
   * Handle one-off report selection from ProjectSelector
   */
  function handleOneOffSelected() {
    console.log('🎯 Socioeconomics: One-off report mode selected');
    selectionModeBinding = 'oneoff';
    selectedProject = null;
  }

  /**
   * Handle create new project from ProjectSelector
   */
  function handleCreateNewProjectClick() {
    console.log('🎯 Socioeconomics: Create new project button clicked');
    showCreateProjectModal = true;
  }

  /**
   * Handle project created - auto-select it and load boundary
   * @param {any} project
   */
  async function handleProjectCreated(project) {
    showCreateProjectModal = false;

    // Refresh the projects list in ProjectSelector FIRST
    if (projectSelectorComponent) {
      await projectSelectorComponent.refreshProjects();
    }

    // Small delay to ensure the dropdown has updated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Auto-select the newly created project
    selectedProject = project;
    selectionModeBinding = 'project';
    selectedProjectIdBinding = project.id;

    // Load the project's polygon on the map if it exists
    if (project.polygon_geojson) {
      const geometry = typeof project.polygon_geojson === 'string'
        ? JSON.parse(project.polygon_geojson)
        : project.polygon_geojson;

      // Wait for map to be ready and load polygon
      let attempts = 0;
      const maxAttempts = 20;
      let polygonLoaded = false;

      while (attempts < maxAttempts && !polygonLoaded) {
        if (mapPanelComponent && typeof mapPanelComponent.loadPolygonOnMap === 'function') {
          polygonLoaded = mapPanelComponent.loadPolygonOnMap(geometry);
          if (!polygonLoaded) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        attempts++;
      }

      await handlePolygonDrawn(geometry);
    }
  }

  /** @param {any} geometry */
  async function handlePolygonDrawn(geometry) {
    console.log('🎯 Socioeconomics: Polygon drawn', geometry);
    currentPolygonGeometry = geometry;

    // Reset state
    socioeconomicsResult = null;
    errorMsg = '';
    loading = true;

    try {
      console.log('🚀 Starting socioeconomics analysis...');
      const result = await analyzeSocioeconomics(geometry);
      console.log('✅ Socioeconomics analysis complete:', result);
      socioeconomicsResult = result;
    } catch (error) {
      console.error('❌ Socioeconomics analysis failed:', error);
      errorMsg = error.message || 'Analysis failed';
    } finally {
      loading = false;
    }
  }

</script>

<div class="dashboard">
  <!-- Simple left panel -->
  <div class="findings-section">
    <!-- Simple navbar -->
    <nav class="navbar">
      <div class="navbar-content">
        <h1 class="navbar-title">Socioeconomics Tool</h1>
      </div>
    </nav>

    <!-- Project Selector -->
    {#if !hasResults}
      <ProjectSelector
        bind:this={projectSelectorComponent}
        bind:selectionMode={selectionModeBinding}
        bind:selectedProjectId={selectedProjectIdBinding}
        on:projectSelected={handleProjectSelected}
        on:oneOffSelected={handleOneOffSelected}
        on:createNewProject={handleCreateNewProjectClick}
        label="Select Project or Analysis Mode"
        showDivider={false}
      />
    {:else}
      <div class="card project-display">
        <div class="project-display-content">
          <span class="project-label">Selected:</span>
          <span class="project-value">
            {#if selectionModeBinding === 'oneoff'}
              One-Off Analysis
            {:else if selectedProject}
              {selectedProject.project_name}
            {:else}
              No project selected
            {/if}
          </span>
          <span class="project-hint">Click refresh to change selection</span>
        </div>
        <button class="refresh-btn-inline" on:click={() => window.location.reload()}>
          <i class="las la-sync"></i>
        </button>
      </div>
    {/if}

    <!-- Simple content area -->
    <div class="findings-panel">
      {#if errorMsg}
        <div class="error-state">
          <div class="error-icon">
            <i class="las la-exclamation-triangle"></i>
          </div>
          <h2>Analysis Error</h2>
          <p>{errorMsg}</p>
        </div>
      {:else if socioeconomicsResult}
        <div class="results-content">
          <SocioeconomicsSpreadsheet
            {socioeconomicsResult}
            projectId={selectedProject?.id || null}
            summaryStats={{
              totalLayers: socioeconomicsResult.metadata?.totalLayers || 0,
              layersWithData: socioeconomicsResult.metadata?.layersWithData || 0,
              generatedAt: socioeconomicsResult.metadata?.generatedAt
            }}
          />
        </div>
      {:else}
        <div class="welcome-content">
          <div class="welcome-icon">
            <i class="las la-chart-bar"></i>
          </div>
          <h2>Draw a Polygon to Analyse</h2>
          <p>Use the drawing tools on the map to create a polygon. The polygon will be analysed against the socioeconomics database.</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Dedicated socioeconomics map panel -->
  <SocioeconomicsMapPanel
    bind:this={mapPanelComponent}
    onPolygonDrawn={handlePolygonDrawn}
    {loading}
    {drawingEnabled}
  />
</div>

<!-- Create Project Modal -->
<AddProjectModal
  isOpen={showCreateProjectModal}
  onProjectCreated={handleProjectCreated}
  onClose={() => showCreateProjectModal = false}
/>

<style>
  /* Override global dashboard layout for socioeconomics - vertical instead of horizontal */
  .dashboard {
    flex-direction: column !important;
    height: 100vh;
    align-items: center;
    padding: 1rem;
    gap: 1rem;
  }

  .findings-section {
    width: 90% !important;
    max-width: 1200px !important;
    height: auto !important;
    order: 2; /* Put findings section below map */
  }

  .findings-panel {
    height: auto !important;
    max-height: 45vh;
    overflow-y: auto;
  }

  /* Make map panel take top portion */
  :global(.socioeconomics-map-panel) {
    order: 1; /* Put map panel above findings */
    height: 45vh !important;
    width: 90% !important;
    max-width: 1200px !important;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .navbar {
    padding: 1rem 1.5rem;
  }

  .navbar-content {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .navbar-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .welcome-content {
    padding: 2rem;
    text-align: center;
  }

  .welcome-icon {
    width: 4rem;
    height: 4rem;
    background: var(--color-emerald-100);
    color: var(--color-emerald-600);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .welcome-icon i {
    font-size: 2rem;
  }

  .welcome-content h2 {
    color: var(--color-slate-800);
    margin-bottom: 1rem;
  }

  .welcome-content p {
    color: var(--color-slate-500);
    line-height: 1.6;
    margin-bottom: 2rem;
  }

  .polygon-info {
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 2rem;
    text-align: left;
  }

  .polygon-info h3 {
    color: var(--color-emerald-600);
    margin: 0 0 0.5rem 0;
  }

  .polygon-info p {
    margin: 0 0 0.5rem 0;
    color: var(--color-green-800);
  }

  .loading-state, .error-state {
    padding: 2rem;
    text-align: center;
  }

  .loading-icon, .error-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .loading-icon {
    background: var(--color-primary-100);
    color: var(--color-primary-500);
  }

  .loading-icon i {
    font-size: 2rem;
    animation: spin 1s linear infinite;
  }

  .error-icon {
    background: var(--color-red-50);
    color: var(--color-red-600);
  }

  .error-icon i {
    font-size: 2rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .results-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .results-header {
    text-align: center;
    margin-bottom: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid var(--color-slate-200);
  }

  .results-icon {
    width: 3rem;
    height: 3rem;
    background: var(--color-emerald-100);
    color: var(--color-emerald-600);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 0.75rem;
  }

  .results-icon i {
    font-size: 1.5rem;
  }

  .results-header h2 {
    color: var(--color-slate-800);
    margin-bottom: 0.5rem;
    font-size: 1.25rem;
  }

  .results-header p {
    color: var(--color-slate-500);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .results-summary {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
  }

  .summary-stat {
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .summary-stat strong {
    color: var(--color-slate-800);
    font-weight: 600;
  }

  /* Project Display (when analysis is running) */
  .project-display {
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .project-display-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .project-label {
    font-weight: 600;
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .project-value {
    font-weight: 600;
    color: var(--color-slate-800);
    font-size: 0.875rem;
  }

  .project-hint {
    color: var(--color-slate-400);
    font-size: 0.75rem;
    font-style: italic;
  }

  .refresh-btn-inline {
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }

  .refresh-btn-inline:hover {
    background: var(--color-purple-700);
  }

  .refresh-btn-inline i {
    font-size: 1rem;
  }
</style>