<script>
  import { buildCombinedReport } from '$lib/services/reportGenerator.js';
  import { generateFloodFindings } from '$lib/services/flood/floodFindings.js';
  import { generateAviationFindings } from '$lib/services/aviation/aviationFindings.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import NarrativeBriefingSelector from './NarrativeBriefingSelector.svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { reviewDraftAgainstBrief } from '$lib/api/guidingBriefs.js';
  import { tick } from 'svelte';
  import {
    narrative, narrativeGenerationId, narrativeLoading, narrativeError,
    generateNarrative, loadBriefingNotes, updateNarrative
  } from '$lib/stores/hlpv-narrative.js';

  let editorRef;
  let trackedGenId = 0;

  // When generation completes, push new content into the already-mounted editor
  // (avoids destroying/remounting which collapses layout)
  $: if ($narrativeGenerationId !== trackedGenId) {
    trackedGenId = $narrativeGenerationId;
    if ($narrativeGenerationId > 0) {
      tick().then(() => { if (editorRef) editorRef.setHTML($narrative); });
    }
  }

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
  /** @type {number|null} */
  export let projectId = null;
  /** @type {string|null} */
  export let developmentType = null;
  /** @type {any} */
  export let floodData = null;
  /** @type {any} */
  export let aviationData = null;
  /** @type {any} */
  export let highwaysData = null;
  /** @type {any} */
  export let amenityData = null;

  const HLPV_DEV_TYPES = ['Solar', 'Wind', 'BESS', 'Solar + BESS', 'Other Renewable', 'Urban Site'];

  let devType = developmentType ?? '';
  $: devType = developmentType ?? '';

  let briefChecking = false;
  let briefCheckResults = null;
  let briefCheckError = null;

  async function checkBrief() {
    const html = editorRef?.getHTML();
    if (!html) return;
    briefChecking = true;
    briefCheckResults = null;
    briefCheckError = null;
    try {
      const result = await reviewDraftAgainstBrief({
        draft_html: html,
        document_type: 'hlpv',
        development_type: devType || null
      });
      briefCheckResults = result;
    } catch (e) {
      briefCheckError = e.message || 'Failed to check brief';
    } finally {
      briefChecking = false;
    }
  }

  $: if (projectId) loadBriefingNotes(projectId);

  $: report = (() => {
    try {
      if (heritageData || landscapeData || renewablesData || ecologyData || agLandData || treesData || airfieldsData) {
        return buildCombinedReport(heritageData, landscapeData, renewablesData, ecologyData, agLandData, treesData, airfieldsData);
      }
      return null;
    } catch (e) {
      return null;
    }
  })();

  $: disciplines = report?.structuredReport?.disciplines || [];
  $: disciplinesWithRules = disciplines.filter(d => d.triggeredRules?.length > 0);
  $: hasNarrative = Boolean($narrative);

  /** Format distance in meters to a readable string */
  function fmtDist(dist_m, on_site, isCoverage = false) {
    if (on_site) return isCoverage ? 'intersects site' : 'on-site';
    if (!dist_m && dist_m !== 0) return 'unknown distance';
    return dist_m >= 1000 ? `${(dist_m / 1000).toFixed(1)}km` : `${Math.round(dist_m)}m`;
  }

  /** Extract a feature name from various possible fields */
  function fname(f) {
    return f.name || f.site_name || f.sitename || f.project_name || null;
  }

  function buildDesignationDetails(disciplineName) {
    const lines = [];

    if (disciplineName === 'Heritage') {
      const lb  = heritageData?.listed_buildings || [];
      const ca  = heritageData?.conservation_areas || [];
      const sm  = heritageData?.scheduled_monuments || [];
      const rpg = heritageData?.registered_parks_gardens || [];
      const whs = heritageData?.world_heritage_sites || [];

      if (lb.length)  { lines.push('Listed Buildings:');              lb.forEach(f  => lines.push(`  - ${fname(f) || 'Unnamed'} (Grade ${f.grade}): ${fmtDist(f.dist_m, f.on_site)}`)); }
      if (ca.length)  { lines.push('Conservation Areas:');            ca.forEach(f  => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (sm.length)  { lines.push('Scheduled Monuments:');           sm.forEach(f  => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site)}`)); }
      if (rpg.length) { lines.push('Registered Parks and Gardens:');  rpg.forEach(f => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (whs.length) { lines.push('World Heritage Sites:');          whs.forEach(f => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
    }

    if (disciplineName === 'Landscape') {
      const aonb = landscapeData?.aonb || [];
      const np   = landscapeData?.national_parks || [];
      const gb   = landscapeData?.green_belt || [];

      if (aonb.length) { lines.push('AONBs / National Landscapes:');  aonb.forEach(f => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (np.length)   { lines.push('National Parks:');               np.forEach(f   => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (gb.length)   { lines.push('Green Belt:');                   gb.forEach(f   => lines.push(`  - ${fname(f) || 'Green Belt'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
    }

    if (disciplineName === 'Ecology') {
      const sssi  = ecologyData?.sssi || [];
      const sac   = ecologyData?.sac || [];
      const spa   = ecologyData?.spa || [];
      const ram   = ecologyData?.ramsar || [];
      const nnr   = ecologyData?.national_nature_reserves || [];
      const gcn   = ecologyData?.gcn || [];
      const ponds = ecologyData?.os_priority_ponds || [];
      const dw    = ecologyData?.drinking_water || [];

      if (sssi.length)  { lines.push('SSSIs:');                 sssi.forEach(f  => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (sac.length)   { lines.push('SACs:');                  sac.forEach(f   => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (spa.length)   { lines.push('SPAs:');                  spa.forEach(f   => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (ram.length)   { lines.push('Ramsar Sites:');          ram.forEach(f   => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (nnr.length)   { lines.push('National Nature Reserves:'); nnr.forEach(f => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
      if (gcn.length)   { lines.push(`Great Crested Newt records: ${gcn.length} found`); }
      if (ponds.length) { lines.push(`Priority Ponds: ${ponds.length} found`); }
      if (dw.length)    { lines.push('Drinking Water Safeguard Zones:'); dw.forEach(f => lines.push(`  - ${fname(f) || 'Zone'}: ${fmtDist(f.dist_m, f.on_site, true)}`)); }
    }

    if (disciplineName === 'Agricultural Land') {
      const ag = agLandData?.ag_land || [];
      if (ag.length) {
        lines.push('Agricultural Land parcels:');
        ag.forEach(f => {
          const grade = f.grade ? `Grade ${f.grade}` : 'Unknown grade';
          const cov   = f.percentage_coverage || f.coverage_percent;
          lines.push(`  - ${grade}${cov ? `: ~${Math.round(cov)}% of site` : ''}`);
        });
      }
    }

    if (disciplineName === 'Ancient Woodland') {
      const aw = treesData?.ancient_woodland || [];
      if (aw.length) {
        lines.push('Ancient Woodland areas:');
        aw.forEach(f => lines.push(`  - ${fname(f) || 'Unnamed'}: ${fmtDist(f.dist_m, f.on_site, true)}`));
      }
    }

    if (disciplineName === 'Renewables Development') {
      const rv = renewablesData?.renewables || [];
      if (rv.length) {
        lines.push('Nearby renewable energy developments:');
        rv.forEach(f => {
          const n = fname(f) || 'Unnamed development';
          lines.push(`  - ${n}: ${fmtDist(f.dist_m, f.on_site)}`);
        });
      }
    }

    return lines.join('\n');
  }

  let exportingWord = false;

  async function handleExportToWord() {
    const html = editorRef?.getHTML();
    if (!html) return;
    exportingWord = true;
    try {
      await exportHtmlToWord(html, 'HLPV Narrative', '/basicdocument.docx');
    } finally {
      exportingWord = false;
    }
  }

  // Build user-assessed (frontend-only) discipline objects for narrative generation
  $: frontendDisciplinesForNarrative = (() => {
    const items = [];

    if (floodData?.overallRisk) {
      let details = '';
      if (floodData.editedSummary) {
        try {
          const fs = JSON.parse(floodData.editedSummary);
          details = generateFloodFindings(
            fs.floodZones || {},
            fs.floodZoneCoverage || {},
            fs.siteOver1ha || '',
            fs.surfaceWaterFlooding || ''
          ) || '';
        } catch {}
      }
      items.push({ name: 'Flood', overallRisk: floodData.overallRisk, triggeredRules: [], userAssessed: true, ...(details ? { designationDetails: details } : {}) });
    }

    if (aviationData?.overallRisk) {
      let details = '';
      if (aviationData.editedSummary) {
        try {
          details = generateAviationFindings(JSON.parse(aviationData.editedSummary)) || '';
        } catch {}
      }
      items.push({ name: 'Aviation', overallRisk: aviationData.overallRisk, triggeredRules: [], userAssessed: true, ...(details ? { designationDetails: details } : {}) });
    }

    if (highwaysData?.overallRisk) {
      items.push({ name: 'Highways', overallRisk: highwaysData.overallRisk, triggeredRules: [], userAssessed: true });
    }

    if (amenityData?.overallRisk) {
      items.push({ name: 'Amenity', overallRisk: amenityData.overallRisk, triggeredRules: [], userAssessed: true });
    }

    return items;
  })();

  $: disciplinesForGeneration = [
    ...disciplines.map(d => {
      const details = buildDesignationDetails(d.name);
      return details ? { ...d, designationDetails: details } : d;
    }),
    ...frontendDisciplinesForNarrative
  ];
</script>

<div class="narrative-tab">
  <div class="tab-header">
    <h2>Generate Narrative</h2>
    <p class="tab-desc">Generate a combined professional planning assessment covering all risk disciplines and any additional topics from the briefing note.</p>
  </div>

  {#if disciplinesWithRules.length === 0}
    <div class="empty-state">
      <i class="las la-search"></i>
      <p>No risk rules were triggered for this site — no narrative to generate.</p>
    </div>
  {:else}
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        {#if projectId}
          <NarrativeBriefingSelector />
        {:else}
          <span class="no-project">Select a project above to include briefing note context</span>
        {/if}
        <select class="devtype-select" bind:value={devType} title="Development type — used to select the right guiding brief">
          <option value="">Dev type...</option>
          {#each HLPV_DEV_TYPES as dt}
            <option value={dt}>{dt}</option>
          {/each}
        </select>
      </div>
      <div class="toolbar-right">
        {#if $narrativeError}
          <span class="toolbar-error">{$narrativeError}</span>
        {/if}
        {#if hasNarrative}
          <button class="btn-check-brief" disabled={briefChecking} on:click={checkBrief}>
            {#if briefChecking}<span class="spinner-xs spinner-teal"></span> Checking...{:else}<i class="las la-clipboard-check"></i> Check{/if}
          </button>
          <button class="btn-generate" disabled={exportingWord} on:click={handleExportToWord}>
            {#if exportingWord}<span class="spinner-xs"></span> Exporting...{:else}<i class="las la-file-word"></i> Export{/if}
          </button>
        {/if}
        <button
          class="btn-generate"
          on:click={() => generateNarrative(projectId, disciplinesForGeneration, devType || null)}
          disabled={$narrativeLoading}
        >
          {#if $narrativeLoading}
            <span class="spinner-xs"></span> Generating...
          {:else}
            <i class="las la-robot"></i> {hasNarrative ? 'Regenerate' : 'Generate narrative'}
          {/if}
        </button>
      </div>
    </div>

    <!-- Combined narrative editor + check results share the scrollable area -->
    <div class="editor-wrap">
      {#if hasNarrative}
        <div class="ai-bar">
          <span class="narrative-tag">AI Draft</span>
          <span class="narrative-hint">Edit as needed before use</span>
        </div>
        <RichTextEditor
          bind:this={editorRef}
          content={$narrative}
          fullHeight={true}
          placeholder=""
          on:change={(e) => updateNarrative(e.detail.html)}
        />
      {:else}
        <div class="placeholder">
          <i class="las la-pen-alt"></i>
          Click <strong>Generate narrative</strong> to create a draft assessment covering all risk disciplines{projectId ? ' and any additional topics from the briefing note' : ''}.
        </div>
      {/if}
    </div>

    {#if briefCheckError}
      <div class="brief-check-panel brief-check-error">
        <span><i class="las la-exclamation-circle"></i> {briefCheckError}</span>
        <button class="brief-dismiss" on:click={() => briefCheckError = null}>Dismiss</button>
      </div>
    {/if}

    {#if briefCheckResults}
      <div class="brief-check-panel">
        <div class="brief-check-header">
          <span class="brief-check-title"><i class="las la-clipboard-check"></i> Brief check results</span>
          <button class="brief-dismiss" on:click={() => briefCheckResults = null}>Dismiss</button>
        </div>
        {#if briefCheckResults.no_brief}
          <p class="brief-info">No guiding brief found for this document type. Add one in the admin console under Guiding Briefs.</p>
        {:else if briefCheckResults.no_checklist}
          <p class="brief-info">A guiding brief exists but has no review checklist configured.</p>
        {:else if briefCheckResults.items?.length === 0}
          <p class="brief-info">No checklist items to review.</p>
        {:else}
          <ul class="brief-check-list">
            {#each briefCheckResults.items as item}
              <li class="brief-check-item brief-check-item--{item.status}">
                <div class="brief-item-header">
                  <span class="brief-status-dot"></span>
                  <span class="brief-item-topic">{item.topic}</span>
                  <span class="brief-item-badge">{item.status}</span>
                </div>
                {#if item.suggestion}
                  <p class="brief-item-suggestion">{item.suggestion}</p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .narrative-tab {
    background: white;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .tab-header {
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .tab-header h2 {
    margin: 0 0 0.375rem;
    color: #1f2937;
    font-size: 1.5rem;
  }

  .tab-desc {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    color: #9ca3af;
    text-align: center;
  }

  .empty-state i {
    font-size: 2rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-shrink: 0;
  }

  .no-project {
    font-size: 0.8rem;
    color: #94a3b8;
    font-style: italic;
  }

  .devtype-select {
    padding: 0.375rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    font-size: 0.8rem;
    color: #374151;
    background: white;
    cursor: pointer;
    font-family: inherit;
  }

  .devtype-select:focus {
    outline: none;
    border-color: #0d9488;
  }

  .toolbar-error {
    font-size: 0.78rem;
    color: #dc2626;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-generate {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-generate:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn-generate:disabled {
    background: #a5b4fc;
    cursor: not-allowed;
  }

  .btn-generate i {
    font-size: 1rem;
  }

  .spinner-xs {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .editor-wrap {
    padding: 1.5rem;
    flex: 1;
  }

  .ai-bar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0.75rem;
    background: #eef2ff;
    border: 1px solid #e0e7ff;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
  }

  .narrative-tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4f46e5;
  }

  .narrative-hint {
    font-size: 0.72rem;
    color: #818cf8;
  }

  /* Remove top border-radius from editor when ai-bar sits above it */
  .ai-bar + :global(.rich-text-editor) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  .placeholder {
    padding: 1rem 1.25rem;
    background: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .placeholder i {
    font-size: 1rem;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .btn-check-brief {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #0d9488;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .btn-check-brief:hover:not(:disabled) {
    background: #0f766e;
  }

  .btn-check-brief:disabled {
    background: #5eead4;
    cursor: not-allowed;
  }

  .btn-check-brief i {
    font-size: 1rem;
  }

  .spinner-teal {
    border-color: rgba(255, 255, 255, 0.35);
    border-top-color: white;
  }

  .brief-check-panel {
    margin: 0 1.5rem 1.5rem;
    border: 1px solid #d1fae5;
    border-radius: 8px;
    background: #f0fdfa;
    padding: 1rem 1.125rem;
    flex-shrink: 0;
  }

  .brief-check-panel.brief-check-error {
    background: #fef2f2;
    border-color: #fecaca;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .brief-check-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .brief-check-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f766e;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .brief-dismiss {
    background: none;
    border: none;
    font-size: 0.8rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: inherit;
  }

  .brief-dismiss:hover {
    background: #e5e7eb;
  }

  .brief-info {
    margin: 0;
    font-size: 0.875rem;
    color: #4b5563;
  }

  .brief-check-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .brief-check-item {
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    border-left: 3px solid transparent;
  }

  .brief-check-item--present {
    background: #f0fdf4;
    border-left-color: #16a34a;
  }

  .brief-check-item--partial {
    background: #fffbeb;
    border-left-color: #d97706;
  }

  .brief-check-item--missing {
    background: #fef2f2;
    border-left-color: #dc2626;
  }

  .brief-item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .brief-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .brief-check-item--present .brief-status-dot { background: #16a34a; }
  .brief-check-item--partial .brief-status-dot { background: #d97706; }
  .brief-check-item--missing .brief-status-dot { background: #dc2626; }

  .brief-item-topic {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
  }

  .brief-item-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .brief-check-item--present .brief-item-badge { background: #dcfce7; color: #16a34a; }
  .brief-check-item--partial .brief-item-badge { background: #fef9c3; color: #92400e; }
  .brief-check-item--missing .brief-item-badge { background: #fee2e2; color: #dc2626; }

  .brief-item-suggestion {
    margin: 0.25rem 0 0 1.25rem;
    font-size: 0.8rem;
    color: #4b5563;
    line-height: 1.4;
  }
</style>
