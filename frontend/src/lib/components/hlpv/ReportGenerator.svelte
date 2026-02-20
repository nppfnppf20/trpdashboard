<script lang="ts">
  import { buildCombinedReport, resolveRiskSummary } from '$lib/services/reportGenerator.js';
  import { exportHLPVFindingsToWord } from '$lib/services/hlpvExport.js';
  import { generateFloodFindings } from '$lib/services/flood/floodFindings.js';
  import { generateAviationFindings, calculateAviationRisk } from '$lib/services/aviation/aviationFindings.js';
  import RiskLevelSection from './report/RiskLevelSection.svelte';
  import GuidanceButton from './report/GuidanceButton.svelte';
  import RiskChangeReasonModal from './report/RiskChangeReasonModal.svelte';
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

  /** @type {() => void} */
  export let onOpenTRPReport = () => {};

  /** @type {boolean} */
  export let analysisSaved = false;

  /** @type {string} */
  export let projectName = 'Site';

  /** @type {string | null} */
  export let originalAnalysisId = null;

  let exporting = false;

  // Risk change modal state
  let showRiskChangeModal = false;
  let pendingRiskChange: {
    discipline: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    applyChange: (reason: string) => void;
    revertChange: () => void;
  } | null = null;

  // Track all changes made during this session (for saving later)
  let sessionChanges: Array<{
    discipline: string;
    fieldPath: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }> = [];

  // Flood form state (frontend-only, no backend)
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

  /** @param {Event} e */
  function enforceNumeric(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    input.value = input.value.replace(/[^0-9]/g, '');
  }

  // Generate flood findings text reactively (logic + text lives in floodFindings.js)
  $: floodFindings = generateFloodFindings(floodZones, floodZoneCoverage, siteOver1ha, surfaceWaterFlooding);

  // Aviation form state (frontend-only, no backend)
  /** @type {{ within500m: string, within500mTo1km: string, within1to5km: string }} */
  let aerodromeCounts = { within500m: '', within500mTo1km: '', within1to5km: '' };

  // Generate aviation findings and risk reactively
  $: aviationFindings = generateAviationFindings(aerodromeCounts);
  $: aviationRiskLevel = calculateAviationRisk(aerodromeCounts);

  // Highways form state (frontend-only, no backend)
  /** @type {string} */
  let highwaysRiskLevel = '';

  // Landscape form state (frontend-only override, no backend)
  /** @type {string} */
  let landscapeRiskLevel = '';

  // Amenity form state (frontend-only, no backend)
  /** @type {string} */
  let amenityRiskLevel = '';

  /**
   * Handle risk level change - shows modal to collect reason
   * @param {string} discipline - Name of the discipline
   * @param {string} oldValue - Previous risk level
   * @param {string} newValue - New risk level
   * @param {(value: string) => void} setter - Function to set the new value
   */
  function handleRiskLevelChange(
    discipline: string,
    oldValue: string,
    newValue: string,
    setter: (value: string) => void
  ) {
    // If clearing the value or setting initial value, don't show modal
    if (!newValue || !oldValue) {
      setter(newValue);
      return;
    }

    // Show modal to collect reason
    pendingRiskChange = {
      discipline,
      fieldName: 'Risk Level',
      oldValue,
      newValue,
      applyChange: (reason: string) => {
        setter(newValue);
        // Record the change
        sessionChanges = [...sessionChanges, {
          discipline,
          fieldPath: 'overallRisk',
          oldValue,
          newValue,
          reason
        }];
        console.log('📝 Risk change recorded:', { discipline, oldValue, newValue, reason });
        pendingRiskChange = null;
        showRiskChangeModal = false;
      },
      revertChange: () => {
        // Don't change the value
        pendingRiskChange = null;
        showRiskChangeModal = false;
      }
    };
    showRiskChangeModal = true;
  }

  function handleRiskChangeConfirm(event: CustomEvent) {
    if (pendingRiskChange) {
      pendingRiskChange.applyChange(event.detail.reason);
    }
  }

  function handleRiskChangeCancel() {
    if (pendingRiskChange) {
      pendingRiskChange.revertChange();
    }
  }

  // Generate combined report when data changes
  $: report = (() => {
    try {
      if (heritageData || landscapeData || renewablesData || ecologyData || agLandData || treesData || airfieldsData) {
        console.log('🔄 Building combined report with:', { heritageData: !!heritageData, landscapeData: !!landscapeData, renewablesData: !!renewablesData, ecologyData: !!ecologyData, agLandData: !!agLandData, treesData: !!treesData, airfieldsData: !!airfieldsData });
        const result = buildCombinedReport(heritageData, landscapeData, renewablesData, ecologyData, agLandData, treesData, airfieldsData);
        console.log('✅ Report built successfully:', result);
        return result;
      }
      return null;
    } catch (error) {
      console.error('❌ Error building report:', error);
      console.error('Data that caused error:', { heritageData, landscapeData, renewablesData, ecologyData, agLandData, treesData, airfieldsData });
      return null;
    }
  })();
  
  // Use the new structured data
  $: structuredReport = report?.structuredReport;
  $: baseSummaryData = structuredReport?.summary;
  $: disciplines = structuredReport?.disciplines || [];

  /** Placeholder entry for disciplines with no risk selected yet */
  const NOT_ASSESSED = { label: '-', description: '', bgColor: '#f3f4f6', color: '#6b7280' };

  // Build the full summary with all disciplines always listed
  $: summaryData = (() => {
    if (!baseSummaryData) return baseSummaryData;

    // Start with backend disciplines, overriding Landscape if user selected
    const backendDisciplines = (baseSummaryData.riskByDiscipline || []).map((d: any) => {
      if (d.name === 'Landscape') {
        return landscapeRiskLevel
          ? { ...d, risk: landscapeRiskLevel, riskSummary: resolveRiskSummary(landscapeRiskLevel) }
          : { ...d, riskSummary: NOT_ASSESSED };
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

    return { ...baseSummaryData, riskByDiscipline: [...backendDisciplines, ...frontendDisciplines] };
  })();

  // Debug when component mounts
  $: if (report !== null) {
    console.log('📊 ReportGenerator component has report data:', report);
    console.log('📋 Disciplines array:', disciplines);
    console.log('📋 Structured report:', structuredReport);
  }
  
  // Keep legacy data for fallback compatibility
  $: designationSummary = report?.combined?.designationSummary || [];
  $: riskAssessment = report?.combined || report?.heritage?.riskAssessment || report?.landscape?.riskAssessment;
  $: triggeredRules = report?.combined?.triggeredRules || [];

  /** @param {string[]} requirements */
  function formatRequirements(requirements) {
    return requirements || [];
  }

  // Risk hierarchy for comparing rule severity (higher index = higher risk)
  const RISK_HIERARCHY = ['low_risk', 'medium_low_risk', 'medium_risk', 'medium_high_risk', 'high_risk', 'extremely_high_risk', 'showstopper'];

  /**
   * Extract base designation type from rule ID
   * e.g., 'ancient_woodland_on_site' -> 'ancient_woodland'
   *       'sssi_within_500m' -> 'sssi'
   */
  function getDesignationType(ruleId: string): string {
    if (!ruleId) return 'unknown';
    // Remove common suffixes like _on_site, _within_Xm, _within_Xkm, _between_X_Ykm
    return ruleId
      .replace(/_on_site$/, '')
      .replace(/_within_\d+m$/, '')
      .replace(/_within_\d+km$/, '')
      .replace(/_between_\d+_\d+km$/, '');
  }

  /** @param {any} discipline */
  function getAggregatedRecommendations(discipline) {
    console.log('🔍 getAggregatedRecommendations called for:', discipline?.name);
    console.log('🔍 triggeredRules:', discipline?.triggeredRules);

    const designationRecommendations: string[] = [];
    const disciplineRecommendations: string[] = [];

    // Add recommendations based on whether rules are triggered or not
    if (!discipline?.triggeredRules || discipline.triggeredRules.length === 0) {
      console.log('❌ No triggered rules found - using no-rules recommendations');
      // Use new disciplineRecommendation field if available, otherwise fall back to old structure
      if (discipline?.disciplineRecommendation) {
        // Split multi-paragraph recommendations into separate bullets for Heritage and Agricultural Land
        if (discipline.name === 'Heritage' || discipline.name === 'Agricultural Land') {
          disciplineRecommendations.push(
            ...discipline.disciplineRecommendation
              .split('\n\n')
              .map((/** @type {string} */ r) => r.trim())
              .filter(Boolean)
          );
        } else {
          disciplineRecommendations.push(discipline.disciplineRecommendation);
        }
      } else if (discipline?.defaultNoRulesRecommendations && Array.isArray(discipline.defaultNoRulesRecommendations)) {
        disciplineRecommendations.push(...discipline.defaultNoRulesRecommendations);
      }
    } else {
      console.log('✅ Rules triggered - collecting recommendations');

      // Group rules by designation type and keep only highest-risk recommendation per type
      const rulesByDesignation: Record<string, { rule: any, riskIndex: number }> = {};

      discipline.triggeredRules.forEach((rule: any, index: number) => {
        console.log(`🔍 Rule ${index}:`, rule);

        const designationType = getDesignationType(rule.id);
        const riskIndex = RISK_HIERARCHY.indexOf(rule.level);

        // Only keep this rule's recommendation if it's higher risk than any existing one for this designation
        if (!rulesByDesignation[designationType] || riskIndex > rulesByDesignation[designationType].riskIndex) {
          rulesByDesignation[designationType] = { rule, riskIndex };
        }
      });

      // Collect recommendations from highest-risk rule per designation type
      Object.values(rulesByDesignation).forEach(({ rule }) => {
        // Handle new format: single recommendation string
        if (rule.recommendation && typeof rule.recommendation === 'string') {
          console.log(`🔍 Keeping recommendation from highest-risk rule:`, rule.id);
          designationRecommendations.push(rule.recommendation);
        }
        // Handle old format: recommendations array (for backward compatibility)
        else if (rule.recommendations && Array.isArray(rule.recommendations)) {
          console.log(`🔍 Keeping recommendations from highest-risk rule:`, rule.id);
          designationRecommendations.push(...rule.recommendations);
        }
      });

      // LAST: Add discipline-level recommendation
      if (discipline?.disciplineRecommendation) {
        // Split multi-paragraph recommendations into separate bullets for Heritage and Agricultural Land
        if (discipline.name === 'Heritage' || discipline.name === 'Agricultural Land') {
          disciplineRecommendations.push(
            ...discipline.disciplineRecommendation
              .split('\n\n')
              .map((/** @type {string} */ r) => r.trim())
              .filter(Boolean)
          );
        } else {
          disciplineRecommendations.push(discipline.disciplineRecommendation);
        }
      } else if (discipline?.defaultTriggeredRecommendations && Array.isArray(discipline.defaultTriggeredRecommendations)) {
        disciplineRecommendations.push(...discipline.defaultTriggeredRecommendations);
      }
    }

    // Combine: designation recommendations FIRST, discipline recommendation LAST
    const allRecommendations = [...designationRecommendations, ...disciplineRecommendations];

    console.log('🔍 All recommendations collected:', allRecommendations);

    // Deduplicate recommendations - remove exact duplicates AND cases where one is a substring of another
    const uniqueRecommendations: string[] = [];

    allRecommendations.forEach(rec => {
      if (!rec) return;

      const normalizedRec = rec.toLowerCase().trim();

      // Check if this recommendation is already covered by an existing one (either exact match or substring)
      const isAlreadyCovered = uniqueRecommendations.some(existing => {
        const normalizedExisting = existing.toLowerCase().trim();
        // Check if either is a substring of the other
        return normalizedExisting === normalizedRec ||
               normalizedExisting.includes(normalizedRec) ||
               normalizedRec.includes(normalizedExisting);
      });

      if (!isAlreadyCovered) {
        uniqueRecommendations.push(rec);
      } else {
        // If the new rec is longer (more complete), replace the shorter one
        const existingIndex = uniqueRecommendations.findIndex(existing => {
          const normalizedExisting = existing.toLowerCase().trim();
          return normalizedRec.includes(normalizedExisting) && normalizedRec !== normalizedExisting;
        });

        if (existingIndex !== -1) {
          // Replace shorter recommendation with longer one
          uniqueRecommendations[existingIndex] = rec;
        }
      }
    });

    console.log('🔍 Unique recommendations:', uniqueRecommendations);
    return uniqueRecommendations;
  }

  function groupRulesByType(rules: any[]) {
    const groups: Record<string, any[]> = {};
    
    rules.forEach((rule: any) => {
      // Extract base type by removing distance/location suffixes
      let baseType = rule.rule
        .replace(/ On-Site$/, '')
        .replace(/ Within \d+m$/, '')
        .replace(/ Within \d+km$/, '')
        .replace(/ Within \d+-\d+km$/, '')
        .replace(/ \(.*\)$/, ''); // Remove anything in parentheses
      
      if (!groups[baseType]) {
        groups[baseType] = [];
      }
      groups[baseType].push(rule);
    });
    
    return groups;
  }

  function formatRiskLevel(riskLevel: string): string {
    if (!riskLevel) return 'UNKNOWN';

    // Convert specific compound risk levels to use hyphens
    let formatted = riskLevel;
    formatted = formatted.replace('medium_high', 'medium-high');
    formatted = formatted.replace('medium_low', 'medium-low');

    // Replace remaining underscores with spaces
    formatted = formatted.replace(/_/g, ' ');

    // Capitalize each word
    return formatted
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async function handleExportToWord() {
    if (!report) {
      alert('No analysis data available to export.');
      return;
    }

    // Build augmented report that includes frontend-only disciplines
    const augmentedReport = JSON.parse(JSON.stringify(report));
    const extraDisciplines = [];

    // Flood
    if (floodRiskLevel || floodFindings.length > 0) {
      extraDisciplines.push({
        name: 'Flood',
        overallRisk: floodRiskLevel || null,
        riskSummary: floodRiskLevel ? resolveRiskSummary(floodRiskLevel) : { label: 'NOT ASSESSED', description: '', bgColor: '#f3f4f6', color: '#6b7280' },
        triggeredRules: [],
        findingsParagraphs: floodFindings,
        disciplineRecommendation: null,
        defaultTriggeredRecommendations: [],
        defaultNoRulesRecommendations: []
      });
    }

    // Aviation
    if (aviationRiskLevel || aviationFindings.length > 0) {
      extraDisciplines.push({
        name: 'Aviation',
        overallRisk: aviationRiskLevel || null,
        riskSummary: aviationRiskLevel ? resolveRiskSummary(aviationRiskLevel) : { label: 'NOT ASSESSED', description: '', bgColor: '#f3f4f6', color: '#6b7280' },
        triggeredRules: [],
        findingsParagraphs: aviationFindings,
        disciplineRecommendation: null,
        defaultTriggeredRecommendations: [],
        defaultNoRulesRecommendations: []
      });
    }

    // Override Landscape risk in existing backend discipline for export
    if (landscapeRiskLevel) {
      const landscapeDiscipline = augmentedReport.structuredReport.disciplines?.find((d: any) => d.name === 'Landscape');
      if (landscapeDiscipline) {
        landscapeDiscipline.overallRisk = landscapeRiskLevel;
        landscapeDiscipline.riskSummary = resolveRiskSummary(landscapeRiskLevel);
      }
    }

    // Highways
    if (highwaysRiskLevel) {
      extraDisciplines.push({
        name: 'Highways',
        overallRisk: highwaysRiskLevel,
        riskSummary: resolveRiskSummary(highwaysRiskLevel),
        triggeredRules: [],
        findingsParagraphs: [],
        disciplineRecommendation: null,
        defaultTriggeredRecommendations: [],
        defaultNoRulesRecommendations: []
      });
    }

    // Amenity
    if (amenityRiskLevel) {
      extraDisciplines.push({
        name: 'Amenity',
        overallRisk: amenityRiskLevel,
        riskSummary: resolveRiskSummary(amenityRiskLevel),
        triggeredRules: [],
        findingsParagraphs: [],
        disciplineRecommendation: null,
        defaultTriggeredRecommendations: [],
        defaultNoRulesRecommendations: []
      });
    }

    // Append frontend-only disciplines
    if (extraDisciplines.length > 0) {
      augmentedReport.structuredReport.disciplines = [
        ...(augmentedReport.structuredReport.disciplines || []),
        ...extraDisciplines
      ];
    }

    // Augment summary riskByDiscipline too
    if (augmentedReport.structuredReport?.summary) {
      const riskByDiscipline = [...(augmentedReport.structuredReport.summary.riskByDiscipline || [])];
      for (const d of extraDisciplines) {
        if (d.overallRisk) {
          riskByDiscipline.push({ name: d.name, risk: d.overallRisk, riskSummary: d.riskSummary });
        }
      }
      augmentedReport.structuredReport.summary.riskByDiscipline = riskByDiscipline;
    }

    exporting = true;
    try {
      await exportHLPVFindingsToWord(augmentedReport, projectName);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export to Word: ' + error.message);
    } finally {
      exporting = false;
    }
  }

  function formatRiskLevelForFindings(riskLevel: string): string {
    if (!riskLevel) return 'unknown';

    // Convert specific compound risk levels to use hyphens
    let formatted = riskLevel;
    formatted = formatted.replace('medium_high', 'medium-high');
    formatted = formatted.replace('medium_low', 'medium-low');

    // Replace remaining underscores with spaces
    formatted = formatted.replace(/_/g, ' ');

    // Capitalize first word only (sentence case)
    return formatted
      .split(' ')
      .map((word, index) => {
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toLowerCase();
      })
      .join(' ');
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

  // Toggle state for recommendation sections (keyed by discipline name)
  let recommendationTogglesOpen: Record<string, boolean> = {};

  function toggleRecommendations(disciplineName: string) {
    recommendationTogglesOpen = { ...recommendationTogglesOpen, [disciplineName]: !recommendationTogglesOpen[disciplineName] };
  }

  // Toggle state for triggered rules sections (keyed by discipline name)
  let triggerTogglesOpen: Record<string, boolean> = {};

  function toggleTriggers(disciplineName: string) {
    triggerTogglesOpen = { ...triggerTogglesOpen, [disciplineName]: !triggerTogglesOpen[disciplineName] };
  }

  function formatFindings(findings: string): string {
    if (!findings) return findings;

    // Pattern to match "XXXXm N (Ykm)" and convert to "X.Xkm N"
    // This matches patterns like "4807m N (5km)" and converts to "4.8km N"
    const distancePattern = /(\d+)m\s+([NSEW])\s*\([^)]+\)/g;

    return findings.replace(distancePattern, (match, meters, direction) => {
      const km = (parseInt(meters) / 1000).toFixed(1);
      return `${km}km ${direction}`;
    });
  }

  function createGroupedRuleDisplay(baseType: string, rules: any[]) {
    // Sort rules by risk level (highest first)
    const riskOrder: Record<string, number> = { 'showstopper': 7, 'extremely_high_risk': 6, 'high_risk': 5, 'medium_high_risk': 4, 'medium_risk': 3, 'medium_low_risk': 2, 'low_risk': 1 };
    const sortedRules = rules.sort((a: any, b: any) => (riskOrder[b.level] || 0) - (riskOrder[a.level] || 0));

    const findings = sortedRules.map((rule: any) => {
      const riskLabel = formatRiskLevelForFindings(rule.level);

      // Extract count and location from findings with better pattern matching
      let simplifiedFindings = rule.findings;

      // Pattern for "X within Ykm" or "X within Ym"
      const withinMatch = rule.findings.match(/(\d+).*?within (\d+)([km]+)/i);
      if (withinMatch) {
        simplifiedFindings = `${withinMatch[1]} within ${withinMatch[2]}${withinMatch[3]} - ${riskLabel}`;
      }
      // Pattern for "X on site" or "on-site"
      else if (rule.rule.includes('On-Site') || rule.findings.toLowerCase().includes('on site')) {
        const onSiteMatch = rule.findings.match(/(\d+)/);
        if (onSiteMatch) {
          simplifiedFindings = `${onSiteMatch[1]} on-site - ${riskLabel}`;
        }
      }
      // Pattern for range "X between Y-Z km"
      else if (rule.findings.includes('between')) {
        const betweenMatch = rule.findings.match(/(\d+).*?between (\d+-\d+)([km]+)/i);
        if (betweenMatch) {
          simplifiedFindings = `${betweenMatch[1]} between ${betweenMatch[2]}${betweenMatch[3]} - ${riskLabel}`;
        }
      }

      return simplifiedFindings;
    }).join('\n');

    // Collect all recommendations - handle both new (recommendation) and old (recommendations) formats
    const allRecommendations = [...new Set(sortedRules.flatMap((r: any) => {
      if (r.recommendation && typeof r.recommendation === 'string') {
        return [r.recommendation];
      }
      return r.recommendations || [];
    }))];

    return {
      title: baseType,
      findings: findings,
      highestRisk: sortedRules[0].level,
      allRecommendations
    };
  }
</script>

<div class="report-container">
  <div class="report-header">
    <h2 id="report-title">Planning Constraints Assessment Report</h2>
  </div>
  
  <div class="report-content">
      {#if structuredReport}
        <!-- Action Buttons (above summary) -->
        <div class="action-buttons">
          <button class="btn-secondary" on:click={handleExportToWord} disabled={exporting}>
            {#if exporting}
              <i class="las la-spinner la-spin"></i>
              Exporting...
            {:else}
              <i class="las la-file-word"></i>
              Export to Word
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

          <!-- Explanatory text -->
          <div class="summary-disclaimer">
            <p>Below is an initial high-level appraisal, please go to the 'Edit Report' tab to make changes.</p>
          </div>

          <!-- Risk by Discipline -->
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
        </div>

        <!-- 2. DISCIPLINE SECTIONS (Heritage, Landscape, etc.) -->
        {#each disciplines as discipline}
          <div class="report-section discipline-section">
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
                <span class="risk-badge-inline" style="background-color: {discipline.riskSummary?.bgColor}; color: {discipline.riskSummary?.color};">
                  {discipline.riskSummary?.label}
                </span>
              </span>
            </h3>
            
            <!-- 2b. Triggered Rules -->
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
                        <!-- Agricultural Land: Show individual rules (no grouping) -->
                        {#each discipline.triggeredRules as rule}
                          <div class="rule-card" style="border-left-color: {discipline.riskSummary?.color};">
                            <div class="rule-header">
                              <h4 class="rule-title">{rule.rule}</h4>
                              <span class="rule-level" style="background-color: {getRiskLevelColors(rule.level).bgColor}; color: {getRiskLevelColors(rule.level).color};">
                                {formatRiskLevel(rule.level)}
                              </span>
                            </div>
                            <div class="rule-content">
                              <p class="rule-findings"><strong>Findings:</strong> {formatFindings(rule.findings)}</p>
                            </div>
                          </div>
                        {/each}
                      {:else}
                        <!-- Other disciplines: Use grouped rules display -->
                        {#each Object.entries(groupRulesByType(discipline.triggeredRules)) as [baseType, rules]}
                          {@const groupedRule = createGroupedRuleDisplay(baseType, rules)}
                          <div class="rule-card" style="border-left-color: {discipline.riskSummary?.color};">
                            <div class="rule-header">
                              <h4 class="rule-title">{groupedRule.title}</h4>
                              <span class="rule-level" style="background-color: {getRiskLevelColors(groupedRule.highestRisk).bgColor}; color: {getRiskLevelColors(groupedRule.highestRisk).color};">
                                {formatRiskLevel(groupedRule.highestRisk)}
                              </span>
                            </div>
                            <div class="rule-content">
                              <div class="rule-findings">
                                <strong>Findings:</strong>
                                <div style="white-space: pre-line; margin-top: 0.5rem;">
                                  {formatFindings(groupedRule.findings)}
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
            
            <!-- 2c. Recommendations (collapsible) -->
            <div class="subsection">
              <button
                class="rec-toggle-header"
                on:click={() => toggleRecommendations(discipline.name)}
              >
                <span>Possible Recommendation Text ({discipline.name})</span>
                <span class="rec-toggle-arrow">{recommendationTogglesOpen[discipline.name] ? '▲' : '▼'}</span>
              </button>
              {#if recommendationTogglesOpen[discipline.name]}
                <div style="margin-top: 0.75rem;">
                  {#if getAggregatedRecommendations(discipline).length > 0}
                    <ul class="recommendations-list">
                      {#each getAggregatedRecommendations(discipline) as recommendation}
                        <li>{recommendation}</li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="no-recommendations">No specific recommendations for this discipline.</p>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- FLOOD SECTION (frontend-only form) -->
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

          <div class="flood-form disabled-form">
            <div class="edit-hint-banner">Edit flood data in Report Editor tab</div>
            <!-- Site over 1ha -->
            <div class="flood-field">
              <label class="flood-label disabled-label">Is the site over 1 hectare?</label>
              <div class="flood-radio-group">
                <label class="flood-radio-label disabled-label">
                  <input type="radio" bind:group={siteOver1ha} value="yes" disabled /> Yes
                </label>
                <label class="flood-radio-label disabled-label">
                  <input type="radio" bind:group={siteOver1ha} value="no" disabled /> No
                </label>
              </div>
            </div>

            <!-- Flood Zones -->
            <div class="flood-field">
              <label class="flood-label disabled-label">Flood Zones Present</label>
              <div class="flood-zones-grid">
                <div class="flood-zone-row">
                  <label class="flood-checkbox-label disabled-label">
                    <input type="checkbox" bind:checked={floodZones.zone1} disabled />
                    Zone 1
                  </label>
                  {#if floodZones.zone1}
                    <div class="flood-coverage-input">
                      <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" value={floodZoneCoverage.zone1} class="flood-percent disabled-input" disabled />
                      <span class="flood-percent-sign">approx. % coverage</span>
                    </div>
                  {/if}
                </div>
                <div class="flood-zone-row">
                  <label class="flood-checkbox-label disabled-label">
                    <input type="checkbox" bind:checked={floodZones.zone2} disabled />
                    Zone 2
                  </label>
                  {#if floodZones.zone2}
                    <div class="flood-coverage-input">
                      <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" value={floodZoneCoverage.zone2} class="flood-percent disabled-input" disabled />
                      <span class="flood-percent-sign">approx. % coverage</span>
                    </div>
                  {/if}
                </div>
                <div class="flood-zone-row">
                  <label class="flood-checkbox-label disabled-label">
                    <input type="checkbox" bind:checked={floodZones.zone3} disabled />
                    Zone 3
                  </label>
                  {#if floodZones.zone3}
                    <div class="flood-coverage-input">
                      <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="%" value={floodZoneCoverage.zone3} class="flood-percent disabled-input" disabled />
                      <span class="flood-percent-sign">approx. % coverage</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Surface Water Flooding -->
            <div class="flood-field">
              <label class="flood-label disabled-label">Surface Water Flooding?</label>
              <div class="flood-radio-group">
                <label class="flood-radio-label disabled-label">
                  <input type="radio" bind:group={surfaceWaterFlooding} value="yes" disabled /> Yes
                </label>
                <label class="flood-radio-label disabled-label">
                  <input type="radio" bind:group={surfaceWaterFlooding} value="no" disabled /> No
                </label>
              </div>
            </div>

            <!-- Risk Level -->
            <div class="flood-field">
              <label class="flood-label disabled-label" for="flood-risk-level">Overall Flood Risk Level</label>
              <select
                id="flood-risk-level"
                class="flood-select disabled-input"
                value={floodRiskLevel}
                disabled
              >
                <option value="">-- Not Set --</option>
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
        </div>

        <!-- AVIATION SECTION (frontend-only form) -->
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
            Aviation data is recorded via satellite imagery review.
          </div>

          <div class="flood-form disabled-form">
            <div class="edit-hint-banner">Edit aviation data in Report Editor tab</div>
            <div class="flood-field">
              <label class="flood-label disabled-label">Aerodromes within 500m</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value={aerodromeCounts.within500m} class="flood-select aviation-count-input disabled-input" disabled />
            </div>
            <div class="flood-field">
              <label class="flood-label disabled-label">Aerodromes within 500m – 1km</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value={aerodromeCounts.within500mTo1km} class="flood-select aviation-count-input disabled-input" disabled />
            </div>
            <div class="flood-field">
              <label class="flood-label disabled-label">Aerodromes within 1 – 5km</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value={aerodromeCounts.within1to5km} class="flood-select aviation-count-input disabled-input" disabled />
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
        </div>

        <!-- HIGHWAYS SECTION (frontend-only form) -->
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

          <div class="flood-form disabled-form">
            <div class="flood-field">
              <label class="flood-label disabled-label" for="highways-risk-level">Overall Highways Risk Level</label>
              <select
                id="highways-risk-level"
                class="flood-select disabled-input"
                value={highwaysRiskLevel}
                disabled
              >
                <option value="">-- Not Set --</option>
                <option value="low_risk">Low Risk</option>
                <option value="medium_low_risk">Medium-Low Risk</option>
                <option value="medium_risk">Medium Risk</option>
                <option value="medium_high_risk">Medium-High Risk</option>
                <option value="high_risk">High Risk</option>
                <option value="extremely_high_risk">Extremely High Risk</option>
                <option value="showstopper">Showstopper</option>
              </select>
              <span class="edit-hint">Edit in Report Editor tab</span>
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
        </div>

        <!-- AMENITY SECTION -->
        <RiskLevelSection
          name="Amenity"
          bind:riskLevel={amenityRiskLevel}
          guidance={DISCIPLINE_GUIDANCE['Amenity']}
          disabled={true}
        />

        <!-- Report Metadata -->
        {#if report?.metadata}
          <div class="report-section">
            <h3>Report Information</h3>
            <div class="metadata">
              <p><strong>Generated:</strong> {new Date(report.metadata.generatedAt).toLocaleString()}</p>
              <p><strong>Rules Processed:</strong> {report.metadata.totalRulesProcessed}</p>
              <p><strong>Rules Triggered:</strong> {report.metadata.rulesTriggered}</p>
              <p><strong>Rules Version:</strong> {report.metadata.rulesVersion}</p>
            </div>
          </div>
        {/if}

      {:else}
        <div class="report-placeholder">
          <h3>⚠️ No Analysis Data</h3>
          <p>Please run an analysis first to generate a report.</p>
        </div>
      {/if}
  </div>
</div>

<!-- Risk Change Reason Modal -->
<RiskChangeReasonModal
  isOpen={showRiskChangeModal}
  discipline={pendingRiskChange?.discipline || ''}
  fieldName={pendingRiskChange?.fieldName || 'Risk Level'}
  oldValue={pendingRiskChange?.oldValue || ''}
  newValue={pendingRiskChange?.newValue || ''}
  on:confirm={handleRiskChangeConfirm}
  on:cancel={handleRiskChangeCancel}
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


  .report-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    height: 0; /* Force flex item to shrink */
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

  /* New structured report styles */
  .subsection {
    margin-bottom: 1.5rem;
  }

  .subsection h4 {
    margin-bottom: 0.75rem;
    color: #4b5563;
    font-size: 1rem;
    font-weight: 600;
  }

  .summary-disclaimer {
    background: #f3f4f6;
    border-left: 4px solid #6b7280;
    border-radius: 6px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #374151;
  }

  .summary-disclaimer p {
    margin: 0 0 0.75rem 0;
  }

  .summary-disclaimer p:last-child {
    margin-bottom: 0;
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

  .placeholder {
    font-style: italic;
    color: #6b7280;
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 6px;
    border-left: 4px solid #d1d5db;
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

  .recommendations-list {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }

  .recommendations-list li {
    margin-bottom: 0.5rem;
    color: #374151;
    line-height: 1.5;
  }

  .no-recommendations {
    color: #6b7280;
    font-style: italic;
    text-align: center;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
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

  .action-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 1.5rem 0;
    flex-wrap: wrap;
  }

  .trp-button-container {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }

  .report-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
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

  /* Disabled/read-only styles */
  .disabled-form {
    opacity: 0.85;
  }

  .disabled-input {
    background: #f3f4f6 !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    border-color: #e5e7eb !important;
  }

  .disabled-label {
    color: #6b7280 !important;
  }

  .edit-hint {
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .edit-hint-banner {
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.8rem;
    color: #1e40af;
    border-radius: 0 4px 4px 0;
  }

  input:disabled,
  select:disabled {
    cursor: not-allowed;
  }

  input[type="radio"]:disabled + span,
  input[type="checkbox"]:disabled + span {
    color: #9ca3af;
  }

  /* Responsive adjustments for modal positioning */
  @media (max-width: 1024px) {
    .report-modal-backdrop {
      width: 45%;
    }
  }

  @media (max-width: 768px) {
    .report-modal-backdrop {
      width: 100%;
    }
  }
</style>
