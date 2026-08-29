<script>
  import { onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import ConflictDetailPopup from './ConflictDetailPopup.svelte';
  import { authFetch } from '$lib/api/client.js';
  import ProjectStagesBoard from '$lib/components/workflow/ProjectStagesBoard.svelte';
  import ProjectOverviewTab from '$lib/components/projects/overview/ProjectOverviewTab.svelte';
  import ProjectDetailsTab from '$lib/components/projects/ProjectDetailsTab.svelte';
  import SimilarSchemesTab from '$lib/components/projects/SimilarSchemesTab.svelte';
  import RelevantPolicyTab from '$lib/components/projects/RelevantPolicyTab.svelte';
  import LpaDecisionAnalysisTab from '$lib/components/projects/LpaDecisionAnalysisTab.svelte';
  import ProjectDocsTab from '$lib/components/projects/ProjectDocsTab.svelte';
  import PlanningHistoryTab from '$lib/components/projects/PlanningHistoryTab.svelte';
  import RelevantDocumentsSection from '$lib/components/projects/RelevantDocumentsSection.svelte';
  import MeetingNotesTab from '$lib/components/projects/MeetingNotesTab.svelte';
  import ConsultationTrackerTab from '$lib/components/projects/ConsultationTrackerTab.svelte';
  import ConditionsTrackerTab from '$lib/components/projects/ConditionsTrackerTab.svelte';
  import ProgressTrackerTab from '$lib/components/projects/ProgressTrackerTab.svelte';
  import ProgrammeTab from '$lib/components/projects/ProgrammeTab.svelte';
  import ProjectCompletenessTab from '$lib/components/projects/ProjectCompletenessTab.svelte';
  import ProjectChatTab from '$lib/components/projects/ProjectChatTab.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
  import { extractPoliciesFromDocument } from '$lib/api/lpaAnalysis.js';
  import { getPolicyDocuments, createPolicyDocument } from '$lib/api/policyDocuments.js';

  export let isOpen = false;
  export let onClose = () => {};
  export let projectId = null;
  export let initialTab = null;

  // Project data
  let projectData = null;
  let loading = true;
  let error = null;

  // Tab state
  let activeTab = 'site_boundary';
  let policyFormOpen = false;

  const trackerLabels = {
    consultation_tracker: 'Consultation Tracker',
    conditions_tracker: 'Conditions Tracker',
    progress_tracker: 'Project Tracker',
    programme: 'Programme',
  };

  // Every tab's display name, for the header — navigation itself now lives
  // solely in the sidebar's Project Workspace section (the in-panel tab bar
  // was fully redundant with it and has been removed).
  const tabLabels = {
    site_boundary: 'Site Boundary',
    details: 'Overview',
    project_details: 'Project Details',
    project_chat: 'Project Chat',
    policy_and_history: 'Policy & Planning History',
    meeting_notes: 'Meeting Notes',
    ...trackerLabels,
    similar_schemes: 'Similar Schemes',
    lpa_decision_analysis: 'LPA Decision Analysis',
    conflict: 'Nearby Renewables Check',
    hlpv: 'Renewables HLPV Analysis',
    project_docs: 'Project Docs',
    stages: 'Key Issues',
    completeness: 'Completeness',
  };

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

  let showMeetingGuide = false;

  // Load project data when modal opens
  $: if (browser && isOpen && projectId && !projectData) {
    loadProject();
  }

  // Jump to a caller-requested tab on open (e.g. sidebar "Consultation Tracker").
  // Only forces activeTab when initialTab is set, and only until it matches —
  // a manual tab click afterwards is left alone.
  $: if (browser && isOpen && initialTab && activeTab !== initialTab) {
    activeTab = initialTab;
  }

  // Load saved conflict check when switching to conflict tab
  $: if (browser && isOpen && activeTab === 'conflict' && projectData && !conflictResults && !loadingSavedCheck) {
    loadSavedConflictCheck();
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
    drawControl = null;
    drawnItems = null;
    siteBoundaryEditMode = false;
    siteBoundaryError = null;
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

  // Same status → color mapping as ProjectsTable's status badges, so the
  // header badge here actually reflects the project's real status.
  function statusClass(status) {
    if (!status) return 'not-set';
    return status.toLowerCase().replace(/\s+/g, '-').replace('post-submission', 'post-sub');
  }

  // Project Details / Site Boundary save inline in place now (no more
  // separate EditProjectModal for this) — merge the saved fields straight
  // into projectData so the page reflects the change immediately.
  function handleProjectUpdated(updated) {
    projectData = { ...projectData, ...updated };
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    return String(dateString).slice(0, 10);
  }

  // Same PUT /api/projects/:id contract EditProjectModal.svelte used —
  // the backend expects the full field set, so this rebuilds it from the
  // current projectData with just the given overrides applied.
  function buildProjectUpdatePayload(overrides = {}) {
    return {
      project_id: projectData.project_id || '',
      project_name: projectData.project_name || '',
      project_type: projectData.project_type || '',
      local_planning_authority: [...(projectData.local_planning_authority || [])],
      project_lead: projectData.project_lead || '',
      project_manager: projectData.project_manager || '',
      project_director: projectData.project_director || '',
      address: projectData.address || '',
      polygon_geojson: projectData.polygon_geojson || null,
      area: projectData.area || '',
      client: projectData.client || '',
      client_spv_name: projectData.client_spv_name || '',
      sectors: [...(projectData.sectors || [])],
      sub_sectors: [...(projectData.sub_sectors || [])],
      development_types: [...(projectData.development_types || [])],
      designations_on_site: projectData.designations_on_site || '',
      relevant_nearby_designations: projectData.relevant_nearby_designations || '',
      development_description: projectData.development_description || '',
      about_applicant: projectData.about_applicant || '',
      status: projectData.status || '',
      case_officer_name: projectData.case_officer_name || '',
      case_officer_email: projectData.case_officer_email || '',
      case_officer_phone_number: projectData.case_officer_phone_number || '',
      lpa_reference: projectData.lpa_reference || '',
      submission_date: formatDateForInput(projectData.submission_date),
      validation_date: formatDateForInput(projectData.validation_date),
      lpa_consultation_end_date: formatDateForInput(projectData.lpa_consultation_end_date),
      committee_date: formatDateForInput(projectData.committee_date),
      target_determination_date: formatDateForInput(projectData.target_determination_date),
      determined_date: formatDateForInput(projectData.determined_date),
      expiry_of_1st_stat_period_date: formatDateForInput(projectData.expiry_of_1st_stat_period_date),
      eot_date: formatDateForInput(projectData.eot_date),
      six_months_appeal_window_date: formatDateForInput(projectData.six_months_appeal_window_date),
      comments: projectData.comments || '',
      ...overrides,
    };
  }

  // Project Chat's "Set {date field} to {date}?" suggestion cards call this
  // to accept — same PUT-the-full-object pattern as saveSiteBoundary below.
  async function handleAcceptDateSuggestion(field, date) {
    try {
      const payload = buildProjectUpdatePayload({ [field]: date });
      const response = await authFetch(`/api/projects/${projectData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        handleProjectUpdated(data.project);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error accepting date suggestion:', err);
      return false;
    }
  }

  // ── Site Boundary inline editing ────────────────────────────────────────
  let siteBoundaryEditMode = false;
  let drawnItems;
  let drawControl;
  let siteBoundarySaving = false;
  let siteBoundaryError = null;
  let draftPolygonGeojson = null;
  let draftArea = '';

  function handleDrawCreated(e) {
    drawnItems.clearLayers();
    drawnItems.addLayer(e.layer);
    draftPolygonGeojson = JSON.stringify(e.layer.toGeoJSON().geometry);
    const area = L.GeometryUtil && e.layer.getLatLngs
      ? L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]) : null;
    if (area) draftArea = `${(area / 10000).toFixed(2)} ha`;
  }

  function handleDrawEdited(e) {
    e.layers.eachLayer(layer => {
      draftPolygonGeojson = JSON.stringify(layer.toGeoJSON().geometry);
    });
  }

  function handleDrawDeleted() {
    draftPolygonGeojson = null;
    draftArea = '';
  }

  async function enableSiteBoundaryEdit() {
    if (!map || !L) return;
    siteBoundaryError = null;
    draftPolygonGeojson = projectData.polygon_geojson || null;
    draftArea = projectData.area || '';

    await import('leaflet-draw');

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (polygonLayer) {
      polygonLayer.eachLayer(layer => drawnItems.addLayer(layer));
      map.removeLayer(polygonLayer);
      polygonLayer = null;
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

    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.EDITED, handleDrawEdited);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);

    siteBoundaryEditMode = true;
  }

  function teardownDrawControl() {
    if (drawControl && map) map.removeControl(drawControl);
    if (drawnItems && map) map.removeLayer(drawnItems);
    if (map && L?.Draw?.Event) {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
      map.off(L.Draw.Event.EDITED, handleDrawEdited);
      map.off(L.Draw.Event.DELETED, handleDrawDeleted);
    }
    drawControl = null;
    drawnItems = null;
  }

  function cancelSiteBoundaryEdit() {
    teardownDrawControl();
    siteBoundaryEditMode = false;
    siteBoundaryError = null;
    if (projectData?.polygon_geojson) {
      displayPolygon(projectData.polygon_geojson);
    }
  }

  async function saveSiteBoundary() {
    siteBoundarySaving = true;
    siteBoundaryError = null;
    try {
      const payload = buildProjectUpdatePayload({ polygon_geojson: draftPolygonGeojson, area: draftArea });
      const response = await authFetch(`/api/projects/${projectData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        handleProjectUpdated(data.project);
        teardownDrawControl();
        siteBoundaryEditMode = false;
        if (projectData.polygon_geojson) displayPolygon(projectData.polygon_geojson);
      } else {
        siteBoundaryError = data.error || 'Failed to update site boundary';
      }
    } catch (err) {
      siteBoundaryError = err.message || 'Network error. Please try again.';
    } finally {
      siteBoundarySaving = false;
    }
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

  function handleClose() {
    projectData = null;
    loading = true;
    error = null;
    activeTab = 'site_boundary';
    policyFormOpen = false;
    conflictResults = null;
    conflictError = null;
    expandedCategories = {};
    savedCheckInfo = null;
    loadingSavedCheck = false;
    showExtractModal = false;
    cleanupMap();
    onClose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Extract from Document — reads a planning document, pulls out policies and
  // development plan documents it references, and stages both for review
  // before anything is saved. Lives here rather than inside RelevantPolicyTab
  // because it populates both the Relevant Documents section and the
  // Relevant Policy tab below it.
  // ─────────────────────────────────────────────────────────────────────────

  let relevantDocsRef;
  let relevantPolicyRef;

  let showExtractModal = false;
  let extractStep = 'input'; // 'input' | 'plans'
  let extractMode = 'file'; // 'file' | 'text'
  let extractFile = null;
  let extractText = '';
  let extracting = false;
  let confirmingPlans = false;
  let extractError = null;
  let extractWarning = null;
  let stagedPlans = [];
  let stagedPolicies = [];

  function openExtractModal() {
    extractStep = 'input';
    extractMode = 'file';
    extractFile = null;
    extractText = '';
    extractError = null;
    extractWarning = null;
    stagedPlans = [];
    stagedPolicies = [];
    showExtractModal = true;
  }

  function closeExtractModal() {
    showExtractModal = false;
    extractStep = 'input';
    extractFile = null;
    extractText = '';
    extractError = null;
    stagedPlans = [];
    stagedPolicies = [];
  }

  function onExtractFileChange(e) {
    extractFile = e.target.files?.[0] ?? null;
  }

  // Builds rows for RelevantPolicyTab's bulk-review table from extracted
  // policies, matching each one to a plan (by name, case-insensitive) from
  // the given plan list — used both for plans that already existed and ones
  // just created via confirmPlansAndContinue below.
  function policiesToBulkRows(policies, plans) {
    return policies.map(p => {
      const matched = p.plan_name
        ? plans.find(d => d.plan_name?.trim().toLowerCase() === p.plan_name.trim().toLowerCase())
        : null;
      return {
        policy_reference: p.policy_reference || '',
        policy_name: p.policy_name || '',
        policy_type: p.policy_type || 'national',
        policy_text: p.policy_text || '',
        relevant_supporting_text: '',
        notes: '',
        is_key_policy: false,
        plan_id: matched ? matched.id : ''
      };
    });
  }

  async function runExtract() {
    if (extractMode === 'file' && !extractFile) { extractError = 'Choose a file to upload'; return; }
    if (extractMode === 'text' && !extractText.trim()) { extractError = 'Paste some text first'; return; }
    extracting = true;
    extractError = null;
    try {
      const { policies: found, plans: foundPlans, warning } = await extractPoliciesFromDocument(
        projectId,
        extractMode === 'file' ? { file: extractFile } : { text: extractText }
      );
      extractWarning = warning || null;
      if (!found.length && !foundPlans.length) {
        extractError = 'No policies or development plan documents were found in that document.';
        return;
      }
      stagedPolicies = found;
      if (foundPlans.length > 0) {
        stagedPlans = foundPlans.map(p => ({ ...p, include: true }));
        extractStep = 'plans';
      } else {
        const existingPlans = await getPolicyDocuments(projectId);
        showExtractModal = false;
        relevantPolicyRef?.reviewExtractedPolicies(policiesToBulkRows(found, existingPlans), extractWarning);
      }
    } catch (err) {
      extractError = err.message;
    } finally {
      extracting = false;
    }
  }

  // Creates whichever staged plans the user kept ticked, refreshes both child
  // panels so they pick the new plans up, then hands the reviewed policies
  // off to RelevantPolicyTab's existing bulk-review table.
  async function confirmPlansAndContinue() {
    confirmingPlans = true;
    extractError = null;
    try {
      const toCreate = stagedPlans.filter(p => p.include && p.plan_name.trim());
      await Promise.all(toCreate.map(p => createPolicyDocument(projectId, {
        section: p.section,
        plan_name: p.plan_name.trim(),
        plan_type: (p.section === 'adopted' || p.section === 'emerging') ? p.plan_type : null,
        year_adopted: p.section === 'adopted' ? (p.year_adopted || null) : null,
        month_adopted: p.section === 'adopted' ? (p.month_adopted || null) : null
      })));

      await Promise.all([relevantDocsRef?.refresh(), relevantPolicyRef?.refreshPlanDocs()]);
      const allPlans = await getPolicyDocuments(projectId);

      showExtractModal = false;
      extractStep = 'input';
      relevantPolicyRef?.reviewExtractedPolicies(policiesToBulkRows(stagedPolicies, allPlans), extractWarning);
    } catch (err) {
      extractError = err.message;
    } finally {
      confirmingPlans = false;
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal-container">
      <div class="modal-header">
        <div class="header-title">
          <div class="modal-breadcrumb">{projectData?.project_name || 'Project Workspace'}</div>
          <h2>
            {tabLabels[activeTab] || 'Project Workspace'}
            {#if projectData?.status}<span class="status-badge status-{statusClass(projectData.status)}">{projectData.status}</span>{/if}
          </h2>
        </div>
        <div class="header-actions">
          <button class="close-btn" on:click={handleClose}>&times;</button>
        </div>
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
              <div class="site-boundary-head">
                {#if !siteBoundaryEditMode}
                  <button class="btn btn-primary btn-sm" on:click={enableSiteBoundaryEdit}>
                    <i class="las la-edit"></i> Edit
                  </button>
                {:else}
                  <button class="btn btn-secondary btn-sm" on:click={cancelSiteBoundaryEdit} disabled={siteBoundarySaving}>Cancel</button>
                  <button class="btn btn-primary btn-sm" on:click={saveSiteBoundary} disabled={siteBoundarySaving}>
                    {#if siteBoundarySaving}<i class="las la-circle-notch la-spin"></i>{:else}<i class="las la-save"></i>{/if} Save
                  </button>
                {/if}
              </div>
              {#if siteBoundaryError}<div class="pd-error"><i class="las la-exclamation-triangle"></i> {siteBoundaryError}</div>{/if}
              {#if !projectData.polygon_geojson && !siteBoundaryEditMode}
                <div class="empty-state">
                  <i class="las la-map-marked-alt"></i>
                  <p>No site boundary defined for this project.</p>
                </div>
              {/if}
              <div class="map-container" bind:this={mapContainer}></div>
            </div>
          {:else if activeTab === 'details'}
            <ProjectOverviewTab project={projectData} onAcceptDateSuggestion={handleAcceptDateSuggestion} />
          {:else if activeTab === 'project_details'}
            <ProjectDetailsTab project={projectData} onOpenMeetingGuide={() => showMeetingGuide = true} onUpdated={handleProjectUpdated} />
          {:else if activeTab === 'hlpv'}
            <!-- HLPV Analysis Tab -->
            <div class="hlpv-analysis-section">
              {#if !projectData.hlpv_last_analyzed}
                <div class="error-state">
                  <i class="las la-info-circle"></i>
                  <p>No Renewables HLPV analysis has been run for this project yet.</p>
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
                  <p class="hint">A site boundary is required to run a nearby renewables check.</p>
                </div>
              {:else}
                <div class="conflict-check-header">
                  <div>
                    <h3>Nearby Renewables Check</h3>
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
                        {savedCheckInfo ? 'Re-run Check' : 'Run Check'}
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
                    <p>Click "Run Check" to search for nearby projects and developments.</p>
                  </div>
                {/if}
              {/if}
            </div>
          {:else if activeTab === 'stages'}
            <ProjectStagesBoard project={projectData} />
          {:else if activeTab === 'policy_and_history'}
            <div class="policy-history-split">
              <div class="split-card">
                <div class="split-card-label split-card-label--with-action">
                  <span>Policy</span>
                  <button class="btn-extract-policy" on:click={openExtractModal}>
                    <i class="las la-file-import"></i> Extract from Document
                  </button>
                </div>
                <div class="split-card-body split-card-body--scroll">
                  {#if !policyFormOpen}
                    <div class="left-panel-section-divider">Relevant Documents</div>
                    <RelevantDocumentsSection project={projectData} bind:this={relevantDocsRef} />
                    <div class="left-panel-section-divider">Relevant Planning Policy</div>
                  {/if}
                  <RelevantPolicyTab project={projectData} bind:this={relevantPolicyRef} on:formopen={() => policyFormOpen = true} on:formclose={() => policyFormOpen = false} />
                </div>
              </div>
              <div class="split-card">
                <div class="split-card-label">Planning History</div>
                <div class="split-card-body">
                  <PlanningHistoryTab project={projectData} />
                </div>
              </div>
            </div>
          {:else if activeTab === 'similar_schemes'}
            <SimilarSchemesTab project={projectData} />
          {:else if activeTab === 'lpa_decision_analysis'}
            <LpaDecisionAnalysisTab project={projectData} />
          {:else if activeTab === 'project_docs'}
            <ProjectDocsTab project={projectData} />
          {:else if activeTab === 'project_chat'}
            <ProjectChatTab project={projectData} onAcceptDateSuggestion={handleAcceptDateSuggestion} />
          {:else if activeTab === 'meeting_notes'}
            <MeetingNotesTab project={projectData} />
          {:else if activeTab === 'consultation_tracker'}
            <div class="ct-scroll-wrap">
              <ConsultationTrackerTab project={projectData} />
            </div>
          {:else if activeTab === 'conditions_tracker'}
            <div class="ct-scroll-wrap">
              <ConditionsTrackerTab project={projectData} />
            </div>
          {:else if activeTab === 'progress_tracker'}
            <div class="ct-scroll-wrap">
              <ProgressTrackerTab project={projectData} />
            </div>
          {:else if activeTab === 'programme'}
            <div class="ct-scroll-wrap">
              <ProgrammeTab project={projectData} />
            </div>
          {:else if activeTab === 'completeness'}
            <ProjectCompletenessTab project={projectData} />
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

<MeetingGuideModal
  show={showMeetingGuide}
  project={projectData}
  issueTracks={[]}
  onClose={() => showMeetingGuide = false}
/>

<!-- Extract from Document Modal -->
{#if showExtractModal}
  <div class="extract-backdrop" on:click|self={closeExtractModal} role="presentation">
    <div class="extract-modal">
      <div class="extract-modal-header">
        <h3>{extractStep === 'input' ? 'Extract Policies from Document' : 'Development Plans Found'}</h3>
        <button class="extract-close-btn" on:click={closeExtractModal}>&times;</button>
      </div>

      <div class="extract-modal-body">
        {#if extractStep === 'input'}
          <p class="extract-hint">
            Upload a planning document (e.g. a stage one review or planning statement) or paste its text below.
            The AI will find every policy it cites and copy the wording verbatim, plus any development plans, SPDs, or other
            documents it references — you'll review and edit everything before anything is saved.
          </p>

          <div class="extract-mode-toggle">
            <button type="button" class:active={extractMode === 'file'} on:click={() => extractMode = 'file'}>Upload file</button>
            <button type="button" class:active={extractMode === 'text'} on:click={() => extractMode = 'text'}>Paste text</button>
          </div>

          {#if extractMode === 'file'}
            <input type="file" accept=".pdf,.docx,.txt,.md" on:change={onExtractFileChange} />
            {#if extractFile}<p class="extract-filename"><i class="las la-file-alt"></i> {extractFile.name}</p>{/if}
          {:else}
            <textarea bind:value={extractText} rows="10" placeholder="Paste the document text here…"></textarea>
          {/if}
        {:else}
          <p class="extract-hint">
            Found {stagedPlans.length} development plan document{stagedPlans.length === 1 ? '' : 's'} referenced in this document.
            Untick any you don't want added to the project's Development Plan list, or edit their details, then continue to review the policies.
          </p>

          <div class="staged-plans-list">
            {#each stagedPlans as plan, i (i)}
              <div class="staged-plan-row" class:excluded={!plan.include}>
                <input type="checkbox" bind:checked={plan.include} />
                <input type="text" class="staged-plan-name" bind:value={plan.plan_name} disabled={!plan.include} />
                <select bind:value={plan.section} disabled={!plan.include}>
                  <option value="adopted">Adopted</option>
                  <option value="emerging">Emerging</option>
                  <option value="supplementary">Supplementary</option>
                  <option value="other">Other</option>
                </select>
                {#if plan.section === 'adopted' || plan.section === 'emerging'}
                  <select bind:value={plan.plan_type} disabled={!plan.include}>
                    <option value="local">Local Plan</option>
                    <option value="neighbourhood">Neighbourhood Plan</option>
                  </select>
                {/if}
                {#if plan.section === 'adopted'}
                  <input type="number" class="staged-plan-year" bind:value={plan.year_adopted} placeholder="Year" disabled={!plan.include} />
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if extractWarning}
          <div class="extract-warning">{extractWarning}</div>
        {/if}
        {#if extractError}
          <div class="extract-error">{extractError}</div>
        {/if}
      </div>

      <div class="extract-modal-footer">
        <span class="extract-count-hint">Nothing is saved until you review and confirm the results</span>
        <div class="extract-footer-actions">
          {#if extractStep === 'input'}
            <button class="btn-cancel" on:click={closeExtractModal} disabled={extracting}>Cancel</button>
            <button class="btn-save" on:click={runExtract} disabled={extracting}>
              {extracting ? 'Extracting…' : 'Extract'}
            </button>
          {:else}
            <button class="btn-cancel" on:click={closeExtractModal} disabled={confirmingPlans}>Cancel</button>
            <button class="btn-save" on:click={confirmPlansAndContinue} disabled={confirmingPlans}>
              {confirmingPlans ? 'Adding…' : 'Continue to Policies'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* No longer a true backdrop — this fills the main content area inline
     instead of overlaying the page, so it just owns a fixed viewport
     height (same self-contained-tool pattern as marketing/+page.svelte). */
  .modal-backdrop {
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--color-white);
  }

  .modal-container {
    background: white;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 2rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .header-title {
    min-width: 0;
  }

  .modal-breadcrumb {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-400);
    margin-bottom: 0.125rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  /* Shape/weight come from the shared tables.css .status-badge (same
     class name); these are the same status-color variants ProjectsTable
     uses, so the header badge matches the table's colors for the same status. */
  .status-not-set {
    background: var(--color-slate-100);
    color: var(--color-slate-400);
  }

  .status-prospective {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .status-instructed {
    background: var(--color-badge-info-bg);
    color: var(--color-badge-info-fg);
  }

  .status-submitted {
    background: var(--color-badge-indigo-bg);
    color: var(--color-badge-indigo-fg);
  }

  .status-post-sub {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .status-closed {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    color: var(--color-slate-500);
    flex: 1;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid var(--color-slate-100);
    border-top: 4px solid var(--color-purple-600);
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
    color: var(--color-red-500);
    margin-bottom: 1rem;
  }

  .error-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .error-state button:hover {
    background: var(--color-purple-700);
  }

  .site-boundary-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .site-boundary-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.5rem 0;
    flex-shrink: 0;
  }

  .pd-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    margin: 0.75rem 1.5rem 0;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: var(--radius-md);
    color: var(--color-red-800);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .site-boundary-section .map-container {
    flex: 1;
    min-height: 0;
  }

  .ct-scroll-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .map-container {
    flex: 1;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--color-slate-300);
    min-height: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--color-slate-200);
    gap: 1rem;
  }

  .btn-close {
    padding: 0.625rem 1.5rem;
    background: var(--color-slate-500);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-close:hover {
    background: var(--color-slate-600);
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
    color: var(--color-slate-800);
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
    border: 1px solid var(--color-slate-200);
    border-radius: 0.5rem;
    padding: 1.25rem;
    text-align: center;
  }

  .risk-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-500);
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
    background: var(--color-emerald-100);
    color: var(--color-emerald-800);
  }

  .risk-value.risk-low-risk {
    background: var(--color-primary-100);
    color: var(--color-primary-800);
  }

  .risk-value.risk-medium-low-risk {
    background: var(--color-amber-100);
    color: var(--color-amber-800);
  }

  .risk-value.risk-medium-risk {
    background: var(--color-red-200);
    color: var(--color-amber-800);
  }

  .risk-value.risk-medium-high-risk {
    background: var(--color-red-200);
    color: var(--color-red-800);
  }

  .risk-value.risk-high-risk {
    background: var(--color-red-200);
    color: var(--color-red-800);
  }

  .risk-value.risk-extremely-high-risk,
  .risk-value.risk-showstopper {
    background: var(--color-red-600);
    color: white;
  }

  .risk-count {
    font-size: 0.75rem;
    color: var(--color-slate-500);
  }

  .hlpv-meta {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 2rem;
  }

  .hlpv-meta p {
    margin: 0.5rem 0;
    color: var(--color-slate-600);
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
    color: var(--color-slate-800);
    font-size: 1.5rem;
  }

  .conflict-description {
    color: var(--color-slate-500);
    font-size: 0.875rem;
    margin: 0;
  }

  .last-checked {
    color: var(--color-slate-500);
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
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    border: 1px solid var(--color-slate-300);
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
    background: var(--color-slate-200);
    border-color: var(--color-slate-400);
  }

  .btn-run-check {
    background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
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
    background: linear-gradient(135deg, var(--color-slate-50) 0%, var(--color-slate-200) 100%);
    border: 1px solid var(--color-slate-300);
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
    color: var(--color-primary-500);
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .summary-label {
    font-size: 0.875rem;
    color: var(--color-slate-500);
    font-weight: 500;
  }

  .summary-meta {
    flex: 1;
  }

  .summary-meta p {
    margin: 0.5rem 0;
    color: var(--color-slate-600);
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
    background: var(--color-slate-100);
    border: 2px dashed var(--color-slate-400);
    border-radius: 0.75rem;
  }

  .no-conflicts i {
    font-size: 3rem;
    color: var(--color-green-500);
    margin-bottom: 1rem;
  }

  .no-conflicts p {
    color: var(--color-green-800);
    font-size: 1rem;
    margin: 0;
  }

  .distance-categories {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .category-section {
    border: 1px solid var(--color-slate-200);
    border-radius: 0.5rem;
    overflow: hidden;
    background: white;
  }

  .category-header {
    width: 100%;
    background: var(--color-slate-50);
    border: none;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .category-header:hover {
    background: var(--color-slate-100);
  }

  .category-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .category-info i {
    font-size: 1rem;
    color: var(--color-slate-500);
    transition: transform 0.2s;
  }

  .category-icon {
    font-size: 1.25rem;
  }

  .category-title {
    font-weight: 600;
    color: var(--color-slate-800);
    font-size: 0.9375rem;
  }

  .category-count {
    background: var(--color-primary-500);
    color: white;
    padding: 0.25rem 0.625rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .category-content {
    padding: 0.5rem;
    background: white;
    border-top: 1px solid var(--color-slate-200);
  }

  .conflict-item-wrapper {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .conflict-item {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
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
    background: var(--color-slate-100);
    border-color: var(--color-slate-300);
    transform: translateX(2px);
  }

  .conflict-delete-btn {
    background: transparent;
    color: var(--color-red-600);
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
    background: var(--color-red-100);
    color: var(--color-red-800);
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
    border-bottom: 1px solid var(--color-slate-200);
  }

  .conflict-layer {
    font-weight: 600;
    color: var(--color-slate-800);
    font-size: 0.875rem;
  }

  .conflict-distance {
    background: var(--color-primary-500);
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
    color: var(--color-slate-600);
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .conflict-details strong {
    color: var(--color-slate-800);
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--color-slate-400);
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
    color: var(--color-slate-400);
    margin-top: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Policy & Planning History split layout */
  .policy-history-split {
    display: flex;
    gap: 1rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .split-card {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-slate-200);
    border-radius: 10px;
    overflow: hidden;
  }

  .split-card-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-purple-600);
    background: var(--color-purple-50);
    border-bottom: 1px solid var(--color-violet-200);
    flex-shrink: 0;
  }

  .split-card-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .split-card-body--scroll {
    overflow-y: auto;
    overflow-x: hidden;
  }

  .split-card-label--with-action {
    justify-content: space-between;
  }

  .btn-extract-policy {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    background: white;
    color: var(--color-purple-600);
    border: 1px solid var(--color-purple-600);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-extract-policy:hover { background: var(--color-purple-50); }

  /* Extract from Document modal */
  .extract-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .extract-modal {
    background: white;
    border-radius: 12px;
    width: 95%;
    max-width: 700px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px var(--overlay-bg);
    overflow: hidden;
  }

  .extract-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .extract-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .extract-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  .extract-close-btn:hover { color: var(--color-slate-800); }

  .extract-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .extract-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .extract-mode-toggle { display: flex; gap: 0.5rem; }
  .extract-mode-toggle button {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    color: var(--color-slate-500);
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .extract-mode-toggle button.active { background: var(--color-purple-600); color: white; border-color: var(--color-purple-600); }

  .extract-filename {
    display: flex; align-items: center; gap: 0.4rem;
    margin: 0; font-size: 0.8rem; color: var(--color-slate-600);
  }

  .extract-warning {
    font-size: 0.8rem;
    color: var(--color-amber-800);
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .extract-error {
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .staged-plans-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .staged-plan-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-200);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
  }
  .staged-plan-row.excluded { opacity: 0.55; }
  .staged-plan-row input[type="checkbox"] {
    width: 16px; height: 16px; accent-color: var(--color-purple-600); cursor: pointer; flex-shrink: 0;
  }
  .staged-plan-name { flex: 1; min-width: 0; }
  .staged-plan-year { width: 5.5rem; flex-shrink: 0; }
  .staged-plan-row select { flex-shrink: 0; }

  .extract-modal input[type="text"],
  .extract-modal input[type="number"],
  .extract-modal input[type="file"],
  .extract-modal select,
  .extract-modal textarea {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    resize: vertical;
  }
  .extract-modal input[type="text"]:focus,
  .extract-modal select:focus,
  .extract-modal textarea:focus {
    outline: none;
    border-color: var(--color-purple-600);
    box-shadow: 0 0 0 3px var(--color-violet-100);
  }

  .extract-modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .extract-count-hint { font-size: 0.8rem; color: var(--color-slate-500); }
  .extract-footer-actions { display: flex; gap: 0.5rem; }

  .extract-modal-footer .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .extract-modal-footer .btn-cancel:hover { background: var(--color-slate-50); }
  .extract-modal-footer .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .extract-modal-footer .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .extract-modal-footer .btn-save:disabled,
  .extract-modal-footer .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Override child components' own scroll when they live in the shared scrolling left panel */
  .split-card-body--scroll :global(.policy-tab) {
    height: auto;
    overflow-y: visible;
    padding: 0;
  }

  .left-panel-section-divider {
    padding: 0.6rem 1.25rem 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-purple-700);
    background: var(--color-violet-50);
    border-top: 1px solid var(--color-violet-200);
    border-bottom: 1px solid var(--color-violet-200);
    flex-shrink: 0;
  }

  .left-panel-section-divider:first-child {
    border-top: none;
  }
</style>
