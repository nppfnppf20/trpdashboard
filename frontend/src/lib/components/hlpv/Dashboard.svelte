<script>
  import Navbar from '../shared/Navbar.svelte';
  import FindingsPanel from './FindingsPanel.svelte';
  import MapPanel from './MapPanel.svelte';
  import ReportGenerator from './ReportGenerator.svelte';
  import TRPReportEditor from './TRPReportEditor.svelte';
  import SaveSiteModal from './SaveSiteModal.svelte';
  import OneOffSiteModal from '../shared/OneOffSiteModal.svelte';
  import AddProjectModal from '../projects/AddProjectModal.svelte';
  import ProjectSelector from '../shared/ProjectSelector.svelte';
  import { analyzeHeritage, analyzeLandscape, analyzeAgLand, analyzeRenewables, analyzeEcology, analyzeTrees, analyzeAirfields, saveSite, createAnalysisSession, getSessionByProject } from '$lib/services/api.js';
  import { startNewScreenshotSession } from '$lib/services/screenshotManager.js';

  /** @type {Record<string, any> | null} */
  let heritageResult = null;
  /** @type {Record<string, any> | null} */
  let landscapeResult = null;
  /** @type {Record<string, any> | null} */
  let agLandResult = null;
  /** @type {Record<string, any> | null} */
  let renewablesResult = null;
  /** @type {Record<string, any> | null} */
  let ecologyResult = null;
  /** @type {Record<string, any> | null} */
  let treesResult = null;
  /** @type {Record<string, any> | null} */
  let airfieldsResult = null;
  /** @type {string} */
  let errorMsg = '';
  /** @type {boolean} */
  let loading = false;
  /** @type {string} */
  let activeTab = 'analysis';
  /** @type {boolean} */
  let trpReportVisible = false;
  /** @type {boolean} */
  let showSaveSiteModal = false;
  /** @type {boolean} */
  let showOneOffModal = false;
  /** @type {boolean} */
  let showCreateProjectModal = false;
  /** @type {boolean} */
  let analysisSaved = false;
  /** @type {boolean} */
  let isManualAnalysis = false;
  /** @type {string | null} */
  let analysisSessionId = null;
  /** @type {boolean} */
  let loadedFromSaved = false; // Track if we loaded from saved analysis (don't re-save)
  /** @type {any | null} */
  let currentPolygonGeometry = null;
  /** @type {any | null} */
  let selectedProject = null;
  /** @type {any | null} */
  let mapPanelComponent = null;
  /** @type {any | null} */
  let projectSelectorComponent = null;
  /** @type {string} */
  let selectionModeBinding = 'project'; // Bound to ProjectSelector mode - defaults to 'project'
  /** @type {string} */
  let selectedProjectIdBinding = ''; // Bound to ProjectSelector dropdown - empty means no project selected

  /**
   * Strip geometry from a single feature, keeping all other properties
   * @param {any} feature
   * @returns {any}
   */
  function stripGeometry(feature) {
    if (!feature || typeof feature !== 'object') return feature;
    const { geometry, geojson, geom, the_geom, shape, ...rest } = feature;
    return rest;
  }

  /**
   * Strip geometries from an array of features
   * @param {any[]} features
   * @returns {any[]}
   */
  function stripGeometryFromArray(features) {
    if (!Array.isArray(features)) return features;
    return features.map(stripGeometry);
  }

  /**
   * Extract data for saving - keeps all feature details but strips GeoJSON geometries
   * @param {any} data - Full analysis data
   * @returns {any} Data with feature details but no geometries
   */
  function extractLightweightData(data) {
    if (!data) return null;

    const result = {
      rules: data.rules || [],
      overallRisk: data.overallRisk,
      disciplineRecommendation: data.disciplineRecommendation || null,
      defaultTriggeredRecommendations: data.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: data.defaultNoRulesRecommendations || [],
      metadata: data.metadata || {}
    };

    // Heritage features
    if (data.listed_buildings) result.listed_buildings = stripGeometryFromArray(data.listed_buildings);
    if (data.conservation_areas) result.conservation_areas = stripGeometryFromArray(data.conservation_areas);
    if (data.scheduled_monuments) result.scheduled_monuments = stripGeometryFromArray(data.scheduled_monuments);
    if (data.registered_parks_gardens) result.registered_parks_gardens = stripGeometryFromArray(data.registered_parks_gardens);
    if (data.world_heritage_sites) result.world_heritage_sites = stripGeometryFromArray(data.world_heritage_sites);

    // Landscape features
    if (data.green_belt) result.green_belt = stripGeometryFromArray(data.green_belt);
    if (data.aonb) result.aonb = stripGeometryFromArray(data.aonb);
    if (data.national_parks) result.national_parks = stripGeometryFromArray(data.national_parks);

    // Ecology features
    if (data.sssi) result.sssi = stripGeometryFromArray(data.sssi);
    if (data.sac) result.sac = stripGeometryFromArray(data.sac);
    if (data.spa) result.spa = stripGeometryFromArray(data.spa);
    if (data.ramsar) result.ramsar = stripGeometryFromArray(data.ramsar);
    if (data.national_nature_reserves) result.national_nature_reserves = stripGeometryFromArray(data.national_nature_reserves);
    if (data.gcn) result.gcn = stripGeometryFromArray(data.gcn);
    if (data.os_priority_ponds) result.os_priority_ponds = stripGeometryFromArray(data.os_priority_ponds);
    if (data.drinking_water) result.drinking_water = stripGeometryFromArray(data.drinking_water);
    if (data.drinkingWaterRules) result.drinkingWaterRules = data.drinkingWaterRules;

    // Agricultural land
    if (data.ag_land) result.ag_land = stripGeometryFromArray(data.ag_land);

    // Renewables
    if (data.renewables) result.renewables = stripGeometryFromArray(data.renewables);

    // Trees
    if (data.ancient_woodland) result.ancient_woodland = stripGeometryFromArray(data.ancient_woodland);

    // Airfields
    if (data.uk_airports) result.uk_airports = stripGeometryFromArray(data.uk_airports);

    return result;
  }

  /**
   * Merge fresh map features with saved text data (risk/rules/recommendations)
   * @param {any} freshData - Fresh analysis data with map features
   * @param {any} savedData - Saved lightweight data with edited risk/rules
   * @returns {any} Merged data: fresh features + saved text
   */
  function mergeFreshWithSaved(freshData, savedData) {
    if (!freshData) return savedData;
    if (!savedData) return freshData;
    return {
      ...freshData, // Keep fresh map features
      // Override with saved text data
      overallRisk: savedData.overallRisk ?? freshData.overallRisk,
      rules: savedData.rules ?? freshData.rules,
      disciplineRecommendation: savedData.disciplineRecommendation ?? freshData.disciplineRecommendation,
      defaultTriggeredRecommendations: savedData.defaultTriggeredRecommendations ?? freshData.defaultTriggeredRecommendations,
      defaultNoRulesRecommendations: savedData.defaultNoRulesRecommendations ?? freshData.defaultNoRulesRecommendations
    };
  }

  /**
   * Create placeholder data from saved analysis for immediate display
   * @param {any} savedData - Saved lightweight data
   * @returns {any} Data suitable for UI display while map loads
   */
  function createPlaceholderFromSaved(savedData) {
    if (!savedData) return null;
    return {
      ...savedData,
      _loadingMapFeatures: true // Flag to indicate map features are loading
    };
  }

  /**
   * Handle project selection from ProjectSelector
   * @param {CustomEvent} event
   */
  async function handleProjectSelected(event) {
    const { project } = event.detail;

    if (!project) {
      // Project was cleared
      selectedProject = null;
      selectionModeBinding = 'project';
      return;
    }

    selectedProject = project;
    selectionModeBinding = 'project';
    console.log('🎯 Project selected:', project);

    if (!project.polygon_geojson) {
      console.log('ℹ️ Project has no polygon defined');
      errorMsg = 'This project is missing a site boundary. Please add one in the projects table to proceed with analysis.';
      return;
    }

    let geometry;
    try {
      geometry = JSON.parse(project.polygon_geojson);
    } catch (e) {
      errorMsg = 'Invalid polygon geometry';
      return;
    }

    console.log('📍 Loading project polygon on map...');
    if (mapPanelComponent) {
      mapPanelComponent.loadPolygonOnMap(geometry);
    }

    // Step 1: Check for saved analysis session and load IMMEDIATELY for instant feedback
    let savedSession = null;

    try {
      console.log('🔍 Checking for saved analysis session...');
      const sessionResponse = await getSessionByProject(project.id);

      if (sessionResponse.success && sessionResponse.data?.sessionId) {
        savedSession = sessionResponse.data;
        analysisSessionId = savedSession.sessionId;
        loadedFromSaved = true;
        analysisSaved = true;

        console.log('📊 Found saved session, showing immediately...', {
          sessionId: analysisSessionId
        });

        // Enable TRP Report tab for editing
        trpReportVisible = true;

        // Show saved data IMMEDIATELY (before map analysis runs)
        heritageResult = createPlaceholderFromSaved(savedSession.heritageData);
        landscapeResult = createPlaceholderFromSaved(savedSession.landscapeData);
        renewablesResult = createPlaceholderFromSaved(savedSession.renewablesData);
        ecologyResult = createPlaceholderFromSaved(savedSession.ecologyData);
        agLandResult = createPlaceholderFromSaved(savedSession.agLandData);
        treesResult = createPlaceholderFromSaved(savedSession.treesData);
        airfieldsResult = createPlaceholderFromSaved(savedSession.airfieldsData);

        console.log('✅ Saved findings displayed - now loading map features...');
      }
    } catch (checkError) {
      console.log('ℹ️ No saved session found (first time for this project)');
      loadedFromSaved = false;
    }

    // Step 2: Run fresh spatial analysis (for map features)
    console.log('🚀 Running spatial analysis for map features...');
    isManualAnalysis = false;
    loading = true;
    errorMsg = '';

    try {
      // Run all analyses in parallel
      const [heritageData, landscapeData, agLandData, renewablesData, ecologyData, treesData, airfieldsData] = await Promise.all([
        analyzeHeritage(geometry).then(data => { console.log('✅ Heritage complete'); return data; }),
        analyzeLandscape(geometry).then(data => { console.log('✅ Landscape complete'); return data; }),
        analyzeAgLand(geometry).then(data => { console.log('✅ AgLand complete'); return data; }),
        analyzeRenewables(geometry).then(data => { console.log('✅ Renewables complete'); return data; }),
        analyzeEcology(geometry).then(data => { console.log('✅ Ecology complete'); return data; }),
        analyzeTrees(geometry).then(data => { console.log('✅ Trees complete'); return data; }),
        analyzeAirfields(geometry).then(data => { console.log('✅ Airfields complete'); return data; })
      ]);

      console.log('🎉 All spatial analyses complete!');

      // Step 3: Merge fresh map features with saved data (if exists)
      if (savedSession) {
        console.log('🔀 Merging fresh map features with saved data...');
        heritageResult = mergeFreshWithSaved(heritageData, savedSession.heritageData);
        landscapeResult = mergeFreshWithSaved(landscapeData, savedSession.landscapeData);
        renewablesResult = mergeFreshWithSaved(renewablesData, savedSession.renewablesData);
        ecologyResult = mergeFreshWithSaved(ecologyData, savedSession.ecologyData);
        agLandResult = mergeFreshWithSaved(agLandData, savedSession.agLandData);
        treesResult = mergeFreshWithSaved(treesData, savedSession.treesData);
        airfieldsResult = mergeFreshWithSaved(airfieldsData, savedSession.airfieldsData);
        console.log('✅ Merged: map features + saved data');
      } else {
        // No saved data - use fresh analysis results
        heritageResult = heritageData;
        landscapeResult = landscapeData;
        agLandResult = agLandData;
        renewablesResult = renewablesData;
        ecologyResult = ecologyData;
        treesResult = treesData;
        airfieldsResult = airfieldsData;
        trpReportVisible = true;

        // Save to normalized tables (first time) - use lightweight data without geometries
        try {
          console.log('💾 Saving analysis session (first time)...');
          const siteName = project.project_name || 'One-off Analysis';
          const saveResult = await createAnalysisSession({
            projectId: project.id,
            siteName,
            polygonGeojson: geometry,
            heritageData: heritageData ? extractLightweightData(heritageData) : null,
            landscapeData: landscapeData ? extractLightweightData(landscapeData) : null,
            renewablesData: renewablesData ? extractLightweightData(renewablesData) : null,
            ecologyData: ecologyData ? extractLightweightData(ecologyData) : null,
            agLandData: agLandData ? extractLightweightData(agLandData) : null,
            treesData: treesData ? extractLightweightData(treesData) : null,
            airfieldsData: airfieldsData ? extractLightweightData(airfieldsData) : null
          });
          analysisSessionId = saveResult.sessionId;
          analysisSaved = true;
          console.log('✅ Analysis session saved with ID:', analysisSessionId);
        } catch (saveErr) {
          console.error('⚠️ Failed to save analysis session:', saveErr);
        }
      }

    } catch (err) {
      console.error('❌ Spatial analysis error:', err);
      errorMsg = err?.message || String(err);
    } finally {
      loading = false;
    }
  }

  /**
   * Handle one-off report selection from ProjectSelector
   */
  function handleOneOffSelected() {
    console.log('🎯 One-off report mode selected');
    selectionModeBinding = 'oneoff';
    selectedProject = null;
  }

  /**
   * Handle create new project from ProjectSelector
   */
  function handleCreateNewProjectClick() {
    console.log('🎯 Create new project button clicked');
    showCreateProjectModal = true;
  }

  /**
   * Handle polygon drawn manually by user (not from project)
   * @param {any} geometry
   */
  async function handleManualPolygonDrawn(geometry) {
    isManualAnalysis = true; // Mark as manual analysis
    await handlePolygonDrawn(geometry);
  }

  /** @param {any} geometry */
  async function handlePolygonDrawn(geometry) {
    console.log('🎯 Polygon drawn, starting analysis...', geometry);
    currentPolygonGeometry = geometry; // Store for TRP saving

    // Start new screenshot session for this analysis
    startNewScreenshotSession();

    errorMsg = '';
    heritageResult = null;
    landscapeResult = null;
    agLandResult = null;
    renewablesResult = null;
    ecologyResult = null;
    treesResult = null;
    airfieldsResult = null;
    analysisSaved = false; // Reset saved state for new analysis
    analysisSessionId = null; // Reset original analysis ID for new analysis
    loadedFromSaved = false; // This is a fresh analysis, not loaded from saved
    loading = true;

    try {
      console.log('🚀 Starting analysis requests...');
      // Run heritage, landscape, agricultural land, renewables, ecology, trees, and airfields analysis in parallel
      const [heritageData, landscapeData, agLandData, renewablesData, ecologyData, treesData, airfieldsData] = await Promise.all([
        analyzeHeritage(geometry).then(data => { console.log('✅ Heritage analysis complete'); return data; }),
        analyzeLandscape(geometry).then(data => { console.log('✅ Landscape analysis complete'); return data; }),
        analyzeAgLand(geometry).then(data => { console.log('✅ AgLand analysis complete'); return data; }),
        analyzeRenewables(geometry).then(data => { console.log('✅ Renewables analysis complete'); return data; }),
        analyzeEcology(geometry).then(data => { console.log('✅ Ecology analysis complete'); return data; }),
        analyzeTrees(geometry).then(data => { console.log('✅ Trees analysis complete'); return data; }),
        analyzeAirfields(geometry).then(data => { console.log('✅ Airfields analysis complete'); return data; })
      ]);
      console.log('🎉 All analyses complete!');
      
      console.log('🔍 API Results:', {
        heritage: heritageData,
        landscape: landscapeData,
        agLand: agLandData,
        renewables: renewablesData,
        ecology: ecologyData,
        trees: treesData,
        airfields: airfieldsData
      });

      console.log('🌱 Renewables structure details:', renewablesData);
      if (renewablesData && renewablesData.renewables) {
        console.log('🔍 First renewables item:', renewablesData.renewables[0]);
        console.log('🔍 Renewables item keys:', Object.keys(renewablesData.renewables[0] || {}));
      }

      console.log('🏛️ Heritage structure details:', heritageData);
      if (heritageData && heritageData.scheduled_monuments) {
        console.log('🔍 First heritage monument:', heritageData.scheduled_monuments[0]);
        console.log('🔍 Heritage monument keys:', Object.keys(heritageData.scheduled_monuments[0] || {}));
      }
      if (heritageData && heritageData.listed_buildings) {
        console.log('🔍 First listed building:', heritageData.listed_buildings[0]);
        console.log('🔍 Listed building keys:', Object.keys(heritageData.listed_buildings[0] || {}));
      }
      
      heritageResult = heritageData;
      landscapeResult = landscapeData;
      agLandResult = agLandData;
      renewablesResult = renewablesData;
      ecologyResult = ecologyData;
      treesResult = treesData;
      airfieldsResult = airfieldsData;
      trpReportVisible = true;

      // Auto-save analysis session to database (only if not already saved for this project)
      // Use lightweight data without geometries to keep payload small
      if (!loadedFromSaved) {
        try {
          console.log('💾 Saving analysis session to database...');
          const siteName = selectedProject?.project_name || 'One-off Analysis';
          const saveResult = await createAnalysisSession({
            projectId: selectedProject?.id || null,
            siteName,
            polygonGeojson: geometry,
            heritageData: heritageData ? extractLightweightData(heritageData) : null,
            landscapeData: landscapeData ? extractLightweightData(landscapeData) : null,
            renewablesData: renewablesData ? extractLightweightData(renewablesData) : null,
            ecologyData: ecologyData ? extractLightweightData(ecologyData) : null,
            agLandData: agLandData ? extractLightweightData(agLandData) : null,
            treesData: treesData ? extractLightweightData(treesData) : null,
            airfieldsData: airfieldsData ? extractLightweightData(airfieldsData) : null
          });
          analysisSessionId = saveResult.sessionId;
          analysisSaved = true;
          console.log('✅ Analysis session saved with ID:', analysisSessionId);
        } catch (saveErr) {
          console.error('⚠️ Failed to save analysis session (non-blocking):', saveErr);
          // Don't block the UI - analysis still works, just won't have versioning
        }
      } else {
        console.log('ℹ️ Skipping save - already have saved session for this project');
      }
    } catch (/** @type {any} */ err) {
      errorMsg = err?.message || String(err);
    } finally {
      loading = false;
    }
  }

  function openReport() {
    console.log('🔍 Opening report with data:', {
      heritage: !!heritageResult,
      landscape: !!landscapeResult,
      renewables: !!renewablesResult,
      ecology: !!ecologyResult,
      agLand: !!agLandResult,
      heritageData: heritageResult,
      landscapeData: landscapeResult,
      renewablesData: renewablesResult,
      ecologyData: ecologyResult,
      agLandData: agLandResult
    });
    activeTab = 'report';
  }

  function setActiveTab(tab) {
    activeTab = tab;
  }

  function openTRPReport() {
    console.log('🎯 openTRPReport called, selection mode:', selectionModeBinding);

    if (selectionModeBinding === 'project' && selectedProject) {
      // Auto-save to selected project (no modal)
      console.log('🚀 Auto-saving to project:', selectedProject.project_name);
      handleSaveSite({
        detail: {
          siteName: selectedProject.project_name,
          projectId: selectedProject.id
        }
      });
    } else if (selectionModeBinding === 'oneoff') {
      // Show one-off modal to get site name
      console.log('📝 Showing one-off modal for site name');
      showOneOffModal = true;
    } else {
      // Fallback: show the old SaveSiteModal (shouldn't normally happen)
      console.log('⚠️ No project or one-off selected, showing save modal');
      showSaveSiteModal = true;
    }
  }

  async function handleSaveSite(event) {
    const { siteName, projectId } = event.detail;
    console.log('🎯 handleSaveSite called with:', { siteName, projectId });
    console.log('🎯 Current polygon geometry:', currentPolygonGeometry);

    if (!currentPolygonGeometry) {
      console.error('❌ No polygon geometry available for saving');
      return;
    }

    try {
      // Save only essential TRP data - minimal for report generation
      const siteData = {
        siteName,
        polygonGeojson: currentPolygonGeometry,
        projectId: projectId || null, // Use projectId from event (can be null for one-off reports)
        // Save only risk levels and basic rule info, no detailed findings
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

      console.log('🚀 Calling saveSite API with minimal data:', siteData);
      console.log('📦 Total payload size:', JSON.stringify(siteData).length, 'characters');
      const result = await saveSite(siteData);
      console.log('✅ Site saved successfully:', result);

      // Mark analysis as saved
      analysisSaved = true;

      // Close modal and open TRP tab
      showSaveSiteModal = false;
      trpReportVisible = true;
      activeTab = 'trp-report';
      console.log('✅ Modal closed, TRP tab opened');
    } catch (error) {
      console.error('❌ Failed to save site:', error);
      // TODO: Show error to user (could enhance SaveSiteModal to handle errors)
    }
  }

  function handleModalClose() {
    showSaveSiteModal = false;
  }

  function handleOneOffModalClose() {
    showOneOffModal = false;
  }

  async function handleOneOffSave(event) {
    const { siteName } = event.detail;
    console.log('🎯 handleOneOffSave called with siteName:', siteName);

    // Call the main handleSaveSite with no projectId (one-off)
    await handleSaveSite({
      detail: {
        siteName,
        projectId: null
      }
    });

    // Close the one-off modal
    showOneOffModal = false;
  }

  function handleCreateNewProject(event) {
    console.log('🎯 handleCreateNewProject called with polygon:', event.detail.polygon);
    // Close SaveSiteModal and open CreateProjectWithAnalysisModal
    showSaveSiteModal = false;
    showCreateProjectModal = true;
  }

  async function handleProjectCreated(project) {
    console.log('✅ Project created:', project);
    // Close modal
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
    // Update the dropdown selection in ProjectSelector (ensure it matches the option value type)
    selectedProjectIdBinding = project.id;

    // Load the project's polygon on the map if it exists
    if (project.polygon_geojson) {
      try {
        const geometry = typeof project.polygon_geojson === 'string'
          ? JSON.parse(project.polygon_geojson)
          : project.polygon_geojson;
        console.log('📍 Loading newly created project polygon on map...');

        // Load polygon on map and zoom to it
        if (mapPanelComponent) {
          mapPanelComponent.loadPolygonOnMap(geometry);
        }

        // Run analysis with the loaded geometry
        console.log('🚀 Running analysis for newly created project...');
        isManualAnalysis = false;
        await handlePolygonDrawn(geometry);
      } catch (error) {
        console.error('❌ Error loading project polygon:', error);
        errorMsg = 'Failed to load project polygon';
      }
    }
  }

  function handleCreateProjectModalClose() {
    showCreateProjectModal = false;
  }

  // Check if we have any results for the Generate Report button
  $: hasResults = !!(heritageResult || landscapeResult || agLandResult || renewablesResult || ecologyResult || treesResult || airfieldsResult);

  // Enable drawing only when a valid selection is made
  $: drawingEnabled = selectionModeBinding === 'oneoff' || (selectionModeBinding === 'project' && selectedProject !== null);
</script>

<div class="dashboard">
  <div class="findings-section">
    <Navbar />

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        class="tab-button {activeTab === 'analysis' ? 'active' : ''}"
        on:click={() => setActiveTab('analysis')}
      >
        Site Analysis
      </button>
      <button
        class="tab-button {activeTab === 'report' ? 'active' : ''}"
        on:click={() => setActiveTab('report')}
        disabled={!hasResults}
      >
        Initial Report
      </button>
      {#if trpReportVisible || loadedFromSaved}
        <button
          class="tab-button {activeTab === 'trp-report' ? 'active' : ''}"
          on:click={() => setActiveTab('trp-report')}
        >
          Edit Report
        </button>
      {/if}
    </div>

    <!-- Project Selector -->
    <div class="project-selector-wrapper">
      {#if !hasResults}
        <ProjectSelector
          bind:this={projectSelectorComponent}
          label="Select Existing Project"
          showDivider={false}
          disabled={false}
          bind:selectedProjectId={selectedProjectIdBinding}
          bind:selectionMode={selectionModeBinding}
          on:projectSelected={handleProjectSelected}
          on:oneOffSelected={handleOneOffSelected}
          on:createNewProject={handleCreateNewProjectClick}
        />
      {:else}
        <!-- Read-only display when analysis has results -->
        <div class="project-display">
          <div class="project-display-content">
            <span class="project-label">Selected:</span>
            <span class="project-value">
              {#if selectionModeBinding === 'oneoff'}
                One-Off Report
              {:else if selectedProject}
                {selectedProject.project_name}
              {:else}
                No project selected
              {/if}
            </span>
            <span class="project-hint">— Click refresh to change selection</span>
          </div>
          <button class="refresh-btn-inline" on:click={() => window.location.reload()} title="Refresh page to change selection">
            <i class="las la-sync"></i>
          </button>
        </div>
      {/if}
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'analysis'}
        <FindingsPanel
          {heritageResult}
          {landscapeResult}
          {agLandResult}
          {renewablesResult}
          {ecologyResult}
          {treesResult}
          airfieldsResult={airfieldsResult}
          {loading}
          {errorMsg}
        />
      {:else if activeTab === 'report'}
        <ReportGenerator
          heritageData={heritageResult}
          landscapeData={landscapeResult}
          renewablesData={renewablesResult}
          ecologyData={ecologyResult}
          agLandData={agLandResult}
          treesData={treesResult}
          airfieldsData={airfieldsResult}
          onOpenTRPReport={openTRPReport}
          analysisSaved={analysisSaved}
          projectName={selectedProject?.project_name || 'Site'}
          {analysisSessionId}
        />
      {:else if activeTab === 'trp-report'}
        <TRPReportEditor
          heritageData={heritageResult}
          landscapeData={landscapeResult}
          renewablesData={renewablesResult}
          ecologyData={ecologyResult}
          agLandData={agLandResult}
          treesData={treesResult}
          airfieldsData={airfieldsResult}
          {analysisSessionId}
        />
      {/if}
    </div>
  </div>

  <MapPanel
    bind:this={mapPanelComponent}
    onPolygonDrawn={handleManualPolygonDrawn}
    {loading}
    {drawingEnabled}
    heritageData={heritageResult}
    landscapeData={landscapeResult}
    renewablesData={renewablesResult}
    ecologyData={ecologyResult}
    treesData={treesResult}
    airfieldsData={airfieldsResult}
  />
</div>

<SaveSiteModal
  show={showSaveSiteModal}
  selectedProject={selectedProject}
  currentPolygon={currentPolygonGeometry}
  on:save={handleSaveSite}
  on:close={handleModalClose}
  on:createNewProject={handleCreateNewProject}
/>

<OneOffSiteModal
  show={showOneOffModal}
  on:save={handleOneOffSave}
  on:close={handleOneOffModalClose}
/>

<AddProjectModal
  isOpen={showCreateProjectModal}
  onClose={handleCreateProjectModalClose}
  onProjectCreated={handleProjectCreated}
/>

<style>
  .project-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
  }

  .project-display-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .project-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
  }

  .project-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
  }

  .project-hint {
    font-size: 0.8125rem;
    color: #64748b;
    font-style: italic;
  }

  .refresh-btn-inline {
    padding: 0.5rem 0.75rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .refresh-btn-inline:hover {
    background: #dc2626;
  }

  .refresh-btn-inline i {
    font-size: 1.125rem;
  }
</style>
