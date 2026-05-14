<script>
  import { buildCombinedReport } from '$lib/services/reportGenerator.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import NarrativeBriefingSelector from './NarrativeBriefingSelector.svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
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

  $: disciplinesForGeneration = disciplines.map(d => {
    const details = buildDesignationDetails(d.name);
    return details ? { ...d, designationDetails: details } : d;
  });
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
      </div>
      <div class="toolbar-right">
        {#if $narrativeError}
          <span class="toolbar-error">{$narrativeError}</span>
        {/if}
        {#if hasNarrative}
          <button class="btn-generate" disabled={exportingWord} on:click={handleExportToWord}>
            {#if exportingWord}<span class="spinner-xs"></span> Exporting...{:else}<i class="las la-file-word"></i> Export{/if}
          </button>
        {/if}
        <button
          class="btn-generate"
          on:click={() => generateNarrative(projectId, disciplinesForGeneration)}
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

    <!-- Combined narrative editor -->
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
</style>
