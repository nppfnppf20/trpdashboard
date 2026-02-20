<script lang="ts">
  import { buildCombinedReport } from '$lib/services/reportGenerator.js';

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

  // Generate combined report when data changes
  $: report = (() => {
    try {
      if (heritageData || landscapeData || renewablesData || ecologyData || agLandData) {
        console.log('🔄 Building combined report with:', { heritageData: !!heritageData, landscapeData: !!landscapeData, renewablesData: !!renewablesData, ecologyData: !!ecologyData, agLandData: !!agLandData });
        const result = buildCombinedReport(heritageData, landscapeData, renewablesData, ecologyData, agLandData);
        console.log('✅ Report built successfully:', result);
        return result;
      }
      return null;
    } catch (error) {
      console.error('❌ Error building report:', error);
      console.error('Data that caused error:', { heritageData, landscapeData, renewablesData, ecologyData, agLandData });
      return null;
    }
  })();

  // Use the new structured data
  $: structuredReport = report?.structuredReport;
  $: summaryData = structuredReport?.summary;
  $: disciplines = structuredReport?.disciplines || [];

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

  /** @param {any} discipline */
  function getAggregatedRecommendations(discipline) {
    console.log('🔍 getAggregatedRecommendations called for:', discipline?.name);
    console.log('🔍 triggeredRules:', discipline?.triggeredRules);

    const allRecommendations = [];

    // Add default recommendations based on whether rules are triggered or not
    if (!discipline?.triggeredRules || discipline.triggeredRules.length === 0) {
      console.log('❌ No triggered rules found - using default no-rules recommendations');
      // Add default recommendations for when NO rules are triggered
      if (discipline?.defaultNoRulesRecommendations && Array.isArray(discipline.defaultNoRulesRecommendations)) {
        allRecommendations.push(...discipline.defaultNoRulesRecommendations);
      }
    } else {
      console.log('✅ Rules triggered - collecting recommendations');
      // Add default recommendations for when ANY rules are triggered
      if (discipline?.defaultTriggeredRecommendations && Array.isArray(discipline.defaultTriggeredRecommendations)) {
        allRecommendations.push(...discipline.defaultTriggeredRecommendations);
      }

      // Collect all recommendations from triggered rules
      discipline.triggeredRules.forEach((rule: any, index: number) => {
        if (rule.recommendation && typeof rule.recommendation === 'string') {
          allRecommendations.push(rule.recommendation);
        }
        if (rule.recommendations && Array.isArray(rule.recommendations)) {
          allRecommendations.push(...rule.recommendations);
        }
      });
    }

    console.log('🔍 All recommendations collected:', allRecommendations);

    // Deduplicate recommendations (case-insensitive)
    const uniqueRecommendations: string[] = [];
    const seen = new Set();

    allRecommendations.forEach(rec => {
      const normalizedRec = rec.toLowerCase().trim();
      if (!seen.has(normalizedRec)) {
        seen.add(normalizedRec);
        uniqueRecommendations.push(rec);
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

  // Toggle state for recommendation sections (keyed by discipline name)
  let recommendationTogglesOpen: Record<string, boolean> = {};

  function toggleRecommendations(disciplineName: string) {
    recommendationTogglesOpen = { ...recommendationTogglesOpen, [disciplineName]: !recommendationTogglesOpen[disciplineName] };
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

    return {
      title: baseType,
      findings: findings,
      highestRisk: sortedRules[0].level,
      allRecommendations: [...new Set(sortedRules.flatMap((r: any) => r.recommendations || []))]
    };
  }
</script>

<div class="report-container">
  <div class="report-header">
    <h2 id="report-title">Planning Constraints Assessment Report</h2>
  </div>

  <div class="report-content">
      {#if structuredReport}
        <!-- 1. SUMMARY SECTION -->
        <div class="report-section">
          <h3>Summary</h3>

          <!-- 1a. Site Summary -->
          <div class="subsection">
            <h4>Site Summary</h4>
            <p class="placeholder">{summaryData?.site}</p>
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

          <!-- 1c. Overall Risk -->
          <div class="subsection">
            <h4>Overall Risk Estimation</h4>
            <p class="placeholder"></p>
          </div>
        </div>

        <!-- 2. DISCIPLINE SECTIONS (Heritage, Landscape, etc.) -->
        {#each disciplines as discipline}
          <div class="report-section discipline-section">
            <h3>{discipline.name}</h3>

            <!-- 2a. Overall Risk for this discipline -->
            <div class="subsection">
              <h4>Predicted {discipline.name} Risk</h4>
              <div class="risk-badge" style="background-color: {discipline.riskSummary?.bgColor}; color: {discipline.riskSummary?.color};">
                <span class="risk-level">{discipline.riskSummary?.label}</span>
                <span class="risk-description">{discipline.riskSummary?.description}</span>
              </div>
            </div>

            <!-- 2b. Triggered Rules -->
            {#if discipline.triggeredRules && discipline.triggeredRules.length > 0}
              <div class="subsection">
                <h4>{discipline.name} Assessment Rules Triggered</h4>
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
                          <p class="rule-findings"><strong>Findings:</strong> {rule.findings}</p>
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
                              {groupedRule.findings}
                            </div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {:else}
              <div class="subsection">
                <h4>{discipline.name} Assessment Rules</h4>
                <p class="no-rules">No {discipline.name.toLowerCase()} risk rules were triggered. Standard development considerations apply.</p>
              </div>
            {/if}

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
  }

  .btn-secondary:hover {
    background: #e5e7eb;
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