<script lang="ts">
  import { buildCombinedReport, resolveRiskSummary } from '$lib/services/reportGenerator.js';
  import { saveSessionEdit } from '$lib/services/api.js';
  import { generateWordReport } from '$lib/services/wordExport.js';
  import { generatePDFReport } from '$lib/services/pdfExport.js';
  import { generateFloodFindings } from '$lib/services/flood/floodFindings.js';
  import { generateAviationFindings, calculateAviationRisk } from '$lib/services/aviation/aviationFindings.js';
  import ImageUploadArea from './ImageUploadArea.svelte';
  import RiskChangeReasonModal from './report/RiskChangeReasonModal.svelte';
  import GuidanceButton from './report/GuidanceButton.svelte';
  import RiskLevelSection from './report/RiskLevelSection.svelte';
  import { DISCIPLINE_GUIDANCE, SUMMARY_GENERAL_GUIDANCE } from '$lib/services/guidance/guidanceMapping.js';

  /** @type {any} */
  export let heritageData = null;

  /** @type {any} */
  export let landscapeData = null;

  /** @type {any} */
  export let renewablesData = null;

  /** @type {any} */
  export let ecologyData = null;

  /** @type {any} */
  export let agLandData = null;

  /** @type {any} */
  export let treesData = null;

  /** @type {any} */
  export let airfieldsData = null;

  /** @type {string|null} */
  export let analysisSessionId = null;

  // Flood form state
  /** @type {string} */
  let floodRiskLevel = '';
  /** @type {string} */
  let siteOver1ha = '';
  /** @type {{ zone1: boolean, zone2: boolean, zone3: boolean }} */
  let floodZones = { zone1: false, zone2: false, zone3: false };
  /** @type {{ zone1: string, zone2: string, zone3: string }} */
  let floodZoneCoverage = { zone1: '', zone2: '', zone3: '' };
  /** @type {string} */
  let surfaceWaterFlooding = '';

  // Aviation form state
  /** @type {{ within500m: string, within500mTo1km: string, within1to5km: string }} */
  let aerodromeCounts = { within500m: '', within500mTo1km: '', within1to5km: '' };

  // Highways form state
  /** @type {string} */
  let highwaysRiskLevel = '';

  // Landscape override form state
  /** @type {string} */
  let landscapeRiskLevel = '';

  // Amenity form state
  /** @type {string} */
  let amenityRiskLevel = '';

  /** @param {Event} e */
  function enforceNumeric(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    input.value = input.value.replace(/[^0-9]/g, '');
  }

  // Generate flood findings text reactively
  $: floodFindings = generateFloodFindings(floodZones, floodZoneCoverage, siteOver1ha, surfaceWaterFlooding);

  // Generate aviation findings and risk reactively
  $: aviationFindings = generateAviationFindings(aerodromeCounts);
  $: aviationRiskLevel = calculateAviationRisk(aerodromeCounts);

  // Track changes for audit trail
  /** @type {Array<{discipline: string, fieldPath: string, oldValue: any, newValue: any, reason?: string}>} */
  let pendingChanges = [];

  // Store original values for comparison
  /** @type {Record<string, any>} */
  let originalRiskLevels = {};

  // Track original recommendation counts per discipline (by index)
  /** @type {Record<number, number>} */
  let originalRecommendationCounts = {};

  // Risk level options for dropdowns - using consistent colors with original report
  const riskLevels = [
    { value: 'showstopper', label: 'SHOWSTOPPER', bgColor: '#fef2f2', color: '#dc2626', description: 'Development is prohibited' },
    { value: 'extremely_high_risk', label: 'EXTREMELY HIGH RISK', bgColor: '#fee2e2', color: '#b91c1c', description: 'Development is extremely unlikely' },
    { value: 'high_risk', label: 'HIGH RISK', bgColor: '#fff7ed', color: '#ea580c', description: 'Development is very challenging' },
    { value: 'medium_high_risk', label: 'MEDIUM-HIGH RISK', bgColor: '#fffbeb', color: '#d97706', description: 'Development has major challenges' },
    { value: 'medium_risk', label: 'MEDIUM RISK', bgColor: '#fff7ed', color: '#f59e0b', description: 'Development has moderate challenges' },
    { value: 'medium_low_risk', label: 'MEDIUM-LOW RISK', bgColor: '#ecfdf5', color: '#10b981', description: 'Development has minor challenges' },
    { value: 'low_risk', label: 'LOW RISK', bgColor: '#ecfdf5', color: '#059669', description: 'Development has minimal challenges' },
    { value: 'no_risk', label: 'NO RISK', bgColor: '#ecfdf5', color: '#059669', description: 'No development restrictions' }
  ];

  // Editable state for the report
  /** @type {any} */
  let editableReport = null;

  /** @type {boolean} */
  let hasUnsavedChanges = false;

  /** @type {boolean} */
  let saving = false;

  /** @type {string} */
  let saveStatus = '';

  // Risk change modal state
  /** @type {boolean} */
  let showReasonModal = false;

  /** @type {{disciplineIndex: number, disciplineName: string, oldValue: string, newValue: string} | null} */
  let pendingRiskChange = null;

  /** @type {boolean} */
  let exportingWord = false;

  /** @type {boolean} */
  let exportingPDF = false;

  // Generate initial report from data
  $: report = (() => {
    try {
      if (heritageData || landscapeData || renewablesData || ecologyData || agLandData || treesData || airfieldsData) {
        console.log('🔄 Building initial TRP report with:', { heritageData: !!heritageData, landscapeData: !!landscapeData, renewablesData: !!renewablesData, ecologyData: !!ecologyData, agLandData: !!agLandData, treesData: !!treesData, airfieldsData: !!airfieldsData });
        const result = buildCombinedReport(heritageData, landscapeData, renewablesData, ecologyData, agLandData, treesData, airfieldsData);
        console.log('✅ TRP report built successfully:', result);
        return result;
      }
      return null;
    } catch (error) {
      console.error('❌ Error building TRP report:', error);
      return null;
    }
  })();

  // Initialize editable report when original report changes
  $: if (report && !editableReport) {
    editableReport = JSON.parse(JSON.stringify(report)); // Deep copy
    pendingChanges = []; // Reset pending changes
    originalRiskLevels = {}; // Reset original values
    originalRecommendationCounts = {}; // Reset original recommendation counts

    // Ensure every discipline has riskSummary.level set (resolveRiskSummary omits it)
    if (editableReport.structuredReport?.disciplines) {
      editableReport.structuredReport.disciplines.forEach((discipline, index) => {
        const riskKey = discipline.riskSummary?.level || discipline.overallRisk;
        if (riskKey) {
          const correctRiskData = getRiskLevelData(riskKey);
          discipline.riskSummary = {
            level: riskKey,
            label: correctRiskData.label,
            description: correctRiskData.description,
            bgColor: correctRiskData.bgColor,
            color: correctRiskData.color
          };
          // Store original risk level for change tracking
          originalRiskLevels[discipline.name] = riskKey;
          // Store original recommendation count for this discipline
          const origRecs = getAggregatedRecommendations(discipline);
          originalRecommendationCounts[index] = origRecs.length;
          console.log(`🔧 Fixed risk data for ${discipline.name}:`, discipline.riskSummary);
        }
      });

      // Also fix summary data
      if (editableReport.structuredReport.summary?.riskByDiscipline) {
        editableReport.structuredReport.summary.riskByDiscipline.forEach((summaryDiscipline) => {
          const riskKey = summaryDiscipline.riskSummary?.level || summaryDiscipline.risk;
          if (riskKey) {
            const correctRiskData = getRiskLevelData(riskKey);
            summaryDiscipline.riskSummary = {
              level: riskKey,
              label: correctRiskData.label,
              description: correctRiskData.description,
              bgColor: correctRiskData.bgColor,
              color: correctRiskData.color
            };
          }
        });
      }
    }

    console.log('🔄 Initialized editable TRP report:', editableReport);
    console.log('📊 Original risk levels stored:', originalRiskLevels);
  }

  // Use the editable structured data
  $: structuredReport = editableReport?.structuredReport;
  $: baseSummaryData = structuredReport?.summary;
  $: disciplines = structuredReport?.disciplines || [];

  /** Placeholder entry for disciplines with no risk selected yet */
  const NOT_ASSESSED = { label: '-', description: '', bgColor: '#f3f4f6', color: '#6b7280' };

  // Build the full summary with all disciplines always listed (backend + frontend-only)
  $: summaryData = (() => {
    if (!baseSummaryData) return baseSummaryData;

    // Start with backend disciplines
    const backendDisciplines = (baseSummaryData.riskByDiscipline || []).map((d: any) => {
      // Check if we have a valid riskSummary, otherwise use NOT_ASSESSED
      if (!d.riskSummary || !d.riskSummary.label) {
        return { ...d, riskSummary: NOT_ASSESSED };
      }
      return d;
    });

    // Frontend-only disciplines — always present, show dash if not selected
    const frontendDisciplines = [
      { name: 'Flood', risk: floodRiskLevel },
      { name: 'Aviation', risk: aviationRiskLevel },
      { name: 'Highways', risk: highwaysRiskLevel },
      { name: 'Amenity', risk: amenityRiskLevel },
    ].map(d => ({
      name: d.name,
      risk: d.risk || null,
      riskSummary: d.risk ? resolveRiskSummary(d.risk) : NOT_ASSESSED
    }));

    return {
      ...baseSummaryData,
      riskByDiscipline: [...backendDisciplines, ...frontendDisciplines]
    };
  })();

  function getRiskLevelData(riskValue) {
    return riskLevels.find(level => level.value === riskValue) || riskLevels[riskLevels.length - 1];
  }

  function handleRiskLevelChange(disciplineIndex, newRiskValue) {
    const discipline = editableReport.structuredReport.disciplines[disciplineIndex];
    const disciplineName = discipline.name;
    const oldRiskLevel = discipline.riskSummary?.level || discipline.overallRisk;

    // If no actual change, do nothing
    if (oldRiskLevel === newRiskValue) {
      return;
    }

    // Store the pending change and show the reason modal
    pendingRiskChange = {
      disciplineIndex,
      disciplineName,
      oldValue: oldRiskLevel,
      newValue: newRiskValue
    };
    showReasonModal = true;

    // Reset the dropdown to the old value until confirmed
    // (The modal will apply the change if confirmed)
    discipline.riskSummary.level = oldRiskLevel;
    editableReport = editableReport;
  }

  function handleReasonConfirm(event) {
    const { discipline, fieldPath, oldValue, newValue, reason } = event.detail;

    if (!pendingRiskChange) return;

    const { disciplineIndex, disciplineName } = pendingRiskChange;

    // Add change record with reason
    pendingChanges = pendingChanges.filter(
      c => !(c.discipline === disciplineName.toLowerCase().replace(/\s+/g, '_') && c.fieldPath === 'overallRisk')
    );
    pendingChanges.push({
      discipline: disciplineName.toLowerCase().replace(/\s+/g, '_'),
      fieldPath: 'overallRisk',
      oldValue,
      newValue,
      reason
    });

    console.log('📝 Change tracked with reason:', { discipline: disciplineName, oldValue, newValue, reason });

    // Now apply the actual change
    applyRiskLevelChange(disciplineIndex, newValue);

    // Close modal and reset
    showReasonModal = false;
    pendingRiskChange = null;
  }

  function handleReasonCancel() {
    // Just close the modal without applying the change
    showReasonModal = false;
    pendingRiskChange = null;
  }

  function applyRiskLevelChange(disciplineIndex, newRiskValue) {
    const discipline = editableReport.structuredReport.disciplines[disciplineIndex];
    const oldRiskSummary = discipline.riskSummary;

    const newRiskData = getRiskLevelData(newRiskValue);
    console.log('🔍 NEW risk data from lookup:', {
      level: newRiskValue,
      label: newRiskData.label,
      description: newRiskData.description,
      bgColor: newRiskData.bgColor,
      color: newRiskData.color
    });

    // Update the discipline risk
    editableReport.structuredReport.disciplines[disciplineIndex].riskSummary = {
      level: newRiskValue,
      label: newRiskData.label,
      description: newRiskData.description,
      bgColor: newRiskData.bgColor,
      color: newRiskData.color
    };

    // Update summary risk by discipline
    const summaryDiscipline = editableReport.structuredReport.summary.riskByDiscipline.find(
      d => d.name === editableReport.structuredReport.disciplines[disciplineIndex].name
    );
    if (summaryDiscipline) {
      summaryDiscipline.riskSummary = {
        level: newRiskValue,
        label: newRiskData.label,
        description: newRiskData.description,
        bgColor: newRiskData.bgColor,
        color: newRiskData.color
      };
    }

    // Force reactive update by reassigning
    editableReport = editableReport;

    // Reset any lingering hover effects on the badge element
    setTimeout(() => {
      const badgeElement = document.querySelector(`[data-discipline-index="${disciplineIndex}"] .risk-badge-inline-dropdown`);
      if (badgeElement) {
        badgeElement.style.border = '2px solid transparent';
        badgeElement.style.transform = 'none';
        badgeElement.style.boxShadow = 'none';
      }
    }, 50);

    hasUnsavedChanges = true;
    console.log('🔄 Risk level changed for', editableReport.structuredReport.disciplines[disciplineIndex].name, 'to', newRiskValue);

    console.log('🔍 AFTER change - Updated risk summary:', {
      level: editableReport.structuredReport.disciplines[disciplineIndex].riskSummary?.level,
      label: editableReport.structuredReport.disciplines[disciplineIndex].riskSummary?.label,
      description: editableReport.structuredReport.disciplines[disciplineIndex].riskSummary?.description,
      bgColor: editableReport.structuredReport.disciplines[disciplineIndex].riskSummary?.bgColor,
      color: editableReport.structuredReport.disciplines[disciplineIndex].riskSummary?.color
    });

  }

  function handleRecommendationChange(disciplineIndex, recommendationIndex, newValue) {
    if (!editableReport.structuredReport.disciplines[disciplineIndex].recommendations) {
      editableReport.structuredReport.disciplines[disciplineIndex].recommendations = [];
    }

    editableReport.structuredReport.disciplines[disciplineIndex].recommendations[recommendationIndex] = newValue;
    hasUnsavedChanges = true;
    console.log('🔄 Recommendation changed for', editableReport.structuredReport.disciplines[disciplineIndex].name, 'index', recommendationIndex);
  }

  function addRecommendation(disciplineIndex) {
    const discipline = editableReport.structuredReport.disciplines[disciplineIndex];

    // Get the current recommendations from getAggregatedRecommendations to preserve existing ones
    const currentAggregatedRecommendations = getAggregatedRecommendations(discipline);

    // If discipline.recommendations doesn't exist, initialize it with the aggregated recommendations
    if (!discipline.recommendations || discipline.recommendations.length === 0) {
      discipline.recommendations = [...currentAggregatedRecommendations];
    }

    // Add new empty recommendation
    discipline.recommendations = [
      ...discipline.recommendations,
      ''
    ];

    // More targeted reactivity - update just the disciplines array instead of the entire editableReport
    editableReport.structuredReport.disciplines = [...editableReport.structuredReport.disciplines];
    hasUnsavedChanges = true;
  }

  function removeRecommendation(disciplineIndex, recommendationIndex) {
    const discipline = editableReport.structuredReport.disciplines[disciplineIndex];

    // Get the current recommendations from getAggregatedRecommendations to work with
    const currentAggregatedRecommendations = getAggregatedRecommendations(discipline);

    // If discipline.recommendations doesn't exist, initialize it with the aggregated recommendations
    if (!discipline.recommendations || discipline.recommendations.length === 0) {
      discipline.recommendations = [...currentAggregatedRecommendations];
    }

    // Now remove the item at the specified index
    if (discipline.recommendations && Array.isArray(discipline.recommendations)) {
      discipline.recommendations = discipline.recommendations.filter((_, index) => index !== recommendationIndex);

      // Trigger reactivity for the disciplines array
      editableReport.structuredReport.disciplines = [...editableReport.structuredReport.disciplines];
      hasUnsavedChanges = true;
    }
  }

  function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit all content
    textarea.style.height = Math.max(44, textarea.scrollHeight) + 'px';
  }

  function handleTextareaInput(event, disciplineIndex, recIndex) {
    // Auto-resize the textarea
    autoResizeTextarea(event.target);
    // Handle the recommendation change
    handleRecommendationChange(disciplineIndex, recIndex, event.target.value);
  }

  // Svelte action to auto-resize textarea on mount
  // Toggle state for recommendation sections (keyed by discipline name)
  /** @type {Record<string, boolean>} */
  let recommendationTogglesOpen = {};

  /** @param {string} disciplineName */
  function toggleRecommendations(disciplineName) {
    recommendationTogglesOpen = { ...recommendationTogglesOpen, [disciplineName]: !recommendationTogglesOpen[disciplineName] };
  }

  // Toggle state for triggered rules sections (keyed by discipline name)
  /** @type {Record<string, boolean>} */
  let triggerTogglesOpen = {};

  /** @param {string} disciplineName */
  function toggleTriggers(disciplineName) {
    triggerTogglesOpen = { ...triggerTogglesOpen, [disciplineName]: !triggerTogglesOpen[disciplineName] };
  }

  function autoResizeOnMount(node) {
    // Initial resize
    setTimeout(() => autoResizeTextarea(node), 0);

    return {
      update() {
        // Re-resize when content changes
        setTimeout(() => autoResizeTextarea(node), 0);
      }
    };
  }

  function handleSiteSummaryChange(newSummary) {
    editableReport.structuredReport.summary.site = newSummary;
    hasUnsavedChanges = true;
  }

  function handleOverallRiskChange(newOverallRisk) {
    editableReport.structuredReport.summary.overallRisk = newOverallRisk;
    hasUnsavedChanges = true;
  }

  async function saveChanges() {
    if (!hasUnsavedChanges) return;

    if (!analysisSessionId) {
      console.error('❌ Cannot save: no analysisSessionId');
      saveStatus = 'Error: Analysis not saved yet. Please wait for analysis to complete.';
      setTimeout(() => saveStatus = '', 5000);
      return;
    }

    saving = true;
    saveStatus = 'Saving...';

    try {
      // Maps discipline display names to normalized discipline keys
      const disciplineToKey = {
        'Heritage': 'heritage',
        'Landscape': 'landscape',
        'Renewables': 'renewables',
        'Ecology': 'ecology',
        'Agricultural Land': 'ag_land',
        'Trees': 'trees',
        'Airfields': 'airfields'
      };

      // Save edits for each discipline
      const savePromises = [];

      if (editableReport?.structuredReport?.disciplines) {
        for (const discipline of editableReport.structuredReport.disciplines) {
          const disciplineKey = disciplineToKey[discipline.name];
          if (!disciplineKey) continue;

          const editedRisk = discipline.riskSummary?.level || 'low_risk';
          const editedRecommendations = discipline.recommendations || getAggregatedRecommendations(discipline);

          // Get changes specific to this discipline
          const disciplineChanges = pendingChanges.filter(
            c => c.discipline === disciplineKey ||
                 c.discipline === discipline.name.toLowerCase().replace(/\s+/g, '_')
          );

          console.log(`💾 Saving edits for ${discipline.name}:`, {
            sessionId: analysisSessionId,
            discipline: disciplineKey,
            editedRisk,
            recommendations: editedRecommendations.length,
            changes: disciplineChanges.length
          });

          savePromises.push(
            saveSessionEdit(
              analysisSessionId,
              disciplineKey,
              editedRisk,
              editedRecommendations,
              disciplineChanges
            )
          );
        }
      }

      // Wait for all saves to complete
      const results = await Promise.all(savePromises);
      console.log('✅ All discipline edits saved successfully:', results);

      // Clear pending changes after successful save
      pendingChanges = [];
      hasUnsavedChanges = false;
      saveStatus = 'Saved successfully!';
      setTimeout(() => saveStatus = '', 3000);

    } catch (error) {
      console.error('❌ Error saving analysis edits:', error);
      saveStatus = `Error: ${error.message}`;
      setTimeout(() => saveStatus = '', 5000);
    } finally {
      saving = false;
    }
  }

  function discardChanges() {
    if (report) {
      editableReport = JSON.parse(JSON.stringify(report)); // Reset to original
      pendingChanges = []; // Clear pending changes
      hasUnsavedChanges = false;
      saveStatus = '';
      console.log('🔄 Discarded TRP changes');
    }
  }

  async function exportToWord() {
    if (!editableReport) {
      console.error('❌ No report data available for export');
      return;
    }

    exportingWord = true;
    try {
      // Generate a site name from the report or use default
      const siteName = editableReport.metadata?.siteName ||
                      editableReport.structuredReport?.summary?.siteName ||
                      'TRP_Report';

      await generateWordReport(editableReport, siteName);
      console.log('✅ Word export completed successfully');
    } catch (error) {
      console.error('❌ Failed to export to Word:', error);
      // You could add user-facing error handling here
    } finally {
      exportingWord = false;
    }
  }

  async function exportToPDF() {
    if (!editableReport) {
      console.error('❌ No report data available for export');
      return;
    }

    exportingPDF = true;
    try {
      // Generate a site name from the report or use default
      const siteName = editableReport.metadata?.siteName ||
                      editableReport.structuredReport?.summary?.siteName ||
                      'TRP_Report';

      await generatePDFReport(editableReport, siteName);
      console.log('✅ PDF export completed successfully');
    } catch (error) {
      console.error('❌ Failed to export to PDF:', error);
      // You could add user-facing error handling here
    } finally {
      exportingPDF = false;
    }
  }

  function getAggregatedRecommendations(discipline) {
    // Use the editable recommendations if available
    if (discipline.recommendations && Array.isArray(discipline.recommendations)) {
      return discipline.recommendations;
    }

    // Fallback to original logic (same as TRPReportGenerator)
    const allRecommendations = [];

    if (!discipline?.triggeredRules || discipline.triggeredRules.length === 0) {
      if (discipline?.defaultNoRulesRecommendations && Array.isArray(discipline.defaultNoRulesRecommendations)) {
        allRecommendations.push(...discipline.defaultNoRulesRecommendations);
      }
    } else {
      if (discipline?.defaultTriggeredRecommendations && Array.isArray(discipline.defaultTriggeredRecommendations)) {
        allRecommendations.push(...discipline.defaultTriggeredRecommendations);
      }

      discipline.triggeredRules.forEach((rule: any) => {
        if (rule.recommendation && typeof rule.recommendation === 'string') {
          allRecommendations.push(rule.recommendation);
        }
        if (rule.recommendations && Array.isArray(rule.recommendations)) {
          allRecommendations.push(...rule.recommendations);
        }
      });
    }

    // Deduplicate recommendations
    const uniqueRecommendations: string[] = [];
    const seen = new Set();

    allRecommendations.forEach(rec => {
      const normalizedRec = rec.toLowerCase().trim();
      if (!seen.has(normalizedRec)) {
        seen.add(normalizedRec);
        uniqueRecommendations.push(rec);
      }
    });

    return uniqueRecommendations;
  }

  // Same grouping functions as TRPReportGenerator
  function groupRulesByType(rules: any[]) {
    const groups: Record<string, any[]> = {};

    rules.forEach((rule: any) => {
      let baseType = rule.rule
        .replace(/ On-Site$/, '')
        .replace(/ Within \d+m$/, '')
        .replace(/ Within \d+km$/, '')
        .replace(/ Within \d+-\d+km$/, '')
        .replace(/ \(.*\)$/, '');

      if (!groups[baseType]) {
        groups[baseType] = [];
      }
      groups[baseType].push(rule);
    });

    return groups;
  }

  function createGroupedRuleDisplay(baseType: string, rules: any[]) {
    const riskOrder: Record<string, number> = { 'showstopper': 7, 'extremely_high_risk': 6, 'high_risk': 5, 'medium_high_risk': 4, 'medium_risk': 3, 'medium_low_risk': 2, 'low_risk': 1 };
    const sortedRules = rules.sort((a: any, b: any) => (riskOrder[b.level] || 0) - (riskOrder[a.level] || 0));

    const findings = sortedRules.map((rule: any) => {
      const riskLabel = rule.level?.replace('_', '-').toUpperCase() || 'UNKNOWN';
      let simplifiedFindings = rule.findings;

      const withinMatch = rule.findings.match(/(\d+).*?within (\d+)([km]+)/i);
      if (withinMatch) {
        simplifiedFindings = `${withinMatch[1]} within ${withinMatch[2]}${withinMatch[3]} - ${riskLabel}`;
      } else if (rule.rule.includes('On-Site') || rule.findings.toLowerCase().includes('on site')) {
        const onSiteMatch = rule.findings.match(/(\d+)/);
        if (onSiteMatch) {
          simplifiedFindings = `${onSiteMatch[1]} on-site - ${riskLabel}`;
        }
      } else if (rule.findings.includes('between')) {
        const betweenMatch = rule.findings.match(/(\d+).*?between (\d+-\d+)([km]+)/i);
        if (betweenMatch) {
          simplifiedFindings = `${betweenMatch[1]} between ${betweenMatch[2]}${betweenMatch[3]} - ${riskLabel}`;
        }
      }

      return simplifiedFindings;
    }).join('\n');

    return {
      title: baseType,
      findings: findings,
      highestRisk: sortedRules[0].level,
      allRecommendations: [...new Set(sortedRules.flatMap((r: any) => r.recommendations || []))]
    };
  }

  function getRiskLevelColors(riskLevel: string): { bgColor: string; color: string } {
    const colorMap = {
      showstopper: { bgColor: '#fef2f2', color: '#dc2626' },
      extremely_high_risk: { bgColor: '#fee2e2', color: '#b91c1c' },
      high_risk: { bgColor: '#fff7ed', color: '#ea580c' },
      medium_risk: { bgColor: '#fff7ed', color: '#f59e0b' },
      medium_high_risk: { bgColor: '#fffbeb', color: '#d97706' },
      medium_low_risk: { bgColor: '#ecfdf5', color: '#10b981' },
      low_risk: { bgColor: '#ecfdf5', color: '#059669' }
    };

    return colorMap[riskLevel] || colorMap.low_risk;
  }
</script>

<div class="report-container">
  <div class="report-header">
    <h2 id="report-title">Edit Report</h2>
  </div>

  <div class="report-content">
    {#if structuredReport}
      <!-- Action Buttons (above summary) -->
      <div class="action-buttons">
        {#if hasUnsavedChanges}
          <span class="unsaved-indicator">Unsaved changes</span>
        {/if}
        {#if saveStatus}
          <span class="save-status {saveStatus.includes('Error') ? 'error' : 'success'}">{saveStatus}</span>
        {/if}
        <button
          class="btn-secondary"
          on:click={discardChanges}
          disabled={!hasUnsavedChanges || saving}
        >
          Discard Changes
        </button>
        <button
          class="btn-primary"
          on:click={saveChanges}
          disabled={!hasUnsavedChanges || saving}
        >
          {#if saving}
            <i class="las la-spinner la-spin"></i>
            Saving...
          {:else}
            <i class="las la-save"></i>
            Save Changes
          {/if}
        </button>
        <button
          class="btn-secondary"
          on:click={exportToWord}
          disabled={exportingWord}
          title="Download report as Word document"
        >
          {#if exportingWord}
            <i class="las la-spinner la-spin"></i>
            Exporting...
          {:else}
            <i class="las la-file-word"></i>
            Export to Word
          {/if}
        </button>
        <button
          class="btn-secondary"
          on:click={exportToPDF}
          disabled={exportingPDF}
          title="Download report as PDF document"
        >
          {#if exportingPDF}
            <i class="las la-spinner la-spin"></i>
            Exporting...
          {:else}
            <i class="las la-file-pdf"></i>
            Export to PDF
          {/if}
        </button>
      </div>

      <!-- 1. SUMMARY SECTION -->
      <div class="report-section">
        <h3>
          Summary
          <GuidanceButton
            title={SUMMARY_GENERAL_GUIDANCE.title}
            sections={SUMMARY_GENERAL_GUIDANCE.sections}
          />
        </h3>

        <!-- 1a. Site Summary (Editable) -->
        <div class="subsection">
          <h4>Site Summary</h4>
          <textarea
            class="editable-textarea site-summary"
            bind:value={baseSummaryData.site}
            on:input={(e) => { autoResizeTextarea(e.target); handleSiteSummaryChange(baseSummaryData.site); }}
            placeholder="Enter site summary..."
            use:autoResizeOnMount
          ></textarea>
        </div>

        <!-- 1b. Risk by Discipline -->
        {#if summaryData?.riskByDiscipline && summaryData.riskByDiscipline.length > 0}
          <div class="subsection">
            <h4>Risk by Discipline</h4>
            <div class="discipline-risk-list">
              {#each summaryData.riskByDiscipline as discipline}
                <div class="discipline-risk-item">
                  <span class="discipline-name">{discipline.name}:</span>
                  <span class="risk-badge-small" style="background-color: {discipline.riskSummary?.bgColor}; color: {discipline.riskSummary?.color};">
                    {discipline.riskSummary?.label}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 1c. Overall Risk (Editable) -->
        <div class="subsection">
          <h4>Overall Risk Estimation</h4>
          <textarea
            class="editable-textarea overall-risk"
            bind:value={baseSummaryData.overallRisk}
            on:input={(e) => { autoResizeTextarea(e.target); handleOverallRiskChange(baseSummaryData.overallRisk); }}
            placeholder="Enter overall risk estimation..."
            use:autoResizeOnMount
          ></textarea>
        </div>

        <!-- General Images -->
        <!-- <ImageUploadArea sectionName="General Site" /> -->
      </div>

      <!-- 2. DISCIPLINE SECTIONS (Heritage, Landscape, etc.) -->
      {#each disciplines as discipline, disciplineIndex}
        <div class="report-section discipline-section" data-discipline-index={disciplineIndex}>
          <h3>
            {discipline.name}
            {#if DISCIPLINE_GUIDANCE[discipline.name]}
              <GuidanceButton
                title={DISCIPLINE_GUIDANCE[discipline.name].title}
                sections={DISCIPLINE_GUIDANCE[discipline.name].sections}
              />
            {/if}
            <span class="predicted-risk-inline">
              <span class="predicted-risk-label">Predicted Risk</span>
              <div
                class="risk-badge-inline risk-badge-inline-dropdown"
                style="background-color: {discipline.riskSummary?.bgColor || '#f3f4f6'}; color: {discipline.riskSummary?.color || '#6b7280'};"
                title="Click to change risk level"
              >
                <select
                  class="hidden-dropdown-inline"
                  value={discipline.riskSummary.level}
                  on:change={(e) => handleRiskLevelChange(disciplineIndex, e.target.value)}
                >
                  {#each riskLevels as riskLevel}
                    <option value={riskLevel.value}>{riskLevel.label}</option>
                  {/each}
                </select>
                {discipline.riskSummary?.label} ▾
              </div>
            </span>
          </h3>

          <!-- 2b. Triggered Rules (Read-only) -->
          <div class="subsection">
            <button
              class="rec-toggle-header"
              on:click={() => toggleTriggers(discipline.name)}
            >
              <span>Rules Triggered ({discipline.name})</span>
              <span class="rec-toggle-arrow">{triggerTogglesOpen[discipline.name] ? '▲' : '▼'}</span>
            </button>
            {#if triggerTogglesOpen[discipline.name]}
              <div style="margin-top: 0.75rem;">
                {#if discipline.triggeredRules && discipline.triggeredRules.length > 0}
                  <div class="rules-container">
                    {#if discipline.name === 'Agricultural Land'}
                      {#each discipline.triggeredRules as rule}
                        <div class="rule-card" style="border-left-color: {discipline.riskSummary?.color};">
                          <div class="rule-header">
                            <h4 class="rule-title">{rule.rule}</h4>
                            <span class="rule-level" style="background-color: {getRiskLevelColors(rule.level).bgColor}; color: {getRiskLevelColors(rule.level).color};">
                              {rule.level?.replace('_', '-').toUpperCase()}
                            </span>
                          </div>
                          <div class="rule-content">
                            <p class="rule-findings"><strong>Findings:</strong> {rule.findings}</p>
                          </div>
                        </div>
                      {/each}
                    {:else}
                      {#each Object.entries(groupRulesByType(discipline.triggeredRules)) as [baseType, rules]}
                        {@const groupedRule = createGroupedRuleDisplay(baseType, rules)}
                        <div class="rule-card" style="border-left-color: {discipline.riskSummary?.color};">
                          <div class="rule-header">
                            <h4 class="rule-title">{groupedRule.title}</h4>
                            <span class="rule-level" style="background-color: {getRiskLevelColors(groupedRule.highestRisk).bgColor}; color: {getRiskLevelColors(groupedRule.highestRisk).color};">
                              {groupedRule.highestRisk?.replace('_', '-').toUpperCase()}
                            </span>
                          </div>
                          <div class="rule-content">
                            <div class="rule-findings">
                              <strong>Findings:</strong>
                              <div style="white-space: pre-line; margin-top: 0.5rem;">
                                {groupedRule.findings}
                              </div>
                            </div>
                          </div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                {:else}
                  <p class="no-rules">No {discipline.name.toLowerCase()} risk rules were triggered. Standard development considerations apply.</p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- 2c. Recommendations (Editable, collapsible) -->
          <div class="subsection">
            <button
              class="rec-toggle-header"
              on:click={() => toggleRecommendations(discipline.name)}
            >
              <span>Possible Recommendation Text ({discipline.name})</span>
              <span class="rec-toggle-arrow">{recommendationTogglesOpen[discipline.name] ? '▲' : '▼'}</span>
            </button>
            {#if recommendationTogglesOpen[discipline.name]}
              <div class="recommendations-editor" style="margin-top: 0.75rem;">
                {#each getAggregatedRecommendations(discipline) as recommendation, recIndex}
                  <div class="recommendation-item">
                    <textarea
                      class="recommendation-input"
                      class:user-added={recIndex >= (originalRecommendationCounts[disciplineIndex] ?? Infinity)}
                      value={recommendation}
                      on:input={(e) => handleTextareaInput(e, disciplineIndex, recIndex)}
                      placeholder="Enter recommendation..."
                      rows="1"
                      use:autoResizeOnMount
                    ></textarea>
                    <button
                      class="remove-recommendation-btn"
                      on:click={() => removeRecommendation(disciplineIndex, recIndex)}
                      title="Remove recommendation"
                    >
                      ×
                    </button>
                  </div>
                {/each}

                <button
                  class="add-recommendation-btn"
                  on:click={() => addRecommendation(disciplineIndex)}
                >
                  + Add Recommendation
                </button>
              </div>
            {/if}
          </div>

          <!-- Image Upload Area for this discipline -->
          <!-- <ImageUploadArea sectionName={discipline.name} /> -->
        </div>
      {/each}

      <!-- FLOOD SECTION (editable form) -->
      <div class="report-section discipline-section">
        <h3>
          Flood
          {#if DISCIPLINE_GUIDANCE['Flood']}
            <GuidanceButton
              title={DISCIPLINE_GUIDANCE['Flood'].title}
              sections={DISCIPLINE_GUIDANCE['Flood'].sections}
            />
          {/if}
        </h3>

        <div class="flood-form">
          <!-- Site over 1ha -->
          <div class="flood-field">
            <label class="flood-label">Is the site over 1 hectare?</label>
            <div class="flood-radio-group">
              <label class="flood-radio-label">
                <input type="radio" bind:group={siteOver1ha} value="yes" on:change={() => hasUnsavedChanges = true} /> Yes
              </label>
              <label class="flood-radio-label">
                <input type="radio" bind:group={siteOver1ha} value="no" on:change={() => hasUnsavedChanges = true} /> No
              </label>
            </div>
          </div>

          <!-- Flood Zones -->
          <div class="flood-field">
            <label class="flood-label">Flood Zones Present</label>
            <div class="flood-zones-grid">
              <div class="flood-zone-row">
                <label class="flood-checkbox-label">
                  <input type="checkbox" bind:checked={floodZones.zone1} on:change={() => hasUnsavedChanges = true} />
                  Zone 1
                </label>
                {#if floodZones.zone1}
                  <div class="flood-coverage-input">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={floodZoneCoverage.zone1} class="flood-percent" />
                    <span class="flood-percent-sign">approx. % coverage</span>
                  </div>
                {/if}
              </div>
              <div class="flood-zone-row">
                <label class="flood-checkbox-label">
                  <input type="checkbox" bind:checked={floodZones.zone2} on:change={() => hasUnsavedChanges = true} />
                  Zone 2
                </label>
                {#if floodZones.zone2}
                  <div class="flood-coverage-input">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={floodZoneCoverage.zone2} class="flood-percent" />
                    <span class="flood-percent-sign">approx. % coverage</span>
                  </div>
                {/if}
              </div>
              <div class="flood-zone-row">
                <label class="flood-checkbox-label">
                  <input type="checkbox" bind:checked={floodZones.zone3} on:change={() => hasUnsavedChanges = true} />
                  Zone 3
                </label>
                {#if floodZones.zone3}
                  <div class="flood-coverage-input">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={floodZoneCoverage.zone3} class="flood-percent" />
                    <span class="flood-percent-sign">approx. % coverage</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- Surface Water Flooding -->
          <div class="flood-field">
            <label class="flood-label">Surface Water Flooding?</label>
            <div class="flood-radio-group">
              <label class="flood-radio-label">
                <input type="radio" bind:group={surfaceWaterFlooding} value="yes" on:change={() => hasUnsavedChanges = true} /> Yes
              </label>
              <label class="flood-radio-label">
                <input type="radio" bind:group={surfaceWaterFlooding} value="no" on:change={() => hasUnsavedChanges = true} /> No
              </label>
            </div>
          </div>

          <!-- Risk Level -->
          <div class="flood-field">
            <label class="flood-label" for="flood-risk-level">Overall Flood Risk Level</label>
            <select
              id="flood-risk-level"
              class="flood-select"
              bind:value={floodRiskLevel}
              on:change={() => hasUnsavedChanges = true}
            >
              <option value="">-- Select --</option>
              <option value="low_risk">Low Risk</option>
              <option value="medium_low_risk">Medium-Low Risk</option>
              <option value="medium_risk">Medium Risk</option>
              <option value="medium_high_risk">Medium-High Risk</option>
              <option value="high_risk">High Risk</option>
              <option value="extremely_high_risk">Extremely High Risk</option>
              <option value="showstopper">Showstopper</option>
            </select>
          </div>
        </div>

        <!-- Show summary of entered flood data -->
        {#if floodRiskLevel}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Predicted Flood Risk</h4>
            <div class="risk-badge" style="background-color: {resolveRiskSummary(floodRiskLevel).bgColor}; color: {resolveRiskSummary(floodRiskLevel).color};">
              <span class="risk-level">{resolveRiskSummary(floodRiskLevel).label}</span>
              <span class="risk-description">{resolveRiskSummary(floodRiskLevel).description}</span>
            </div>
          </div>
        {/if}

        <!-- Generated flood findings text -->
        {#if floodFindings.length > 0}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Flood Findings</h4>
            <div class="flood-findings">
              {#each floodFindings as paragraph}
                <p class="flood-finding-paragraph" class:flood-finding-check={paragraph.startsWith('[CHECK')}>{paragraph}</p>
              {/each}
            </div>
          </div>
        {/if}

        {#if !floodRiskLevel && !siteOver1ha && !surfaceWaterFlooding && !floodZones.zone1 && !floodZones.zone2 && !floodZones.zone3}
          <p class="flood-hint">Complete the form above to record flood risk information for this site.</p>
        {/if}

        <!-- <ImageUploadArea sectionName="Flood" /> -->
      </div>

      <!-- AVIATION SECTION (editable form) -->
      <div class="report-section discipline-section">
        <h3>
          Aviation
          {#if DISCIPLINE_GUIDANCE['Aviation']}
            <GuidanceButton
              title={DISCIPLINE_GUIDANCE['Aviation'].title}
              sections={DISCIPLINE_GUIDANCE['Aviation'].sections}
            />
          {/if}
        </h3>

        <div class="aviation-note">
          Use the map and satellite imagery to identify any aerodromes, airfields, or helipads in the vicinity of the site, then record the counts below.
        </div>

        <div class="flood-form">
          <div class="flood-field">
            <label class="flood-label">Aerodromes within 500m</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={aerodromeCounts.within500m} class="flood-select aviation-count-input" />
          </div>
          <div class="flood-field">
            <label class="flood-label">Aerodromes within 500m – 1km</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={aerodromeCounts.within500mTo1km} class="flood-select aviation-count-input" />
          </div>
          <div class="flood-field">
            <label class="flood-label">Aerodromes within 1 – 5km</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" on:input={(e) => { enforceNumeric(e); hasUnsavedChanges = true; }} bind:value={aerodromeCounts.within1to5km} class="flood-select aviation-count-input" />
          </div>
        </div>

        <!-- Calculated aviation risk -->
        {#if aviationRiskLevel}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Predicted Aviation Risk</h4>
            <div class="risk-badge" style="background-color: {resolveRiskSummary(aviationRiskLevel).bgColor}; color: {resolveRiskSummary(aviationRiskLevel).color};">
              <span class="risk-level">{resolveRiskSummary(aviationRiskLevel).label}</span>
              <span class="risk-description">{resolveRiskSummary(aviationRiskLevel).description}</span>
            </div>
          </div>
        {/if}

        <!-- Generated aviation findings text -->
        {#if aviationFindings.length > 0}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Aviation Findings</h4>
            <div class="flood-findings">
              {#each aviationFindings as paragraph}
                <p class="flood-finding-paragraph">{paragraph}</p>
              {/each}
            </div>
          </div>
        {/if}

        {#if !aerodromeCounts.within500m && !aerodromeCounts.within500mTo1km && !aerodromeCounts.within1to5km}
          <p class="flood-hint">Enter aerodrome counts above to generate aviation findings.</p>
        {/if}

        <!-- <ImageUploadArea sectionName="Aviation" /> -->
      </div>

      <!-- HIGHWAYS SECTION (editable form) -->
      <div class="report-section discipline-section">
        <h3>
          Highways
          {#if DISCIPLINE_GUIDANCE['Highways']}
            <GuidanceButton
              title={DISCIPLINE_GUIDANCE['Highways'].title}
              sections={DISCIPLINE_GUIDANCE['Highways'].sections}
            />
          {/if}
        </h3>

        <div class="flood-form">
          <div class="flood-field">
            <label class="flood-label" for="highways-risk-level">Overall Highways Risk Level</label>
            <select
              id="highways-risk-level"
              class="flood-select"
              bind:value={highwaysRiskLevel}
              on:change={() => hasUnsavedChanges = true}
            >
              <option value="">-- Select --</option>
              <option value="low_risk">Low Risk</option>
              <option value="medium_low_risk">Medium-Low Risk</option>
              <option value="medium_risk">Medium Risk</option>
              <option value="medium_high_risk">Medium-High Risk</option>
              <option value="high_risk">High Risk</option>
              <option value="extremely_high_risk">Extremely High Risk</option>
              <option value="showstopper">Showstopper</option>
            </select>
          </div>
        </div>

        {#if highwaysRiskLevel}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Predicted Highways Risk</h4>
            <div class="risk-badge" style="background-color: {resolveRiskSummary(highwaysRiskLevel).bgColor}; color: {resolveRiskSummary(highwaysRiskLevel).color};">
              <span class="risk-level">{resolveRiskSummary(highwaysRiskLevel).label}</span>
              <span class="risk-description">{resolveRiskSummary(highwaysRiskLevel).description}</span>
            </div>
          </div>
        {/if}

        <!-- <ImageUploadArea sectionName="Highways" /> -->
      </div>

      <!-- AMENITY SECTION (editable form) -->
      <div class="report-section discipline-section">
        <h3>
          Amenity
          {#if DISCIPLINE_GUIDANCE['Amenity']}
            <GuidanceButton
              title={DISCIPLINE_GUIDANCE['Amenity'].title}
              sections={DISCIPLINE_GUIDANCE['Amenity'].sections}
            />
          {/if}
        </h3>

        <div class="flood-form">
          <div class="flood-field">
            <label class="flood-label" for="amenity-risk-level">Overall Amenity Risk Level</label>
            <select
              id="amenity-risk-level"
              class="flood-select"
              bind:value={amenityRiskLevel}
              on:change={() => hasUnsavedChanges = true}
            >
              <option value="">-- Select --</option>
              <option value="low_risk">Low Risk</option>
              <option value="medium_low_risk">Medium-Low Risk</option>
              <option value="medium_risk">Medium Risk</option>
              <option value="medium_high_risk">Medium-High Risk</option>
              <option value="high_risk">High Risk</option>
              <option value="extremely_high_risk">Extremely High Risk</option>
              <option value="showstopper">Showstopper</option>
            </select>
          </div>
        </div>

        {#if amenityRiskLevel}
          <div class="subsection" style="margin-top: 1rem;">
            <h4>Predicted Amenity Risk</h4>
            <div class="risk-badge" style="background-color: {resolveRiskSummary(amenityRiskLevel).bgColor}; color: {resolveRiskSummary(amenityRiskLevel).color};">
              <span class="risk-level">{resolveRiskSummary(amenityRiskLevel).label}</span>
              <span class="risk-description">{resolveRiskSummary(amenityRiskLevel).description}</span>
            </div>
          </div>
        {/if}

        <!-- <ImageUploadArea sectionName="Amenity" /> -->
      </div>

      <!-- Report Metadata -->
      {#if editableReport?.metadata}
        <div class="report-section">
          <h3>Report Information</h3>
          <div class="metadata">
            <p><strong>Generated:</strong> {new Date(editableReport.metadata.generatedAt).toLocaleString()}</p>
            <p><strong>Rules Processed:</strong> {editableReport.metadata.totalRulesProcessed}</p>
            <p><strong>Rules Triggered:</strong> {editableReport.metadata.rulesTriggered}</p>
            <p><strong>Rules Version:</strong> {editableReport.metadata.rulesVersion}</p>
          </div>
        </div>
      {/if}
    {:else}
      <div class="report-placeholder">
        <h3>⚠️ No Analysis Data</h3>
        <p>Please run an analysis first to generate a TRP report.</p>
      </div>
    {/if}
  </div>
</div>

<!-- Risk Change Reason Modal -->
<RiskChangeReasonModal
  isOpen={showReasonModal}
  discipline={pendingRiskChange?.disciplineName || ''}
  oldValue={pendingRiskChange?.oldValue || ''}
  newValue={pendingRiskChange?.newValue || ''}
  on:confirm={handleReasonConfirm}
  on:cancel={handleReasonCancel}
/>

<style>
  .report-container {
    background: white;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .report-header h2 {
    margin: 0;
    color: #1f2937;
    font-size: 1.5rem;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 1.5rem 0;
    flex-wrap: wrap;
  }

  .unsaved-indicator {
    color: #d97706;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .save-status {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .save-status.success {
    color: #059669;
  }

  .save-status.error {
    color: #dc2626;
  }

  .report-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    height: 0;
  }

  .report-placeholder {
    text-align: center;
    padding: 2rem;
  }

  .report-placeholder h3 {
    color: #374151;
    margin-bottom: 1rem;
  }

  .report-placeholder p {
    color: #6b7280;
    margin-bottom: 2rem;
  }

  .report-section {
    margin-bottom: 2rem;
  }

  .report-section h3 {
    color: #374151;
    font-size: 1.25rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .subsection {
    margin-bottom: 1.5rem;
  }

  .subsection h4 {
    margin-bottom: 0.75rem;
    color: #4b5563;
    font-size: 1rem;
    font-weight: 600;
  }

  /* Editable field styles */
  .editable-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    line-height: 1.5;
    resize: vertical;
    transition: all 0.2s ease;
    box-sizing: border-box;
    font-family: inherit;
  }

  .editable-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .editable-textarea.site-summary {
    min-height: 80px;
  }

  .editable-textarea.overall-risk {
    min-height: 60px;
  }

  .editable-textarea.recommendations {
    min-height: 120px;
  }

  /* Recommendations editor styles */
  .recommendations-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .recommendation-item {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .recommendation-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
    min-height: 44px;
    line-height: 1.5;
  }

  .recommendation-input.user-added {
    color: #dc2626;
  }

  .recommendation-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .remove-recommendation-btn {
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .remove-recommendation-btn:hover {
    background: #dc2626;
    transform: scale(1.05);
  }

  .add-recommendation-btn {
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
  }

  .add-recommendation-btn:hover {
    background: #059669;
    transform: translateY(-1px);
  }

  .risk-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
  }

  .risk-level {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .risk-description {
    font-size: 0.875rem;
    font-weight: 400;
  }

  /* Additional styles for dropdown functionality - extends .risk-badge */
  .risk-badge-dropdown {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    /* Force exact same styling as regular badges */
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    padding: 1rem !important;
    border-radius: 8px !important;
    text-align: center !important;
    font-weight: 600 !important;
  }

  .risk-badge-dropdown:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  /* Reset hover effects after dropdown interaction */
  .risk-badge-dropdown:focus-within {
    border-color: transparent !important;
    transform: none !important;
    box-shadow: none !important;
  }

  /* Ensure spans inside dropdown badges match exactly */
  .risk-badge-dropdown .risk-level {
    font-size: 1.25rem !important;
    margin-bottom: 0.5rem !important;
  }

  .risk-badge-dropdown .risk-description {
    font-size: 0.875rem !important;
    font-weight: 400 !important;
  }

  .hidden-dropdown {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 10;
  }

  .dropdown-arrow {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    font-size: 0.875rem;
    pointer-events: none;
    opacity: 0.8;
    transition: transform 0.2s ease;
  }

  .risk-badge-dropdown:hover .dropdown-arrow {
    transform: scale(1.1);
    opacity: 1;
  }

  .discipline-risk-list {
    background: #f9fafb;
    border-radius: 8px;
    padding: 1rem;
  }

  .discipline-risk-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .discipline-risk-item:last-child {
    margin-bottom: 0;
  }

  .discipline-name {
    font-weight: 500;
    color: #374151;
  }

  .risk-badge-small {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .discipline-section {
    border-top: 2px solid #e5e7eb;
    padding-top: 1.5rem;
  }

  .discipline-section h3 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .predicted-risk-inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .predicted-risk-label {
    font-size: 0.8rem;
    font-weight: 400;
    color: #9ca3af;
    white-space: nowrap;
  }

  .risk-badge-inline {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.65rem;
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    letter-spacing: 0.03em;
  }

  .risk-badge-inline-dropdown {
    position: relative;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .risk-badge-inline-dropdown:hover {
    opacity: 0.8;
  }

  .hidden-dropdown-inline {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 10;
    border: none;
  }

  .rules-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .rule-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 4px solid;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .rule-title {
    margin: 0;
    color: #374151;
    font-size: 1.125rem;
  }

  .rule-level {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .rule-content p {
    margin-bottom: 0.75rem;
    color: #4b5563;
    line-height: 1.5;
  }

  .rule-content p:last-child {
    margin-bottom: 0;
  }

  .no-rules {
    color: #059669;
    font-style: italic;
    text-align: center;
    padding: 1rem;
    background: #ecfdf5;
    border-radius: 8px;
  }

  .metadata {
    background: #f9fafb;
    border-radius: 8px;
    padding: 1rem;
  }

  .metadata p {
    margin-bottom: 0.5rem;
    color: #4b5563;
    font-size: 0.875rem;
  }

  .metadata p:last-child {
    margin-bottom: 0;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary i {
    font-size: 1.125rem;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border: 1px solid #3b82f6;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    background: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }

  .btn-primary i {
    font-size: 1.125rem;
  }

  /* Flood form styles */
  .flood-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: #f9fafb;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .flood-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .flood-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .flood-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    background: white;
    max-width: 280px;
  }

  .flood-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .flood-radio-group {
    display: flex;
    gap: 1.5rem;
  }

  .flood-radio-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    font-weight: 400;
  }

  .flood-zones-grid {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .flood-zone-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .flood-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    min-width: 110px;
    font-weight: 400;
  }

  .flood-coverage-input {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .flood-percent {
    width: 70px;
    padding: 0.35rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    text-align: right;
  }

  .flood-percent:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .flood-percent-sign {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .flood-findings {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 4px solid #3b82f6;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .flood-finding-paragraph {
    color: #374151;
    line-height: 1.6;
    margin-bottom: 0.75rem;
  }

  .flood-finding-paragraph:last-child {
    margin-bottom: 0;
  }

  .flood-finding-check {
    color: #b45309;
    font-style: italic;
    background: #fffbeb;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    border-left: 3px solid #f59e0b;
  }

  .flood-hint {
    color: #6b7280;
    font-style: italic;
    text-align: center;
    padding: 0.75rem;
    margin-top: 0.75rem;
    font-size: 0.875rem;
  }

  /* Aviation styles */
  .aviation-note {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: #1e40af;
    line-height: 1.5;
  }

  .aviation-count-input {
    max-width: 120px;
  }

  .rec-toggle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #4b5563;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s ease;
  }

  .rec-toggle-header:hover {
    background: #e5e7eb;
  }

  .rec-toggle-arrow {
    font-size: 0.7rem;
    color: #9ca3af;
    flex-shrink: 0;
  }
</style>